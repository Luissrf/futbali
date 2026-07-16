// Game loop, match state machine, physics resolution, scoring — wires every other module together.

const HALF_SECONDS = 90;
const TACKLE_CHANCE_PER_60FPS = 0.034;

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const state = {
  players: [],
  ball: null,
  controlledPlayer: null,
  controlledPlayerB: null, // set only in 2-player mode
  possessor: null,
  teamA: null,
  teamB: null,
  scoreA: 0,
  scoreB: 0,
  streakA: 0,
  streakB: 0,
  half: 1,
  timeLeft: HALF_SECONDS,
  phase: 'menu', // menu | playing | paused | goal | fulltime
  switchTimer: 0.25,
  switchTimerB: 0.25,
  tournament: null, // null | { stage, opponents: [country, country] }
  twoPlayer: false,
  matchTackles: 0,
  matchHumanGoals: 0,
  matchSecondHalfGoal: false,
};

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const scale = Math.min(window.innerWidth / FIELD.W, window.innerHeight / FIELD.H);
  canvas.style.width = Math.floor(FIELD.W * scale) + 'px';
  canvas.style.height = Math.floor(FIELD.H * scale) + 'px';
  canvas.width = Math.floor(FIELD.W * scale * dpr);
  canvas.height = Math.floor(FIELD.H * scale * dpr);
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
}

function buildTeam(team, country) {
  TEAM_COLOR[team] = { main: country.main, dark: country.dark, trim: country.trim };
  const numbers = [1, 4, 5, 8, 9];
  const speedMul = team === 'B' && !state.twoPlayer ? RUNTIME.difficulty.speedMul : 1;
  return FORMATION.map((f, i) => {
    const pos = homePosition(team, f.lx, f.ly);
    const p = new Player({ team, role: f.role, number: numbers[i], x: pos.x, y: pos.y, isGK: f.role === 'GK' });
    p.formation = { lx: f.lx, ly: f.ly };
    p.maxSpeed *= speedMul;
    return p;
  });
}

function setupKickoff(kickingTeam) {
  for (const p of state.players) {
    const pos = homePosition(p.team, p.formation.lx, p.formation.ly);
    p.homeX = pos.x; p.homeY = pos.y;
    p.x = pos.x; p.y = pos.y;
    p.vx = 0; p.vy = 0;
  }
  state.ball.x = FIELD.CX; state.ball.y = FIELD.CY;
  state.ball.vx = 0; state.ball.vy = 0; state.ball.trail = [];
  state.possessor = state.players.find((p) => p.team === kickingTeam && p.role === 'MID');
  // a finger can be resting on the joystick/shoot button through the frozen goal-celebration
  // window (the update loop that would normally consume/clear these is paused), so force both
  // rigs back to neutral here rather than risk carrying a stale gesture into the new kickoff
  INPUT.reset();
  INPUT2.reset();
}

// trackProgress=false is used only for the cosmetic idle match built behind the splash/menu at
// startup, so it doesn't falsely count toward the "distinct countries played today" mission.
function loadMatch(countryA, countryB, { trackProgress = true } = {}) {
  // an optional custom team name overlays the display name only — the chosen country still
  // supplies the flag/colors, so buildTeam still gets the real country object (with .name kept
  // on it via the spread) for jersey colors, while state.teamA shows the player's own name.
  const displayA = PROGRESS.teamName ? { ...countryA, name: PROGRESS.teamName } : countryA;
  state.teamA = displayA;
  state.teamB = countryB;
  state.players = [...buildTeam('A', displayA), ...buildTeam('B', countryB)];
  state.ball = new Ball(FIELD.CX, FIELD.CY);
  state.scoreA = 0; state.scoreB = 0;
  state.streakA = 0; state.streakB = 0;
  state.half = 1; state.timeLeft = HALF_SECONDS;
  state.matchTackles = 0;
  state.matchHumanGoals = 0;
  state.matchSecondHalfGoal = false;
  setupKickoff('A');
  state.controlledPlayer = state.players.find((p) => p.team === 'A' && p.role === 'MID');
  setControlled(state.controlledPlayer);
  if (state.twoPlayer) {
    setControlledB(state.players.find((p) => p.team === 'B' && p.role === 'MID'));
  } else {
    state.controlledPlayerB = null;
  }
  state.phase = 'playing';
  if (trackProgress) {
    PROGRESS.recordCountryPlayed(countryA.code);
    if (state.twoPlayer) PROGRESS.recordCountryPlayed(countryB.code);
  }
  UI.updateHud(state);
}

