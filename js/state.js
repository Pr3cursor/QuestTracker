// ═══════════════════════════════════════════════════════════════════
//  state.js — Einzige Source of Truth für den App-State
//  Kein DOM, kein UI, keine Side-Effects außer localStorage.
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_COLUMNS = [
    { id: 'col-open',   label: 'Open',   color: null },
    { id: 'col-doing',  label: 'Doing',  color: null },
    { id: 'col-review', label: 'Review', color: null },
    { id: 'col-done',   label: 'Done',   color: null }
];

// ── ID Generators ──────────────────────────────────────────────────
function generateId() {
    return 'QST-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,5).toUpperCase();
}
function generateColId() {
    return 'col-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,4);
}

// ── Board Factory ──────────────────────────────────────────────────
function createBoard(name) {
    return {
        id: 'board-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,5),
        name,
        columns: JSON.parse(JSON.stringify(DEFAULT_COLUMNS)),
        issues: [],
        globalLabels: []
    };
}

// ── Persistence ────────────────────────────────────────────────────
function saveState(s) {
    try {
        localStorage.setItem('qt-boards', JSON.stringify(s));
    } catch (e) {
        // QuotaExceededError — Speicher voll
        console.warn('QuestTracker: localStorage voll, State konnte nicht gespeichert werden.', e);
    }
}

function loadState() {
    try {
        const raw = localStorage.getItem('qt-boards');
        if (raw) {
            const data = JSON.parse(raw);
            if (data.boards && data.boards.length > 0) {
                // Migration: globalLabels sicherstellen
                data.boards.forEach(b => {
                    if (!b.globalLabels) b.globalLabels = [];
                    // Migration: sortOrder auf allen Issues normalisieren
                    b.issues.forEach((iss, idx) => {
                        if (iss.sortOrder === undefined) iss.sortOrder = idx;
                    });
                });
                return data;
            }
        }
    } catch (e) {
        console.warn('QuestTracker: State konnte nicht geladen werden.', e);
    }

    // Legacy-Migration von altem Format
    const oldIssues    = JSON.parse(localStorage.getItem('scrum-issues')    || '[]');
    const oldColColors = JSON.parse(localStorage.getItem('scrum-col-colors') || '{}');
    const colMap = { open: 'col-open', doing: 'col-doing', review: 'col-review', done: 'col-done' };
    const defaultBoard = createBoard('Main Board');
    defaultBoard.columns.forEach(col => {
        const oldKey = Object.keys(colMap).find(k => colMap[k] === col.id);
        if (oldKey && oldColColors[oldKey]) col.color = oldColColors[oldKey];
    });
    defaultBoard.issues = oldIssues.map((iss, idx) => ({
        ...iss,
        id:        iss.id    || generateId(),
        color:     iss.color || '#6c63ff',
        status:    colMap[iss.status] || 'col-open',
        labels:    iss.labels  || [],
        dueDate:   iss.dueDate || null,
        sortOrder: iss.sortOrder !== undefined ? iss.sortOrder : idx
    }));
    const s = { activeBoardId: defaultBoard.id, boards: [defaultBoard] };
    saveState(s);
    return s;
}

// ── State-Instanz (einzige globale State-Variable) ─────────────────
let state = loadState();

// ── Accessor ───────────────────────────────────────────────────────
function activeBoard() {
    return state.boards.find(b => b.id === state.activeBoardId) || state.boards[0];
}
