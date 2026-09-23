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

const WALK_SPEED = 1.5;      // m/s
const TURN_RATE = 0.14;      // yaw lerp per frame
const HEIGHT_M = 1.78;
const CLIP = { idle: 'Idle_Loop', walk: 'Walk_Loop', kneel: 'Fixing_Kneeling', reach: 'Interact' };
const WALK_CLIP_MPS = 1.35; // ground speed the Walk_Loop cycle is authored at
const MODEL_URL = `${import.meta.env.BASE_URL ?? '/'}models/technician.glb`;

export function buildTechnician(THREE) {
  const root = new THREE.Group(); root.name = 'technician';
  const body = new THREE.Group(); body.name = 'technician_body_root'; root.add(body);

  /* -------- rig / animation state (filled once the GLB lands) -------- */
  let mixer = null, actions = {}, current = null, bones = {}, ready = false;
  const bone = (n) => bones[n] ?? null;

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
      const col = new Float32Array(pos.count * 3), c = new THREE.Color(), boneName = mesh.skeleton.bones.map((b) => b.name.replace(/^DEF-/, ''));
      const headBone = bones['head']; const headY = headBone ? headBone.getWorldPosition(new THREE.Vector3()).y : Infinity;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        // Dominant joint decides the garment.
        let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
        const region = regionOf(boneName[best] ?? '');
        if (region === 'head') { v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld); c.copy(v.y > headY + 0.135 ? PALETTE.hair : PALETTE.skin); }
        else if (region === 'polo') { v.fromBufferAttribute(pos, i); c.copy(boneName[best] === 'spine.003' && v.y > 1.5 ? PALETTE.collar : PALETTE.polo); }
        else if (region === 'trouser') { v.fromBufferAttribute(pos, i); c.copy(boneName[best] === 'hips' && v.y > 0.98 ? PALETTE.belt : PALETTE.trouser); }
        else c.copy(PALETTE[region]);
        if (darken) c.multiplyScalar(0.72);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    };
    model.updateMatrixWorld(true);
    model.traverse((o) => { if (o.isBone) bones[o.name.replace(/^DEF-/, '')] = o; });
    model.traverse((o) => {
      if (!(o.isMesh || o.isSkinnedMesh)) return;
      o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; o.name = 'technician_body';
      const src = Array.isArray(o.material) ? o.material[0] : o.material;
      const isJoint = /joint/i.test(src?.name ?? '');
      paint(o, isJoint);
      o.material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: isJoint ? 0.6 : 0.82, metalness: 0.02 });
    });

    // Work wear parented to the rig (bone-local units are metres divided by the model scale).
    const s = 1 / model.scale.y;
    const head = bone('head'), chest = bone('spine.002') ?? bone('spine.001'), upper = bone('spine.003') ?? chest, hips = bone('hips');
    const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...o });
    const mats = {
      hat: M(0xf1f2f4, { roughness: 0.4 }), hiVis: M(0xd7f03a, { roughness: 0.75, side: THREE.DoubleSide }),
      stripe: M(0xd9dde3, { roughness: 0.3, metalness: 0.4, emissive: 0x2e3135, emissiveIntensity: 0.3, side: THREE.DoubleSide }),
      lanyard: M(0x1f5fd0, { roughness: 0.8 }), badge: M(0xf4f6fa, { roughness: 0.5 }), badgeInk: M(0x1b2a44), leather: M(0x1b1a18, { roughness: 0.85 }), buckle: M(0xb9bdc2, { metalness: 0.8, roughness: 0.3 }),
    };
    const mesh = (geo, mat, name) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = false; return m; };
    // The torso is an ellipse in plan (wide, shallow): bands are round meshes scaled to hug it.
    const hug = (m, y, z = -0.01) => { m.position.set(0, y * s, z * s); m.scale.set(1.32, 1, 0.78); return m; };
    if (head) {
      const hat = mesh(new THREE.SphereGeometry(0.118 * s, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), mats.hat, 'technician_hat'); hat.position.set(0, 0.125 * s, 0.01 * s); hat.castShadow = true;
      const brim = mesh(new THREE.CylinderGeometry(0.14 * s, 0.14 * s, 0.012 * s, 24), mats.hat, 'technician_hat_brim'); brim.position.set(0, 0.125 * s, 0.035 * s);
      const peak = mesh(new THREE.BoxGeometry(0.16 * s, 0.01 * s, 0.07 * s), mats.hat, 'technician_hat_peak'); peak.position.set(0, 0.122 * s, 0.15 * s);
      const band = mesh(new THREE.CylinderGeometry(0.121 * s, 0.121 * s, 0.03 * s, 20, 1, true), mats.hiVis, 'technician_hat_band'); band.position.set(0, 0.13 * s, 0.01 * s);
      head.add(hat); head.add(brim); head.add(peak); head.add(band);
    }
    if (chest) {
      // Hi-vis vest: body band with two reflective stripes, shoulder straps over the trapezius, open at the front.
      const bandV = hug(mesh(new THREE.CylinderGeometry(0.2 * s, 0.215 * s, 0.24 * s, 28, 1, true, Math.PI * 0.08, Math.PI * 1.84), mats.hiVis, 'technician_vest'), 0.1);
      const rs = hug(mesh(new THREE.CylinderGeometry(0.206 * s, 0.212 * s, 0.03 * s, 28, 1, true), mats.stripe, 'technician_vest_stripe'), 0.05);
      const rs2 = hug(mesh(new THREE.CylinderGeometry(0.203 * s, 0.208 * s, 0.03 * s, 28, 1, true), mats.stripe, 'technician_vest_stripe'), 0.16);
      chest.add(bandV); chest.add(rs); chest.add(rs2);
      // ID badge on a lanyard round the neck.
      const lan = mesh(new THREE.TorusGeometry(0.11 * s, 0.004 * s, 6, 24, Math.PI * 1.1), mats.lanyard, 'technician_lanyard'); lan.position.set(0, 0.2 * s, 0.05 * s); lan.rotation.set(-Math.PI / 2 + 0.6, 0, Math.PI / 2 + Math.PI * 0.45); chest.add(lan);
      const badge = mesh(new THREE.BoxGeometry(0.06 * s, 0.085 * s, 0.004 * s), mats.badge, 'technician_badge'); badge.position.set(0.03 * s, 0.05 * s, 0.155 * s); badge.rotation.z = -0.08; chest.add(badge);
      const photo = mesh(new THREE.BoxGeometry(0.024 * s, 0.03 * s, 0.002 * s), mats.badgeInk, 'technician_badge_photo'); photo.position.set(-0.013 * s, 0.015 * s, 0.003 * s); badge.add(photo);
      for (let i = 0; i < 3; i++) { const l = mesh(new THREE.BoxGeometry(0.02 * s, 0.004 * s, 0.002 * s), mats.badgeInk, 'technician_badge_line'); l.position.set(0.012 * s, (0.026 - i * 0.012) * s, 0.003 * s); badge.add(l); }
      const clip = mesh(new THREE.BoxGeometry(0.012 * s, 0.014 * s, 0.006 * s), mats.buckle, 'technician_badge_clip'); clip.position.set(0, 0.05 * s, 0); badge.add(clip);
    }
    if (upper) {
      for (const x of [-0.085, 0.085]) { const strap = mesh(new THREE.BoxGeometry(0.055 * s, 0.014 * s, 0.24 * s), mats.hiVis, 'technician_vest_strap'); strap.position.set(x * s, 0.19 * s, -0.005 * s); strap.rotation.x = 0.12; upper.add(strap); }
    }
    if (hips) {
      // Tool belt with buckle and a pouch on the right hip.
      const belt = hug(mesh(new THREE.CylinderGeometry(0.168 * s, 0.172 * s, 0.04 * s, 24, 1, true), mats.leather, 'technician_belt'), 0.04, 0);
      const buckle = mesh(new THREE.BoxGeometry(0.05 * s, 0.035 * s, 0.01 * s), mats.buckle, 'technician_buckle'); buckle.position.set(0, 0.04 * s, 0.135 * s);
      const pouch = mesh(new THREE.BoxGeometry(0.11 * s, 0.14 * s, 0.07 * s), mats.leather, 'technician_pouch'); pouch.position.set(0.2 * s, -0.05 * s, 0.02 * s); pouch.rotation.z = 0.05;
      const flap = mesh(new THREE.BoxGeometry(0.112 * s, 0.04 * s, 0.074 * s), mats.leather, 'technician_pouch_flap'); flap.position.set(0, 0.06 * s, 0); pouch.add(flap);
      const driver = mesh(new THREE.CylinderGeometry(0.006 * s, 0.006 * s, 0.14 * s, 8), mats.buckle, 'technician_driver'); driver.position.set(-0.03 * s, 0.09 * s, 0.02 * s); pouch.add(driver);
      const grip = mesh(new THREE.CylinderGeometry(0.012 * s, 0.012 * s, 0.06 * s, 10), M(0xd8641e), 'technician_driver_grip'); grip.position.set(0, 0.08 * s, 0); driver.add(grip);
      hips.add(belt); hips.add(buckle); hips.add(pouch);
    }
    body.add(model);
    mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) { const a = mixer.clipAction(clip); a.enabled = true; a.setEffectiveWeight(0); actions[clip.name] = a; }
    if (actions[CLIP.walk]) actions[CLIP.walk].setEffectiveTimeScale(WALK_SPEED / WALK_CLIP_MPS);
    if (actions[CLIP.reach]) actions[CLIP.reach].setEffectiveTimeScale(0.7);
    if (actions[CLIP.kneel]) { actions[CLIP.kneel].setEffectiveTimeScale(0.9); actions[CLIP.kneel].setLoop(THREE.LoopOnce, 1); actions[CLIP.kneel].clampWhenFinished = true; } // settle on one knee and stay there
    ready = true;
    fade(clipFor(pose), 0);
  }, undefined, (err) => console.warn('[technician] model failed to load', err));

  /* -------- motion state -------- */
  let path = null, seg = 0, segT = 0, onArrive = null, pose = 'idle', targetYaw = Math.PI, faceYaw = null;

  const walkTo = (pts) => new Promise((resolve) => {
    if (!pts || pts.length < 2) { resolve(); return; }
    root.position.set(pts[0].x, 0, pts[0].z);
    path = pts; seg = 0; segT = 0; faceYaw = null; pose = 'walk'; if (ready) fade(CLIP.walk);
    onArrive = () => { pose = 'idle'; if (ready) fade(CLIP.idle); resolve(); };
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
    let d = targetYaw - root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); root.rotation.y += d * TURN_RATE;

    if (ready) mixer.update(dt);
  };

  root.userData = {
    walkTo, tick,
    setPose(p) { pose = p; if (ready) fade(clipFor(p)); },
    /** Face a world yaw (toward the rack) once standing still. */
    face(yaw) { faceYaw = yaw; },
    get pose() { return pose; },
    get walking() { return !!path; },
    get ready() { return ready; },
    reset(x, z) { path = null; onArrive = null; pose = 'idle'; faceYaw = null; root.position.set(x, 0, z); root.rotation.y = Math.PI; if (ready) fade(CLIP.idle, 0); },
  };
  return root;
}