function applyRuntimeFromSelection(sel) {
  RUNTIME.difficulty = sel.difficulty;
  RUNTIME.ballSkin = sel.ballSkin;
  RUNTIME.kitStyle = { A: sel.kit, B: findKitStyle('sash') };
}

function startTournament(userCountry) {
  const pool = COUNTRIES.filter((c) => c.code !== userCountry.code);
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  const opponents = shuffled.slice(0, 2);
  state.tournament = { stage: 0, opponents };
  loadMatch(userCountry, opponents[0]);
  EASTER_EGGS.toast(`🏆 Fase 1 de 2 · vs ${opponents[0].flag} ${opponents[0].name}`);
}

function quitToMenu() {
  state.phase = 'menu';
  state.tournament = null;
  UI.hideOverlay('overlay-pause');
  UI.hideOverlay('overlay-fulltime');
  UI.showOverlay('overlay-menu');
}

function setControlled(p) {
  if (state.controlledPlayer) state.controlledPlayer.isControlled = false;
  state.controlledPlayer = p;
  p.isControlled = true;
}

function setControlledB(p) {
  if (state.controlledPlayerB) state.controlledPlayerB.isControlled = false;
  state.controlledPlayerB = p;
  p.isControlled = true;
}

function resetForGoalKick(defendingTeam) {
  const b = state.ball;
  b.x = FIELD.CX;
  b.y = defendingTeam === 'B' ? FIELD.TOP + 40 : FIELD.BOTTOM - 40;
  b.vx = 0; b.vy = 0; b.trail = [];
  state.possessor = state.players.find((p) => p.team === defendingTeam && p.isGK);
  SFX.whistle();
}

function triggerGoal(scoringTeam) {
  state.phase = 'goal';
  const isHumanGoal = scoringTeam === 'A' || (scoringTeam === 'B' && state.twoPlayer);
  if (isHumanGoal) {
    state.matchHumanGoals++;
    if (state.half === 2) state.matchSecondHalfGoal = true;
  }
  if (scoringTeam === 'A') {
    state.scoreA++;
    state.streakA++; state.streakB = 0;
    SFX.goal();
    COMMENTARY.goalHuman();
    EASTER_EGGS.confetti(36);
    EASTER_EGGS.checkStreak(state.streakA);
  } else {
    state.scoreB++;
    state.streakB++; state.streakA = 0;
    SFX.goal();
    COMMENTARY.goalRival();
    EASTER_EGGS.confetti(16);
  }
  UI.updateHud(state);
  UI.flashGoal(scoringTeam === 'A' ? `¡GOL DE ${state.teamA.name.toUpperCase()}!` : `¡GOL DE ${state.teamB.name.toUpperCase()}!`);
  setTimeout(() => {
    if (state.phase === 'goal') {
      setupKickoff(scoringTeam === 'A' ? 'B' : 'A');
      state.phase = 'playing';
    }
  }, 1600);
}

