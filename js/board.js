// ═══════════════════════════════════════════════════════════════════
//  board.js — Board & Column CRUD
//  Kein alert/confirm/prompt — nutzt showConfirm/showPrompt aus modals.js
//  Abhängigkeiten: state.js, ui.js, modals.js
// ═══════════════════════════════════════════════════════════════════

// ── Board Switcher ──────────────────────────────────────────────────
function renderBoardSelect() {
    const sel = document.getElementById('boardSelect');
    if (!sel) return;
    sel.innerHTML = '';
    state.boards.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.name;
        if (b.id === state.activeBoardId) opt.selected = true;
        sel.appendChild(opt);
    });
}

function switchBoard(id) {
    state.activeBoardId = id;
    saveState(state);
    renderAll();
}

async function addBoard() {
    const name = await showPrompt('Name des neuen Boards:', '', 'Erstellen');
    if (!name) return;
    const b = createBoard(name);
    state.boards.push(b);
    state.activeBoardId = b.id;
    saveState(state);
    renderAll();
    showToast(`📋 Board "${name}" erstellt`);
}

async function renameBoard() {
    const b = activeBoard();
    const name = await showPrompt('Board umbenennen:', b.name, 'Umbenennen');
    if (!name) return;
    b.name = name;
    saveState(state);
    renderBoardSelect();
    showToast(`✏️ Board umbenannt zu "${name}"`);
}

async function deleteBoard() {
    if (state.boards.length === 1) {
        showToast('❌ Das letzte Board kann nicht gelöscht werden.');
        return;
    }
    const b = activeBoard();
    const confirmed = await showConfirm(
        `Board "${b.name}" und alle Issues wirklich löschen?`,
        'Löschen',
        true
    );
    if (!confirmed) return;
    state.boards = state.boards.filter(x => x.id !== b.id);
    state.activeBoardId = state.boards[0].id;
    saveState(state);
    renderAll();
    showToast(`🗑️ Board "${b.name}" gelöscht`);
}

// ── Column CRUD ────────────────────────────────────────────────────
let pendingColColorTarget = null;

async function addColumn() {
    const name = await showPrompt('Name der neuen Spalte:', '', 'Hinzufügen');
    if (!name) return;
    activeBoard().columns.push({ id: generateColId(), label: name, color: null });
    saveState(state);
    renderAll();
    showToast(`🗳️ Spalte "${name}" hinzugefügt`);
}

async function renameColumn(colId) {
    const col = activeBoard().columns.find(c => c.id === colId);
    if (!col) return;
    const name = await showPrompt('Spalte umbenennen:', col.label, 'Umbenennen');
    if (!name) return;
    col.label = name;
    saveState(state);
    // Nur den Header updaten, kein komplettes Re-Render nötig
    const h2 = document.querySelector(`[data-col="${colId}"] h2`);
    if (h2) h2.textContent = name;
    buildStatusOptions();
    showToast(`✏️ Spalte umbenannt zu "${name}"`);
}

async function deleteColumn(colId) {
    const board = activeBoard();
    if (board.columns.length <= 1) {
        showToast('❌ Mindestens eine Spalte muss übrig bleiben.');
        return;
    }
    const col      = board.columns.find(c => c.id === colId);
    const affected = board.issues.filter(i => i.status === colId);
    const remaining = board.columns.filter(c => c.id !== colId);

    if (affected.length > 0) {
        // Issues vorhanden — Ziel-Spalte per Prompt abfragen
        const opts = remaining.map((c, i) => `${i + 1}: ${c.label}`).join('\n');
        const answer = await showPrompt(
            `Die Spalte „${col.label}“ enthält ${affected.length} Issue(s).\n\nWohin verschieben?\n${opts}\n\n(Nummer eingeben, oder leer lassen zum Löschen)`,
            '1',
            'Bestätigen'
        );
        if (answer === null) return;
        const idx = parseInt(answer, 10) - 1;
        if (!isNaN(idx) && remaining[idx]) {
            affected.forEach(i => { i.status = remaining[idx].id; });
        } else {
            board.issues = board.issues.filter(i => i.status !== colId);
        }
    } else {
        const confirmed = await showConfirm(`Spalte „${col.label}“ löschen?`, 'Löschen', true);
        if (!confirmed) return;
    }

    board.columns = remaining;
    saveState(state);
    renderAll();
    showToast(`🗑️ Spalte "${col.label}" gelöscht`);
}

