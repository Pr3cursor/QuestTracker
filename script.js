// ═══════════════════════════════════════════════════════════════════
//  QuestTracker — State
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_COLUMNS = [
    { id: 'col-open',   label: 'Open',   color: null },
    { id: 'col-doing',  label: 'Doing',  color: null },
    { id: 'col-review', label: 'Review', color: null },
    { id: 'col-done',   label: 'Done',   color: null }
];

function createBoard(name) {
    return {
        id: 'board-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,5),
        name,
        columns: JSON.parse(JSON.stringify(DEFAULT_COLUMNS)),
        issues: [],
        globalLabels: []   // board-level label definitions
    };
}

function loadState() {
    const raw = localStorage.getItem('qt-boards');
    if (raw) {
        try {
            const data = JSON.parse(raw);
            if (data.boards && data.boards.length > 0) {
                data.boards.forEach(b => { if (!b.globalLabels) b.globalLabels = []; });
                return data;
            }
        } catch {}
    }
    const oldIssues    = JSON.parse(localStorage.getItem('scrum-issues')    || '[]');
    const oldColColors = JSON.parse(localStorage.getItem('scrum-col-colors') || '{}');
    const colMap = { open: 'col-open', doing: 'col-doing', review: 'col-review', done: 'col-done' };
    const defaultBoard = createBoard('Main Board');
    defaultBoard.columns.forEach(col => {
        const oldKey = Object.keys(colMap).find(k => colMap[k] === col.id);
        if (oldKey && oldColColors[oldKey]) col.color = oldColColors[oldKey];
    });
    defaultBoard.issues = oldIssues.map(iss => ({
        ...iss,
        id:     iss.id    || generateId(),
        color:  iss.color || '#6c63ff',
        status: colMap[iss.status] || 'col-open',
        labels: iss.labels || [],
        dueDate: iss.dueDate || null
    }));
    const s = { activeBoardId: defaultBoard.id, boards: [defaultBoard] };
    saveState(s);
    return s;
}

function saveState(s) { localStorage.setItem('qt-boards', JSON.stringify(s)); }

let state = loadState();
function activeBoard() {
    return state.boards.find(b => b.id === state.activeBoardId) || state.boards[0];
}

let filterSearch   = '';
let filterPriority = '';
let filterLabel    = '';
let newIssueLabels = [];

// ═══════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════
function generateId() {
    return 'QST-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,5).toUpperCase();
}
function generateColId() {
    return 'col-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,4);
}
function normalizeUrl(url) {
    const t = url.trim();
    if (!t) return null;
    const n = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    try { new URL(n); return n; } catch { return null; }
}
function parseLinks(raw) { return raw.split('\n').map(normalizeUrl).filter(Boolean); }
function hexToRgb(hex) {
    return [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)).join(',');
}
function formatDate(iso) {
    if (!iso) return null;
    const [y,m,d] = iso.split('-');
    return `${d}.${m}.${y}`;
}
function isOverdue(iso) {
    if (!iso) return false;
    return new Date(iso) < new Date(new Date().toDateString());
}
function isDueSoon(iso) {
    if (!iso) return false;
    const diff = new Date(iso) - new Date(new Date().toDateString());
    return diff >= 0 && diff <= 2 * 86400000;
}

// ═══════════════════════════════════════════════════════════════════
//  Toast
// ═══════════════════════════════════════════════════════════════════
let toastTimer = null;
function showToast(msg, duration = 3000) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), duration);
}

