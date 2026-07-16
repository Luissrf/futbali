// Field geometry (logical units) — vertical pitch, own goal at bottom, rival goal at top.
const FIELD = {
  MARGIN: 24,
  PITCH_W: 500,
  PITCH_H: 900,
  GOAL_W: 150,
  GOAL_DEPTH: 20,
  CENTER_R: 75,
  BOX_W: 300,
  BOX_D: 125,
  SIX_W: 190,
  SIX_D: 45,
  PEN_SPOT_D: 95,
  ARC_R: 75,
};
FIELD.W = FIELD.PITCH_W + FIELD.MARGIN * 2;
FIELD.H = FIELD.PITCH_H + FIELD.MARGIN * 2;
FIELD.TOP = FIELD.MARGIN;
FIELD.BOTTOM = FIELD.MARGIN + FIELD.PITCH_H;
FIELD.LEFT = FIELD.MARGIN;
FIELD.RIGHT = FIELD.MARGIN + FIELD.PITCH_W;
FIELD.CX = FIELD.MARGIN + FIELD.PITCH_W / 2;
FIELD.CY = FIELD.MARGIN + FIELD.PITCH_H / 2;
FIELD.GOAL_X0 = FIELD.CX - FIELD.GOAL_W / 2;
FIELD.GOAL_X1 = FIELD.CX + FIELD.GOAL_W / 2;

function drawField(ctx) {
  const f = FIELD;

  // grass stripes (extend a bit beyond pitch for the run-off look)
  const stripeCount = 12;
  const stripeH = f.H / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#0b6e2c' : '#0a632a';
    ctx.fillRect(0, i * stripeH, f.W, stripeH + 1);
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  // outer boundary
  ctx.strokeRect(f.LEFT, f.TOP, f.PITCH_W, f.PITCH_H);

  // halfway line
  ctx.beginPath();
  ctx.moveTo(f.LEFT, f.CY);
  ctx.lineTo(f.RIGHT, f.CY);
  ctx.stroke();

  // center circle + spot
  ctx.beginPath();
  ctx.arc(f.CX, f.CY, f.CENTER_R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(f.CX, f.CY, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();

  [f.TOP, f.BOTTOM].forEach((goalLineY, idx) => {
    const dir = idx === 0 ? 1 : -1; // box extends into the pitch
    // penalty box
    ctx.strokeRect(f.CX - f.BOX_W / 2, idx === 0 ? goalLineY : goalLineY - f.BOX_D, f.BOX_W, f.BOX_D);
    // six-yard box
    ctx.strokeRect(f.CX - f.SIX_W / 2, idx === 0 ? goalLineY : goalLineY - f.SIX_D, f.SIX_W, f.SIX_D);
    // penalty spot
    const spotY = goalLineY + dir * f.PEN_SPOT_D;
    ctx.beginPath();
    ctx.arc(f.CX, spotY, 3, 0, Math.PI * 2);
    ctx.fill();
    // penalty arc
    ctx.beginPath();
    const startAngle = idx === 0 ? 0.21 * Math.PI : 1.21 * Math.PI;
    const endAngle = idx === 0 ? 0.79 * Math.PI : 1.79 * Math.PI;
    ctx.arc(f.CX, spotY, f.ARC_R, startAngle, endAngle);
    ctx.stroke();
    // corner arcs
    [f.LEFT, f.RIGHT].forEach((cx) => {
      ctx.beginPath();
      ctx.arc(cx, goalLineY, 10, 0, Math.PI * 2);
      ctx.stroke();
    });
  });

  ctx.restore();

  // goals (posts + net)
  drawGoal(ctx, f.TOP, -1);
  drawGoal(ctx, f.BOTTOM, 1);
}

function drawGoal(ctx, lineY, dir) {
  const f = FIELD;
  const x0 = f.GOAL_X0, x1 = f.GOAL_X1;
  const depth = f.GOAL_DEPTH * dir * -1; // dir=-1 (top) net goes up (negative y), dir=1 (bottom) net goes down

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x0, dir === -1 ? lineY - f.GOAL_DEPTH : lineY, x1 - x0, f.GOAL_DEPTH);

  // net hatch
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  const netTop = dir === -1 ? lineY - f.GOAL_DEPTH : lineY;
  const netBottom = dir === -1 ? lineY : lineY + f.GOAL_DEPTH;
  for (let x = x0; x <= x1; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, netTop);
    ctx.lineTo(x, netBottom);
    ctx.stroke();
  }
  for (let y = netTop; y <= netBottom; y += 6) {
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
  }

  // posts
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x0, lineY);
  ctx.lineTo(x1, lineY);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x0, netTop); ctx.lineTo(x0, netBottom);
  ctx.moveTo(x1, netTop); ctx.lineTo(x1, netBottom);
  ctx.stroke();
  ctx.restore();
}
