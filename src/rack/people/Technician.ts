// @ts-nocheck
/* eslint-disable */
// Data-centre technician: a rigged, skinned humanoid (public/models/technician.glb — the CC0 mannequin from
// Quaternius' Universal Animation Library with its Idle / Walk / Interact / Fixing-Kneeling clips) driven by an
// AnimationMixer, dressed at runtime as a DC tech: navy work uniform, hi-vis vest band with reflective stripes and
// a white hard hat parented to the rig. Walks the hall's corridors (people/paths.ts) to whichever rack has a
// remediation in flight, plays the reach (Interact) or kneel (Fixing_Kneeling) clip while the fix is acted out, and
// does rounds between jobs. Built at scene-build time; the mesh arrives asynchronously and the same userData API
// works before and after it lands.
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createArmOverlay } from './armOverlay';
import { createUniformMaterial, bakeUniformAttributes, REGION } from './uniformMaterial';

const WALK_SPEED = 1.5;      // m/s
const TURN_RATE = 9;         // yaw easing rate, 1/s (frame-rate independent)
const REACH_FROM_M = 1.7;    // the right hand starts rising toward the rack this far from the stand point
const REACH_HOLD = 0.7;      // how far the hand stays raised while standing at the rack waiting for the fix
const INSPECT_REACH = 0.75;  // hand toward the rack while the user has parked the technician in front of it (drive mode)
const HEIGHT_M = 1.78;
// 'reach' (working on a device above knee height) is the idle stance with the right hand placed on the device by the
// arm overlay's IK (workAt), rather than the canned Interact poke; 'kneel' is the authored kneeling fix.
const CLIP = { idle: 'Idle_Loop', walk: 'Walk_Loop', kneel: 'Fixing_Kneeling', reach: 'Idle_Loop' };
const FADE = { idle: 0.45, walk: 0.3, kneel: 0.6, reach: 0.45 }; // crossfade seconds into each pose
const FADE_STAND_UP = 0.9;  // kneel -> idle: standing back up takes a moment
const WALK_CLIP_MPS = 1.35; // ground speed the Walk_Loop cycle is authored at
const MODEL_URL = `${import.meta.env.BASE_URL ?? '/'}models/technician.glb`;

