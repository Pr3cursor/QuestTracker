// ═══════════════════════════════════════════════════════════════════
//  QuestTracker — Multi-Board State
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
        issues: []
    };
}

function loadState() {
    const raw = localStorage.getItem('qt-boards');
    if (raw) {
        try {
            const data = JSON.parse(raw);
            if (data.boards && data.boards.length > 0) return data;
        } catch {}
    }
    // First run or migration from old format
    const oldIssues = JSON.parse(localStorage.getItem('scrum-issues') || '[]');
    const oldColColors = JSON.parse(localStorage.getItem('scrum-col-colors') || '{}');
    const colMap = { open: 'col-open', doing: 'col-doing', review: 'col-review', done: 'col-done' };
    const defaultBoard = createBoard('Main Board');
    // Migrate old column colors
    defaultBoard.columns.forEach(col => {
        const oldKey = Object.keys(colMap).find(k => colMap[k] === col.id);
        if (oldKey && oldColColors[oldKey]) col.color = oldColColors[oldKey];
    });
    // Migrate old issues — remap status ids
    defaultBoard.issues = oldIssues.map(iss => ({
        ...iss,
        id:     iss.id     || generateId(),
        color:  iss.color  || '#6c63ff',
        status: colMap[iss.status] || 'col-open'
    }));
    const state = { activeBoardId: defaultBoard.id, boards: [defaultBoard] };
    saveState(state);
    return state;
}

function saveState(s) {
    localStorage.setItem('qt-boards', JSON.stringify(s));
}

let state = loadState();

function activeBoard() {
    return state.boards.find(b => b.id === state.activeBoardId) || state.boards[0];
}

// ═══════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════
function generateId() {
    return 'QST-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,5).toUpperCase();
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
    const cur = document.documentElement.getAttribute('data-theme');
    applyTheme(cur === 'dark' ? 'light' : 'dark');
}

// ═══════════════════════════════════════════════════════════════════
//  Board Switcher
// ═══════════════════════════════════════════════════════════════════
function renderBoardSelect() {
    const sel = document.getElementById('boardSelect');
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

function addBoard() {
    const name = prompt('Name des neuen Boards:');
    if (!name || !name.trim()) return;
    const b = createBoard(name.trim());
    state.boards.push(b);
    state.activeBoardId = b.id;
    saveState(state);
    renderAll();
}

function renameBoard() {
    const b = activeBoard();
    const name = prompt('Board umbenennen:', b.name);
    if (!name || !name.trim()) return;
    b.name = name.trim();
    saveState(state);
    renderBoardSelect();
}

function deleteBoard() {
    if (state.boards.length === 1) { alert('Das letzte Board kann nicht gelöscht werden.'); return; }
    const b = activeBoard();
    if (!confirm(`Board "${b.name}" wirklich löschen? Alle Issues gehen verloren.`)) return;
    state.boards = state.boards.filter(x => x.id !== b.id);
    state.activeBoardId = state.boards[0].id;
    saveState(state);
    renderAll();
}

// ═══════════════════════════════════════════════════════════════════
//  Column rename (inline double-click)
// ═══════════════════════════════════════════════════════════════════
function renameColumn(colId) {
    const col = activeBoard().columns.find(c => c.id === colId);
    if (!col) return;
    const name = prompt('Spalte umbenennen:', col.label);
    if (!name || !name.trim()) return;
    col.label = name.trim();
    saveState(state);
    // Update label text in DOM only (no full re-render to preserve drag state)
    const h2 = document.querySelector(`[data-col="${colId}"] h2`);
    if (h2) h2.textContent = col.label;
    // Also update status options in edit modal
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
        if (col.color) {
            el.style.background = col.color + '22';
            el.style.borderTop  = `3px solid ${col.color}`;
        } else {
            el.style.background = '';
            el.style.borderTop  = '';
        }
    });
}

