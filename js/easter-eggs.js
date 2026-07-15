// Secret unlockables. None of these are hinted anywhere in the UI on purpose — find them by playing around.
//  1) Tap the "FUTBALI" title 5 times fast on the main menu  -> Modo Fiesta (rainbow ball trail + confetti while playing)
//  2) Hold the pause button ~3s during a match              -> Modo Gigante (huge heads for 10s)
//  3) Score 3 unanswered goals in one match                 -> secret hype line + confetti (one-time discovery)
//  4) Tap the Brazil flag 4 times fast in the team picker    -> unlocks the hidden "Fantasmas FC" ghost team

const EASTER_EGGS = (() => {
  const STORAGE_KEY = 'futali_eggs_v1';
  let unlocked = {};
  try { unlocked = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { unlocked = {}; }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked)); } catch (e) { /* ignore */ }
  }

  function toast(message, ms = 2600) {
    let el = document.getElementById('egg-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'egg-toast';
      document.getElementById('game-wrap').appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), ms);
  }

  function confetti(count = 60) {
    let layer = document.getElementById('confetti-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'confetti-layer';
      document.getElementById('game-wrap').appendChild(layer);
    }
    const colors = ['#ffd23f', '#ff5e3a', '#2f6fed', '#4be36a', '#e0356b', '#fff'];
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + '%';
      piece.style.background = colors[(Math.random() * colors.length) | 0];
      piece.style.animationDuration = (1.6 + Math.random() * 1.2) + 's';
      piece.style.animationDelay = (Math.random() * 0.4) + 's';
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      layer.appendChild(piece);
      setTimeout(() => piece.remove(), 3200);
    }
  }

  function unlockOnce(id, message, { speak, withConfetti = true } = {}) {
    const isNew = !unlocked[id];
    if (isNew) { unlocked[id] = true; persist(); }
    toast(message);
    if (withConfetti) confetti();
    if (speak) COMMENTARY.say(speak);
    return isNew;
  }

  // generic rapid-tap tracker: calls onComplete once `needed` taps land within `windowMs` of each other
  function makeTapTracker(needed, windowMs, onComplete) {
    let count = 0, last = 0;
    return function tap() {
      const now = performance.now();
      if (now - last > windowMs) count = 0;
      count++;
      last = now;
      if (count >= needed) { count = 0; onComplete(); }
    };
  }

  const state = { partyMode: false, giantHeads: false, giantUntil: 0, ghostTeamFound: !!unlocked.ghost_team };

  const titleTracker = makeTapTracker(5, 1600, () => {
    state.partyMode = !state.partyMode;
    unlockOnce('party_mode', state.partyMode ? '🎉 ¡Modo Fiesta activado! Balón arcoíris' : 'Modo Fiesta desactivado', {
      speak: state.partyMode ? '¡Encontraste el modo fiesta secreto!' : null,
    });
  });

  function unlockGhostTeam() {
    if (unlocked.ghost_team) { toast('👻 Ya desbloqueaste a los Fantasmas FC'); return false; }
    state.ghostTeamFound = true;
    unlockOnce('ghost_team', '👻 ¡Equipo secreto desbloqueado: Fantasmas FC!', { speak: 'Encontraste un equipo fantasma secreto' });
    if (typeof onGhostTeamUnlocked === 'function') onGhostTeamUnlocked();
    return true;
  }

  const flagTracker = makeTapTracker(4, 1400, unlockGhostTeam);

  return {
    state,
    toast,
    confetti,
    isUnlocked: (id) => !!unlocked[id],
    unlockGhostTeam,

    onTitleTap() { titleTracker(); },
    onFlagTap(code) { if (code === 'BRA') flagTracker(); },

    triggerGiantHeads() {
      state.giantHeads = true;
      state.giantUntil = performance.now() + 10000;
      unlockOnce('giant_heads', '🤯 ¡Modo Gigante! 10 segundos', { speak: '¡Cabezas gigantes activadas!' });
    },
    updateGiantHeads() {
      if (state.giantHeads && performance.now() > state.giantUntil) state.giantHeads = false;
    },

    checkStreak(unansweredGoals) {
      if (unansweredGoals === 3 && !unlocked.streak_king) {
        unlockOnce('streak_king', `🔥 ¡Racha de 3 goles seguidos!`, { speak: null });
        COMMENTARY.streak();
      }
    },
  };
})();
