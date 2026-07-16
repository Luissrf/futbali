// AI for every player that is not the human-controlled one: teammates, opponents, both goalkeepers.

const FORMATION = [
  // role, local x (0..1 across pitch width), local y (0..1 own goal -> rival goal)
  { role: 'GK', lx: 0.5, ly: 0.05 },
  { role: 'DEF', lx: 0.30, ly: 0.24 },
  { role: 'DEF', lx: 0.70, ly: 0.24 },
  { role: 'MID', lx: 0.50, ly: 0.50 },
  { role: 'FWD', lx: 0.50, ly: 0.72 },
];

function ownGoalPos(team) {
  return { x: FIELD.CX, y: team === 'A' ? FIELD.BOTTOM : FIELD.TOP };
}
function rivalGoalPos(team) {
  return { x: FIELD.CX, y: team === 'A' ? FIELD.TOP : FIELD.BOTTOM };
}
function attackDir(team) { return team === 'A' ? -1 : 1; } // sign applied to ly progress in world Y

// only the AI-only rival team (B) is scaled by the chosen difficulty; in 2-player mode team B
// is human-controlled too, so it plays at the same neutral baseline as team A
const NEUTRAL_DIFF = { speedMul: 1, accuracyMul: 1, tackleMul: 1, gkMul: 1 };
function diffFor(team, state) {
  const twoPlayer = state && state.twoPlayer;
  return team === 'B' && !twoPlayer && typeof RUNTIME !== 'undefined' ? RUNTIME.difficulty : NEUTRAL_DIFF;
}

function homePosition(team, lx, ly) {
  const ownY = ownGoalPos(team).y;
  const dir = attackDir(team);
  return {
    x: FIELD.LEFT + lx * FIELD.PITCH_W,
    y: ownY + dir * ly * FIELD.PITCH_H,
  };
}

function updateAI(dt, state) {
  const { players, ball } = state;

  // one chaser per team goes straight for the ball; when the OTHER team has it, a second nearby
  // teammate also closes the carrier down (like a real defense pressing in twos) instead of the
  // rest of the team just holding a passive shape — this also means there's usually someone
  // close enough for the human's QUITAR button (or a passive contest) to actually have a shot
  const chaserA = getChaser('A', state);
  const chaserB = getChaser('B', state);
  const presserA = getPresser('A', state, chaserA);
  const presserB = getPresser('B', state, chaserB);

  for (const p of players) {
    if (p === state.controlledPlayer || p === state.controlledPlayerB) continue;
    if (p.isGK) { updateGoalkeeper(p, dt, state); continue; }

    const carrying = state.possessor === p;
    if (carrying) {
      updateCarrierAI(p, dt, state);
      continue;
    }

    const chaser = p.team === 'A' ? chaserA : chaserB;
    const presser = p.team === 'A' ? presserA : presserB;
    const oppositionHasBall = state.possessor && state.possessor.team !== p.team;

    if (chaser === p) {
      chase(p, ball, dt, diffFor(p.team, state).speedMul);
    } else if (presser === p && oppositionHasBall && dist(p, state.possessor) < 260) {
      pressBallCarrier(p, state, dt);
    } else {
      supportFormation(p, dt, state);
    }
  }
}