// Tallies the just-finished match into coins/missions/achievements and refreshes the menu's
// progress display. Runs for every match (normal, each tournament round, 1P and 2P alike).
function settleMatchProgress() {
  const wonMatch = state.twoPlayer ? state.scoreA !== state.scoreB : state.scoreA > state.scoreB;
  const drawMatch = state.scoreA === state.scoreB;
  const hardWin = wonMatch && !state.twoPlayer && RUNTIME.difficulty === DIFFICULTIES.hard;
  const tournamentRoundWin = !!state.tournament && wonMatch;

  const summary = PROGRESS.finishMatch({
    goals: state.matchHumanGoals,
    tackles: state.matchTackles,
    win: wonMatch ? 1 : 0,
    draw: drawMatch ? 1 : 0,
    hardWin: hardWin ? 1 : 0,
    tournamentRoundWin: tournamentRoundWin ? 1 : 0,
    secondHalfGoal: state.matchSecondHalfGoal ? 1 : 0,
    twoPlayer: state.twoPlayer,
  });

  const parts = [`+${summary.coinsEarned} 🪙`];
  summary.missions.forEach((m) => parts.push(`🎯 ${m.text} (+${m.reward} 🪙)`));
  summary.achievements.forEach((a) => parts.push(`🏅 ${a.text} (+${a.reward} 🪙)`));
  EASTER_EGGS.toast(parts.join(' · '), 4000);
  UI.refreshProgress();
}

function handleHalfEnd() {
  if (state.half === 1) {
    state.half = 2;
    state.timeLeft = HALF_SECONDS;
    COMMENTARY.halftime();
    UI.flashGoal('DESCANSO');
    setupKickoff('B');
  } else {
    state.phase = 'fulltime';
    SFX.whistleLong();
    const scoreLine = `${state.teamA.name} ${state.scoreA} - ${state.scoreB} ${state.teamB.name}`;
    settleMatchProgress();

    if (state.tournament) {
      const won = state.scoreA > state.scoreB;
      const t = state.tournament;
      if (won && t.stage < t.opponents.length - 1) {
        t.stage++;
        const next = t.opponents[t.stage];
        COMMENTARY.fulltime('win');
        EASTER_EGGS.confetti(30);
        UI.showMatchEnd({
          title: `¡GANASTE LA FASE ${t.stage}!`,
          scoreLine,
          primaryLabel: `SIGUIENTE: ${next.name.toUpperCase()}`,
          primaryAction: () => {
            loadMatch(state.teamA, next);
            EASTER_EGGS.toast(`🏆 Fase ${t.stage + 1} de ${t.opponents.length} · vs ${next.flag} ${next.name}`);
            COMMENTARY.kickoff();
          },
          secondaryLabel: 'MENÚ',
          secondaryAction: quitToMenu,
        });
      } else if (won) {
        COMMENTARY.say(`¡Sos el campeón del torneo, ${COMMENTARY.STAR_NAME}! Un crack total.`);
        EASTER_EGGS.confetti(50);
        const champ = PROGRESS.recordTournamentChampion();
        const achLine = champ.achievement ? ` · 🏅 ${champ.achievement.text} (+${champ.achievement.reward} 🪙)` : '';
        EASTER_EGGS.toast(`🏆 +${champ.coinsEarned} 🪙 de campeón${achLine}`, 4000);
        UI.refreshProgress();
        UI.showMatchEnd({
          title: '🏆 ¡CAMPEÓN DEL TORNEO! 🏆',
          scoreLine,
          primaryLabel: 'JUGAR DE NUEVO',
          primaryAction: () => startTournament(state.teamA),
          secondaryLabel: 'MENÚ',
          secondaryAction: quitToMenu,
        });
      } else {
        COMMENTARY.fulltime('lose');
        UI.showMatchEnd({
          title: 'ELIMINADO DEL TORNEO',
          scoreLine,
          primaryLabel: 'REINTENTAR TORNEO',
          primaryAction: () => startTournament(state.teamA),
          secondaryLabel: 'MENÚ',
          secondaryAction: quitToMenu,
        });
      }
      return;
    }

    const result = state.scoreA > state.scoreB ? 'win' : state.scoreA < state.scoreB ? 'lose' : 'draw';
    COMMENTARY.fulltime(result);
    UI.showMatchEnd({
      title: 'FINAL DEL PARTIDO',
      scoreLine,
      primaryLabel: 'JUGAR DE NUEVO',
      primaryAction: () => { loadMatch(state.teamA, state.teamB); COMMENTARY.kickoff(); },
      secondaryLabel: 'MENÚ',
      secondaryAction: quitToMenu,
    });
  }
}

