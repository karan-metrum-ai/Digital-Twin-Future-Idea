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

const WALK_SPEED = 1.5;      // m/s
const TURN_RATE = 9;         // yaw easing rate, 1/s (frame-rate independent)
const REACH_FROM_M = 1.7;    // the right hand starts rising toward the rack this far from the stand point
const REACH_HOLD = 0.7;      // how far the hand stays raised while standing at the rack waiting for the fix
const HEIGHT_M = 1.78;
const CLIP = { idle: 'Idle_Loop', walk: 'Walk_Loop', kneel: 'Fixing_Kneeling', reach: 'Interact' };
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
    // Dress the mannequin. The mesh is one skin, so clothing is painted per vertex from the bone each vertex mostly
    // follows: skin on the head, neck, forearms and hands; a navy short-sleeve polo over the torso and upper arms;
    // charcoal work trousers; black safety boots. Joint caps take the same colour a shade darker.
    const PALETTE = {
      skin: new THREE.Color(0xc98f6b), hair: new THREE.Color(0x2b2118), polo: new THREE.Color(0x2b4a7c), collar: new THREE.Color(0xe8ebef),
      trouser: new THREE.Color(0x30343b), belt: new THREE.Color(0x15171a), boot: new THREE.Color(0x141414),
    };
    const regionOf = (name) => {
      if (/^(head)$/.test(name)) return 'head';
      if (/^neck$/.test(name)) return 'skin';
      if (/forearm|hand|thumb|f_index|f_middle|f_ring|f_pinky/.test(name)) return 'skin';
      if (/shoulder|upper_arm|spine/.test(name)) return 'polo';
      if (/hips/.test(name)) return 'trouser';
      if (/thigh|shin/.test(name)) return 'trouser';
      if (/foot|toe/.test(name)) return 'boot';
      return 'polo';
    };
    const paint = (mesh, darken) => {
      const g = mesh.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
      if (!si || !sw || !mesh.skeleton) return;
      const col = new Float32Array(pos.count * 3), c = new THREE.Color(), boneName = mesh.skeleton.bones.map((b) => boneKey(b.name));
      const headBone = bones['head']; const headY = headBone ? headBone.getWorldPosition(new THREE.Vector3()).y : Infinity;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        // Dominant joint decides the garment.
        let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
        const region = regionOf(boneName[best] ?? '');
        if (region === 'head') { v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld); c.copy(v.y > headY + 0.135 ? PALETTE.hair : PALETTE.skin); }
        else if (region === 'polo') { v.fromBufferAttribute(pos, i); c.copy(boneName[best] === 'spine003' && v.y > 1.5 ? PALETTE.collar : PALETTE.polo); }
        else if (region === 'trouser') { v.fromBufferAttribute(pos, i); c.copy(boneName[best] === 'hips' && v.y > 0.98 ? PALETTE.belt : PALETTE.trouser); }
        else c.copy(PALETTE[region]);
        if (darken) c.multiplyScalar(0.72);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    };
    model.updateMatrixWorld(true);
    model.traverse((o) => { if (o.isBone) bones[boneKey(o.name)] = o; });
    model.traverse((o) => {
      if (!(o.isMesh || o.isSkinnedMesh)) return;
      o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; o.name = 'technician_body';
      const src = Array.isArray(o.material) ? o.material[0] : o.material;
      const isJoint = /joint/i.test(src?.name ?? '');
      paint(o, isJoint);
      o.material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: isJoint ? 0.6 : 0.82, metalness: 0.02 });
    });

    // Work wear parented to the rig. Everything is sized from the skinned mesh itself (measureRegion: the extent of
    // the vertices a bone drives, in that bone's frame) so the bands hug the torso and hips instead of guessing.
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
      // Hi-vis vest: an open-fronted band over the chest/upper-abdomen with two reflective stripes, sized to the
      // torso between the waist and the shoulder roots and left ~1.2 cm loose like a real vest.
      const t = measureRegion(THREE, model, chest, ['spine002', 'spine003', 'spine001'], -0.07, 0.17, { halfX: 0.16, halfZ: 0.125, zc: 0 });
      const rx = t.halfX + 0.012, rz = t.halfZ + 0.012, yMid = 0.05, h = 0.24;
      chest.add(band(mats.hiVis, 'technician_vest', rx, rz, h, yMid, t.zc, 0.92, Math.PI * 0.09, Math.PI * 1.82));
      chest.add(band(mats.stripe, 'technician_vest_stripe', rx + 0.003, rz + 0.003, 0.028, yMid - 0.06, t.zc, 1, Math.PI * 0.09, Math.PI * 1.82));
      chest.add(band(mats.stripe, 'technician_vest_stripe', rx * 0.97 + 0.003, rz * 0.97 + 0.003, 0.028, yMid + 0.05, t.zc, 1, Math.PI * 0.09, Math.PI * 1.82));
      // ID badge on a lanyard round the neck, hanging just in front of the chest.
      const lan = mesh(new THREE.TorusGeometry(0.09, 0.004, 6, 24, Math.PI * 1.1), mats.lanyard, 'technician_lanyard'); lan.position.set(0, 0.19, t.zc + 0.03); lan.rotation.set(-Math.PI / 2 + 0.6, 0, Math.PI / 2 + Math.PI * 0.45); chest.add(lan);
      const badge = mesh(new THREE.BoxGeometry(0.06, 0.085, 0.004), mats.badge, 'technician_badge'); badge.position.set(0.03, yMid, t.zc + rz + 0.012); badge.rotation.z = -0.08; chest.add(badge);
      const photo = mesh(new THREE.BoxGeometry(0.024, 0.03, 0.002), mats.badgeInk, 'technician_badge_photo'); photo.position.set(-0.013, 0.015, 0.003); badge.add(photo);
      for (let i = 0; i < 3; i++) { const l = mesh(new THREE.BoxGeometry(0.02, 0.004, 0.002), mats.badgeInk, 'technician_badge_line'); l.position.set(0.012, 0.026 - i * 0.012, 0.003); badge.add(l); }
      const clip = mesh(new THREE.BoxGeometry(0.012, 0.014, 0.006), mats.buckle, 'technician_badge_clip'); clip.position.set(0, 0.05, 0); badge.add(clip);
    }
    if (upper) {
      // Vest shoulder straps over the trapezius, placed from the shoulder-root width of the upper chest.
      const u = measureRegion(THREE, model, upper, ['spine003', 'shoulderL', 'shoulderR'], 0.08, 0.2, { halfX: 0.16, halfZ: 0.09, zc: -0.04 });
      for (const x of [-1, 1]) { const strap = mesh(new THREE.BoxGeometry(0.055, 0.014, 0.22), mats.hiVis, 'technician_vest_strap'); strap.position.set(x * (u.halfX - 0.07), 0.16, u.zc); strap.rotation.x = 0.12; upper.add(strap); }
    }
    if (hips) {
      // Tool belt with buckle and a pouch on the right hip, sized to the hips just above the trouser line.
      const hp = measureRegion(THREE, model, hips, ['hips'], 0.03, 0.11, { halfX: 0.125, halfZ: 0.11, zc: 0.03 });
      const rx = hp.halfX + 0.01, rz = hp.halfZ + 0.01, y = 0.07;
      hips.add(band(mats.leather, 'technician_belt', rx, rz, 0.04, y, hp.zc));
      const buckle = mesh(new THREE.BoxGeometry(0.05, 0.035, 0.01), mats.buckle, 'technician_buckle'); buckle.position.set(0, y, hp.zc + rz + 0.004); hips.add(buckle);
      const pouch = mesh(new THREE.BoxGeometry(0.1, 0.13, 0.07), mats.leather, 'technician_pouch'); pouch.position.set(-(rx + 0.03), y - 0.09, hp.zc + 0.01); pouch.rotation.z = -0.05; hips.add(pouch); // character's right is -x
      const flap = mesh(new THREE.BoxGeometry(0.102, 0.04, 0.074), mats.leather, 'technician_pouch_flap'); flap.position.set(0, 0.06, 0); pouch.add(flap);
      const driver = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 8), mats.buckle, 'technician_driver'); driver.position.set(-0.03, 0.09, 0.02); pouch.add(driver);
      const grip = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 10), M(0xd8641e), 'technician_driver_grip'); grip.position.set(0, 0.08, 0); driver.add(grip);
    }
    body.add(model);
    mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) { const a = mixer.clipAction(clip); a.enabled = true; a.setEffectiveWeight(0); actions[clip.name] = a; }
    if (actions[CLIP.walk]) actions[CLIP.walk].setEffectiveTimeScale(WALK_SPEED / WALK_CLIP_MPS);
    if (actions[CLIP.reach]) actions[CLIP.reach].setEffectiveTimeScale(0.7);
    if (actions[CLIP.kneel]) { actions[CLIP.kneel].setEffectiveTimeScale(0.9); actions[CLIP.kneel].setLoop(THREE.LoopOnce, 1); actions[CLIP.kneel].clampWhenFinished = true; } // settle on one knee and stay there
    overlay = createArmOverlay(THREE, bones, root); if (pendingLook) overlay.lookAt(pendingLook);
    ready = true;
    fade(clipFor(pose), 0);
  }, undefined, (err) => console.warn('[technician] model failed to load', err));

  /* -------- motion state -------- */
  let path = null, seg = 0, segT = 0, onArrive = null, pose = 'idle', targetYaw = Math.PI, faceYaw = null;
  let reachWalk = false, atJob = false, pendingLook = null; // reachWalk: this walk ends at a rack (hand rises on approach); atJob: standing at one

  /** Metres left to the end of the current path. */
  const remainingM = () => {
    if (!path) return 0;
    let s = 0; for (let i = seg; i < path.length - 1; i++) s += Math.hypot(path[i + 1].x - path[i].x, path[i + 1].z - path[i].z);
    return s - segT;
  };

  /** Walk a waypoint chain. `opts.reach`: the chain ends at a rack, so the hand rises toward it on the last stretch. */
  const walkTo = (pts, opts = {}) => new Promise((resolve) => {
    if (!pts || pts.length < 2) { resolve(); return; }
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
    overlay.apply({ walking: !!path, reach, armsFree: pose === 'idle' || pose === 'walk' }, dt);
  };

  root.userData = {
    walkTo, tick,
    setPose(p) { pose = p; if (ready) fade(clipFor(p)); },
    /** Turn the head toward a world x/z point while walking or standing (null clears). */
    lookAt(p) { pendingLook = p ?? null; if (overlay) overlay.lookAt(pendingLook); },
    /** Face a world yaw (toward the rack) once standing still. */
    face(yaw) { faceYaw = yaw; },
    get pose() { return pose; },
    get walking() { return !!path; },
    get ready() { return ready; },
    reset(x, z) { path = null; onArrive = null; pose = 'idle'; faceYaw = null; reachWalk = false; atJob = false; pendingLook = null; root.position.set(x, 0, z); root.rotation.y = Math.PI; if (overlay) overlay.lookAt(null); if (ready) fade(CLIP.idle, 0); },
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