// ═══════════════════════════════════════════════════════════════════
//  Theme
// ═══════════════════════════════════════════════════════════════════
function initTheme() {
    const saved = localStorage.getItem('scrum-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('scrum-theme', theme);
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}
function toggleTheme() {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}

// ═══════════════════════════════════════════════════════════════════
//  Global Label Manager
// ═══════════════════════════════════════════════════════════════════
const LABEL_PALETTE = [
    '#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c',
    '#3498db','#9b59b6','#e91e63','#00bcd4','#8bc34a'
];
function labelColor(text) {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
    return LABEL_PALETTE[h % LABEL_PALETTE.length];
}

// Returns merged list: globalLabels + any orphan issue-labels
function getAllLabels() {
    const board = activeBoard();
    const global = board.globalLabels || [];
    const fromIssues = new Set();
    board.issues.forEach(i => (i.labels || []).forEach(l => fromIssues.add(l)));
    const merged = [...global];
    fromIssues.forEach(l => { if (!merged.includes(l)) merged.push(l); });
    return merged.sort();
}

// ── Label Manager Modal ────────────────────────────────────────────
function buildLabelManagerModal() {
    if (document.getElementById('labelManagerOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'labelManagerOverlay';
    overlay.className = 'modal-overlay hidden';
    overlay.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="labelManagerTitle" style="max-width:420px">
            <div class="modal-header">
                <h2 id="labelManagerTitle">🏷️ Label-Manager</h2>
                <button type="button" class="icon-btn" id="closeLabelManagerBtn" aria-label="Schließen">✕</button>
            </div>
            <div class="modal-body">
                <div class="lm-create-row">
                    <input type="text" id="lmNewLabelInput" placeholder="Neues Label..." style="flex:1">
                    <button type="button" class="primary-btn lm-add-btn" id="lmAddBtn">+ Hinzufügen</button>
                </div>
                <div id="lmLabelList" class="lm-label-list"></div>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeLabelManager(); });
    document.getElementById('closeLabelManagerBtn').addEventListener('click', closeLabelManager);
    document.getElementById('lmAddBtn').addEventListener('click', lmAddLabel);
    document.getElementById('lmNewLabelInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); lmAddLabel(); }
    });
}

function openLabelManager() {
    buildLabelManagerModal();
    renderLabelManagerList();
    document.getElementById('labelManagerOverlay').classList.remove('hidden');
    document.body.classList.add('modal-open');
    document.getElementById('lmNewLabelInput').focus();
}
function closeLabelManager() {
    document.getElementById('labelManagerOverlay').classList.add('hidden');
    document.body.classList.remove('modal-open');
    rebuildLabelDropdowns();
    rebuildLabelFilter();
}

function lmAddLabel() {
    const input = document.getElementById('lmNewLabelInput');
    const raw = input.value.trim().toLowerCase().replace(/\s+/g, '-');
    if (!raw) return;
    const board = activeBoard();
    if (!board.globalLabels) board.globalLabels = [];
    if (board.globalLabels.includes(raw)) { showToast('Label existiert bereits.'); return; }
    board.globalLabels.push(raw);
    saveState(state);
    input.value = '';
    input.focus();
    renderLabelManagerList();
    showToast(`🏷️ Label "${raw}" erstellt`);
}

function lmDeleteLabel(lbl) {
    const board = activeBoard();
    board.globalLabels = (board.globalLabels || []).filter(l => l !== lbl);
    board.issues.forEach(i => { i.labels = (i.labels || []).filter(l => l !== lbl); });
    saveState(state);
    renderLabelManagerList();
    renderIssues();
    rebuildLabelFilter();
    showToast(`🗑️ Label "${lbl}" gelöscht`);
}

function renderLabelManagerList() {
    const list = document.getElementById('lmLabelList');
    if (!list) return;
    const labels = getAllLabels();
    if (labels.length === 0) {
        list.innerHTML = '<p class="lm-empty">Noch keine Labels. Erstelle dein erstes!</p>';
        return;
    }
    list.innerHTML = '';
    labels.forEach(lbl => {
        const row = document.createElement('div');
        row.className = 'lm-label-row';
        const chip = document.createElement('span');
        chip.className = 'label-chip';
        chip.style.background = labelColor(lbl) + '22';
        chip.style.color = labelColor(lbl);
        chip.style.borderColor = labelColor(lbl) + '55';
        chip.textContent = lbl;
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'lm-delete-btn';
        delBtn.innerHTML = '🗑️';
        delBtn.title = `Label "${lbl}" löschen`;
        delBtn.addEventListener('click', () => lmDeleteLabel(lbl));
        row.append(chip, delBtn);
        list.appendChild(row);
    });
}

// ── Label Dropdown (in forms) ──────────────────────────────────────
function buildLabelDropdown(selectId, activeLabels, onToggle) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="">+ Label auswählen...</option>';
    getAllLabels().forEach(lbl => {
        const opt = document.createElement('option');
        opt.value = lbl;
        opt.textContent = (activeLabels.includes(lbl) ? '✓ ' : '') + lbl;
        sel.appendChild(opt);
    });
    sel.onchange = () => {
        const val = sel.value;
        if (!val) return;
        onToggle(val);
        sel.value = '';
    };
}

