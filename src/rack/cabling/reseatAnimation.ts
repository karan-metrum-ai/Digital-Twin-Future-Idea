// @ts-nocheck
/* eslint-disable */
// Reseat animation for the unseated RJ45 (see wireCabling.ts's fault cable). Staged the way a technician does it:
//   1. lift + square up — the plug is picked up off its sagging hang and aligned with the jack (rotation -> 0,
//                          eased back a touch so it can be lined up with the opening)
//   2. push home        — eased travel into the jack, slowing as the latch ramp loads up
//   3. click            — the latch tab compresses and springs back, with a millimetre of overshoot and settle
//   4. link up          — the alarm-red emissive fades and the jacket returns to the same blue as its neighbours
// The cable is re-meshed from the plug transform every frame so it follows the connector exactly.
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const easeIn = (u) => u * u * u;
const easeOut = (u) => 1 - Math.pow(1 - u, 3);

export function createReseatAnimation(THREE, fc) {
  const { plug, unseated, seated, latchTail, material, rebuild, seatedColor } = fc;
  const redColor = material.color.clone(), redEmissive = material.emissive.clone();
  const T_LIFT = 0.55, T_PUSH = 0.60, T_CLICK = 0.30, T_LINK = 0.75; // seconds
  const total = T_LIFT + T_PUSH + T_CLICK + T_LINK;
  let start = -1, done = false, onDone = null, state = 'unseated';
  const lifted = { pos: new THREE.Vector3(seated.pos.x, seated.pos.y, unseated.pos.z + 0.004), rot: new THREE.Euler(0, 0, 0) };
  const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion();
  const slerpRot = (a, b, u) => { q0.setFromEuler(a); q1.setFromEuler(b); plug.quaternion.copy(q0).slerp(q1, u); };

  const applySeated = () => {
    plug.position.copy(seated.pos); plug.rotation.copy(seated.rot); latchTail.scale.y = 1; rebuild();
    material.color.copy(seatedColor); material.emissive.setHex(0x000000); material.emissiveIntensity = 0;
    state = 'seated'; done = true;
  };
  const applyUnseated = () => {
    plug.position.copy(unseated.pos); plug.rotation.copy(unseated.rot); latchTail.scale.y = 1; rebuild();
    material.color.copy(redColor); material.emissive.copy(redEmissive);
    state = 'unseated'; done = false; start = -1;
  };

  const tick = (t) => {
    if (start < 0 || done) return;
    const e = t - start;
    if (e < T_LIFT) {                                   // 1. lift + square up
      const u = easeInOut(e / T_LIFT);
      plug.position.lerpVectors(unseated.pos, lifted.pos, u); slerpRot(unseated.rot, lifted.rot, u);
    } else if (e < T_LIFT + T_PUSH) {                   // 2. push home (slows as the latch ramp loads up)
      const u = (e - T_LIFT) / T_PUSH, k = u < 0.8 ? easeIn(u / 0.8) * 0.94 : 0.94 + 0.06 * easeOut((u - 0.8) / 0.2);
      plug.position.lerpVectors(lifted.pos, seated.pos, k); plug.rotation.copy(seated.rot);
      latchTail.scale.y = 1 - 0.45 * THREE.MathUtils.smoothstep(u, 0.55, 1.0); // tab riding down the ramp
    } else if (e < T_LIFT + T_PUSH + T_CLICK) {         // 3. click: 1 mm overshoot + settle, latch springs back
      const u = (e - T_LIFT - T_PUSH) / T_CLICK;
      plug.position.copy(seated.pos); plug.position.z -= 0.001 * Math.sin(u * Math.PI) * (1 - u);
      latchTail.scale.y = 0.55 + 0.45 * easeOut(Math.min(1, u * 1.6)) + 0.08 * Math.sin(u * Math.PI * 3) * (1 - u);
    } else {                                            // 4. link up: red alarm -> ordinary blue jacket
      const u = Math.min(1, (e - T_LIFT - T_PUSH - T_CLICK) / T_LINK);
      plug.position.copy(seated.pos); latchTail.scale.y = 1;
      material.color.lerpColors(redColor, seatedColor, easeInOut(u));
      material.emissive.copy(redEmissive).multiplyScalar(1 - u); material.emissiveIntensity = 1.2 * (1 - u);
      if (u >= 1) { applySeated(); if (onDone) onDone(); return; }
    }
    rebuild();
  };

  return {
    /** Begin the staged reseat at scene time `t`; `cb` fires once the cable has gone blue. */
    start(t, cb) { if (state === 'seated' || start >= 0) return; onDone = cb; start = t; state = 'seating'; },
    /** Jump straight to the seated state (e.g. mounted with the issue already fixed). */
    seatNow() { applySeated(); },
    /** Put the fault back (dev/demo reset). */
    reset() { applyUnseated(); },
    tick,
    get state() { return state; },
    /** The alarm pulse is only meaningful while the fault is live. */
    get pulsing() { return state === 'unseated'; },
    duration: total,
  };
}