function openColColorPicker(colId) {
    pendingColColorTarget = colId;
    const col = activeBoard().columns.find(c => c.id === colId);
    const picker = document.getElementById('colColorInput');
    picker.value = (col && col.color) || '#6c63ff';
    picker.click();
}

function applyColumnColors() {
    activeBoard().columns.forEach(col => {
        const el = document.getElementById(col.id);
        if (!el) return;
        if (col.color) {
            el.style.background = col.color + '22';
            el.style.borderTop  = `3px solid ${col.color}`;
        } else {
            el.style.background = '';
            el.style.borderTop  = '';
        }
    });
}

// ── Issue CRUD ─────────────────────────────────────────────────────
let newIssueLabels = [];

function addIssue() {
    const titleInput    = document.getElementById('taskInput');
    const descInput     = document.getElementById('descriptionInput');
    const linksInput    = document.getElementById('linksInput');
    const priorityInput = document.getElementById('priorityInput');
    const colorInput    = document.getElementById('colorInput');
    const dueDateInput  = document.getElementById('dueDateInput');
    const title = titleInput.value.trim();
    if (!title) { titleInput.focus(); return; }
    const firstCol = activeBoard().columns[0];
    activeBoard().issues.push({
        id:          generateId(),
        title,
        description: descInput.value.trim(),
        links:       parseLinks(linksInput.value),
        priority:    priorityInput.value,
        status:      firstCol.id,
        color:       colorInput.value,
        dueDate:     dueDateInput.value || null,
        labels:      [...newIssueLabels],
        sortOrder:   activeBoard().issues.filter(i => i.status === firstCol.id).length
    });
    // Formular zurücksetzen
    titleInput.value = '';
    descInput.value  = '';
    linksInput.value = '';
    priorityInput.value = '2';
    colorInput.value    = '#6c63ff';
    dueDateInput.value  = '';
    newIssueLabels = [];
    renderNewIssueLabelChips();
    rebuildLabelDropdowns();
    titleInput.focus();
    saveState(state);
    renderIssues();
    rebuildLabelFilter();
    showToast('✅ Issue erstellt');
}

function deleteIssue(id) {
    // Soft-Delete mit Undo-Toast
    const board = activeBoard();
    const issue = board.issues.find(i => i.id === id);
    if (!issue) return;
    const snapshot = { ...issue };
    board.issues = board.issues.filter(i => i.id !== id);
    saveState(state);
    renderIssues();

    let undone = false;
    showToast(`🗑️ Issue gelöscht — <button id="undoDeleteBtn" style="background:none;border:none;color:inherit;text-decoration:underline;cursor:pointer;font:inherit;padding:0">↩ Rükgängig</button>`, 5000);
    setTimeout(() => {
        const btn = document.getElementById('undoDeleteBtn');
        if (btn && !undone) btn.addEventListener('click', () => {
            undone = true;
            activeBoard().issues.push(snapshot);
            saveState(state);
            renderIssues();
            showToast('↩ Issue wiederhergestellt');
        });
    }, 50);
}

function renderNewIssueLabelChips() {
    renderLabelChips(newIssueLabels, document.getElementById('newIssueLabelChips'), lbl => {
        newIssueLabels = newIssueLabels.filter(x => x !== lbl);
        renderNewIssueLabelChips();
        rebuildLabelDropdowns();
    });
}

function addNewIssueLabel(raw) {
    const lbl = raw.trim().toLowerCase().replace(/\s+/g, '-');
    if (!lbl || newIssueLabels.includes(lbl)) return;
    const board = activeBoard();
    if (!board.globalLabels) board.globalLabels = [];
    if (!board.globalLabels.includes(lbl)) { board.globalLabels.push(lbl); saveState(state); }
    newIssueLabels.push(lbl);
    renderNewIssueLabelChips();
    rebuildLabelDropdowns();
}

function rebuildLabelFilter() {
    const sel = document.getElementById('filterLabel');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">Alle Labels</option>';
    getAllLabels(activeBoard()).forEach(l => {
        const opt = document.createElement('option');
        opt.value = l;
        opt.textContent = l;
        sel.appendChild(opt);
    });
    if (cur) sel.value = cur;
}
