// DOM/HUD layer: splash, country picker, mode/difficulty/players/skins/missions, shop, scoreboard, overlays, power meters.
//
// Note on events: everything that lives inside a scrollable container (.menu-scroll,
// .country-grid) is wired with 'click', not 'pointerdown'. 'click' is what browsers use to
// distinguish a genuine tap from the start of a scroll/swipe gesture — 'pointerdown' fires the
// instant a finger touches down, before that distinction is made, which both mis-fires taps
// during a scroll attempt and (since these handlers rebuild their container's innerHTML) yanks
// the touched element out from under the finger mid-gesture, killing the scroll entirely.
// Fast-response controls that are NOT inside a scrolling container (joystick, shoot/switch
// buttons, pause) still use 'pointerdown' for minimum input latency.

const UI = (() => {
  const el = (id) => document.getElementById(id);

  const selection = { a: 'BRA', b: 'ARG', mode: 'normal', difficulty: 'normal', kit: 'sash', ballSkin: 'classic', players: 1 };

  function renderGrid(teamKey) {
    const grid = el(teamKey === 'a' ? 'grid-team-a' : 'grid-team-b');
    grid.innerHTML = '';
    const list = COUNTRIES.concat(EASTER_EGGS.isUnlocked('ghost_team') ? [GHOST_TEAM] : []);
    list.forEach((c) => {
      const cell = document.createElement('div');
      cell.className = 'country-cell' + (c.code === 'GHO' ? ' ghost' : '') + (selection[teamKey] === c.code ? ' selected' : '');
      cell.textContent = c.flag;
      cell.title = c.name;
      cell.addEventListener('click', () => {
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
      btn.addEventListener('click', () => {
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
      const unlocked = PROGRESS.isUnlocked('ballSkin', skin.id);
      const price = PROGRESS.priceOf('ballSkin', skin.id);
      const dot = document.createElement('div');
      dot.className = 'skin-swatch' + (selection.ballSkin === skin.id ? ' selected' : '') + (unlocked ? '' : ' locked');
      dot.style.background = `radial-gradient(circle at 35% 30%, ${skin.base}, ${skin.shade})`;
      dot.title = unlocked ? skin.name : `${skin.name} · 🪙${price}`;
      dot.textContent = unlocked ? '' : '🔒';
      dot.addEventListener('click', () => {
        if (unlocked) {
          selection.ballSkin = skin.id;
          SFX.click();
          renderBallSkins();
          return;
        }
        buyBallSkin(skin.id, true);
      });
      row.appendChild(dot);
    });
  }

  function renderKitButtons() {
    const container = el('kit-toggle');
    container.querySelectorAll('.seg-btn').forEach((btn) => {
      const id = btn.dataset.kit;
      const style = findKitStyle(id);
      const unlocked = PROGRESS.isUnlocked('kit', id);
      const price = PROGRESS.priceOf('kit', id);
      btn.textContent = unlocked ? style.name.toUpperCase() : `${style.name.toUpperCase()} 🔒${price}`;
      btn.classList.toggle('selected', selection.kit === id);
      btn.onclick = () => {
        if (unlocked) {
          selection.kit = id;
          SFX.click();
          renderKitButtons();
          return;
        }
        buyKit(id, true);
      };
    });
  }

  function buyBallSkin(id, selectAfter) {
    const skin = findBallSkin(id);
    const res = PROGRESS.tryPurchase('ballSkin', id);
    if (res.ok) {
      if (selectAfter) selection.ballSkin = id;
      SFX.goal();
      EASTER_EGGS.toast(`⚽ ¡Desbloqueaste el balón ${skin.name}!`);
      renderBallSkins();
      renderShop();
      renderCoinBalance();
      (res.unlocks || []).forEach((a) => EASTER_EGGS.toast(`🏅 ${a.text} (+${a.reward} 🪙)`));
    } else {
      SFX.postHit();
      EASTER_EGGS.toast(`🪙 Te faltan ${res.needed} monedas`);
    }
  }

  function buyKit(id, selectAfter) {
    const style = findKitStyle(id);
    const res = PROGRESS.tryPurchase('kit', id);
    if (res.ok) {
      if (selectAfter) selection.kit = id;
      SFX.goal();
      EASTER_EGGS.toast(`👕 ¡Desbloqueaste la camiseta ${style.name}!`);
      renderKitButtons();
      renderShop();
      renderCoinBalance();
      (res.unlocks || []).forEach((a) => EASTER_EGGS.toast(`🏅 ${a.text} (+${a.reward} 🪙)`));
    } else {
      SFX.postHit();
      EASTER_EGGS.toast(`🪙 Te faltan ${res.needed} monedas`);
    }
  }

  function renderShop() {
    el('shop-coin-balance').textContent = PROGRESS.coins;

    const ballsEl = el('shop-balls');
    ballsEl.innerHTML = '';
    BALL_SKINS.forEach((skin) => {
      const unlocked = PROGRESS.isUnlocked('ballSkin', skin.id);
      const price = PROGRESS.priceOf('ballSkin', skin.id);
      const card = document.createElement('div');
      card.className = 'shop-item' + (unlocked ? ' owned' : '') + (selection.ballSkin === skin.id ? ' selected' : '');
      card.innerHTML = `
        <div class="shop-item-swatch" style="background:radial-gradient(circle at 35% 30%, ${skin.base}, ${skin.shade})"></div>
        <div class="shop-item-name">${skin.name}</div>
        ${unlocked ? '<div class="shop-item-owned-tag">✅ Tuyo</div>' : `<div class="shop-item-price">🪙 ${price}</div>`}
      `;
      card.addEventListener('click', () => {
        if (unlocked) { selection.ballSkin = skin.id; SFX.click(); renderShop(); renderBallSkins(); return; }
        buyBallSkin(skin.id, true);
      });
      ballsEl.appendChild(card);
    });

    const kitsEl = el('shop-kits');
    kitsEl.innerHTML = '';
    KIT_STYLES.forEach((style) => {
      const unlocked = PROGRESS.isUnlocked('kit', style.id);
      const price = PROGRESS.priceOf('kit', style.id);
      const card = document.createElement('div');
      card.className = 'shop-item' + (unlocked ? ' owned' : '') + (selection.kit === style.id ? ' selected' : '');
      card.innerHTML = `
        <div class="shop-item-swatch" style="background:#2f6fed"></div>
        <div class="shop-item-name">${style.name}</div>
        ${unlocked ? '<div class="shop-item-owned-tag">✅ Tuyo</div>' : `<div class="shop-item-price">🪙 ${price}</div>`}
      `;
      card.addEventListener('click', () => {
        if (unlocked) { selection.kit = style.id; SFX.click(); renderShop(); renderKitButtons(); return; }
        buyKit(style.id, true);
      });
      kitsEl.appendChild(card);
    });
  }

  function renderCoinBalance() { el('coin-balance').textContent = PROGRESS.coins; }

  function renderMissions() {
    const list = el('mission-list');
    list.innerHTML = '';
    PROGRESS.dailyMissions.forEach((m) => {
      const row = document.createElement('div');
      row.className = 'mission-row' + (m.done ? ' done' : '');
      const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
      row.innerHTML = `
        <div class="mission-top">
          <span>${m.done ? '✅ ' : ''}${m.text}</span>
          <span class="mission-reward">🪙${m.reward}</span>
        </div>
        <div class="mission-bar"><div class="mission-bar-fill" style="width:${pct}%"></div></div>
      `;
      list.appendChild(row);
    });
  }

  function updateModeVisibility() {
    const isTournament = selection.mode === 'tournament';
    el('row-team-b').classList.toggle('hidden', isTournament);
    el('row-tournament-note').classList.toggle('hidden', !isTournament);
  }

  function updatePlayersVisibility() {
    const isTwoPlayer = String(selection.players) === '2';
    el('row-mode').classList.toggle('hidden', isTwoPlayer);
    el('row-difficulty').classList.toggle('hidden', isTwoPlayer);
    el('row-2p-note').classList.toggle('hidden', !isTwoPlayer);
    el('row-team-b-label').textContent = isTwoPlayer ? 'Jugador 2' : 'Rival';
    // 2P always needs the team-B picker (P2 must pick a country); leaving 2P re-applies the
    // tournament-mode visibility rule, which may hide it again.
    el('row-team-b').classList.remove('hidden');
    if (!isTwoPlayer) updateModeVisibility();
  }

  function initMenu() {
    renderGrid('a');
    renderGrid('b');
    renderBallSkins();
    renderKitButtons();
    renderCoinBalance();
    renderMissions();
    renderShop();
    el('pick-a-name').textContent = findCountry(selection.a).name;
    el('pick-b-name').textContent = findCountry(selection.b).name;
    el('game-title').addEventListener('pointerdown', () => EASTER_EGGS.onTitleTap());
    el('btn-start').addEventListener('pointerdown', () => {
      SFX.click();
      COMMENTARY.unlock();
      hideOverlay('overlay-splash');
      showOverlay('overlay-menu');
    });
    el('btn-shop').addEventListener('click', () => { SFX.click(); renderShop(); showOverlay('overlay-shop'); });
    el('btn-shop-close').addEventListener('click', () => { SFX.click(); hideOverlay('overlay-shop'); });

    wireSegmented('players-toggle', 'players', 'players', updatePlayersVisibility);
    wireSegmented('mode-toggle', 'mode', 'mode', updateModeVisibility);
    wireSegmented('difficulty-toggle', 'diff', 'difficulty');
    updateModeVisibility();
    updatePlayersVisibility();
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
      twoPlayer: String(selection.players) === '2',
    };
  }

  // called after a match ends, so the menu reflects newly earned coins/missions next time it's shown
  function refreshProgress() {
    renderCoinBalance();
    renderMissions();
    renderBallSkins();
    renderKitButtons();
    renderShop();
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

  const powerState = { a: false, b: false };
  function setPower(side, fraction) {
    el(side === 'b' ? 'power-fill-p2' : 'power-fill').style.height = Math.round(fraction * 100) + '%';
    if (!powerState[side]) { el(side === 'b' ? 'power-meter-p2' : 'power-meter').classList.add('visible'); powerState[side] = true; }
  }
  function hidePower(side) {
    el(side === 'b' ? 'power-meter-p2' : 'power-meter').classList.remove('visible');
    powerState[side] = false;
  }

  return { initMenu, getSelection, refreshProgress, showOverlay, hideOverlay, updateHud, flashGoal, showMatchEnd, setPower, hidePower };
})();