export function buildTechnician(THREE) {
  const root = new THREE.Group(); root.name = 'technician';
  const body = new THREE.Group(); body.name = 'technician_body_root'; root.add(body);

  /* -------- rig / animation state (filled once the GLB lands) -------- */
  let mixer = null, actions = {}, current = null, bones = {}, ready = false, overlay = null;
  // GLTFLoader sanitises node names (PropertyBinding.sanitizeNodeName) — 'DEF-spine.002' arrives as 'DEF-spine002'
  // — so bones are keyed, and looked up, by the Rigify name with its 'DEF-' prefix and dots removed.
  const boneKey = (n) => n.replace(/^DEF-/, '').replace(/\./g, '');
  const bone = (n) => bones[boneKey(n)] ?? null;

  const fade = (name, dur = 0.3) => {
    const next = actions[name]; if (!next || next === current) return;
    next.reset().setEffectiveWeight(1).play();
    if (current) current.crossFadeTo(next, dur, true); current = next;
  };
  const clipFor = (p) => CLIP[p] ?? CLIP.idle;

  new GLTFLoader().load(MODEL_URL, (gltf) => {
    const model = gltf.scene;
    // Normalise to a standing height in metres with the feet on the floor; the rig faces +z as exported.
    const box = new THREE.Box3().setFromObject(model); const h = box.max.y - box.min.y;
    model.scale.multiplyScalar(HEIGHT_M / h); model.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(model); model.position.y -= box2.min.y;
    // Dress the mannequin. The mesh is one skin, so the uniform is drawn by the shader (uniformMaterial.ts) from each
    // vertex's rest-pose position and a body region taken from the bone it mostly follows: skin on the head, neck,
    // forearms and hands; a navy polo over the torso and upper arms with the hi-vis vest, zip and collar painted on
    // top; charcoal trousers with the belt; black safety boots. Joint caps use the same material a shade darker.
    const regionOfBone = (name) => {
      if (/^head$/.test(name)) return REGION.hair;                 // split into hair / skin by height in bakeUniformAttributes
      if (/^neck$/.test(name)) return REGION.skin;
      if (/forearm|hand|thumb|f_index|f_middle|f_ring|f_pinky/.test(name)) return REGION.skin;
      if (/shoulder|upper_arm|spine/.test(name)) return REGION.polo;
      if (/hips|thigh|shin/.test(name)) return REGION.trouser;
      if (/foot|toe/.test(name)) return REGION.boot;
      return REGION.polo;
    };
    model.updateMatrixWorld(true);
    model.traverse((o) => { if (o.isBone) bones[boneKey(o.name)] = o; });
    const headY = bones['head'] ? bones['head'].getWorldPosition(new THREE.Vector3()).y : Infinity;
    const uniformMat = createUniformMaterial(THREE), jointMat = createUniformMaterial(THREE, { joint: true });
    model.traverse((o) => {
      if (!(o.isMesh || o.isSkinnedMesh)) return;
      o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; o.name = 'technician_body';
      const src = Array.isArray(o.material) ? o.material[0] : o.material;
      const isJoint = /joint/i.test(src?.name ?? '');
      bakeUniformAttributes(THREE, o, regionOfBone, o.matrixWorld, headY + 0.135);
      o.material = isJoint ? jointMat : uniformMat;
    });

    // Props parented to the rig (hard hat, lanyard + badge, tool pouch); the garments themselves are painted by the
    // shader above. Sized from the skinned mesh itself (measureHead / measureRegion) so they sit on the body.
    const head = bone('head'), chest = bone('spine.002') ?? bone('spine.001'), upper = bone('spine.003') ?? chest, hips = bone('hips');
    const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...o });
    const mats = {
      hat: M(0xf1f2f4, { roughness: 0.4 }), hiVis: M(0xd7f03a, { roughness: 0.75, side: THREE.DoubleSide }),
      stripe: M(0xd9dde3, { roughness: 0.3, metalness: 0.4, emissive: 0x2e3135, emissiveIntensity: 0.3, side: THREE.DoubleSide }),
      lanyard: M(0x1f5fd0, { roughness: 0.8 }), badge: M(0xf4f6fa, { roughness: 0.5 }), badgeInk: M(0x1b2a44), leather: M(0x1b1a18, { roughness: 0.85 }), buckle: M(0xb9bdc2, { metalness: 0.8, roughness: 0.3 }),
    };
    const mesh = (geo, mat, name) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = false; return m; };
    /** Elliptic open band around a bone: unit cylinder scaled to (rx, rz), centred at (y, zc). */
    const band = (mat, name, rx, rz, h, y, zc, taper = 1, theta0 = 0, thetaLen = Math.PI * 2) => { const m = mesh(new THREE.CylinderGeometry(1, taper, h, 32, 1, true, theta0, thetaLen), mat, name); m.scale.set(rx, 1, rz); m.position.set(0, y, zc); return m; };
    if (head) {
      // Hard hat fitted to the head mesh itself. The vertices the head bone drives are measured in the bone's own
      // frame (rest pose): the skull top, and the width/depth of the band just above the brow where the rim sits.
      // The shell is an ellipsoid dome sized to that band plus a suspension gap, so it sits ON the head instead of
      // intersecting it, with the brim at brow height, a longer front peak, a crest ridge and a hi-vis band.
      const fit = measureHead(THREE, model, head);
      const rimY = fit.top - 0.075;                                  // rim at brow height
      const rx = fit.halfX + 0.02, rz = fit.halfZ + 0.02, ry = fit.top - rimY + 0.035; // shell radii: ~2 cm clearance all round, ~3.5 cm suspension gap on top
      const hatG = new THREE.Group(); hatG.name = 'technician_hat_root'; hatG.position.set(0, rimY, fit.zc); head.add(hatG);
      const dome = mesh(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), mats.hat, 'technician_hat'); dome.scale.set(rx, ry, rz); dome.castShadow = true; hatG.add(dome);
      const ridge = mesh(new THREE.BoxGeometry(0.018, 0.012, rz * 1.15), mats.hat, 'technician_hat_ridge'); ridge.position.set(0, ry - 0.003, 0); hatG.add(ridge);
      const brim = mesh(new THREE.CylinderGeometry(1, 1, 0.008, 32), mats.hat, 'technician_hat_brim'); brim.scale.set(rx + 0.012, 1, rz + 0.012); brim.position.set(0, -0.002, 0); hatG.add(brim);
      const peak = mesh(new THREE.CylinderGeometry(1, 1, 0.008, 24, 1, false, -Math.PI / 2, Math.PI), mats.hat, 'technician_hat_peak'); peak.scale.set(rx + 0.008, 1, 0.075); peak.position.set(0, -0.006, rz - 0.01); peak.rotation.x = 0.16; hatG.add(peak);
      const bandY = 0.03, k = Math.sqrt(1 - (bandY / ry) ** 2);
      hatG.add(band(mats.hiVis, 'technician_hat_band', rx * k + 0.003, rz * k + 0.003, 0.028, bandY, 0));
    }
    if (chest) {
      // ID badge on a lanyard round the neck, hanging just in front of the chest (chest depth measured from the mesh).
      const t = measureRegion(THREE, model, chest, ['spine002', 'spine003', 'spine001'], -0.07, 0.17, { halfX: 0.16, halfZ: 0.125, zc: 0 });
      const rz = t.halfZ + 0.012, yMid = 0.05;
      const lan = mesh(new THREE.TorusGeometry(0.09, 0.004, 6, 24, Math.PI * 1.1), mats.lanyard, 'technician_lanyard'); lan.position.set(0, 0.19, t.zc + 0.03); lan.rotation.set(-Math.PI / 2 + 0.6, 0, Math.PI / 2 + Math.PI * 0.45); chest.add(lan);
      const badge = mesh(new THREE.BoxGeometry(0.06, 0.085, 0.004), mats.badge, 'technician_badge'); badge.position.set(0.03, yMid, t.zc + rz + 0.012); badge.rotation.z = -0.08; chest.add(badge);
      const photo = mesh(new THREE.BoxGeometry(0.024, 0.03, 0.002), mats.badgeInk, 'technician_badge_photo'); photo.position.set(-0.013, 0.015, 0.003); badge.add(photo);
      for (let i = 0; i < 3; i++) { const l = mesh(new THREE.BoxGeometry(0.02, 0.004, 0.002), mats.badgeInk, 'technician_badge_line'); l.position.set(0.012, 0.026 - i * 0.012, 0.003); badge.add(l); }
      const clip = mesh(new THREE.BoxGeometry(0.012, 0.014, 0.006), mats.buckle, 'technician_badge_clip'); clip.position.set(0, 0.05, 0); badge.add(clip);
    }
    if (hips) {
      // Tool pouch on the right hip (the belt and buckle are painted), sized to the hips just above the trouser line.
      const hp = measureRegion(THREE, model, hips, ['hips'], 0.03, 0.11, { halfX: 0.125, halfZ: 0.11, zc: 0.03 });
      const rx = hp.halfX + 0.01, rz = hp.halfZ + 0.01, y = 0.07;
      const pouch = mesh(new THREE.BoxGeometry(0.1, 0.13, 0.07), mats.leather, 'technician_pouch'); pouch.position.set(-(rx + 0.03), y - 0.09, hp.zc + 0.01); pouch.rotation.z = -0.05; hips.add(pouch); // character's right is -x
      const flap = mesh(new THREE.BoxGeometry(0.102, 0.04, 0.074), mats.leather, 'technician_pouch_flap'); flap.position.set(0, 0.06, 0); pouch.add(flap);
      const driver = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 8), mats.buckle, 'technician_driver'); driver.position.set(-0.03, 0.09, 0.02); pouch.add(driver);
      const grip = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 10), M(0xd8641e), 'technician_driver_grip'); grip.position.set(0, 0.08, 0); driver.add(grip);
    }
    body.add(model);
    mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) { const a = mixer.clipAction(clip); a.enabled = true; a.setEffectiveWeight(0); actions[clip.name] = a; }
    if (actions[CLIP.walk]) actions[CLIP.walk].setEffectiveTimeScale(WALK_SPEED / WALK_CLIP_MPS);
    if (actions[CLIP.kneel]) { actions[CLIP.kneel].setEffectiveTimeScale(0.9); actions[CLIP.kneel].setLoop(THREE.LoopOnce, 1); actions[CLIP.kneel].clampWhenFinished = true; } // settle on one knee and stay there
    overlay = createArmOverlay(THREE, bones, root); if (pendingLook) overlay.lookAt(pendingLook); if (pendingAim) overlay.aimAt(pendingAim, pendingAim.gaze);
    ready = true;
    fade(clipFor(pose), 0);
  }, undefined, (err) => console.warn('[technician] model failed to load', err));

  /* -------- motion state -------- */
  let path = null, seg = 0, segT = 0, onArrive = null, pose = 'idle', targetYaw = Math.PI, faceYaw = null;
  let reachWalk = false, atJob = false, pendingLook = null; // reachWalk: this walk ends at a rack (hand rises on approach); atJob: standing at one
  // Drive mode (keyboard, see corridors.ts): the scene places the figure every frame instead of a path.
  let driving = false, driveSpeed = 0, inspecting = false, pendingAim = null;
  const walkTimeScale = (mps) => { if (ready && actions[CLIP.walk]) actions[CLIP.walk].setEffectiveTimeScale(mps / WALK_CLIP_MPS); };

  /** Metres left to the end of the current path. */
  const remainingM = () => {
    if (!path) return 0;
    let s = 0; for (let i = seg; i < path.length - 1; i++) s += Math.hypot(path[i + 1].x - path[i].x, path[i + 1].z - path[i].z);
    return s - segT;
  };

  /** Walk a waypoint chain. `opts.reach`: the chain ends at a rack, so the hand rises toward it on the last stretch. */
  const walkTo = (pts, opts = {}) => new Promise((resolve) => {
    if (!pts || pts.length < 2) { resolve(); return; }
    driving = false; driveSpeed = 0; inspecting = false; walkTimeScale(WALK_SPEED); // a dispatch walk always wins over the keyboard (and takes them off the NOC desk)
    root.position.set(pts[0].x, 0, pts[0].z);
    path = pts; seg = 0; segT = 0; faceYaw = null; pose = 'walk'; reachWalk = !!opts.reach; atJob = false; if (ready) fade(CLIP.walk);
    onArrive = () => { pose = 'idle'; atJob = reachWalk; if (ready) fade(CLIP.idle); resolve(); };
  });

  const tick = (t, dt) => {
    if (path) {
      let remaining = WALK_SPEED * dt;
      while (remaining > 0 && seg < path.length - 1) {
        const a = path[seg], b = path[seg + 1], len = Math.hypot(b.x - a.x, b.z - a.z);
        if (len < 1e-6) { seg++; segT = 0; continue; }
        const step = Math.min(remaining, len - segT); segT += step; remaining -= step;
        const u = segT / len; root.position.set(a.x + (b.x - a.x) * u, 0, a.z + (b.z - a.z) * u);
        targetYaw = Math.atan2(b.x - a.x, b.z - a.z);
        if (segT >= len - 1e-6) { seg++; segT = 0; }
      }
      if (seg >= path.length - 1) { path = null; const cb = onArrive; onArrive = null; if (cb) cb(); }
    } else if (faceYaw !== null) targetYaw = faceYaw;
    // Yaw eases toward the heading; wrap the difference so it turns the short way.
    let d = targetYaw - root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); root.rotation.y += d * (1 - Math.exp(-TURN_RATE * dt));

    if (!ready) return;
    overlay.restore(); mixer.update(dt);
    // Hands: pump harder while walking, rise toward the rack on the final approach, stay half-raised while waiting
    // at it; the head tracks the rack. Work clips (kneel / interact) own the arms outright.
    let reach = 0;
    if (path && reachWalk) reach = smooth01(1 - (remainingM() - 0.2) / REACH_FROM_M);
    else if (!path && atJob && pose === 'idle') reach = REACH_HOLD;
    else if (inspecting && pose === 'idle') reach = INSPECT_REACH;
    const moving = !!path || (driving && Math.abs(driveSpeed) > 0.05);
    // 'reach' work (a device, or the NOC keyboard): arms are not free (no swing / inspect gestures) but the IK aim owns
    // the right arm and the head.
    const working = pose === 'reach';
    overlay.apply({ walking: moving, reach: working ? 0 : reach, armsFree: pose === 'idle' || pose === 'walk', inspect: inspecting && pose === 'idle', aim: working }, dt);
  };

  root.userData = {
    walkTo, tick,
    setPose(p) { const from = pose; pose = p; if (ready) fade(clipFor(p), from === 'kneel' && p !== 'kneel' ? FADE_STAND_UP : (FADE[p] ?? 0.4)); },
    /** Point the right hand (and eyes) at a world point while in the 'reach' work pose; null releases. */
    workAt(p, gaze) { if (overlay) overlay.aimAt(p, gaze); pendingAim = p ? { x: p.x, y: p.y, z: p.z, gaze: gaze ? { x: gaze.x, y: gaze.y, z: gaze.z } : undefined } : null; },
    /** Turn the head toward a world x/z point while walking or standing (null clears). */
    lookAt(p) { pendingLook = p ?? null; if (overlay) overlay.lookAt(pendingLook); },
    /** Face a world yaw (toward the rack) once standing still. */
    face(yaw) { faceYaw = yaw; },
    get pose() { return pose; },
    get walking() { return !!path || (driving && Math.abs(driveSpeed) > 0.05); },
    get driving() { return driving; },
    get inspecting() { return inspecting; },
    /**
     * Drive mode: the scene's controller (corridors.ts) supplies position / heading / ground speed every frame; the
     * walk clip's rate follows the speed (negative = back-pedal). `null` leaves drive mode standing where they are.
     */
    drive(frame) {
      if (!frame) { if (!driving) return; driving = false; driveSpeed = 0; walkTimeScale(WALK_SPEED); if (pose === 'walk') { pose = 'idle'; if (ready) fade(CLIP.idle); } return; }
      if (!driving) { driving = true; path = null; onArrive = null; reachWalk = false; atJob = false; faceYaw = null; }
      root.position.set(frame.x, 0, frame.z); targetYaw = frame.yaw; driveSpeed = frame.speed;
      if (Math.abs(driveSpeed) > 0.05) {
        if (pose !== 'walk') { pose = 'walk'; if (ready) fade(CLIP.walk); }
        walkTimeScale(driveSpeed);
      } else if (pose === 'walk') { pose = 'idle'; if (ready) fade(CLIP.idle); }
    },
    /** Cancel any walk or drive and stand still where they are (the keyboard taking over from the rounds). */
    stop() { path = null; onArrive = null; reachWalk = false; atJob = false; faceYaw = null; driveSpeed = 0; walkTimeScale(WALK_SPEED); if (pose === 'walk') { pose = 'idle'; if (ready) fade(CLIP.idle); } },
    /** Face `t.yaw`, look at (t.x, t.z) and hold the inspecting pose (hand toward the rack, head scanning); null clears. */
    inspect(t) { inspecting = !!t; faceYaw = t ? t.yaw : null; pendingLook = t ? { x: t.x, z: t.z } : null; if (overlay) overlay.lookAt(pendingLook); },
    get ready() { return ready; },
    reset(x, z) { path = null; onArrive = null; pose = 'idle'; faceYaw = null; reachWalk = false; atJob = false; pendingLook = null; pendingAim = null; driving = false; driveSpeed = 0; inspecting = false; walkTimeScale(WALK_SPEED); root.position.set(x, 0, z); root.rotation.y = Math.PI; if (overlay) { overlay.lookAt(null); overlay.aimAt(null); } if (ready) fade(CLIP.idle, 0); },
    get overlay() { return overlay; },
  };
  return root;
}