function rebuildLabelDropdowns() {
    buildLabelDropdown('newIssueLabelSelect', newIssueLabels, lbl => {
        newIssueLabels = newIssueLabels.includes(lbl)
            ? newIssueLabels.filter(x => x !== lbl)
            : [...newIssueLabels, lbl];
        renderNewIssueLabelChips();
        rebuildLabelDropdowns();
    });
    buildLabelDropdown('editLabelSelect', editModalLabels, lbl => {
        editModalLabels = editModalLabels.includes(lbl)
            ? editModalLabels.filter(x => x !== lbl)
            : [...editModalLabels, lbl];
        refreshEditLabelChips();
        rebuildLabelDropdowns();
    });
}

// ── Render label chips helpers ─────────────────────────────────────
function renderLabelChips(labels, container, onRemove) {
    container.innerHTML = '';
    labels.forEach(lbl => {
        const chip = document.createElement('span');
        chip.className = 'label-chip';
        chip.style.background = labelColor(lbl) + '22';
        chip.style.color = labelColor(lbl);
        chip.style.borderColor = labelColor(lbl) + '55';
        chip.textContent = lbl;
        if (onRemove) {
            const x = document.createElement('button');
            x.type = 'button';
            x.className = 'label-chip-remove';
            x.textContent = '×';
            x.addEventListener('click', () => onRemove(lbl));
            chip.appendChild(x);
        }
        container.appendChild(chip);
    });
}

function renderNewIssueLabelChips() {
    renderLabelChips(newIssueLabels, document.getElementById('newIssueLabelChips'), lbl => {
        newIssueLabels = newIssueLabels.filter(x => x !== lbl);
        renderNewIssueLabelChips();
        rebuildLabelDropdowns();
    });
}

function rebuildLabelFilter() {
    const sel = document.getElementById('filterLabel');
    const cur = sel.value;
    sel.innerHTML = '<option value="">Alle Labels</option>';
    getAllLabels().forEach(l => {
        const opt = document.createElement('option');
        opt.value = l; opt.textContent = l;
        sel.appendChild(opt);
    });
    if (cur) sel.value = cur;
}

// Legacy: add label by typing + Enter in new-issue form
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

// ═══════════════════════════════════════════════════════════════════
//  Board Switcher
// ═══════════════════════════════════════════════════════════════════
function renderBoardSelect() {
    const sel = document.getElementById('boardSelect');
    sel.innerHTML = '';
    state.boards.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id; opt.textContent = b.name;
        if (b.id === state.activeBoardId) opt.selected = true;
        sel.appendChild(opt);
    });
}
function switchBoard(id) { state.activeBoardId = id; saveState(state); renderAll(); }
function addBoard() {
    const name = prompt('Name des neuen Boards:');
    if (!name || !name.trim()) return;
    const b = createBoard(name.trim());
    state.boards.push(b); state.activeBoardId = b.id;
    saveState(state); renderAll();
}
function renameBoard() {
    const b = activeBoard();
    const name = prompt('Board umbenennen:', b.name);
    if (!name || !name.trim()) return;
    b.name = name.trim(); saveState(state); renderBoardSelect();
}
function deleteBoard() {
    if (state.boards.length === 1) { alert('Das letzte Board kann nicht gelöscht werden.'); return; }
    const b = activeBoard();
    if (!confirm(`Board "${b.name}" wirklich löschen?`)) return;
    state.boards = state.boards.filter(x => x.id !== b.id);
    state.activeBoardId = state.boards[0].id;
    saveState(state); renderAll();
}

