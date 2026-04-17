// ═══════════════════════════════════════════════════════════════════
//  recurring.js — Wiederkehrende Issues
//  Wird einmal beim Start aufgerufen (nach loadState).
//  Prüft ob ein recurring Issue zurückgesetzt werden muss.
//  Option B: Issue wird zurück nach Open verschoben (kein Klon).
// ═══════════════════════════════════════════════════════════════════

function checkRecurringIssues() {
    const now   = new Date();
    const today = toDateStr(now); // 'YYYY-MM-DD'
    let changed = false;

    state.boards.forEach(board => {
        const openCol = board.columns[0]; // erste Spalte = Open
        if (!openCol) return;

        board.issues.forEach(issue => {
            if (!issue.recurring || issue.recurring.interval === 'none') return;

            const last = issue.recurring.lastReset; // 'YYYY-MM-DD' oder null

            if (shouldReset(issue.recurring, last, now)) {
                issue.status            = openCol.id;
                issue.recurring.lastReset = today;
                issue.sortOrder         = 0; // oben einreihen
                changed = true;
            }
        });
    });

    if (changed) {
        saveState(state);
        showToast('🔄 Wiederkehrende Issues wurden zurückgesetzt');
    }
}

// Entscheidet ob ein Reset fällig ist
function shouldReset(rec, lastReset, now) {
    const today = toDateStr(now);
    if (lastReset === today) return false; // heute schon zurückgesetzt

    if (rec.interval === 'daily') {
        // Täglich: einfach prüfen ob heute != lastReset
        return true;
    }

    if (rec.interval === 'weekly') {
        // Wöchentlich: prüfen ob heute der konfigurierte Wochentag ist
        // rec.weekday: 0=Mo, 1=Di, ... 6=So (JS: So=0, Mo=1... → angepasst)
        const jsDay   = now.getDay(); // 0=So, 1=Mo, ...
        const targetDay = ((rec.weekday ?? 0) + 1) % 7; // 0=Mo → JS 1, 6=So → JS 0
        return jsDay === targetDay;
    }

    return false;
}

// Hilfsfunktion: Date → 'YYYY-MM-DD'
function toDateStr(d) {
    return d.toISOString().slice(0, 10);
}