const smooth01 = (u) => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };

/**
 * Measure the head in the head bone's local frame from the skinned mesh's rest pose: skull top, and the half-width /
 * half-depth / depth-centre of the band just under the top where a hat's rim sits. Vertices count as "head" when the
 * head bone is their dominant skin influence. Falls back to a generic adult head if the mesh has no skin data.
 */
function measureHead(THREE, model, head) {
  const out = { top: 0.26, halfX: 0.085, halfZ: 0.11, zc: -0.01 };
  const inv = new THREE.Matrix4().copy(head.matrixWorld).invert(), v = new THREE.Vector3();
  const pts = [];
  model.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const g = o.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight; if (!si || !sw) return;
    const names = o.skeleton.bones.map((b) => b.name.replace(/^DEF-/, '').replace(/\./g, ''));
    for (let i = 0; i < pos.count; i++) {
      let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
      if (names[best] !== 'head') continue;
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv); pts.push(v.clone());
    }
  });
  if (pts.length < 20) return out;
  let top = -Infinity; for (const p of pts) top = Math.max(top, p.y);
  // Rim band: the 3 cm either side of the brow line; this is what the shell has to clear all the way round.
  const rimY = top - 0.075; let hx = 0, zmin = Infinity, zmax = -Infinity, n = 0;
  for (const p of pts) if (p.y > rimY - 0.03 && p.y < rimY + 0.03) { hx = Math.max(hx, Math.abs(p.x)); zmin = Math.min(zmin, p.z); zmax = Math.max(zmax, p.z); n++; }
  if (n < 4) return { ...out, top };
  return { top, halfX: hx, halfZ: (zmax - zmin) / 2, zc: (zmax + zmin) / 2 };
}

