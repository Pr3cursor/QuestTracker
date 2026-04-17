// ═══════════════════════════════════════════════════════════════════
//  modals.js — Alle Modal-Dialoge
//  Ersetzt: alert(), confirm(), prompt() komplett.
//  Abhängigkeiten: state.js, helpers.js, ui.js
// ═══════════════════════════════════════════════════════════════════

// ── Custom Confirm (ersetzt confirm()) ───────────────────────────
function showConfirm(message, confirmLabel = 'OK', dangerMode = false) {
    return new Promise(resolve => {
        const existing = document.getElementById('confirmOverlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'confirmOverlay';
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal modal--sm" role="alertdialog" aria-modal="true" aria-labelledby="confirmMsg">
                <div class="modal-body" style="padding-top: var(--space-6)">
                    <p id="confirmMsg" style="text-align:center; font-size: var(--text-base)">${message}</p>
                </div>
                <div class="modal-actions">
                    <button type="button" class="secondary-btn" id="confirmCancelBtn">Abbrechen</button>
                    <button type="button" class="${dangerMode ? 'danger-btn' : 'primary-btn'}" id="confirmOkBtn">${confirmLabel}</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        document.body.classList.add('modal-open');

        const cleanup = (result) => {
            overlay.remove();
            document.body.classList.remove('modal-open');
            resolve(result);
        };

        document.getElementById('confirmOkBtn').addEventListener('click', () => cleanup(true));
        document.getElementById('confirmCancelBtn').addEventListener('click', () => cleanup(false));
        overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(false); });
        document.getElementById('confirmOkBtn').focus();

        overlay.addEventListener('keydown', e => {
            if (e.key === 'Escape') cleanup(false);
            if (e.key === 'Enter')  cleanup(true);
        });
    });
}

// ── Custom Prompt (ersetzt prompt()) ─────────────────────────────
function showPrompt(message, defaultValue = '', confirmLabel = 'OK') {
    return new Promise(resolve => {
        const existing = document.getElementById('promptOverlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'promptOverlay';
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="promptMsg">
                <div class="modal-body" style="padding-top: var(--space-6); display:flex; flex-direction:column; gap: var(--space-4)">
                    <label id="promptMsg" style="font-size: var(--text-base)">${message}</label>
                    <input type="text" id="promptInput" value="${defaultValue.replace(/"/g, '&quot;')}" style="width:100%">
                </div>
                <div class="modal-actions">
                    <button type="button" class="secondary-btn" id="promptCancelBtn">Abbrechen</button>
                    <button type="button" class="primary-btn" id="promptOkBtn">${confirmLabel}</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        document.body.classList.add('modal-open');

        const input = document.getElementById('promptInput');
        input.focus();
        input.select();

        const cleanup = (result) => {
            overlay.remove();
            document.body.classList.remove('modal-open');
            resolve(result);
        };

        document.getElementById('promptOkBtn').addEventListener('click', () => {
            const val = input.value.trim();
            cleanup(val || null);
        });
        document.getElementById('promptCancelBtn').addEventListener('click', () => cleanup(null));
        overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(null); });
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter')  { e.preventDefault(); cleanup(input.value.trim() || null); }
            if (e.key === 'Escape') { e.preventDefault(); cleanup(null); }
        });
    });
}

// ── Edit Modal ───────────────────────────────────────────────────────
let currentEditIssueId = null;
let editModalLabels    = [];

