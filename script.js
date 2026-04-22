// ═══════════════════════════════════════════════════════════════════
//  script.js — App-Initialisierung
//  Nur Event-Verdrahtung. Keine Logik, kein DOM-Bau.
//  Alle Module werden in index.html vor dieser Datei geladen.
// ═══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    // ── Init
    initTheme();
    buildEditModal();
    buildLabelManagerModal();
    checkRecurringIssues(); // Wiederkehrende Issues vor dem ersten Render prüfen
    renderAll();

    // ── Board
    document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);
    document.getElementById('boardSelect').addEventListener('change', e => switchBoard(e.target.value));
    document.getElementById('addBoardBtn').addEventListener('click', addBoard);
    document.getElementById('renameBoardBtn').addEventListener('click', renameBoard);
    document.getElementById('deleteBoardBtn').addEventListener('click', deleteBoard);

    // ── Export / Import
    document.getElementById('exportBtn').addEventListener('click', exportState);
    document.getElementById('importFile').addEventListener('change', e => {
        importState(e.target.files[0], () => {
            checkRecurringIssues(); // Nach Import ebenfalls prüfen
            renderAll();
        });
        e.target.value = '';
    });

    // ── Label Manager
    document.getElementById('labelManagerBtn').addEventListener('click', openLabelManager);

    // ── Neues Issue Formular
    document.getElementById('taskInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') addIssue();
    });
    document.getElementById('labelInput').addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addNewIssueLabel(e.target.value);
            e.target.value = '';
        }
    });
    buildLabelDropdown('newIssueLabelSelect', newIssueLabels, v => {
        newIssueLabels = newIssueLabels.includes(v)
            ? newIssueLabels.filter(x => x !== v)
            : [...newIssueLabels, v];
        renderNewIssueLabelChips();
        rebuildLabelDropdowns();
    });

    // ── Filter
    document.getElementById('searchInput').addEventListener('input', e => {
        filterSearch = e.target.value;
        renderIssues();
    });
    document.getElementById('filterPriority').addEventListener('change', e => {
        filterPriority = e.target.value;
        renderIssues();
    });
    document.getElementById('filterLabel').addEventListener('change', e => {
        filterLabel = e.target.value;
        renderIssues();
    });
    document.getElementById('clearFilterBtn').addEventListener('click', () => {
        filterSearch = ''; filterPriority = ''; filterLabel = '';
        document.getElementById('searchInput').value    = '';
        document.getElementById('filterPriority').value = '';
        document.getElementById('filterLabel').value    = '';
        renderIssues();
    });

    // ── Spaltenfarbe
    const colPicker = document.getElementById('colColorInput');
    colPicker.addEventListener('input', () => {
        if (!pendingColColorTarget) return;
        const col = activeBoard().columns.find(c => c.id === pendingColColorTarget);
        if (col) { col.color = colPicker.value; saveState(state); applyColumnColors(); }
    });
    colPicker.addEventListener('change', () => { pendingColColorTarget = null; });

    // ── Keyboard Shortcuts
    document.addEventListener('keydown', e => {
        const overlay   = document.getElementById('editModalOverlay');
        const modalOpen = overlay && !overlay.classList.contains('hidden');
        const tag       = document.activeElement.tagName;
        const isInput   = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

        if (modalOpen) {
            if (e.key === 'Escape')                        closeEditModal();
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveIssueEdits();
            return;
        }
        if (e.key === 'n' && !isInput) { e.preventDefault(); document.getElementById('taskInput').focus(); }
        if (e.key === '/' && !isInput) { e.preventDefault(); document.getElementById('searchInput').focus(); }
        if (e.key === 'Escape' && isInput) document.activeElement.blur();
    });
});