// ═══════════════════════════════════════════════════════════════════
//  Build Board DOM
// ═══════════════════════════════════════════════════════════════════
function buildBoardDOM() {
    const container = document.getElementById('boardContainer');
    container.innerHTML = '';
    activeBoard().columns.forEach(col => {
        const colEl = document.createElement('div');
        colEl.className = 'column';
        colEl.id = col.id;
        colEl.setAttribute('ondrop', 'drop(event)');
        colEl.setAttribute('ondragover', 'allowDrop(event)');

        const header = document.createElement('div');
        header.className = 'column-header';
        header.dataset.col = col.id;

        const h2 = document.createElement('h2');
        h2.textContent = col.label;
        h2.title = 'Doppelklick zum Umbenennen';
        h2.style.cursor = 'pointer';
        h2.addEventListener('dblclick', () => renameColumn(col.id));

        const headerBtns = document.createElement('div');
        headerBtns.className = 'col-header-btns';

        const renameBtn = document.createElement('button');
        renameBtn.className = 'col-rename-btn';
        renameBtn.innerHTML = '&#9998;';
        renameBtn.title = 'Umbenennen';
        renameBtn.addEventListener('click', () => renameColumn(col.id));

        const colorBtn = document.createElement('button');
        colorBtn.className = 'col-color-btn';
        colorBtn.innerHTML = '&#127912;';
        colorBtn.title = 'Spaltenfarbe';
        colorBtn.addEventListener('click', () => openColColorPicker(col.id));

        headerBtns.appendChild(renameBtn);
        headerBtns.appendChild(colorBtn);
        header.appendChild(h2);
        header.appendChild(headerBtns);

        const issueList = document.createElement('div');
        issueList.className = 'issue-list';

        colEl.appendChild(header);
        colEl.appendChild(issueList);
        container.appendChild(colEl);
    });
}

// ═══════════════════════════════════════════════════════════════════
//  Edit Modal
// ═══════════════════════════════════════════════════════════════════
let currentEditIssueId = null;

function buildStatusOptions() {
    const sel = document.getElementById('editStatusInput');
    if (!sel) return;
    const curVal = sel.value;
    sel.innerHTML = '';
    activeBoard().columns.forEach(col => {
        const opt = document.createElement('option');
        opt.value = col.id;
        opt.textContent = col.label;
        sel.appendChild(opt);
    });
    if ([...sel.options].some(o => o.value === curVal)) sel.value = curVal;
}

function buildEditModal() {
    if (document.getElementById('editModalOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'editModalOverlay';
    overlay.className = 'modal-overlay hidden';
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
                <label class="modal-label" for="editLinksInput">URLs</label>
                <textarea id="editLinksInput" rows="3" placeholder="Eine URL pro Zeile"></textarea>
                <label class="modal-label" for="editPriorityInput">Priorität</label>
                <select id="editPriorityInput">
                    <option value="1">Hoch</option>
                    <option value="2">Mittel</option>
                    <option value="3">Niedrig</option>
                </select>
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
    buildStatusOptions();
}

function openEditModal(id) {
    const issue = activeBoard().issues.find(i => i.id === id);
    if (!issue) return;
    currentEditIssueId = id;
    buildStatusOptions();
    document.getElementById('editTitleInput').value       = issue.title;
    document.getElementById('editDescriptionInput').value = issue.description || '';
    document.getElementById('editLinksInput').value       = (issue.links || []).join('\n');
    document.getElementById('editPriorityInput').value    = String(issue.priority);
    document.getElementById('editStatusInput').value      = issue.status;
    document.getElementById('editColorInput').value       = issue.color || '#6c63ff';
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
    const board = activeBoard();
    const issue = board.issues.find(i => i.id === currentEditIssueId);
    if (!issue) return;
    const title = document.getElementById('editTitleInput').value.trim();
    if (!title) { document.getElementById('editTitleInput').focus(); return; }
    issue.title       = title;
    issue.description = document.getElementById('editDescriptionInput').value.trim();
    issue.links       = parseLinks(document.getElementById('editLinksInput').value);
    issue.priority    = document.getElementById('editPriorityInput').value;
    issue.status      = document.getElementById('editStatusInput').value;
    issue.color       = document.getElementById('editColorInput').value;
    saveState(state);
    closeEditModal();
    renderIssues();
}

// ═══════════════════════════════════════════════════════════════════
//  Render Issues (no DOM rebuild)
// ═══════════════════════════════════════════════════════════════════
function renderIssues() {
    document.querySelectorAll('.issue-list').forEach(l => { l.innerHTML = ''; });
    const board  = activeBoard();
    const sorted = [...board.issues].sort((a,b) => a.priority - b.priority);

    sorted.forEach(issue => {
        const color = issue.color || '#6c63ff';
        const rgb   = hexToRgb(color);

        const card = document.createElement('div');
        card.className = `issue-card prio-${issue.priority}`;
        card.draggable = true;
        card.dataset.id = issue.id;
        card.style.borderLeftColor = color;
        card.style.background = `rgba(${rgb},0.06)`;

        const header = document.createElement('div');
        header.className = 'issue-header';

        const meta = document.createElement('div');
        meta.className = 'issue-meta';

        const idBadge = document.createElement('span');
        idBadge.className = 'issue-id';
        idBadge.textContent = issue.id;
        idBadge.style.background = `rgba(${rgb},0.15)`;
        idBadge.style.color = color;

        const titleEl = document.createElement('h3');
        titleEl.className = 'issue-title';
        titleEl.textContent = issue.title;

        meta.appendChild(idBadge);
        meta.appendChild(titleEl);

        const actions = document.createElement('div');
        actions.className = 'issue-actions';

        const colorDot = document.createElement('span');
        colorDot.className = 'color-dot';
        colorDot.style.background = color;

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'edit-btn';
        editBtn.textContent = 'Bearbeiten';
        editBtn.setAttribute('aria-label', `Issue ${issue.id} bearbeiten`);
        editBtn.onclick = e => { e.stopPropagation(); openEditModal(issue.id); };

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'delete-btn';
        delBtn.textContent = '✕';
        delBtn.setAttribute('aria-label', `Issue ${issue.id} löschen`);
        delBtn.onclick = e => { e.stopPropagation(); deleteIssue(issue.id); };

        actions.appendChild(colorDot);
        actions.appendChild(editBtn);
        actions.appendChild(delBtn);
        header.appendChild(meta);
        header.appendChild(actions);
        card.appendChild(header);

        if (issue.description) {
            const desc = document.createElement('p');
            desc.className = 'issue-description';
            desc.textContent = issue.description;
            card.appendChild(desc);
        }

        if (issue.links && issue.links.length > 0) {
            const lc = document.createElement('div');
            lc.className = 'issue-links';
            issue.links.forEach(url => {
                const a = document.createElement('a');
                a.href = url; a.textContent = url;
                a.target = '_blank'; a.rel = 'noopener noreferrer';
                lc.appendChild(a);
            });
            card.appendChild(lc);
        }

        card.ondragstart = e => e.dataTransfer.setData('text', issue.id);
        const target = document.querySelector(`#${issue.status} .issue-list`);
        if (target) target.appendChild(card);
    });
}

// Full re-render (board switch, board create/delete)
function renderAll() {
    renderBoardSelect();
    buildBoardDOM();
    applyColumnColors();
    renderIssues();
    buildStatusOptions();
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
        color:       colorInput.value
    });

    titleInput.value = '';
    descInput.value  = '';
    linksInput.value = '';
    priorityInput.value = '2';
    colorInput.value = '#6c63ff';
    titleInput.focus();
    saveState(state);
    renderIssues();
}

