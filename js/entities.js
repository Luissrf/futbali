// Player and Ball entities: state + physics + rendering.
// TEAM_COLOR is populated at match setup time from the chosen countries (see countries.js / main.js).
const TEAM_COLOR = {
  A: { main: '#2f6fed', dark: '#1c4bb0', trim: '#fff' },
  B: { main: '#e0356b', dark: '#a4204a', trim: '#fff' },
};

function readableTextColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1a1a1a' : '#ffffff';
}

class Player {
  constructor({ team, role, number, x, y, isGK = false }) {
    this.team = team;
    this.role = role; // GK, DEF, MID, FWD
    this.number = number;
    this.isGK = isGK;
    this.x = x;
    this.y = y;
    this.homeX = x;
    this.homeY = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = isGK ? 15 : 14;
    this.maxSpeed = isGK ? 165 : (role === 'FWD' ? 216 : 192);
    this.accel = 1650;
    this.angle = team === 'A' ? -Math.PI / 2 : Math.PI / 2;
    this.isControlled = false;
    this.kickCooldown = 0;
    this.staminaBob = Math.random() * Math.PI * 2;
    this.hasBallTouch = 0; // small grace timer once player "controls" the ball
  }

  // desired direction normalized (-1..1), speedScale 0..1
  steer(dx, dy, dt, speedScale = 1) {
    const len = Math.hypot(dx, dy);
    let tvx = 0, tvy = 0;
    // below this, dx/dy is noise around a near-zero offset (e.g. a formation player already
    // sitting on its target, or two players jostling right next to each other for the ball) —
    // normalizing it would still yield a full-speed vector pointed in a near-random direction
    if (len > 3) {
      tvx = (dx / len) * this.maxSpeed * speedScale;
      tvy = (dy / len) * this.maxSpeed * speedScale;
      // turn toward the desired heading at a bounded angular speed instead of snapping straight
      // to it — a plain `this.angle = atan2(...)` can flip near-instantly back and forth whenever
      // the desired direction itself oscillates frame to frame (e.g. jostling for the ball at
      // close range, or a low/variable framerate), which reads as the player spinning wildly
      const desired = Math.atan2(dy, dx);
      // The old 16 rad/s cap still allowed more than two full rotations per second.
      const TURN_RATE = this.isControlled ? 11 : 6.5;
      let diff = desired - this.angle;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const maxTurn = TURN_RATE * dt;
      this.angle += clamp(diff, -maxTurn, maxTurn);
    }
    const ax = tvx - this.vx;
    const ay = tvy - this.vy;
    const alen = Math.hypot(ax, ay);
    const maxDelta = this.accel * dt;
    if (alen > maxDelta && alen > 0) {
      this.vx += (ax / alen) * maxDelta;
      this.vy += (ay / alen) * maxDelta;
    } else {
      this.vx = tvx;
      this.vy = tvy;
    }
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.kickCooldown > 0) this.kickCooldown -= dt;
    if (this.hasBallTouch > 0) this.hasBallTouch -= dt;
    this.staminaBob += dt * (4 + Math.hypot(this.vx, this.vy) * 0.03);
    // keep inside a generous playable area (allow slightly outside pitch lines)
    const pad = this.radius + 4;
    this.x = clamp(this.x, FIELD.LEFT - pad + 6, FIELD.RIGHT + pad - 6);
    this.y = clamp(this.y, FIELD.TOP - pad + 6, FIELD.BOTTOM + pad - 6);
  }

  draw(ctx) {
    const c = TEAM_COLOR[this.team];
    const bobY = Math.sin(this.staminaBob) * 1.1;
    const giant = typeof EASTER_EGGS !== 'undefined' && EASTER_EGGS.state.giantHeads;
    const r = this.radius * (giant ? 2.1 : 1);

    ctx.save();
    ctx.translate(this.x, this.y + bobY);

    // shadow
    ctx.beginPath();
    ctx.ellipse(0, r * 0.75, r * 0.9, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fill();

    // ring for controlled player
    if (this.isControlled) {
      ctx.beginPath();
      ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // body (jersey circle)
    const grad = ctx.createRadialGradient(-3, -3, 2, 0, 0, r);
    grad.addColorStop(0, this.isGK ? '#2b2b2b' : c.main);
    grad.addColorStop(1, this.isGK ? '#111' : c.dark);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // kit trim (second kit color), style depends on the chosen kit for this team
    const kit = (typeof RUNTIME !== 'undefined' && RUNTIME.kitStyle[this.team]) || KIT_STYLES[0];
    if (!this.isGK && kit.id !== 'solid') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = c.trim;
      if (kit.id === 'stripes') {
        for (let sx = -r; sx < r; sx += r * 0.55) ctx.fillRect(sx, -r, r * 0.22, r * 2);
      } else {
        ctx.fillRect(-r, -r * 0.28, r * 2, r * 0.22);
      }
      ctx.restore();
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.stroke();

    // number
    ctx.fillStyle = this.isGK ? '#fff' : readableTextColor(c.main);
    ctx.font = `bold ${giant ? 16 : 10}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.number, 0, 0.5);

    // facing indicator (small chevron)
    ctx.rotate(this.angle);
    ctx.beginPath();
    ctx.moveTo(r + 1, 0);
    ctx.lineTo(r - 3, -3);
    ctx.lineTo(r - 3, 3);
    ctx.closePath();
    ctx.fillStyle = '#ffd23f';
    ctx.fill();

    ctx.restore();
  }
}

class Ball {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = 9;
    this.spin = 0;
    this.lastTouchTeam = null;
    this.lastTouchPlayer = null;
    this.lastKickWasShot = false;
    this.trail = [];
  }

  kick(vx, vy) {
    this.vx = vx;
    this.vy = vy;
  }

  // glued to a dribbling player: eased toward a spot just ahead of their facing direction
  followPlayer(p, dt) {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 6) this.trail.shift();
    const followDist = p.radius + this.radius - 2;
    const tx = p.x + Math.cos(p.angle) * followDist;
    const ty = p.y + Math.sin(p.angle) * followDist;
    const ease = Math.min(1, dt * 14);
    this.x += (tx - this.x) * ease;
    this.y += (ty - this.y) * ease;
    this.vx = p.vx;
    this.vy = p.vy;
    this.spin += Math.hypot(p.vx, p.vy) * dt * 0.08;
  }

  update(dt) {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 6) this.trail.shift();

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const speed = Math.hypot(this.vx, this.vy);
    const friction = Math.min(speed, 205 * dt);
    if (speed > 0.01) {
      this.vx -= (this.vx / speed) * friction;
      this.vy -= (this.vy / speed) * friction;
    } else {
      this.vx = 0; this.vy = 0;
    }
    this.spin += speed * dt * 0.08;

    // bounce off touchlines (side walls), but not the goal lines (handled by game logic)
    const pad = this.radius;
    if (this.x < FIELD.LEFT + pad) {
      this.x = FIELD.LEFT + pad;
      this.vx = Math.abs(this.vx) * 0.55;
      SFX.bounce();
    } else if (this.x > FIELD.RIGHT - pad) {
      this.x = FIELD.RIGHT - pad;
      this.vx = -Math.abs(this.vx) * 0.55;
      SFX.bounce();
    }
  }

  draw(ctx) {
    const partyMode = typeof EASTER_EGGS !== 'undefined' && EASTER_EGGS.state.partyMode;

    // trail
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const a = (i / this.trail.length) * (partyMode ? 0.55 : 0.25);
      ctx.beginPath();
      ctx.arc(t.x, t.y, this.radius * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = partyMode ? `hsla(${(t.x + t.y + performance.now() * 0.2) % 360},90%,60%,${a})` : `rgba(255,255,255,${a})`;
      ctx.fill();
    }

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + this.radius * 0.7, this.radius * 0.9, this.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    const skin = (typeof RUNTIME !== 'undefined' && RUNTIME.ballSkin) || { base: '#ffffff', shade: '#d8d8d8', pattern: '#222' };

    ctx.translate(this.x, this.y);
    ctx.rotate(this.spin);
    const grad = ctx.createRadialGradient(-2, -2, 1, 0, 0, this.radius);
    grad.addColorStop(0, skin.base);
    grad.addColorStop(1, skin.shade);
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // simple pentagon pattern
    ctx.fillStyle = skin.pattern;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * this.radius * 0.5, Math.sin(a) * this.radius * 0.5, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// push two overlapping circles apart (used for player-player and player-ball contact)
function resolveOverlap(a, b, minDist) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 0.001;
  if (d >= minDist) return;
  const overlap = (minDist - d) / 2;
  const nx = dx / d, ny = dy / d;
  a.x -= nx * overlap; a.y -= ny * overlap;
  b.x += nx * overlap; b.y += ny * overlap;
}
