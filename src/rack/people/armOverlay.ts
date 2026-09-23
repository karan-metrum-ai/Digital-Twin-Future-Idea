// @ts-nocheck
/* eslint-disable */
// Procedural upper-body overlay for the technician rig, layered on top of whatever clip the AnimationMixer has
// just written into the bones. Three effects, each with its own smoothed weight so nothing pops:
//   • walk swing  — the Walk_Loop's arm swing is read back from the upper-arm bones and amplified in phase, with a
//                   matching elbow bend, so the hands visibly pump while the figure crosses the hall;
//   • reach       — on the final approach to a rack the right arm rises toward it (and stays half-raised while the
//                   technician stands at the rack waiting for the fix to be confirmed);
//   • look        — the head turns toward a world point (the rack being walked to), clamped to a natural range;
//   • aim         — while working on a device the right hand is placed ON it: a two-bone CCD solve (forearm, then
//                   upper arm, three passes) on top of the clip's pose, blended in by weight, with the head pitching
//                   to look at the same point. This is what puts the hand on the FRU at the issue's U height.
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
const AIM_REACH_FRAC = 0.97;  // never fully lock the elbow: targets beyond reach are pulled in to this fraction of the arm
const AIM_HEAD_PITCH_MAX = 0.7; // rad
const AIM_LEAN_MAX = 0.42;      // rad, waist bend toward a low unit
// Inspect scan (parked in front of a rack): the head sweeps slowly up and down the device stack and a little side to side.
const SCAN_PITCH = 0.2;      // rad amplitude of the up/down scan
const SCAN_DOWN = -0.28;     // rad bias toward the devices (head ~1.65 m, rack face centre ~1.0 m at ~1 m)
const SCAN_PERIOD_S = 3.2;
const SCAN_YAW = 0.12;       // rad, side-to-side sweep

