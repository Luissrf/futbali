// DOM/HUD layer: country picker, scoreboard, overlays, power meter.

const UI = (() => {
  const el = (id) => document.getElementById(id);

  const selection = { a: 'BRA', b: 'ARG' };

  function renderGrid(teamKey) {
    const grid = el(teamKey === 'a' ? 'grid-team-a' : 'grid-team-b');
    grid.innerHTML = '';
    const list = COUNTRIES.concat(EASTER_EGGS.isUnlocked('ghost_team') ? [GHOST_TEAM] : []);
    list.forEach((c) => {
      const cell = document.createElement('div');
      cell.className = 'country-cell' + (c.code === 'GHO' ? ' ghost' : '') + (selection[teamKey] === c.code ? ' selected' : '');
      cell.textContent = c.flag;
      cell.title = c.name;
      cell.addEventListener('pointerdown', () => {
        if (c.code === 'BRA') EASTER_EGGS.onFlagTap('BRA');
        selection[teamKey] = c.code;
        el(teamKey === 'a' ? 'pick-a-name' : 'pick-b-name').textContent = c.name;
        SFX.click();
        renderGrid(teamKey);
      });
      grid.appendChild(cell);
    });
  }

  function initMenu() {
    renderGrid('a');
    renderGrid('b');
    el('pick-a-name').textContent = findCountry(selection.a).name;
    el('pick-b-name').textContent = findCountry(selection.b).name;
    el('game-title').addEventListener('pointerdown', () => EASTER_EGGS.onTitleTap());
  }

  function refreshGridsIfGhostUnlocked() {
    renderGrid('a');
    renderGrid('b');
  }
  window.onGhostTeamUnlocked = refreshGridsIfGhostUnlocked;

  function getSelection() {
    return {
      a: selection.a === 'GHO' ? GHOST_TEAM : findCountry(selection.a),
      b: selection.b === 'GHO' ? GHOST_TEAM : findCountry(selection.b),
    };
  }

  function showOverlay(id) { el(id).classList.remove('hidden'); }
  function hideOverlay(id) { el(id).classList.add('hidden'); }

  function updateHud(state) {
    el('score-a').textContent = state.scoreA;
    el('score-b').textContent = state.scoreB;
    el('hud-name-a').textContent = state.teamA.name.toUpperCase();
    el('hud-name-b').textContent = state.teamB.name.toUpperCase();
    document.querySelector('.badge-a').style.background = state.teamA.main;
    document.querySelector('.badge-b').style.background = state.teamB.main;
    const mins = Math.floor(state.timeLeft / 60);
    const secs = Math.floor(state.timeLeft % 60);
    el('clock').textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    el('half-label').textContent = state.half === 1 ? '1ER TIEMPO' : '2DO TIEMPO';
  }

  function flashGoal(text) {
    el('goal-text').textContent = text;
    showOverlay('overlay-goal');
    setTimeout(() => hideOverlay('overlay-goal'), 1500);
  }

  function showFulltime(scoreA, scoreB, teamAName, teamBName) {
    el('fulltime-title').textContent = 'FINAL DEL PARTIDO';
    el('fulltime-score').textContent = `${teamAName} ${scoreA} - ${scoreB} ${teamBName}`;
    showOverlay('overlay-fulltime');
  }

  let powerVisible = false;
  function setPower(fraction) {
    el('power-fill').style.height = Math.round(fraction * 100) + '%';
    if (!powerVisible) { el('power-meter').classList.add('visible'); powerVisible = true; }
  }
  function hidePower() {
    el('power-meter').classList.remove('visible');
    powerVisible = false;
  }

  return { initMenu, getSelection, showOverlay, hideOverlay, updateHud, flashGoal, showFulltime, setPower, hidePower };
})();