function deleteIssue(id) {
    activeBoard().issues = activeBoard().issues.filter(i => i.id !== id);
    saveState(state);
    renderIssues();
}

// ═══════════════════════════════════════════════════════════════════
//  Drag & Drop
// ═══════════════════════════════════════════════════════════════════
function allowDrop(ev) { ev.preventDefault(); }
function drop(ev) {
    ev.preventDefault();
    const id = ev.dataTransfer.getData('text');
    let target = ev.target;
    while (target && !target.classList.contains('column')) target = target.parentElement;
    if (!target) return;
    const issue = activeBoard().issues.find(i => i.id === id);
    if (issue) { issue.status = target.id; saveState(state); renderIssues(); }
}

// ═══════════════════════════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    buildEditModal();
    renderAll();

    document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);
    document.getElementById('boardSelect').addEventListener('change', e => switchBoard(e.target.value));
    document.getElementById('addBoardBtn').addEventListener('click', addBoard);
    document.getElementById('renameBoardBtn').addEventListener('click', renameBoard);
    document.getElementById('deleteBoardBtn').addEventListener('click', deleteBoard);
    document.getElementById('taskInput').addEventListener('keydown', e => { if (e.key === 'Enter') addIssue(); });

    const colPicker = document.getElementById('colColorInput');
    colPicker.addEventListener('input', () => {
        if (!pendingColColorTarget) return;
        const col = activeBoard().columns.find(c => c.id === pendingColColorTarget);
        if (col) { col.color = colPicker.value; saveState(state); applyColumnColors(); }
    });
    colPicker.addEventListener('change', () => { pendingColColorTarget = null; });

    document.addEventListener('keydown', e => {
        const overlay = document.getElementById('editModalOverlay');
        if (!overlay || overlay.classList.contains('hidden')) return;
        if (e.key === 'Escape') closeEditModal();
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveIssueEdits();
    });
});
