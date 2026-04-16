let issues = JSON.parse(localStorage.getItem('scrum-issues')) || [];

// --- ID-Generierung ---
function generateId() {
    return 'QST-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
}

// --- URL-Normalisierung ---
function normalizeUrl(url) {
    const trimmed = url.trim();
    if (!trimmed) return null;
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try { new URL(normalized); return normalized; }
    catch { return null; }
}

function parseLinks(rawValue) {
    return rawValue.split('\n').map(line => normalizeUrl(line)).filter(Boolean);
}

// --- Migration: alten Issues ohne ID eine ID geben ---
function migrateIssues() {
    let changed = false;
    issues.forEach(issue => {
        if (!issue.id) { issue.id = generateId(); changed = true; }
        if (!issue.description) { issue.description = ''; }
        if (!issue.links) { issue.links = []; }
    });
    if (changed) localStorage.setItem('scrum-issues', JSON.stringify(issues));
}

// --- Board rendern ---
function renderBoard() {
    document.querySelectorAll('.issue-list').forEach(list => list.innerHTML = '');
    const sorted = [...issues].sort((a, b) => a.priority - b.priority);

    sorted.forEach((issue) => {
        const card = document.createElement('div');
        card.className = `issue-card prio-${issue.priority}`;
        card.draggable = true;
        card.dataset.id = issue.id;

        // Header: ID + Titel + Delete
        const header = document.createElement('div');
        header.className = 'issue-header';

        const idBadge = document.createElement('span');
        idBadge.className = 'issue-id';
        idBadge.textContent = issue.id;

        const title = document.createElement('h3');
        title.className = 'issue-title';
        title.textContent = issue.title;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '✕';
        deleteBtn.setAttribute('aria-label', 'Issue löschen');
        deleteBtn.onclick = () => deleteIssue(issue.id);

        header.appendChild(idBadge);
        header.appendChild(title);
        header.appendChild(deleteBtn);
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

// --- Issue hinzufügen ---
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

// --- Issue löschen (per ID, nicht Index) ---
function deleteIssue(id) {
    issues = issues.filter(issue => issue.id !== id);
    renderBoard();
}

// --- Drag & Drop ---
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

// --- Enter-Taste im Titel-Input ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('taskInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addIssue();
    });
});

migrateIssues();
renderBoard();