/**
 * Extent of the skinned vertices dominated by any of `boneNames` (sanitised: no 'DEF-', no dots), expressed in
 * `ref`'s frame and restricted to the slab yFrom..yTo of that frame: half-width in x, half-depth and centre in z.
 * `fallback` is returned when the mesh has no skin data or the slab is empty.
 */
function measureRegion(THREE, model, ref, boneNames, yFrom, yTo, fallback) {
  const want = new Set(boneNames);
  const inv = new THREE.Matrix4().copy(ref.matrixWorld).invert(), v = new THREE.Vector3();
  let hx = 0, zmin = Infinity, zmax = -Infinity, n = 0;
  model.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const g = o.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight; if (!si || !sw) return;
    const names = o.skeleton.bones.map((b) => b.name.replace(/^DEF-/, '').replace(/\./g, ''));
    for (let i = 0; i < pos.count; i++) {
      let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
      if (!want.has(names[best])) continue;
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      if (v.y < yFrom || v.y > yTo) continue;
      hx = Math.max(hx, Math.abs(v.x)); zmin = Math.min(zmin, v.z); zmax = Math.max(zmax, v.z); n++;
    }
  });
  if (n < 6) return fallback;
  return { halfX: hx, halfZ: (zmax - zmin) / 2, zc: (zmax + zmin) / 2, n };
}
