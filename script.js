// ── State ────────────────────────────────────────────────────────────
let issues = JSON.parse(localStorage.getItem('scrum-issues')) || [];
let columnColors = JSON.parse(localStorage.getItem('scrum-col-colors')) || {};
let currentEditIssueId = null;
let pendingColColorTarget = null;

// ── Theme ─────────────────────────────────────────────────────────────
function initTheme() {
    const saved = localStorage.getItem('scrum-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    applyTheme(theme);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('scrum-theme', theme);
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ── Column Colors ────────────────────────────────────────────────────
function applyColumnColors() {
    ['open','doing','review','done'].forEach(col => {
        const el = document.getElementById(col);
        if (!el) return;
        if (columnColors[col]) {
            el.style.background = columnColors[col] + '22'; // 13% opacity
            el.style.borderTop = `3px solid ${columnColors[col]}`;
        } else {
            el.style.background = '';
            el.style.borderTop = '';
        }
    });
}

function openColColorPicker(colId) {
    pendingColColorTarget = colId;
    const picker = document.getElementById('colColorInput');
    picker.value = columnColors[colId] || '#6c63ff';
    picker.click();
}

// ── Helpers ──────────────────────────────────────────────────────────
function generateId() {
    return 'QST-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,5).toUpperCase();
}

function normalizeUrl(url) {
    const trimmed = url.trim();
    if (!trimmed) return null;
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try { new URL(normalized); return normalized; } catch { return null; }
}

function parseLinks(rawValue) {
    return rawValue.split('\n').map(line => normalizeUrl(line)).filter(Boolean);
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `${r},${g},${b}`;
}

// ── Migration ────────────────────────────────────────────────────────
function migrateIssues() {
    let changed = false;
    issues.forEach(issue => {
        if (!issue.id)                                     { issue.id = generateId(); changed = true; }
        if (typeof issue.description !== 'string')         { issue.description = ''; changed = true; }
        if (!Array.isArray(issue.links))                   { issue.links = []; changed = true; }
        if (!issue.color)                                  { issue.color = '#6c63ff'; changed = true; }
    });
    if (changed) localStorage.setItem('scrum-issues', JSON.stringify(issues));
}

// ── Edit Modal ───────────────────────────────────────────────────────
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
                <select id="editStatusInput">
                    <option value="open">Open</option>
                    <option value="doing">Doing</option>
                    <option value="review">Review</option>
                    <option value="done">Done</option>
                </select>
            </div>
            <div class="modal-actions">
                <button type="button" class="secondary-btn" id="cancelEditBtn">Abbrechen</button>
                <button type="button" class="primary-btn" id="saveEditBtn">Speichern</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeEditModal(); });
    document.getElementById('closeEditModalBtn').addEventListener('click', closeEditModal);
    document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);
    document.getElementById('saveEditBtn').addEventListener('click', saveIssueEdits);
}

function openEditModal(id) {
    const issue = issues.find(i => i.id === id);
    if (!issue) return;

    currentEditIssueId = id;
    document.getElementById('editTitleInput').value = issue.title;
    document.getElementById('editDescriptionInput').value = issue.description || '';
    document.getElementById('editLinksInput').value = (issue.links || []).join('\n');
    document.getElementById('editPriorityInput').value = String(issue.priority);
    document.getElementById('editStatusInput').value = issue.status;
    document.getElementById('editColorInput').value = issue.color || '#6c63ff';

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
    const issue = issues.find(i => i.id === currentEditIssueId);
    if (!issue) return;

    const title = document.getElementById('editTitleInput').value.trim();
    if (!title) { document.getElementById('editTitleInput').focus(); return; }

    issue.title       = title;
    issue.description = document.getElementById('editDescriptionInput').value.trim();
    issue.links       = parseLinks(document.getElementById('editLinksInput').value);
    issue.priority    = document.getElementById('editPriorityInput').value;
    issue.status      = document.getElementById('editStatusInput').value;
    issue.color       = document.getElementById('editColorInput').value;

    closeEditModal();
    renderBoard();
}

