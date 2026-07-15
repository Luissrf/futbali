// DOM/HUD layer: country picker, mode/difficulty/skins pickers, scoreboard, overlays, power meter.

const UI = (() => {
  const el = (id) => document.getElementById(id);

  const selection = { a: 'BRA', b: 'ARG', mode: 'normal', difficulty: 'normal', kit: 'sash', ballSkin: 'classic' };

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

  function wireSegmented(containerId, dataAttr, key, onChange) {
    const container = el(containerId);
    container.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.addEventListener('pointerdown', () => {
        selection[key] = btn.dataset[dataAttr];
        container.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('selected', b === btn));
        SFX.click();
        if (onChange) onChange(selection[key]);
      });
    });
  }

  function renderBallSkins() {
    const row = el('ball-skin-row');
    row.innerHTML = '';
    BALL_SKINS.forEach((skin) => {
      const dot = document.createElement('div');
      dot.className = 'skin-swatch' + (selection.ballSkin === skin.id ? ' selected' : '');
      dot.style.background = `radial-gradient(circle at 35% 30%, ${skin.base}, ${skin.shade})`;
      dot.title = skin.name;
      dot.addEventListener('pointerdown', () => {
        selection.ballSkin = skin.id;
        SFX.click();
        renderBallSkins();
      });
      row.appendChild(dot);
    });
  }

  function updateModeVisibility() {
    const isTournament = selection.mode === 'tournament';
    el('row-team-b').classList.toggle('hidden', isTournament);
    el('row-tournament-note').classList.toggle('hidden', !isTournament);
  }

  function initMenu() {
    renderGrid('a');
    renderGrid('b');
    renderBallSkins();
    el('pick-a-name').textContent = findCountry(selection.a).name;
    el('pick-b-name').textContent = findCountry(selection.b).name;
    el('game-title').addEventListener('pointerdown', () => EASTER_EGGS.onTitleTap());

    wireSegmented('mode-toggle', 'mode', 'mode', updateModeVisibility);
    wireSegmented('difficulty-toggle', 'diff', 'difficulty');
    wireSegmented('kit-toggle', 'kit', 'kit');
    updateModeVisibility();
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
      mode: selection.mode,
      difficulty: findDifficulty(selection.difficulty),
      kit: findKitStyle(selection.kit),
      ballSkin: findBallSkin(selection.ballSkin),
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

  // cfg: { title, scoreLine, primaryLabel, primaryAction, secondaryLabel, secondaryAction }
  function showMatchEnd(cfg) {
    el('fulltime-title').textContent = cfg.title;
    el('fulltime-score').textContent = cfg.scoreLine;
    const primary = el('btn-fulltime-primary');
    const secondary = el('btn-fulltime-secondary');
    primary.textContent = cfg.primaryLabel;
    secondary.textContent = cfg.secondaryLabel;
    primary.onclick = () => { hideOverlay('overlay-fulltime'); cfg.primaryAction(); };
    secondary.onclick = () => { hideOverlay('overlay-fulltime'); cfg.secondaryAction(); };
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

  return { initMenu, getSelection, showOverlay, hideOverlay, updateHud, flashGoal, showMatchEnd, setPower, hidePower };
})();