// ═══════════════════════════════════════════════════════════════════
//  Export / Import
// ═══════════════════════════════════════════════════════════════════
function exportState() {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const date = new Date().toISOString().slice(0,10);
    a.href = url; a.download = `questtracker-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📥 Board exportiert!');
}

function importState(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.boards || !Array.isArray(data.boards)) throw new Error();
            if (!confirm(`Import wird den aktuellen Stand überschreiben. Fortfahren?`)) return;
            data.boards.forEach(b => { if (!b.globalLabels) b.globalLabels = []; });
            state = data;
            saveState(state);
            renderAll();
            showToast('📤 Board importiert!');
        } catch {
            alert('Ungültige Datei. Bitte eine gültige QuestTracker-JSON wählen.');
        }
    };
    reader.readAsText(file);
}

// ═══════════════════════════════════════════════════════════════════
//  Column CRUD + Reorder
// ═══════════════════════════════════════════════════════════════════
function addColumn() {
    const name = prompt('Name der neuen Spalte:');
    if (!name || !name.trim()) return;
    activeBoard().columns.push({ id: generateColId(), label: name.trim(), color: null });
    saveState(state); renderAll();
}
function deleteColumn(colId) {
    const board = activeBoard();
    if (board.columns.length <= 1) { alert('Mindestens eine Spalte muss übrig bleiben.'); return; }
    const col      = board.columns.find(c => c.id === colId);
    const affected = board.issues.filter(i => i.status === colId);
    const remaining = board.columns.filter(c => c.id !== colId);
    if (affected.length > 0) {
        const opts   = remaining.map((c,i) => `${i+1}: ${c.label}`).join('\n');
        const answer = prompt(`Die Spalte „${col.label}" enthält ${affected.length} Issue(s).\n\nWohin verschieben?\n${opts}\n\nNummer — oder leer für löschen:`, '1');
        if (answer === null) return;
        const idx = parseInt(answer, 10) - 1;
        if (!isNaN(idx) && remaining[idx]) affected.forEach(i => { i.status = remaining[idx].id; });
        else board.issues = board.issues.filter(i => i.status !== colId);
    } else {
        if (!confirm(`Spalte „${col.label}" löschen?`)) return;
    }
    board.columns = remaining;
    saveState(state); renderAll();
}
function renameColumn(colId) {
    const col = activeBoard().columns.find(c => c.id === colId);
    if (!col) return;
    const name = prompt('Spalte umbenennen:', col.label);
    if (!name || !name.trim()) return;
    col.label = name.trim(); saveState(state);
    const h2 = document.querySelector(`[data-col="${colId}"] h2`);
    if (h2) h2.textContent = col.label;
    buildStatusOptions();
}

let pendingColColorTarget = null;
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
        if (col.color) { el.style.background = col.color + '22'; el.style.borderTop = `3px solid ${col.color}`; }
        else           { el.style.background = ''; el.style.borderTop = ''; }
    });
}

