let issues = JSON.parse(localStorage.getItem('scrum-issues')) || [];
let currentEditIssueId = null;

function generateId() {
    return 'QST-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
}

function normalizeUrl(url) {
    const trimmed = url.trim();
    if (!trimmed) return null;
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
        new URL(normalized);
        return normalized;
    } catch {
        return null;
    }
}

function parseLinks(rawValue) {
    return rawValue.split('\n').map(line => normalizeUrl(line)).filter(Boolean);
}

function migrateIssues() {
    let changed = false;
    issues.forEach(issue => {
        if (!issue.id) { issue.id = generateId(); changed = true; }
        if (typeof issue.description !== 'string') { issue.description = ''; changed = true; }
        if (!Array.isArray(issue.links)) { issue.links = []; changed = true; }
    });
    if (changed) localStorage.setItem('scrum-issues', JSON.stringify(issues));
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
                <button type="button" class="icon-btn" id="closeEditModalBtn" aria-label="Bearbeitungsfenster schließen">✕</button>
            </div>
            <div class="modal-body">
                <label class="modal-label" for="editTitleInput">Titel</label>
                <input type="text" id="editTitleInput" placeholder="Issue-Titel...">

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

    issue.title = title;
    issue.description = document.getElementById('editDescriptionInput').value.trim();
    issue.links = parseLinks(document.getElementById('editLinksInput').value);
    issue.priority = document.getElementById('editPriorityInput').value;
    issue.status = document.getElementById('editStatusInput').value;

    closeEditModal();
    renderBoard();
}

function renderBoard() {
    document.querySelectorAll('.issue-list').forEach(list => { list.innerHTML = ''; });
    const sorted = [...issues].sort((a, b) => a.priority - b.priority);

    sorted.forEach((issue) => {
        const card = document.createElement('div');
        card.className = `issue-card prio-${issue.priority}`;
        card.draggable = true;
        card.dataset.id = issue.id;

        // Header
        const header = document.createElement('div');
        header.className = 'issue-header';

        const meta = document.createElement('div');
        meta.className = 'issue-meta';

        const idBadge = document.createElement('span');
        idBadge.className = 'issue-id';
        idBadge.textContent = issue.id;

        const title = document.createElement('h3');
        title.className = 'issue-title';
        title.textContent = issue.title;

        meta.appendChild(idBadge);
        meta.appendChild(title);

        // Action Buttons
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

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        header.appendChild(meta);
        header.appendChild(actions);
        card.appendChild(header);

        // Beschreibung
        if (issue.description) {
            const desc = document.createElement('p');
            desc.className = 'issue-description';
            desc.textContent = issue.description;
            card.appendChild(desc);
        }

        // Links
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

function addIssue() {
    const titleInput = document.getElementById('taskInput');
    const descInput = document.getElementById('descriptionInput');
    const linksInput = document.getElementById('linksInput');
    const priorityInput = document.getElementById('priorityInput');

    const title = titleInput.value.trim();
    if (!title) { titleInput.focus(); return; }

    issues.push({
        id: generateId(),
        title,
        description: descInput.value.trim(),
        links: parseLinks(linksInput.value),
        priority: priorityInput.value,
        status: 'open'
    });

    titleInput.value = '';
    descInput.value = '';
    linksInput.value = '';
    priorityInput.value = '2';
    titleInput.focus();
    renderBoard();
}

function deleteIssue(id) {
    issues = issues.filter(i => i.id !== id);
    renderBoard();
}

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

document.addEventListener('DOMContentLoaded', () => {
    buildEditModal();

    document.getElementById('taskInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addIssue();
    });

    document.addEventListener('keydown', (e) => {
        const overlay = document.getElementById('editModalOverlay');
        if (!overlay || overlay.classList.contains('hidden')) return;
        if (e.key === 'Escape') closeEditModal();
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveIssueEdits();
    });
});

migrateIssues();
renderBoard();