// pick the outfield player (per team) best placed to chase the ball
function getChaser(team, state) {
  let best = null, bestD = Infinity;
  for (const p of state.players) {
    if (p.team !== team || p.isGK) continue;
    const d = dist(p, state.ball);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

// second-closest outfield player on the team, excluding the primary chaser — the one who closes
// down the ball carrier alongside the chaser when the opponent has possession
function getPresser(team, state, exclude) {
  let best = null, bestD = Infinity;
  for (const p of state.players) {
    if (p.team !== team || p.isGK || p === exclude) continue;
    const d = dist(p, state.ball);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

function chase(p, ball, dt, urgency) {
  const leadX = ball.x + ball.vx * 0.12;
  const leadY = ball.y + ball.vy * 0.12;
  p.steer(leadX - p.x, leadY - p.y, dt, urgency);
}

// close down the ball carrier directly, but stop just short of shoving distance so this defender
// doesn't stack on top of the primary chaser already contesting the ball
function pressBallCarrier(p, state, dt) {
  const carrier = state.possessor;
  const standoff = p.radius + carrier.radius + 14;
  const dx = carrier.x - p.x, dy = carrier.y - p.y;
  const d = Math.hypot(dx, dy) || 1;
  const urgency = diffFor(p.team, state).speedMul;
  if (d > standoff) {
    p.steer(dx, dy, dt, urgency * 0.9);
  } else {
    // hold the marking distance, tracking the carrier's drift rather than freezing in place
    p.steer(dx * 0.2, dy * 0.2, dt, urgency * 0.4);
  }
}

function supportFormation(p, dt, state) {
  const home = { x: p.homeX, y: p.homeY };
  const ball = state.ball;

  // elastic band: shift home position toward the ball, more for advanced roles
  const pull = p.role === 'FWD' ? 0.38 : p.role === 'MID' ? 0.3 : 0.16;
  const dir = attackDir(p.team);
  const push = state.possessor && state.possessor.team === p.team ? 26 : 0; // nudge forward when team attacks

  let tx = home.x + (ball.x - home.x) * pull;
  let ty = home.y + (ball.y - home.y) * pull * 0.6 + dir * push * 0.4;

  tx = clamp(tx, FIELD.LEFT + 14, FIELD.RIGHT - 14);
  ty = clamp(ty, FIELD.TOP + 14, FIELD.BOTTOM - 14);

  const d = Math.hypot(tx - p.x, ty - p.y);
  p.steer(tx - p.x, ty - p.y, dt, d > 6 ? 0.75 : 0.2);
}

function updateCarrierAI(p, dt, state) {
  const goal = rivalGoalPos(p.team);
  const distToGoal = Math.hypot(goal.x - p.x, goal.y - p.y);
  const diff = diffFor(p.team, state);
  const defender = nearestOpponent(p, state);
  const defenderDist = defender ? dist(defender, p) : Infinity;
  const pressured = defenderDist < 55;

  // shoot when close enough and reasonably centred
  if (distToGoal < 260 && Math.abs(goal.x - p.x) < 190) {
    aiKick(p, state, goal.x, goal.y, 1.0, true);
    return;
  }

  // look for a pass — more urgent (and more frequent, via a shorter cooldown) the tighter the
  // marking, so a well-marked carrier gives the ball up instead of just bulling into the defender.
  // NOTE: this must stay gated by the cooldown even under pressure — re-rolling every single frame
  // once a defender is close would let the AI offload the ball before a chasing player ever gets a
  // chance to actually win the tackle.
  p.passCooldown = (p.passCooldown || 0) - dt;
  if (p.passCooldown <= 0) {
    const dir = attackDir(p.team);
    const forwardMate = state.players.find((o) => o.team === p.team && o !== p && !o.isGK &&
      (o.y - p.y) * dir > 55 && Math.abs(o.x - p.x) < 230 && dist(o, p) < 320);
    // no one ahead and under pressure: lay the ball off to whichever teammate is least marked,
    // instead of only ever considering options further upfield
    const safeMate = !forwardMate && pressured
      ? state.players.find((o) => o.team === p.team && o !== p && !o.isGK && dist(o, p) < 320 &&
          nearestOpponentDist(o, state) > defenderDist + 25)
      : null;
    const mate = forwardMate || safeMate;
    const passChance = pressured ? 0.75 : 0.5;
    if (mate && Math.random() < passChance) {
      aiKick(p, state, mate.x + mate.vx * 0.2, mate.y + mate.vy * 0.2, 0.55, false);
      p.passCooldown = pressured ? 0.5 : 1.0;
      return;
    }
    p.passCooldown = 0.45;
  }

  // dribble toward goal, weaving away from a very close defender and slowing while crowded so a
  // chasing defender can actually close the gap and win the ball
  let steerX = goal.x - p.x;
  let steerY = goal.y - p.y;
  let speedScale = diff.speedMul;
  if (defender && defenderDist < 26) {
    const awayX = p.x - defender.x, awayY = p.y - defender.y;
    steerX += awayX * 0.8;
    steerY += awayY * 0.8;
    speedScale *= 0.72;
  }
  p.steer(steerX, steerY, dt, speedScale);
}

function nearestOpponent(p, state) {
  let best = null, bestD = Infinity;
  for (const o of state.players) {
    if (o.team === p.team) continue;
    const d = dist(o, p);
    if (d < bestD) { bestD = d; best = o; }
  }
  return best;
}

function nearestOpponentDist(p, state) {
  const o = nearestOpponent(p, state);
  return o ? dist(o, p) : Infinity;
}

function aiKick(p, state, tx, ty, power, isShot) {
  const dx = tx - state.ball.x, dy = ty - state.ball.y;
  const len = Math.hypot(dx, dy) || 1;
  const speed = (isShot ? 330 : 235) * power + Math.random() * 20;
  const baseInaccuracy = isShot ? 0.16 : 0.08;
  const inaccuracy = baseInaccuracy / diffFor(p.team, state).accuracyMul;
  const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * inaccuracy;
  state.ball.kick(Math.cos(ang) * speed, Math.sin(ang) * speed);
  state.ball.lastTouchTeam = p.team;
  state.ball.lastTouchPlayer = p;
  state.possessor = null;
  p.kickCooldown = 0.25;
  SFX.kick();
}

function updateGoalkeeper(gk, dt, state) {
  const ball = state.ball;
  const own = ownGoalPos(gk.team);
  const dir = attackDir(gk.team);
  const diff = diffFor(gk.team, state);
  const lineY = own.y - dir * 22; // stands a little in front of the line
  const boxHalf = FIELD.BOX_W / 2 - gk.radius;

  const ballInDanger = Math.abs(ball.y - own.y) < FIELD.BOX_D + 45 && Math.abs(ball.x - FIELD.CX) < FIELD.BOX_W / 2 + 30;

  let tx = clamp(ball.x, FIELD.CX - boxHalf, FIELD.CX + boxHalf);
  let ty = lineY;

  if (ballInDanger) {
    // rush toward the ball a bit when it's dangerously close
    const rush = clamp((FIELD.BOX_D + 45 - Math.abs(ball.y - own.y)) / (FIELD.BOX_D + 45), 0, 1);
    ty = lineY - dir * rush * 28;
    tx = clamp(ball.x, FIELD.CX - FIELD.GOAL_W / 2 - 6, FIELD.CX + FIELD.GOAL_W / 2 + 6);
  }

  gk.steer(tx - gk.x, ty - gk.y, dt, (ballInDanger ? 1 : 0.6) * diff.gkMul);

  // if carrying (caught the ball), clear it upfield after a short hold
  if (state.possessor === gk) {
    gk.clearTimer = (gk.clearTimer || 0) - dt;
    if (gk.clearTimer <= 0) {
      const targetMate = state.players.find((o) => o.team === gk.team && !o.isGK && (o.role === 'MID' || o.role === 'DEF'));
      const tx2 = targetMate ? targetMate.x : FIELD.CX;
      const ty2 = own.y + dir * 220;
      aiKick(gk, state, tx2, ty2, 0.85, false);
      gk.clearTimer = 1.4;
    }
  } else {
    gk.clearTimer = 0.35;
  }
}