// ═══════════════════════════════════════════════════════════════════
//  Build Board DOM + SortableJS
// ═══════════════════════════════════════════════════════════════════
function buildBoardDOM() {
    const container = document.getElementById('boardContainer');
    container.innerHTML = '';

    activeBoard().columns.forEach(col => {
        const colEl = document.createElement('div');
        colEl.className = 'column'; colEl.id = col.id;

        const header = document.createElement('div');
        header.className = 'column-header'; header.dataset.col = col.id;

        const dragHandle = document.createElement('span');
        dragHandle.className = 'col-drag-handle';
        dragHandle.innerHTML = '&#8942;&#8942;';
        dragHandle.title = 'Spalte verschieben';

        const h2 = document.createElement('h2');
        h2.title = 'Doppelklick zum Umbenennen'; h2.style.cursor = 'pointer';
        h2.addEventListener('dblclick', () => renameColumn(col.id));

        const countBadge = document.createElement('span');
        countBadge.className = 'col-count'; countBadge.dataset.colCount = col.id;

        const headerBtns = document.createElement('div');
        headerBtns.className = 'col-header-btns';

        const renameBtn = document.createElement('button');
        renameBtn.className = 'col-rename-btn'; renameBtn.innerHTML = '&#9998;'; renameBtn.title = 'Umbenennen';
        renameBtn.addEventListener('click', () => renameColumn(col.id));

        const colorBtn = document.createElement('button');
        colorBtn.className = 'col-color-btn'; colorBtn.innerHTML = '&#127912;'; colorBtn.title = 'Spaltenfarbe';
        colorBtn.addEventListener('click', () => openColColorPicker(col.id));

        const delColBtn = document.createElement('button');
        delColBtn.className = 'col-delete-btn'; delColBtn.innerHTML = '&#10006;'; delColBtn.title = 'Spalte löschen';
        delColBtn.addEventListener('click', () => deleteColumn(col.id));

        const titleWrap = document.createElement('div');
        titleWrap.className = 'col-title-wrap';
        titleWrap.appendChild(dragHandle);
        titleWrap.appendChild(h2);
        titleWrap.appendChild(countBadge);

        headerBtns.append(renameBtn, colorBtn, delColBtn);
        header.append(titleWrap, headerBtns);

        const issueList = document.createElement('div');
        issueList.className = 'issue-list'; issueList.dataset.colId = col.id;

        const emptyState = document.createElement('div');
        emptyState.className = 'col-empty'; emptyState.dataset.colEmpty = col.id;
        emptyState.innerHTML = '<span>&#128203;</span><p>Keine Issues hier.<br>Hinziehen oder neu erstellen.</p>';

        colEl.append(header, issueList, emptyState);
        container.appendChild(colEl);
    });

    const addColBtn = document.createElement('button');
    addColBtn.className = 'add-col-btn'; addColBtn.innerHTML = '&#43; Spalte';
    addColBtn.addEventListener('click', addColumn);
    container.appendChild(addColBtn);

    document.querySelectorAll('.issue-list').forEach(list => {
        Sortable.create(list, {
            group: 'issues',
            animation: 150,
            handle: '.issue-card',
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            onEnd(evt) {
                const id    = evt.item.dataset.id;
                const toCol = evt.to.dataset.colId;
                const board = activeBoard();
                const issue = board.issues.find(i => i.id === id);
                if (!issue) return;
                issue.status = toCol;
                document.querySelectorAll('.issue-list').forEach(l => {
                    [...l.querySelectorAll('.issue-card')].forEach((card, idx) => {
                        const iss = board.issues.find(i => i.id === card.dataset.id);
                        if (iss) iss.sortOrder = idx;
                    });
                });
                saveState(state);
                updateCountBadges();
                updateEmptyStates();
            }
        });
    });

    Sortable.create(container, {
        animation: 150,
        handle: '.col-drag-handle',
        filter: '.add-col-btn',
        ghostClass: 'sortable-ghost',
        onEnd() {
            const board = activeBoard();
            const newOrder = [...container.querySelectorAll('.column')].map(el => el.id);
            board.columns = newOrder.map(id => board.columns.find(c => c.id === id)).filter(Boolean);
            saveState(state);
            buildStatusOptions();
        }
    });
}

// ═══════════════════════════════════════════════════════════════════
//  Edit Modal
// ═══════════════════════════════════════════════════════════════════
let currentEditIssueId = null;
let editModalLabels    = [];

function buildStatusOptions() {
    const sel = document.getElementById('editStatusInput');
    if (!sel) return;
    const cur = sel.value; sel.innerHTML = '';
    activeBoard().columns.forEach(col => {
        const opt = document.createElement('option');
        opt.value = col.id; opt.textContent = col.label;
        sel.appendChild(opt);
    });
    if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
}

