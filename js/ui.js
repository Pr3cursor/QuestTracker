// ═══════════════════════════════════════════════════════════════════
//  ui.js — Toast, Theme, Export / Import
//  Abhängigkeiten: state.js, helpers.js (werden als globale Scripts geladen)
// ═══════════════════════════════════════════════════════════════════

// ── Toast ───────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, duration = 3000) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), duration);
}

// ── Theme ───────────────────────────────────────────────────────────
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('scrum-theme', theme);
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}
function initTheme() {
    const saved = localStorage.getItem('scrum-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}
function toggleTheme() {
    applyTheme(
        document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
    );
}

// ── Export ───────────────────────────────────────────────────────────
function exportState() {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `questtracker-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📥 Board exportiert!');
}

// ── Import ───────────────────────────────────────────────────────────
// onSuccess-Callback ermöglicht renderAll() aufzurufen ohne zirkulare Abhängigkeit
function importState(file, onSuccess) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.boards || !Array.isArray(data.boards)) throw new Error('Ungültiges Format');

            showConfirm(
                'Import wird den aktuellen Stand überschreiben. Fortfahren?',
                'Importieren'
            ).then(confirmed => {
                if (!confirmed) return;
                data.boards.forEach(b => {
                    if (!b.globalLabels) b.globalLabels = [];
                    b.issues.forEach((iss, idx) => {
                        if (iss.sortOrder === undefined) iss.sortOrder = idx;
                    });
                });
                state = data;
                saveState(state);
                if (onSuccess) onSuccess();
                showToast('📤 Board importiert!');
            });
        } catch {
            showToast('❌ Ungültige Datei. Bitte eine gültige QuestTracker-JSON wählen.');
        }
    };
    reader.readAsText(file);
}
