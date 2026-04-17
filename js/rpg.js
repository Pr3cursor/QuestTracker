// ═══════════════════════════════════════════════════════════════════
//  rpg.js — XP, Level & Quest-Typ System
// ═══════════════════════════════════════════════════════════════════

const QUEST_TYPES = {
    main:      { label: '⚔️ Main Quest',    xp: 150, color: '#e74c3c' },
    side:      { label: '📜 Side Quest',    xp: 75,  color: '#3498db' },
    daily:     { label: '🔁 Daily Quest',   xp: 50,  color: '#27ae60' },
    legendary: { label: '🏆 Legendary',     xp: 300, color: '#f39c12' }
};

const LEVEL_TITLES = [
    'Novice', 'Apprentice', 'Squire', 'Adventurer', 'Knight',
    'Veteran', 'Champion', 'Hero', 'Legend', 'Mythic'
];

function xpForLevel(level) {
    return Math.floor(100 * Math.pow(1.4, level - 1));
}

function getLevelFromXP(xp) {
    let level = 1;
    let total = 0;
    while (total + xpForLevel(level) <= xp) {
        total += xpForLevel(level);
        level++;
    }
    return level;
}

function getLevelTitle(level) {
    return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
}

function getXPProgress(xp) {
    let level = 1, total = 0;
    while (total + xpForLevel(level) <= xp) {
        total += xpForLevel(level);
        level++;
    }
    const current = xp - total;
    const needed  = xpForLevel(level);
    return { level, current, needed, pct: Math.floor((current / needed) * 100) };
}

function getRPGState() {
    const raw = localStorage.getItem('qt-rpg');
    if (raw) return JSON.parse(raw);
    return { xp: 0 };
}

function saveRPGState(rpg) {
    localStorage.setItem('qt-rpg', JSON.stringify(rpg));
}

function awardXP(questType) {
    const rpg    = getRPGState();
    const oldLvl = getLevelFromXP(rpg.xp);
    const gained = (QUEST_TYPES[questType] || QUEST_TYPES.side).xp;
    rpg.xp      += gained;
    saveRPGState(rpg);
    const newLvl = getLevelFromXP(rpg.xp);
    updateXPBar();
    if (newLvl > oldLvl) triggerLevelUp(newLvl);
    return gained;
}

function updateXPBar() {
    const rpg  = getRPGState();
    const prog = getXPProgress(rpg.xp);
    const bar  = document.getElementById('xpBarFill');
    const txt  = document.getElementById('xpBarText');
    const lvl  = document.getElementById('playerLevel');
    const ttl  = document.getElementById('playerTitle');
    if (bar) bar.style.width = prog.pct + '%';
    if (txt) txt.textContent = `${prog.current} / ${prog.needed} XP`;
    if (lvl) lvl.textContent = `LVL ${prog.level}`;
    if (ttl) ttl.textContent = getLevelTitle(prog.level);
}

function triggerLevelUp(level) {
    const overlay = document.getElementById('levelUpOverlay');
    const lvlEl   = document.getElementById('levelUpNumber');
    const ttlEl   = document.getElementById('levelUpTitle');
    if (!overlay) return;
    if (lvlEl) lvlEl.textContent = level;
    if (ttlEl) ttlEl.textContent = getLevelTitle(level);
    overlay.classList.remove('hidden');
    setTimeout(() => overlay.classList.add('hidden'), 3000);
}
