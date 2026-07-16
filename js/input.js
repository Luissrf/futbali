// Touch joystick + action buttons + keyboard fallback. Reusable per-player "rig" factory so
// a second local player (2-player mode) can get an independent control set on the same page.
// Rigs report raw, un-mirrored vectors — any left/right inversion for a player seated at the
// opposite edge of the screen is applied where the vector is consumed (main.js), not here.

function createTouchRig({ zone, base, stick, shoot, pass, switchBtn, maxR }) {
  const rig = {
    move: { x: 0, y: 0 },
    shootDown: false,
    shootStartTime: 0,
    shootReleased: false,
    releasedPower: 0,
    passPressed: false,
    switchPressed: false,
    CHARGE_MAX: 0.85,
  };

  const zoneEl = document.getElementById(zone);
  const baseEl = document.getElementById(base);
  const stickEl = document.getElementById(stick);
  const shootBtn = document.getElementById(shoot);
  const passBtnEl = document.getElementById(pass);
  const switchBtnEl = document.getElementById(switchBtn);
  const radius = maxR || 38;
  let pointerId = null;

  function baseCenter() {
    const r = baseEl.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function updateJoystick(clientX, clientY) {
    const c = baseCenter();
    let dx = clientX - c.x, dy = clientY - c.y;
    const len = Math.hypot(dx, dy);
    if (len > radius) { dx = (dx / len) * radius; dy = (dy / len) * radius; }
    stickEl.style.transform = `translate(${dx}px, ${dy}px)`;
    rig.move.x = dx / radius;
    rig.move.y = dy / radius;
  }

  function resetJoystick() {
    pointerId = null;
    rig.move.x = 0; rig.move.y = 0;
    stickEl.style.transform = 'translate(0px,0px)';
  }

  zoneEl.addEventListener('pointerdown', (e) => {
    pointerId = e.pointerId;
    zoneEl.setPointerCapture(e.pointerId);
    updateJoystick(e.clientX, e.clientY);
  });
  zoneEl.addEventListener('pointermove', (e) => {
    if (e.pointerId === pointerId) updateJoystick(e.clientX, e.clientY);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) =>
    zoneEl.addEventListener(ev, (e) => { if (e.pointerId === pointerId) resetJoystick(); })
  );

  function startShoot(e) {
    e.preventDefault();
    if (rig.shootDown) return;
    rig.shootDown = true;
    rig.shootStartTime = performance.now();
  }
  function endShoot(e) {
    e.preventDefault();
    if (!rig.shootDown) return;
    const held = (performance.now() - rig.shootStartTime) / 1000;
    rig.releasedPower = Math.max(0.18, Math.min(1, held / rig.CHARGE_MAX));
    rig.shootDown = false;
    rig.shootReleased = true;
  }
  shootBtn.addEventListener('pointerdown', startShoot);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => shootBtn.addEventListener(ev, endShoot));

  passBtnEl.addEventListener('pointerdown', (e) => { e.preventDefault(); rig.passPressed = true; });
  switchBtnEl.addEventListener('pointerdown', (e) => { e.preventDefault(); rig.switchPressed = true; });

  rig._keyShootDown = () => { if (!rig.shootDown) { rig.shootDown = true; rig.shootStartTime = performance.now(); } };
  rig._keyShootUp = () => {
    if (!rig.shootDown) return;
    const held = (performance.now() - rig.shootStartTime) / 1000;
    rig.releasedPower = Math.max(0.18, Math.min(1, held / rig.CHARGE_MAX));
    rig.shootDown = false;
    rig.shootReleased = true;
  };

  // called on kickoff (incl. after a goal) so a finger left resting on the joystick/shoot button
  // through the goal-celebration overlay can't leave the rig stuck in a mid-gesture state once
  // play resumes — the game-state pause during the celebration means none of this gets consumed
  // or cleared by the normal update loop while it's frozen
  rig.reset = () => {
    if (pointerId !== null) {
      try { zoneEl.releasePointerCapture(pointerId); } catch (e) { /* already released */ }
    }
    resetJoystick();
    rig.shootDown = false;
    rig.shootReleased = false;
    rig.passPressed = false;
    rig.switchPressed = false;
  };

  return rig;
}

// keyboard fallback for desktop testing — each rig gets its own independent key set
function wireKeyboard(rig, map) {
  const keys = { up: false, down: false, left: false, right: false };
  function recompute() {
    let x = 0, y = 0;
    if (keys.left) x -= 1;
    if (keys.right) x += 1;
    if (keys.up) y -= 1;
    if (keys.down) y += 1;
    const len = Math.hypot(x, y);
    rig.move.x = len ? x / len : 0;
    rig.move.y = len ? y / len : 0;
  }
  window.addEventListener('keydown', (e) => {
    if (map.up.includes(e.code)) { keys.up = true; recompute(); }
    else if (map.down.includes(e.code)) { keys.down = true; recompute(); }
    else if (map.left.includes(e.code)) { keys.left = true; recompute(); }
    else if (map.right.includes(e.code)) { keys.right = true; recompute(); }
    else if (map.shoot.includes(e.code)) { e.preventDefault(); rig._keyShootDown(); }
    else if (map.pass.includes(e.code)) { e.preventDefault(); rig.passPressed = true; }
    else if (map.switchKey.includes(e.code)) { rig.switchPressed = true; }
  });
  window.addEventListener('keyup', (e) => {
    if (map.up.includes(e.code)) { keys.up = false; recompute(); }
    else if (map.down.includes(e.code)) { keys.down = false; recompute(); }
    else if (map.left.includes(e.code)) { keys.left = false; recompute(); }
    else if (map.right.includes(e.code)) { keys.right = false; recompute(); }
    else if (map.shoot.includes(e.code)) { e.preventDefault(); rig._keyShootUp(); }
  });
}

const INPUT = createTouchRig({ zone: 'joystick-zone', base: 'joystick-base', stick: 'joystick-stick', shoot: 'btn-shoot', pass: 'btn-pass', switchBtn: 'btn-switch', maxR: 38 });
const INPUT2 = createTouchRig({ zone: 'joystick-zone-p2', base: 'joystick-base-p2', stick: 'joystick-stick-p2', shoot: 'btn-shoot-p2', pass: 'btn-pass-p2', switchBtn: 'btn-switch-p2', maxR: 33 });

wireKeyboard(INPUT, { up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], shoot: ['Space'], pass: ['KeyE'], switchKey: ['KeyQ'] });
wireKeyboard(INPUT2, { up: ['Numpad8'], down: ['Numpad5', 'Numpad2'], left: ['Numpad4'], right: ['Numpad6'], shoot: ['NumpadEnter', 'Enter'], pass: ['Numpad9'], switchKey: ['NumpadAdd'] });