function buildEditModal() {
    if (document.getElementById('editModalOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'editModalOverlay'; overlay.className = 'modal-overlay hidden';
    overlay.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="editModalTitle">
            <div class="modal-header">
                <h2 id="editModalTitle">Issue bearbeiten</h2>
                <button type="button" class="icon-btn" id="closeEditModalBtn" aria-label="Schließen">✕</button>
            </div>
            <div class="modal-body">
                <label class="modal-label" for="editTitleInput">Titel</label>
                <div class="input-row">
                    <input type="color" id="editColorInput" class="color-picker" title="Farbe wählen">
                    <input type="text" id="editTitleInput" placeholder="Issue-Titel..." style="flex:1">
                </div>
                <label class="modal-label" for="editDescriptionInput">Beschreibung</label>
                <textarea id="editDescriptionInput" rows="4" placeholder="Worum geht es genau?"></textarea>
                <label class="modal-label">Labels</label>
                <div class="label-input-row">
                    <div class="label-chips" id="editLabelChips"></div>
                    <select id="editLabelSelect" class="label-select"></select>
                    <input type="text" id="editLabelInput" placeholder="Neu tippen + Enter" class="label-text-input">
                </div>
                <label class="modal-label" for="editLinksInput">URLs</label>
                <textarea id="editLinksInput" rows="3" placeholder="Eine URL pro Zeile"></textarea>
                <div class="input-row" style="gap:12px;margin-top:4px">
                    <div style="flex:1">
                        <label class="modal-label" for="editDueDateInput">Fälligkeitsdatum</label>
                        <input type="date" id="editDueDateInput" style="width:100%">
                    </div>
                    <div style="flex:1">
                        <label class="modal-label" for="editPriorityInput">Priorität</label>
                        <select id="editPriorityInput">
                            <option value="1">🔴 Hoch</option>
                            <option value="2">🟠 Mittel</option>
                            <option value="3">🟢 Niedrig</option>
                        </select>
                    </div>
                </div>
                <label class="modal-label" for="editStatusInput">Status</label>
                <select id="editStatusInput"></select>
            </div>
            <div class="modal-actions">
                <button type="button" class="secondary-btn" id="cancelEditBtn">Abbrechen</button>
                <button type="button" class="primary-btn" id="saveEditBtn">Speichern</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeEditModal(); });
    document.getElementById('closeEditModalBtn').addEventListener('click', closeEditModal);
    document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);
    document.getElementById('saveEditBtn').addEventListener('click', saveIssueEdits);

    document.getElementById('editLabelInput').addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const val = e.target.value.trim();
            if (val) {
                const lbl = val.toLowerCase().replace(/\s+/g, '-');
                const board = activeBoard();
                if (!board.globalLabels) board.globalLabels = [];
                if (!board.globalLabels.includes(lbl)) { board.globalLabels.push(lbl); saveState(state); }
                if (!editModalLabels.includes(lbl)) { editModalLabels.push(lbl); refreshEditLabelChips(); }
                e.target.value = '';
            }
        }
    });
    buildStatusOptions();
}

function refreshEditLabelChips() {
    renderLabelChips(editModalLabels, document.getElementById('editLabelChips'), lbl => {
        editModalLabels = editModalLabels.filter(x => x !== lbl);
        refreshEditLabelChips();
        rebuildLabelDropdowns();
    });
    buildLabelDropdown('editLabelSelect', editModalLabels, lbl => {
        editModalLabels = editModalLabels.includes(lbl)
            ? editModalLabels.filter(x => x !== lbl)
            : [...editModalLabels, lbl];
        refreshEditLabelChips();
    });
}

function openEditModal(id) {
    const issue = activeBoard().issues.find(i => i.id === id);
    if (!issue) return;
    currentEditIssueId = id;
    editModalLabels    = [...(issue.labels || [])];
    buildStatusOptions();
    document.getElementById('editTitleInput').value       = issue.title;
    document.getElementById('editDescriptionInput').value = issue.description || '';
    document.getElementById('editLinksInput').value       = (issue.links || []).join('\n');
    document.getElementById('editPriorityInput').value    = String(issue.priority);
    document.getElementById('editStatusInput').value      = issue.status;
    document.getElementById('editColorInput').value       = issue.color || '#6c63ff';
    document.getElementById('editDueDateInput').value     = issue.dueDate || '';
    document.getElementById('editLabelInput').value       = '';
    refreshEditLabelChips();
    const overlay = document.getElementById('editModalOverlay');
    overlay.classList.remove('hidden');
    document.body.classList.add('modal-open');
    document.getElementById('editTitleInput').focus();
    document.getElementById('editTitleInput').select();
}

