// @ts-nocheck
/* eslint-disable */
// Procedural upper-body overlay for the technician rig, layered on top of whatever clip the AnimationMixer has
// just written into the bones. Three effects, each with its own smoothed weight so nothing pops:
//   • walk swing  — the Walk_Loop's arm swing is read back from the upper-arm bones and amplified in phase, with a
//                   matching elbow bend, so the hands visibly pump while the figure crosses the hall;
//   • reach       — on the final approach to a rack the right arm rises toward it (and stays half-raised while the
//                   technician stands at the rack waiting for the fix to be confirmed);
//   • look        — the head turns toward a world point (the rack being walked to), clamped to a natural range.
// All rotations are applied about world-space axes (character right / forward / up) mapped into each bone's local
// frame, so the overlay is independent of how the rig's rest pose is oriented. Pure bone maths, no scene access.
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.

const SWING_GAIN = 0.9;      // extra swing as a fraction of the clip's own (0.9 ≈ nearly double)
const SWING_MAX = 0.55;      // rad, cap on the added swing
const ELBOW_BASE = 0.22;     // rad, slight standing elbow bend while walking
const ELBOW_GAIN = 0.7;      // rad per rad of forward swing
const REACH_RAISE = 1.3;     // rad, right upper arm forward at full reach (the idle clip hangs the arm a little behind the hip)
const REACH_OUT = 0.22;      // rad, abduction so the hand clears the hip/rack edge
const REACH_ELBOW = 0.4;     // rad
const LOOK_MAX = 0.8;        // rad, head yaw clamp

export function createArmOverlay(THREE, bones, root) {
  const q = new THREE.Quaternion(), qi = new THREE.Quaternion(), qr = new THREE.Quaternion();
  const axis = new THREE.Vector3(), dir = new THREE.Vector3(), fwd = new THREE.Vector3(), charRight = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0), UP = new THREE.Vector3(0, 1, 0);
  const B = (n) => bones[n.replace(/\./g, '')] ?? null; // bones are keyed by sanitised name (no 'DEF-', no dots) — see Technician.ts
  const upperL = B('upper_arm.L'), upperR = B('upper_arm.R'), foreL = B('forearm.L'), foreR = B('forearm.R'), head = B('head');

  // The mixer only rewrites a bone whose animated value changed since the last frame (PropertyMixer.apply), so a
  // bone on a flat stretch of its track would keep last frame's overlay and the rotations would pile up. Every bone
  // this overlay touches therefore has its pre-overlay local quaternion saved in apply() and put back by restore(),
  // which the owner calls before the next mixer.update().
  const touched = new Map(); // bone -> saved Quaternion
  const remember = (bone) => { if (!bone || touched.has(bone)) return; touched.set(bone, bone.quaternion.clone()); };
  const restore = () => { for (const [bone, q0] of touched) bone.quaternion.copy(q0); touched.clear(); };

  /** Smoothed weights (0..1) and their targets. */
  const w = { swing: 0, reach: 0, look: 0 };
  const target = { swing: 0, reach: 0, look: 0 };
  let lookPoint = null; // { x, z } world

  /** Rotate `bone` by `angle` about a world-space axis, keeping its subtree's world matrices current. */
  const rotateWorld = (bone, worldAxis, angle) => {
    if (!bone || Math.abs(angle) < 1e-5) return;
    remember(bone);
    bone.getWorldQuaternion(q); qi.copy(q).invert(); axis.copy(worldAxis).applyQuaternion(qi).normalize();
    qr.setFromAxisAngle(axis, angle); bone.quaternion.multiply(qr);
    bone.updateMatrixWorld(true);
  };
  /** Forward swing angle of an upper arm (rad, + = ahead of the body) from straight down. */
  const swingOf = (upper) => { upper.getWorldQuaternion(q); dir.copy(Y).applyQuaternion(q); return Math.atan2(dir.dot(fwd), -dir.y); };
  const approach = (cur, goal, dt, rate) => cur + (goal - cur) * (1 - Math.exp(-rate * dt));

  /**
   * Apply the overlay for this frame. Call after mixer.update() (and call restore() before it).
   * `s`: { walking, reach (0..1 desired reach amount), armsFree (false while a work clip owns the arms) }.
   */
  const apply = (s, dt) => {
    target.swing = s.walking && s.armsFree ? 1 : 0;
    target.reach = s.armsFree ? THREE.MathUtils.clamp(s.reach, 0, 1) : 0;
    target.look = lookPoint && s.armsFree ? 1 : 0;
    w.swing = approach(w.swing, target.swing, dt, 7);
    w.reach = approach(w.reach, target.reach, dt, target.reach < w.reach ? 9 : 5);
    w.look = approach(w.look, target.look, dt, 4);
    if (w.swing < 0.01 && w.reach < 0.01 && w.look < 0.01) return;

    const yaw = root.rotation.y;
    fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    charRight.crossVectors(fwd, UP); // the character's own right-hand side

    if (w.swing > 0.01) {
      for (const [upper, fore] of [[upperL, foreL], [upperR, foreR]]) {
        if (!upper) continue;
        const sw = swingOf(upper);
        const extra = THREE.MathUtils.clamp(sw * SWING_GAIN, -SWING_MAX, SWING_MAX) * w.swing;
        rotateWorld(upper, charRight, extra);
        if (fore) rotateWorld(fore, charRight, (ELBOW_BASE + ELBOW_GAIN * Math.max(0, sw)) * w.swing);
      }
    }
    if (w.reach > 0.01 && upperR) {
      rotateWorld(upperR, charRight, REACH_RAISE * w.reach);
      rotateWorld(upperR, fwd, -REACH_OUT * w.reach);
      if (foreR) rotateWorld(foreR, charRight, REACH_ELBOW * w.reach);
    }
    if (w.look > 0.01 && head && lookPoint) {
      const want = Math.atan2(lookPoint.x - root.position.x, lookPoint.z - root.position.z);
      let d = want - yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      rotateWorld(head, UP, THREE.MathUtils.clamp(d, -LOOK_MAX, LOOK_MAX) * w.look);
    }
  };

  return {
    apply, restore,
    /** Turn the head toward a world x/z point (null clears). */
    lookAt(p) { lookPoint = p ? { x: p.x, z: p.z } : null; },
    get weights() { return w; },
    /** Debug: current forward swing of each upper arm. */
    swings() { const yaw = root.rotation.y; fwd.set(Math.sin(yaw), 0, Math.cos(yaw)); return { L: upperL ? swingOf(upperL) : 0, R: upperR ? swingOf(upperR) : 0 }; },
  };
}