function buildStatusOptions() {
    const sel = document.getElementById('editStatusInput');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '';
    activeBoard().columns.forEach(col => {
        const opt = document.createElement('option');
        opt.value = col.id;
        opt.textContent = col.label;
        sel.appendChild(opt);
    });
    if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
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

                <!-- ── Wiederkehrend ────────────────────────────── -->
                <div class="recurring-section">
                    <label class="modal-label" for="editRecurringInterval">🔄 Wiederkehrend</label>
                    <select id="editRecurringInterval">
                        <option value="none">Nicht wiederkehrend</option>
                        <option value="daily">Täglich</option>
                        <option value="weekly">Wöchentlich</option>
                    </select>
                    <div id="recurringWeekdayRow" class="recurring-extra hidden">
                        <label class="modal-label" for="editRecurringWeekday">Wochentag</label>
                        <select id="editRecurringWeekday">
                            <option value="0">Montag</option>
                            <option value="1">Dienstag</option>
                            <option value="2">Mittwoch</option>
                            <option value="3">Donnerstag</option>
                            <option value="4">Freitag</option>
                            <option value="5">Samstag</option>
                            <option value="6">Sonntag</option>
                        </select>
                    </div>
                    <p id="recurringHint" class="recurring-hint hidden"></p>
                </div>
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

    // Recurring: Wochentag-Row ein-/ausblenden
    document.getElementById('editRecurringInterval').addEventListener('change', updateRecurringUI);

    document.getElementById('editLabelInput').addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const val = e.target.value.trim();
            if (!val) return;
            const lbl = val.toLowerCase().replace(/\s+/g, '-');
            const board = activeBoard();
            if (!board.globalLabels) board.globalLabels = [];
            if (!board.globalLabels.includes(lbl)) { board.globalLabels.push(lbl); saveState(state); }
            if (!editModalLabels.includes(lbl)) { editModalLabels.push(lbl); refreshEditLabelChips(); }
            e.target.value = '';
        }
    });
    buildStatusOptions();
}

function updateRecurringUI() {
    const interval = document.getElementById('editRecurringInterval').value;
    const weekdayRow = document.getElementById('recurringWeekdayRow');
    const hint       = document.getElementById('recurringHint');

    weekdayRow.classList.toggle('hidden', interval !== 'weekly');

    if (interval === 'none') {
        hint.classList.add('hidden');
    } else {
        hint.classList.remove('hidden');
        if (interval === 'daily') {
            hint.textContent = '↩ Issue wird täglich beim Öffnen der App nach Open verschoben.';
        } else {
            const days = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
            const day  = days[document.getElementById('editRecurringWeekday').value] || 'Montag';
            hint.textContent = `↩ Issue wird jeden ${day} beim Öffnen der App nach Open verschoben.`;
        }
    }
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

    // Recurring-Felder befüllen
    const rec = issue.recurring || { interval: 'none', weekday: 0, lastReset: null };
    document.getElementById('editRecurringInterval').value = rec.interval || 'none';
    document.getElementById('editRecurringWeekday').value  = rec.weekday ?? 0;
    updateRecurringUI();

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

    // Recurring speichern
    const interval = document.getElementById('editRecurringInterval').value;
    if (interval === 'none') {
        issue.recurring = null;
    } else {
        issue.recurring = {
            interval,
            weekday:   parseInt(document.getElementById('editRecurringWeekday').value, 10),
            lastReset: issue.recurring?.lastReset || null
        };
    }

    saveState(state);
    closeEditModal();
    renderIssues();
    rebuildLabelFilter();
    if (interval !== 'none') showToast('🔄 Wiederkehrendes Issue gespeichert');
}

// ── Label Manager Modal ─────────────────────────────────────────────
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
    const labels = getAllLabels(activeBoard());
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
        chip.style.background   = labelColor(lbl) + '22';
        chip.style.color        = labelColor(lbl);
        chip.style.borderColor  = labelColor(lbl) + '55';
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

// ── Label Dropdown Helper ──────────────────────────────────────────
function buildLabelDropdown(selectId, activeLabels, onToggle) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="">+ Label auswählen...</option>';
    getAllLabels(activeBoard()).forEach(lbl => {
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

function renderLabelChips(labels, container, onRemove) {
    container.innerHTML = '';
    labels.forEach(lbl => {
        const chip = document.createElement('span');
        chip.className = 'label-chip';
        chip.style.background  = labelColor(lbl) + '22';
        chip.style.color       = labelColor(lbl);
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