function updatePossession(dt) {
  const ball = state.ball;
  const pickupR = (p) => p.radius + ball.radius + 3;

  if (!state.possessor) {
    let best = null, bestD = Infinity;
    for (const p of state.players) {
      const d = dist(p, ball);
      if (d < pickupR(p) && d < bestD) { best = p; bestD = d; }
    }
    if (best) {
      if (best.isGK && ball.lastTouchPlayer === state.controlledPlayer && ball.lastTouchTeam !== best.team) {
        COMMENTARY.nearMiss();
      }
      state.possessor = best;
    }
    return;
  }

  const carrier = state.possessor;
  for (const p of state.players) {
    if (p.team === carrier.team || p.kickCooldown > 0) continue;
    // contest based on proximity to the ball CARRIER, not the exact ball pixel — otherwise a
    // defender closing in from behind can never reach a ball that's glued just ahead of the dribbler
    const contestRadius = p.radius + carrier.radius + 8;
    const d = dist(p, carrier);
    if (d < contestRadius) {
      const diffMul = diffFor(p.team, state).tackleMul;
      const isHuman = p === state.controlledPlayer || p === state.controlledPlayerB;
      const bonus = isHuman ? 1.8 : 1;
      // the tighter the marking, the more likely the tackle lands — being right on top of the
      // carrier for a moment should reliably win the ball, not just barely nudge the odds
      const proximity = 0.3 + (1 - d / contestRadius) * 1.4;
      const chance = TACKLE_CHANCE_PER_60FPS * bonus * diffMul * proximity * (dt * 60);
      if (Math.random() < chance) {
        state.possessor = p;
        SFX.bounce();
        if (isHuman) state.matchTackles++;
        if (p === state.controlledPlayer) COMMENTARY.tackle();
        break;
      }
    }
  }
}

function resolveAllCollisions() {
  const players = state.players;
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      resolveOverlap(players[i], players[j], players[i].radius + players[j].radius - 3);
    }
  }
  const ball = state.ball;
  for (const p of players) {
    if (p === state.possessor) continue;
    const minD = p.radius + ball.radius;
    if (dist(p, ball) < minD) resolveOverlap(p, ball, minD);
  }
}

// side: 'A' or 'B'. rig: INPUT or INPUT2. Handles power-meter display + the actual kick.
function handleShootFor(side, rig, powerSide) {
  if (rig.shootDown) {
    const frac = Math.min(1, (performance.now() - rig.shootStartTime) / 1000 / rig.CHARGE_MAX);
    UI.setPower(powerSide, frac);
  } else {
    UI.hidePower(powerSide);
  }

  if (!rig.shootReleased) return;
  rig.shootReleased = false;
  const cp = side === 'A' ? state.controlledPlayer : state.controlledPlayerB;
  if (!cp) return;

  if (state.possessor === cp) {
    const useJoystick = Math.abs(rig.move.x) + Math.abs(rig.move.y) > 0.12;
    let aim = useJoystick ? { x: rig.move.x, y: rig.move.y } : { x: Math.cos(cp.angle), y: Math.sin(cp.angle) };
    // light auto-aim assist toward the rival goal when shooting from decent range, so shots that
    // are roughly on target actually threaten the goal instead of drifting wide
    const goal = rivalGoalPos(cp.team);
    const goalDist = Math.hypot(goal.x - cp.x, goal.y - cp.y);
    if (goalDist < 340) {
      const gx = goal.x - cp.x, gy = goal.y - cp.y;
      const glen = Math.hypot(gx, gy) || 1;
      aim = { x: aim.x + (gx / glen) * 0.22, y: aim.y + (gy / glen) * 0.22 };
    }
    const len = Math.hypot(aim.x, aim.y) || 1;
    const power = rig.releasedPower;
    const speed = 200 + power * 310;
    state.ball.kick((aim.x / len) * speed, (aim.y / len) * speed);
    state.ball.lastTouchTeam = side;
    state.ball.lastTouchPlayer = cp;
    state.possessor = null;
    cp.kickCooldown = 0.16;
    SFX.kick();
  } else {
    cp.vx += Math.cos(cp.angle) * 170;
    cp.vy += Math.sin(cp.angle) * 170;
  }
}

