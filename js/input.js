// Touch joystick + action buttons + keyboard fallback, unified into a single INPUT state.

const INPUT = {
  move: { x: 0, y: 0 },
  shootDown: false,
  shootStartTime: 0,
  shootReleased: false,
  releasedPower: 0,
  switchPressed: false,
  CHARGE_MAX: 0.85,
};

(function setupInput() {
  const zoneEl = document.getElementById('joystick-zone');
  const baseEl = document.getElementById('joystick-base');
  const stickEl = document.getElementById('joystick-stick');
  const shootBtn = document.getElementById('btn-shoot');
  const switchBtn = document.getElementById('btn-switch');

  const touchMove = { x: 0, y: 0 };
  const keyMove = { x: 0, y: 0 };
  const keys = { up: false, down: false, left: false, right: false };
  let joystickPointerId = null;

  function syncMove() {
    if (joystickPointerId !== null) {
      INPUT.move.x = touchMove.x;
      INPUT.move.y = touchMove.y;
    } else {
      INPUT.move.x = keyMove.x;
      INPUT.move.y = keyMove.y;
    }
  }

  function baseCenter() {
    const r = baseEl.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function updateJoystick(clientX, clientY) {
    const c = baseCenter();
    let dx = clientX - c.x, dy = clientY - c.y;
    const maxR = 38;
    const len = Math.hypot(dx, dy);
    if (len > maxR) { dx = (dx / len) * maxR; dy = (dy / len) * maxR; }
    stickEl.style.transform = `translate(${dx}px, ${dy}px)`;
    touchMove.x = dx / maxR;
    touchMove.y = dy / maxR;
    syncMove();
  }

  function resetJoystick() {
    joystickPointerId = null;
    touchMove.x = 0; touchMove.y = 0;
    stickEl.style.transform = 'translate(0px,0px)';
    syncMove();
  }

  zoneEl.addEventListener('pointerdown', (e) => {
    joystickPointerId = e.pointerId;
    zoneEl.setPointerCapture(e.pointerId);
    updateJoystick(e.clientX, e.clientY);
  });
  zoneEl.addEventListener('pointermove', (e) => {
    if (e.pointerId === joystickPointerId) updateJoystick(e.clientX, e.clientY);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) =>
    zoneEl.addEventListener(ev, (e) => { if (e.pointerId === joystickPointerId) resetJoystick(); })
  );

  function startShoot(e) {
    e.preventDefault();
    if (INPUT.shootDown) return;
    INPUT.shootDown = true;
    INPUT.shootStartTime = performance.now();
  }
  function endShoot(e) {
    e.preventDefault();
    if (!INPUT.shootDown) return;
    const held = (performance.now() - INPUT.shootStartTime) / 1000;
    INPUT.releasedPower = Math.max(0.18, Math.min(1, held / INPUT.CHARGE_MAX));
    INPUT.shootDown = false;
    INPUT.shootReleased = true;
  }
  shootBtn.addEventListener('pointerdown', startShoot);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => shootBtn.addEventListener(ev, endShoot));

  switchBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); INPUT.switchPressed = true; });

  function recomputeKeyMove() {
    let x = 0, y = 0;
    if (keys.left) x -= 1;
    if (keys.right) x += 1;
    if (keys.up) y -= 1;
    if (keys.down) y += 1;
    const len = Math.hypot(x, y);
    keyMove.x = len ? x / len : 0;
    keyMove.y = len ? y / len : 0;
    syncMove();
  }

  window.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'ArrowUp': case 'KeyW': keys.up = true; recomputeKeyMove(); break;
      case 'ArrowDown': case 'KeyS': keys.down = true; recomputeKeyMove(); break;
      case 'ArrowLeft': case 'KeyA': keys.left = true; recomputeKeyMove(); break;
      case 'ArrowRight': case 'KeyD': keys.right = true; recomputeKeyMove(); break;
      case 'Space':
        e.preventDefault();
        if (!INPUT.shootDown) { INPUT.shootDown = true; INPUT.shootStartTime = performance.now(); }
        break;
      case 'ShiftLeft': case 'KeyE': INPUT.switchPressed = true; break;
    }
  });
  window.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'ArrowUp': case 'KeyW': keys.up = false; recomputeKeyMove(); break;
      case 'ArrowDown': case 'KeyS': keys.down = false; recomputeKeyMove(); break;
      case 'ArrowLeft': case 'KeyA': keys.left = false; recomputeKeyMove(); break;
      case 'ArrowRight': case 'KeyD': keys.right = false; recomputeKeyMove(); break;
      case 'Space':
        e.preventDefault();
        if (INPUT.shootDown) {
          const held = (performance.now() - INPUT.shootStartTime) / 1000;
          INPUT.releasedPower = Math.max(0.18, Math.min(1, held / INPUT.CHARGE_MAX));
          INPUT.shootDown = false;
          INPUT.shootReleased = true;
        }
        break;
    }
  });
})();
