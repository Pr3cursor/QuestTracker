// ═══════════════════════════════════════════════════════════════════
//  helpers.js — Reine Utility-Funktionen
//  Kein DOM, kein State, keine Side-Effects.
// ═══════════════════════════════════════════════════════════════════

// ── URL / Text Helpers ─────────────────────────────────────────────
function normalizeUrl(url) {
    const t = url.trim();
    if (!t) return null;
    const n = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    try { new URL(n); return n; } catch { return null; }
}
function parseLinks(raw) {
    return raw.split('\n').map(normalizeUrl).filter(Boolean);
}

// ── Color Helpers ──────────────────────────────────────────────────
function hexToRgb(hex) {
    return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');
}

const LABEL_PALETTE = [
    '#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c',
    '#3498db','#9b59b6','#e91e63','#00bcd4','#8bc34a'
];
function labelColor(text) {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
    return LABEL_PALETTE[h % LABEL_PALETTE.length];
}

// ── Date Helpers ───────────────────────────────────────────────────
function formatDate(iso) {
    if (!iso) return null;
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
}
function isOverdue(iso) {
    if (!iso) return false;
    return new Date(iso) < new Date(new Date().toDateString());
}
function isDueSoon(iso) {
    if (!iso) return false;
    const diff = new Date(iso) - new Date(new Date().toDateString());
    return diff >= 0 && diff <= 2 * 86400000;
}

// ── Label Helpers ──────────────────────────────────────────────────
// Gibt alle Labels eines Boards zurück (globalLabels + Orphans aus Issues)
function getAllLabels(board) {
    const global = board.globalLabels || [];
    const fromIssues = new Set();
    board.issues.forEach(i => (i.labels || []).forEach(l => fromIssues.add(l)));
    const merged = [...global];
    fromIssues.forEach(l => { if (!merged.includes(l)) merged.push(l); });
    return merged.sort();
}