// ── Render ───────────────────────────────────────────────────────────
function renderBoard() {
    document.querySelectorAll('.issue-list').forEach(list => { list.innerHTML = ''; });
    const sorted = [...issues].sort((a, b) => a.priority - b.priority);

    sorted.forEach((issue) => {
        const color = issue.color || '#6c63ff';
        const rgb   = hexToRgb(color);

        const card = document.createElement('div');
        card.className = `issue-card prio-${issue.priority}`;
        card.draggable = true;
        card.dataset.id = issue.id;
        card.style.borderLeftColor = color;
        card.style.background = `rgba(${rgb}, 0.06)`;

        // Header
        const header = document.createElement('div');
        header.className = 'issue-header';

        const meta = document.createElement('div');
        meta.className = 'issue-meta';

        const idBadge = document.createElement('span');
        idBadge.className = 'issue-id';
        idBadge.textContent = issue.id;
        idBadge.style.background = `rgba(${rgb}, 0.15)`;
        idBadge.style.color = color;

        const titleEl = document.createElement('h3');
        titleEl.className = 'issue-title';
        titleEl.textContent = issue.title;

        meta.appendChild(idBadge);
        meta.appendChild(titleEl);

        const actions = document.createElement('div');
        actions.className = 'issue-actions';

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'edit-btn';
        editBtn.textContent = 'Bearbeiten';
        editBtn.setAttribute('aria-label', `Issue ${issue.id} bearbeiten`);
        editBtn.onclick = (e) => { e.stopPropagation(); openEditModal(issue.id); };

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '✕';
        deleteBtn.setAttribute('aria-label', `Issue ${issue.id} löschen`);
        deleteBtn.onclick = (e) => { e.stopPropagation(); deleteIssue(issue.id); };

        const colorDot = document.createElement('span');
        colorDot.className = 'color-dot';
        colorDot.style.background = color;
        colorDot.title = 'Issue-Farbe';

        actions.appendChild(colorDot);
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

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
            const linksContainer = document.createElement('div');
            linksContainer.className = 'issue-links';
            issue.links.forEach(url => {
                const link = document.createElement('a');
                link.href = url;
                link.textContent = url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                linksContainer.appendChild(link);
            });
            card.appendChild(linksContainer);
        }

        card.ondragstart = (e) => e.dataTransfer.setData('text', issue.id);
        document.querySelector(`#${issue.status} .issue-list`).appendChild(card);
    });

    localStorage.setItem('scrum-issues', JSON.stringify(issues));
}

// ── Add / Delete ─────────────────────────────────────────────────────
function addIssue() {
    const titleInput    = document.getElementById('taskInput');
    const descInput     = document.getElementById('descriptionInput');
    const linksInput    = document.getElementById('linksInput');
    const priorityInput = document.getElementById('priorityInput');
    const colorInput    = document.getElementById('colorInput');

    const title = titleInput.value.trim();
    if (!title) { titleInput.focus(); return; }

    issues.push({
        id:          generateId(),
        title,
        description: descInput.value.trim(),
        links:       parseLinks(linksInput.value),
        priority:    priorityInput.value,
        status:      'open',
        color:       colorInput.value
    });

    titleInput.value    = '';
    descInput.value     = '';
    linksInput.value    = '';
    priorityInput.value = '2';
    colorInput.value    = '#6c63ff';
    titleInput.focus();
    renderBoard();
}

function deleteIssue(id) {
    issues = issues.filter(i => i.id !== id);
    renderBoard();
}

// ── Drag & Drop ──────────────────────────────────────────────────────
function allowDrop(ev) { ev.preventDefault(); }

function drop(ev) {
    ev.preventDefault();
    const id = ev.dataTransfer.getData('text');
    let target = ev.target;
    while (target && !target.classList.contains('column')) { target = target.parentElement; }
    if (!target) return;
    const issue = issues.find(i => i.id === id);
    if (issue) { issue.status = target.id; renderBoard(); }
}

// ── Init ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    buildEditModal();
    applyColumnColors();

    document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);

    document.getElementById('taskInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addIssue();
    });

    // Column color picker
    const colPicker = document.getElementById('colColorInput');
    colPicker.addEventListener('input', () => {
        if (!pendingColColorTarget) return;
        columnColors[pendingColColorTarget] = colPicker.value;
        localStorage.setItem('scrum-col-colors', JSON.stringify(columnColors));
        applyColumnColors();
    });
    colPicker.addEventListener('change', () => { pendingColColorTarget = null; });

    document.addEventListener('keydown', (e) => {
        const overlay = document.getElementById('editModalOverlay');
        if (!overlay || overlay.classList.contains('hidden')) return;
        if (e.key === 'Escape') closeEditModal();
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveIssueEdits();
    });
});

migrateIssues();
renderBoard();