function closeEditModal() {
    currentEditIssueId = null;
    const overlay = document.getElementById('editModalOverlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    document.body.classList.remove('modal-open');
}

function saveIssueEdits() {
    if (!currentEditIssueId) return;
    const issue = activeBoard().issues.find(i => i.id === currentEditIssueId);
    if (!issue) return;
    const title = document.getElementById('editTitleInput').value.trim();
    if (!title) { document.getElementById('editTitleInput').focus(); return; }
    issue.title       = title;
    issue.description = document.getElementById('editDescriptionInput').value.trim();
    issue.links       = parseLinks(document.getElementById('editLinksInput').value);
    issue.priority    = document.getElementById('editPriorityInput').value;
    issue.status      = document.getElementById('editStatusInput').value;
    issue.color       = document.getElementById('editColorInput').value;
    issue.dueDate     = document.getElementById('editDueDateInput').value || null;
    issue.labels      = [...editModalLabels];
    saveState(state); closeEditModal(); renderIssues(); rebuildLabelFilter();
}

// ═══════════════════════════════════════════════════════════════════
//  Render Issues
// ═══════════════════════════════════════════════════════════════════
function getFilteredIssues() {
    return activeBoard().issues.filter(issue => {
        if (filterPriority && String(issue.priority) !== filterPriority) return false;
        if (filterLabel    && !(issue.labels || []).includes(filterLabel))  return false;
        if (filterSearch) {
            const q = filterSearch.toLowerCase();
            const haystack = [issue.title, issue.description, issue.id, ...(issue.labels||[])].join(' ').toLowerCase();
            if (!haystack.includes(q)) return false;
        }
        return true;
    });
}

function updateCountBadges() {
    const all = activeBoard().issues;
    activeBoard().columns.forEach(col => {
        const el = document.querySelector(`[data-col-count="${col.id}"]`);
        if (el) el.textContent = all.filter(i => i.status === col.id).length;
    });
}

function updateEmptyStates() {
    activeBoard().columns.forEach(col => {
        const list  = document.querySelector(`[data-col-id="${col.id}"]`);
        const empty = document.querySelector(`[data-col-empty="${col.id}"]`);
        if (!list || !empty) return;
        empty.style.display = list.children.length === 0 ? 'flex' : 'none';
    });
}

function renderIssues() {
    document.querySelectorAll('.issue-list').forEach(l => { l.innerHTML = ''; });
    const board   = activeBoard();
    const visible = getFilteredIssues();
    const sorted  = [...visible].sort((a,b) => {
        const oa = a.sortOrder ?? 9999, ob = b.sortOrder ?? 9999;
        if (oa !== ob) return oa - ob;
        return a.priority - b.priority;
    });

    sorted.forEach(issue => {
        const color = issue.color || '#6c63ff';
        const rgb   = hexToRgb(color);

        const card = document.createElement('div');
        card.className = `issue-card prio-${issue.priority}`;
        card.draggable = false;
        card.dataset.id = issue.id;
        card.style.borderLeftColor = color;
        card.style.background = `rgba(${rgb},0.06)`;

        const header = document.createElement('div');
        header.className = 'issue-header';
        const meta = document.createElement('div'); meta.className = 'issue-meta';
        const idBadge = document.createElement('span');
        idBadge.className = 'issue-id';
        idBadge.textContent = issue.id;
        idBadge.style.background = `rgba(${rgb},0.15)`;
        idBadge.style.color = color;
        const titleEl = document.createElement('h3');
        titleEl.className = 'issue-title'; titleEl.textContent = issue.title;
        meta.append(idBadge, titleEl);

        const actions = document.createElement('div'); actions.className = 'issue-actions';
        const editBtn = document.createElement('button');
        editBtn.type = 'button'; editBtn.className = 'edit-btn'; editBtn.textContent = 'Bearbeiten';
        editBtn.setAttribute('aria-label', `Issue ${issue.id} bearbeiten`);
        editBtn.onclick = e => { e.stopPropagation(); openEditModal(issue.id); };
        const delBtn = document.createElement('button');
        delBtn.type = 'button'; delBtn.className = 'delete-btn'; delBtn.textContent = '✕';
        delBtn.setAttribute('aria-label', `Issue ${issue.id} löschen`);
        delBtn.onclick = e => { e.stopPropagation(); deleteIssue(issue.id); };
        actions.append(editBtn, delBtn);
        header.append(meta, actions);
        card.appendChild(header);

        if (issue.labels && issue.labels.length > 0) {
            const lrow = document.createElement('div'); lrow.className = 'issue-label-row';
            renderLabelChips(issue.labels, lrow, null);
            card.appendChild(lrow);
        }

        if (issue.dueDate) {
            const due = document.createElement('div');
            due.className = 'issue-due';
            if (isOverdue(issue.dueDate))      due.classList.add('overdue');
            else if (isDueSoon(issue.dueDate)) due.classList.add('due-soon');
            due.textContent = '📅 ' + formatDate(issue.dueDate);
            card.appendChild(due);
        }

        if (issue.description) {
            const desc = document.createElement('p');
            desc.className = 'issue-description'; desc.textContent = issue.description;
            card.appendChild(desc);
        }
        if (issue.links && issue.links.length > 0) {
            const lc = document.createElement('div'); lc.className = 'issue-links';
            issue.links.forEach(url => {
                const a = document.createElement('a');
                a.href = url; a.textContent = url;
                a.target = '_blank'; a.rel = 'noopener noreferrer';
                lc.appendChild(a);
            });
            card.appendChild(lc);
        }

        const target = document.querySelector(`[data-col-id="${issue.status}"]`);
        if (target) target.appendChild(card);
    });

    updateCountBadges();
    updateEmptyStates();
    rebuildLabelFilter();
}

function renderAll() {
    renderBoardSelect();
    buildBoardDOM();
    applyColumnColors();
    renderIssues();
    buildStatusOptions();
    setTimeout(rebuildLabelDropdowns, 0);
}

// ═══════════════════════════════════════════════════════════════════
//  Add / Delete Issue
// ═══════════════════════════════════════════════════════════════════
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
    titleInput.value = ''; descInput.value = ''; linksInput.value = '';
    priorityInput.value = '2'; colorInput.value = '#6c63ff'; dueDateInput.value = '';
    newIssueLabels = [];
    renderNewIssueLabelChips();
    rebuildLabelDropdowns();
    titleInput.focus();
    saveState(state); renderIssues(); rebuildLabelFilter();
}

