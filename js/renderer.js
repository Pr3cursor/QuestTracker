// ═══════════════════════════════════════════════════════════════════
//  renderer.js — Alles DOM-Rendering + SortableJS
//  Einzige Datei die direkt DOM-Elemente baut.
//  Abhängigkeiten: state.js, helpers.js, board.js, modals.js
// ═══════════════════════════════════════════════════════════════════

// ── Board DOM ──═══════════════════════════════════════════════════════
function buildBoardDOM() {
    const container = document.getElementById('boardContainer');
    container.innerHTML = '';

    activeBoard().columns.forEach(col => {
        const colEl = document.createElement('div');
        colEl.className = 'column';
        colEl.id = col.id;

        const header = document.createElement('div');
        header.className = 'column-header';
        header.dataset.col = col.id;

        const dragHandle = document.createElement('span');
        dragHandle.className = 'col-drag-handle';
        dragHandle.innerHTML = '&#8942;&#8942;';
        dragHandle.title = 'Spalte verschieben';

        const h2 = document.createElement('h2');
        h2.title = 'Doppelklick zum Umbenennen';
        h2.style.cursor = 'pointer';
        h2.addEventListener('dblclick', () => renameColumn(col.id));

        const countBadge = document.createElement('span');
        countBadge.className = 'col-count';
        countBadge.dataset.colCount = col.id;

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

        const delColBtn = document.createElement('button');
        delColBtn.className = 'col-delete-btn';
        delColBtn.innerHTML = '&#10006;';
        delColBtn.title = 'Spalte löschen';
        delColBtn.addEventListener('click', () => deleteColumn(col.id));

        const titleWrap = document.createElement('div');
        titleWrap.className = 'col-title-wrap';
        titleWrap.appendChild(dragHandle);
        titleWrap.appendChild(h2);
        titleWrap.appendChild(countBadge);

        headerBtns.append(renameBtn, colorBtn, delColBtn);
        header.append(titleWrap, headerBtns);

        const issueList = document.createElement('div');
        issueList.className = 'issue-list';
        issueList.dataset.colId = col.id;

        const emptyState = document.createElement('div');
        emptyState.className = 'col-empty';
        emptyState.dataset.colEmpty = col.id;
        emptyState.innerHTML = '<span>&#128203;</span><p>Keine Issues hier.<br>Hinziehen oder neu erstellen.</p>';

        colEl.append(header, issueList, emptyState);
        container.appendChild(colEl);
    });

    // „+ Spalte“ Button
    const addColBtn = document.createElement('button');
    addColBtn.className = 'add-col-btn';
    addColBtn.innerHTML = '&#43; Spalte';
    addColBtn.addEventListener('click', addColumn);
    container.appendChild(addColBtn);

    initSortable(container);
}

// ── SortableJS ────────────────────────────────────────────────────────
function initSortable(container) {
    // Issue-Drag zwischen Spalten
    document.querySelectorAll('.issue-list').forEach(list => {
        Sortable.create(list, {
            group:      'issues',
            animation:  150,
            handle:     '.issue-card',
            ghostClass: 'sortable-ghost',
            dragClass:  'sortable-drag',
            onEnd(evt) {
                const id    = evt.item.dataset.id;
                const toCol = evt.to.dataset.colId;
                const board = activeBoard();
                const issue = board.issues.find(i => i.id === id);
                if (!issue) return;
                issue.status = toCol;
                // sortOrder aller Karten neu berechnen
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

    // Spalten-Drag
    Sortable.create(container, {
        animation:  150,
        handle:     '.col-drag-handle',
        filter:     '.add-col-btn',
        ghostClass: 'sortable-ghost',
        onEnd() {
            const board = activeBoard();
            const newOrder = [...container.querySelectorAll('.column')].map(el => el.id);
            board.columns = newOrder
                .map(id => board.columns.find(c => c.id === id))
                .filter(Boolean);
            saveState(state);
            buildStatusOptions();
        }
    });
}

// ── Issue Rendering ──────────────────────────────────────────────────
let filterSearch   = '';
let filterPriority = '';
let filterLabel    = '';

function getFilteredIssues() {
    return activeBoard().issues.filter(issue => {
        if (filterPriority && String(issue.priority) !== filterPriority) return false;
        if (filterLabel    && !(issue.labels || []).includes(filterLabel))  return false;
        if (filterSearch) {
            const q = filterSearch.toLowerCase();
            const haystack = [
                issue.title,
                issue.description,
                issue.id,
                ...(issue.labels || [])
            ].join(' ').toLowerCase();
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
    const board  = activeBoard();
    const sorted = [...getFilteredIssues()].sort((a, b) => {
        const oa = a.sortOrder ?? 9999;
        const ob = b.sortOrder ?? 9999;
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

        // Header
        const header  = document.createElement('div');
        header.className = 'issue-header';
        const meta    = document.createElement('div');
        meta.className = 'issue-meta';
        const idBadge = document.createElement('span');
        idBadge.className = 'issue-id';
        idBadge.textContent = issue.id;
        idBadge.style.background = `rgba(${rgb},0.15)`;
        idBadge.style.color = color;
        const titleEl = document.createElement('h3');
        titleEl.className = 'issue-title';
        titleEl.textContent = issue.title;
        meta.append(idBadge, titleEl);

        // Actions
        const actions = document.createElement('div');
        actions.className = 'issue-actions';
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
        actions.append(editBtn, delBtn);
        header.append(meta, actions);
        card.appendChild(header);

        // Labels
        if (issue.labels && issue.labels.length > 0) {
            const lrow = document.createElement('div');
            lrow.className = 'issue-label-row';
            renderLabelChips(issue.labels, lrow, null);
            card.appendChild(lrow);
        }

        // Fälligkeitsdatum
        if (issue.dueDate) {
            const due = document.createElement('div');
            due.className = 'issue-due';
            if (isOverdue(issue.dueDate))      due.classList.add('overdue');
            else if (isDueSoon(issue.dueDate)) due.classList.add('due-soon');
            due.textContent = '📅 ' + formatDate(issue.dueDate);
            card.appendChild(due);
        }

        // Beschreibung
        if (issue.description) {
            const desc = document.createElement('p');
            desc.className = 'issue-description';
            desc.textContent = issue.description;
            card.appendChild(desc);
        }

        // Links
        if (issue.links && issue.links.length > 0) {
            const lc = document.createElement('div');
            lc.className = 'issue-links';
            issue.links.forEach(url => {
                const a = document.createElement('a');
                a.href = url;
                a.textContent = url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
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

// ── renderAll ─────────────────────────────────────────────────────────
function renderAll() {
    renderBoardSelect();
    buildBoardDOM();
    applyColumnColors();
    renderIssues();
    buildStatusOptions();
    setTimeout(rebuildLabelDropdowns, 0);
}