export function createArmOverlay(THREE, bones, root) {
  const q = new THREE.Quaternion(), qi = new THREE.Quaternion(), qr = new THREE.Quaternion();
  const axis = new THREE.Vector3(), dir = new THREE.Vector3(), fwd = new THREE.Vector3(), charRight = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0), UP = new THREE.Vector3(0, 1, 0);
  const B = (n) => bones[n.replace(/\./g, '')] ?? null; // bones are keyed by sanitised name (no 'DEF-', no dots) — see Technician.ts
  const upperL = B('upper_arm.L'), upperR = B('upper_arm.R'), foreL = B('forearm.L'), foreR = B('forearm.R'), handR = B('hand.R'), head = B('head');
  const hips = B('hips'), spineLow = B('spine.001') ?? hips;
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), qW = new THREE.Quaternion(), q0u = new THREE.Quaternion(), q0f = new THREE.Quaternion();
  const aimTarget = new THREE.Vector3(), gazeTarget = new THREE.Vector3(); let aimOn = false;

  // The mixer only rewrites a bone whose animated value changed since the last frame (PropertyMixer.apply), so a
  // bone on a flat stretch of its track would keep last frame's overlay and the rotations would pile up. Every bone
  // this overlay touches therefore has its pre-overlay local quaternion saved in apply() and put back by restore(),
  // which the owner calls before the next mixer.update().
  const touched = new Map(); // bone -> saved Quaternion
  const remember = (bone) => { if (!bone || touched.has(bone)) return; touched.set(bone, bone.quaternion.clone()); };
  const restore = () => { for (const [bone, q0] of touched) bone.quaternion.copy(q0); touched.clear(); };

  /** Smoothed weights (0..1) and their targets. */
  const w = { swing: 0, reach: 0, look: 0, scan: 0, aim: 0 };
  const target = { swing: 0, reach: 0, look: 0, scan: 0, aim: 0 };
  let lookPoint = null; // { x, z } world
  let scanT = 0;

  /** Rotate `bone` by `angle` about a world-space axis, keeping its subtree's world matrices current. */
  const rotateWorld = (bone, worldAxis, angle) => {
    if (!bone || Math.abs(angle) < 1e-5) return;
    remember(bone);
    bone.getWorldQuaternion(q); qi.copy(q).invert(); axis.copy(worldAxis).applyQuaternion(qi).normalize();
    qr.setFromAxisAngle(axis, angle); bone.quaternion.multiply(qr);
    bone.updateMatrixWorld(true);
  };
  /** Apply an arbitrary WORLD-space rotation to a bone (new world = qWorld * old world), keeping its subtree current. */
  const rotateWorldQuat = (bone, qWorld) => {
    remember(bone);
    bone.getWorldQuaternion(q); qi.copy(q).invert();
    qr.copy(qi).multiply(qWorld).multiply(q); bone.quaternion.multiply(qr);
    bone.updateMatrixWorld(true);
  };
  /**
   * Two-bone analytic reach: put the wrist on `aimTarget` (world). The elbow is placed on the circle that satisfies both
   * bone lengths (law of cosines), on the side of a "pole" that points down and a little outward so the elbow hangs
   * naturally; then the upper arm is rotated onto shoulder→elbow and the forearm onto elbow→wrist. Exact for
   * reachable targets; out-of-reach targets are pulled in to AIM_REACH_FRAC of the arm so the elbow never locks.
   * Blended against the pre-solve (clip) pose by `k`.
   */
  const pole = new THREE.Vector3(), uDir = new THREE.Vector3(), eNew = new THREE.Vector3(), qTmp = new THREE.Quaternion();
  const solveArm = (upper, fore, hand, k) => {
    if (!upper || !fore || !hand) return;
    upper.getWorldPosition(vA); fore.getWorldPosition(vB); hand.getWorldPosition(vC);           // S, E, W
    const L1 = vA.distanceTo(vB), L2 = vB.distanceTo(vC);
    const dMax = (L1 + L2) * AIM_REACH_FRAC, dMin = Math.abs(L1 - L2) + 0.02;
    // A target below the shoulder and beyond the arm gets a bend at the waist toward it (brings the shoulder forward
    // and down), the way a person leans in to a unit at hip height; high targets are reached with the arm alone.
    if (spineLow) {
      const shortfall = vA.distanceTo(aimTarget) - dMax, below = aimTarget.y < vA.y - 0.05;
      const lean = shortfall > 0 && below ? Math.min(AIM_LEAN_MAX, shortfall * 2.6) : 0;
      if (lean > 0.005) { rotateWorld(spineLow, charRight, -lean * k); upper.getWorldPosition(vA); fore.getWorldPosition(vB); hand.getWorldPosition(vC); }
    }
    q0u.copy(upper.quaternion); q0f.copy(fore.quaternion);
    uDir.copy(aimTarget).sub(vA); let d = uDir.length();
    d = THREE.MathUtils.clamp(d, dMin, dMax); uDir.normalize();
    // Elbow: distance `a` along S→T and `h` off the line, on the pole side (down + outward = character's right for the right arm).
    const a = (L1 * L1 + d * d - L2 * L2) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    pole.set(0, -1, 0).addScaledVector(charRight, 0.7).addScaledVector(fwd, -0.25);
    pole.addScaledVector(uDir, -pole.dot(uDir)); if (pole.lengthSq() < 1e-6) pole.copy(charRight); pole.normalize();
    eNew.copy(vA).addScaledVector(uDir, a).addScaledVector(pole, h);
    // Upper arm onto S→E, then forearm onto E→T (the forearm bone's origin is the elbow).
    qW.setFromUnitVectors(dir.copy(vB).sub(vA).normalize(), vB.copy(eNew).sub(vA).normalize()); rotateWorldQuat(upper, qW);
    fore.getWorldPosition(vB); hand.getWorldPosition(vC);
    vA.copy(vB).addScaledVector(uDir, 0); // E
    const tgt = eNew.copy(upper.getWorldPosition(eNew)).addScaledVector(uDir, d);               // clamped target point
    qW.setFromUnitVectors(dir.copy(vC).sub(vB).normalize(), vC.copy(tgt).sub(vB).normalize()); rotateWorldQuat(fore, qW);
    if (k < 0.999) {
      qTmp.copy(upper.quaternion); upper.quaternion.slerpQuaternions(q0u, qTmp, k);
      qTmp.copy(fore.quaternion); fore.quaternion.slerpQuaternions(q0f, qTmp, k);
      upper.updateMatrixWorld(true);
    }
  };
  /** Forward swing angle of an upper arm (rad, + = ahead of the body) from straight down. */
  const swingOf = (upper) => { upper.getWorldQuaternion(q); dir.copy(Y).applyQuaternion(q); return Math.atan2(dir.dot(fwd), -dir.y); };
  const approach = (cur, goal, dt, rate) => cur + (goal - cur) * (1 - Math.exp(-rate * dt));

  /**
   * Apply the overlay for this frame. Call after mixer.update() (and call restore() before it).
   * `s`: { walking, reach (0..1 desired reach amount), armsFree (false while a work clip owns the arms), inspect (head scan) }.
   */
  const apply = (s, dt) => {
    target.swing = s.walking && s.armsFree ? 1 : 0;
    target.reach = s.armsFree ? THREE.MathUtils.clamp(s.reach, 0, 1) : 0;
    target.look = lookPoint && s.armsFree ? 1 : 0;
    w.swing = approach(w.swing, target.swing, dt, 7);
    w.reach = approach(w.reach, target.reach, dt, target.reach < w.reach ? 9 : 5);
    w.look = approach(w.look, target.look, dt, 4);
    target.scan = s.inspect && s.armsFree ? 1 : 0;
    w.scan = approach(w.scan, target.scan, dt, 3);
    scanT = w.scan > 0.01 ? scanT + dt : 0;
    target.aim = s.aim && aimOn ? 1 : 0;
    w.aim = approach(w.aim, target.aim, dt, target.aim > w.aim ? 3 : 5);
    if (w.swing < 0.01 && w.reach < 0.01 && w.look < 0.01 && w.scan < 0.01 && w.aim < 0.01) return;

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
    if (w.scan > 0.01 && head) {
      const ph = (scanT / SCAN_PERIOD_S) * Math.PI * 2;
      rotateWorld(head, UP, SCAN_YAW * Math.sin(ph * 0.5 + 1.0) * w.scan);                 // slow sweep across the rack's width
      rotateWorld(head, charRight, (SCAN_DOWN + SCAN_PITCH * Math.sin(ph)) * w.scan);      // up/down over the device stack
    }
    if (w.aim > 0.01) {
      solveArm(upperR, foreR, handR, w.aim);
      if (head) {
        // Eyes on the work (or on a separate gaze point, e.g. the video wall at the NOC desk): yaw toward it, then pitch to its height.
        head.getWorldPosition(vA); vB.copy(gazeTarget).sub(vA);
        let dy = Math.atan2(vB.x, vB.z) - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        const pitch = Math.atan2(vB.y, Math.hypot(vB.x, vB.z));
        rotateWorld(head, UP, THREE.MathUtils.clamp(dy, -LOOK_MAX, LOOK_MAX) * w.aim);
        rotateWorld(head, charRight, THREE.MathUtils.clamp(pitch, -AIM_HEAD_PITCH_MAX, AIM_HEAD_PITCH_MAX) * w.aim);
      }
    }
  };

  return {
    apply, restore,
    /** Turn the head toward a world x/z point (null clears). */
    lookAt(p) { lookPoint = p ? { x: p.x, z: p.z } : null; },
    /** Put the right hand on a world point while `apply` is called with `aim: true` (null releases it). */
    aimAt(p, gaze) { aimOn = !!p; if (p) { aimTarget.set(p.x, p.y, p.z); const g = gaze ?? p; gazeTarget.set(g.x, g.y, g.z); } },
    get aiming() { return aimOn; },
    get weights() { return w; },
    /** Debug: current forward swing of each upper arm. */
    swings() { const yaw = root.rotation.y; fwd.set(Math.sin(yaw), 0, Math.cos(yaw)); return { L: upperL ? swingOf(upperL) : 0, R: upperR ? swingOf(upperR) : 0 }; },
  };
}