function deleteIssue(id) {
    activeBoard().issues = activeBoard().issues.filter(i => i.id !== id);
    saveState(state); renderIssues();
    showToast('🗑️ Issue gelöscht');
}

// ═══════════════════════════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    buildEditModal();
    buildLabelManagerModal();
    renderAll();

    document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);
    document.getElementById('boardSelect').addEventListener('change', e => switchBoard(e.target.value));
    document.getElementById('addBoardBtn').addEventListener('click', addBoard);
    document.getElementById('renameBoardBtn').addEventListener('click', renameBoard);
    document.getElementById('deleteBoardBtn').addEventListener('click', deleteBoard);
    document.getElementById('exportBtn').addEventListener('click', exportState);
    document.getElementById('importFile').addEventListener('change', e => {
        importState(e.target.files[0]);
        e.target.value = '';
    });
    document.getElementById('labelManagerBtn').addEventListener('click', openLabelManager);

    document.getElementById('taskInput').addEventListener('keydown', e => { if (e.key === 'Enter') addIssue(); });

    document.getElementById('labelInput').addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addNewIssueLabel(e.target.value);
            e.target.value = '';
        }
    });

    buildLabelDropdown('newIssueLabelSelect', newIssueLabels, v => {
        newIssueLabels = newIssueLabels.includes(v) ? newIssueLabels.filter(x=>x!==v) : [...newIssueLabels, v];
        renderNewIssueLabelChips();
        rebuildLabelDropdowns();
    });

    document.getElementById('searchInput').addEventListener('input', e => {
        filterSearch = e.target.value; renderIssues();
    });
    document.getElementById('filterPriority').addEventListener('change', e => {
        filterPriority = e.target.value; renderIssues();
    });
    document.getElementById('filterLabel').addEventListener('change', e => {
        filterLabel = e.target.value; renderIssues();
    });
    document.getElementById('clearFilterBtn').addEventListener('click', () => {
        filterSearch = ''; filterPriority = ''; filterLabel = '';
        document.getElementById('searchInput').value = '';
        document.getElementById('filterPriority').value = '';
        document.getElementById('filterLabel').value = '';
        renderIssues();
    });

    const colPicker = document.getElementById('colColorInput');
    colPicker.addEventListener('input', () => {
        if (!pendingColColorTarget) return;
        const col = activeBoard().columns.find(c => c.id === pendingColColorTarget);
        if (col) { col.color = colPicker.value; saveState(state); applyColumnColors(); }
    });
    colPicker.addEventListener('change', () => { pendingColColorTarget = null; });

    document.addEventListener('keydown', e => {
        const overlay = document.getElementById('editModalOverlay');
        const modalOpen = overlay && !overlay.classList.contains('hidden');
        const tag = document.activeElement.tagName;
        const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

        if (modalOpen) {
            if (e.key === 'Escape') closeEditModal();
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveIssueEdits();
            return;
        }
        if (e.key === 'n' && !isInput) { e.preventDefault(); document.getElementById('taskInput').focus(); }
        if (e.key === '/' && !isInput) { e.preventDefault(); document.getElementById('searchInput').focus(); }
        if (e.key === 'Escape' && isInput) { document.activeElement.blur(); }
    });
});