// finds the best teammate to receive a pass: prefers whoever is most aligned with the aim
// direction, with a mild penalty for distance so a nearby option isn't skipped for a far one
function findPassTarget(cp, state, aimX, aimY) {
  const mates = state.players.filter((o) => o.team === cp.team && o !== cp && !o.isGK);
  if (!mates.length) return null;
  const aimLen = Math.hypot(aimX, aimY) || 1;
  const ax = aimX / aimLen, ay = aimY / aimLen;
  let best = null, bestScore = -Infinity;
  for (const m of mates) {
    const dx = m.x - cp.x, dy = m.y - cp.y;
    const dlen = Math.hypot(dx, dy) || 1;
    const align = (dx / dlen) * ax + (dy / dlen) * ay;
    const score = align - dlen / 900;
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

// side: 'A' or 'B'. rig: INPUT or INPUT2. Auto-targeted pass to a teammate — aimed with the
// joystick/facing direction like a shot, but always finds and hits an actual teammate.
function handlePassFor(side, rig, state) {
  if (!rig.passPressed) return;
  rig.passPressed = false;
  const cp = side === 'A' ? state.controlledPlayer : state.controlledPlayerB;
  if (!cp || state.possessor !== cp) return;

  const useJoystick = Math.abs(rig.move.x) + Math.abs(rig.move.y) > 0.12;
  const aimX = useJoystick ? rig.move.x : Math.cos(cp.angle);
  const aimY = useJoystick ? rig.move.y : Math.sin(cp.angle);
  const target = findPassTarget(cp, state, aimX, aimY);
  if (!target) return;

  const dx = (target.x + target.vx * 0.18) - state.ball.x;
  const dy = (target.y + target.vy * 0.18) - state.ball.y;
  const len = Math.hypot(dx, dy) || 1;
  const speed = 235 + Math.min(len, 420) * 0.35;
  state.ball.kick((dx / len) * speed, (dy / len) * speed);
  state.ball.lastTouchTeam = side;
  state.ball.lastTouchPlayer = cp;
  state.possessor = null;
  cp.kickCooldown = 0.16;
  SFX.kick();
}

// side: 'A' or 'B'. rig: INPUT or INPUT2. A deliberate, player-initiated tackle attempt — reaches
// a bit further than the passive contest in updatePossession() and has a much better success
// chance, since pressing the button is a clear intent to go for the ball rather than incidental
// contact. Has its own cooldown (independent of kickCooldown) so it can't be mashed for free rolls.
function handleTackleFor(side, rig, dt) {
  rig.tackleCooldown = Math.max(0, (rig.tackleCooldown || 0) - dt);
  if (!rig.tacklePressed) return;
  rig.tacklePressed = false;
  if (rig.tackleCooldown > 0) return;

  const cp = side === 'A' ? state.controlledPlayer : state.controlledPlayerB;
  const carrier = state.possessor;
  if (!cp || !carrier || carrier.team === cp.team) return; // nothing to win back

  const range = cp.radius + carrier.radius + 24; // a deliberate lunge reaches further than passive contact
  const d = dist(cp, carrier);
  if (d > range) return;

  rig.tackleCooldown = 0.7;
  const chance = clamp(0.85 - (d / range) * 0.45, 0.35, 0.85); // closer = much more likely to land
  if (Math.random() < chance) {
    state.possessor = cp;
    state.matchTackles++;
    SFX.bounce();
    COMMENTARY.tackle();
  } else {
    // mistimed lunge costs a bit of momentum, so spamming the button isn't free
    cp.vx *= 0.3;
    cp.vy *= 0.3;
  }
}

function handleSwitchFor(side, rig, dt) {
  const team = side === 'A' ? 'A' : 'B';
  const current = side === 'A' ? state.controlledPlayer : state.controlledPlayerB;
  const setter = side === 'A' ? setControlled : setControlledB;
  const timerKey = side === 'A' ? 'switchTimer' : 'switchTimerB';

  if (rig.switchPressed) {
    rig.switchPressed = false;
    const mates = state.players.filter((p) => p.team === team && !p.isGK && p !== current);
    mates.sort((a, b) => dist(a, state.ball) - dist(b, state.ball));
    if (mates[0]) setter(mates[0]);
  }

  state[timerKey] -= dt;
  if (state[timerKey] <= 0) {
    state[timerKey] = 0.25;
    const active = side === 'A' ? state.controlledPlayer : state.controlledPlayerB;
    if (active && state.possessor !== active) {
      const mates = state.players.filter((p) => p.team === team && !p.isGK);
      mates.sort((a, b) => dist(a, state.ball) - dist(b, state.ball));
      const best = mates[0];
      if (best && best !== active && dist(best, state.ball) < dist(active, state.ball) - 14) {
        setter(best);
      }
    }
  }
}

function checkGoalsAndBounds() {
  const ball = state.ball;
  const withinGoalX = ball.x > FIELD.GOAL_X0 + ball.radius - 2 && ball.x < FIELD.GOAL_X1 - ball.radius + 2;
  if (ball.y - ball.radius < FIELD.TOP) {
    if (withinGoalX) triggerGoal('A'); else resetForGoalKick('B');
  } else if (ball.y + ball.radius > FIELD.BOTTOM) {
    if (withinGoalX) triggerGoal('B'); else resetForGoalKick('A');
  }
}

function update(dt) {
  state.timeLeft -= dt;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    handleHalfEnd();
    UI.updateHud(state);
    return;
  }

  EASTER_EGGS.updateGiantHeads();

  // Player.steer() expects a direction vector on the same rough scale the AI uses (real pixel
  // offsets to a target, typically tens to hundreds of px) — it has a small deadzone (len > 3)
  // to stop AI players jittering when they're basically already on their target. INPUT.move.x/y
  // is a normalized joystick tilt (-1..1), so its length is at most ~1.4 and NEVER cleared that
  // deadzone — the human player's steer() call was always taking the "no input" branch, meaning
  // the joystick could never actually move the player. Scaling it up here keeps the same direction
  // (steer() only cares about the dx/dy ratio and length-vs-deadzone) while putting it on a scale
  // where any real joystick tilt clears the deadzone.
  const JOYSTICK_SCALE = 100;
  if (state.controlledPlayer) state.controlledPlayer.steer(INPUT.move.x * JOYSTICK_SCALE, INPUT.move.y * JOYSTICK_SCALE, dt, 1);
  // Player 2 is seated at the opposite edge of the screen facing Player 1, so their sense of
  // "left/right" is mirrored relative to the screen's absolute frame — negate X only.
  // "Forward" (away from their body) already matches team B's attack direction, so Y stays as-is.
  if (state.twoPlayer && state.controlledPlayerB) state.controlledPlayerB.steer(-INPUT2.move.x * JOYSTICK_SCALE, INPUT2.move.y * JOYSTICK_SCALE, dt, 1);
  updateAI(dt, state);
  updatePossession(dt);

  for (const p of state.players) p.update(dt);
  if (state.possessor) state.ball.followPlayer(state.possessor, dt);
  else state.ball.update(dt);

  resolveAllCollisions();
  handleShootFor('A', INPUT, 'a');
  handlePassFor('A', INPUT, state);
  handleTackleFor('A', INPUT, dt);
  handleSwitchFor('A', INPUT, dt);
  if (state.twoPlayer) {
    handleShootFor('B', INPUT2, 'b');
    handlePassFor('B', INPUT2, state);
    handleTackleFor('B', INPUT2, dt);
    handleSwitchFor('B', INPUT2, dt);
  }
  checkGoalsAndBounds();
  UI.updateHud(state);
}

function render() {
  ctx.clearRect(0, 0, FIELD.W, FIELD.H);
  drawField(ctx);
  if (state.ball) {
    const drawables = [...state.players, state.ball];
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw(ctx);
  }
}

let lastTs = 0;
function loop(ts) {
  // an uncaught error anywhere in here would otherwise abort this function before it reaches the
  // requestAnimationFrame call, permanently freezing the whole game (no more input, no more
  // rendering) on whatever one-off condition triggered it — the try/finally guarantees the loop
  // keeps scheduling itself even if a single frame's simulation or render blows up
  try {
    const dt = Math.min((ts - lastTs) / 1000 || 0, 0.033);
    lastTs = ts;
    if (state.phase === 'playing') update(dt);
    render();
  } catch (err) {
    console.error('game loop frame failed, recovering:', err);
  } finally {
    requestAnimationFrame(loop);
  }
}

function togglePause() {
  if (state.phase === 'playing') {
    state.phase = 'paused';
    UI.showOverlay('overlay-pause');
  }
}

function wireButtons() {
  document.getElementById('btn-play').addEventListener('pointerdown', () => {
    SFX.click();
    COMMENTARY.unlock();
    const sel = UI.getSelection();
    applyRuntimeFromSelection(sel);
    state.twoPlayer = sel.twoPlayer;
    document.getElementById('controls-p2').classList.toggle('hidden', !sel.twoPlayer);
    UI.hideOverlay('overlay-menu');
    if (sel.twoPlayer) {
      state.tournament = null;
      loadMatch(sel.a, sel.b);
    } else if (sel.mode === 'tournament') {
      startTournament(sel.a);
    } else {
      state.tournament = null;
      loadMatch(sel.a, sel.b);
    }
    COMMENTARY.kickoff();
  });

  let pauseHoldTimer = null;
  let pauseHoldTriggered = false;
  const btnPause = document.getElementById('btn-pause');
  btnPause.addEventListener('pointerdown', () => {
    pauseHoldTriggered = false;
    pauseHoldTimer = setTimeout(() => {
      pauseHoldTriggered = true;
      EASTER_EGGS.triggerGiantHeads();
    }, 3000);
  });
  btnPause.addEventListener('pointerup', () => {
    clearTimeout(pauseHoldTimer);
    if (!pauseHoldTriggered) togglePause();
  });
  btnPause.addEventListener('pointercancel', () => clearTimeout(pauseHoldTimer));

  document.getElementById('btn-resume').addEventListener('pointerdown', () => {
    state.phase = 'playing';
    UI.hideOverlay('overlay-pause');
  });
  document.getElementById('btn-restart').addEventListener('pointerdown', () => {
    UI.hideOverlay('overlay-pause');
    loadMatch(state.teamA, state.teamB);
  });
  document.getElementById('btn-quit').addEventListener('pointerdown', quitToMenu);
}

function init() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  UI.initMenu();
  const sel = UI.getSelection();
  loadMatch(sel.a, sel.b, { trackProgress: false });
  state.phase = 'menu';
  wireButtons();
  requestAnimationFrame(loop);
}

init();
