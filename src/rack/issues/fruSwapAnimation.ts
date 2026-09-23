// @ts-nocheck
/* eslint-disable */
// Generic field-replaceable-unit swap, acted out on the front of ANY rack — including the ten baked replicas, which
// have no per-component meshes of their own. A small proxy module (drive sled, GPU sled, PSU, fan, DIMM tray, SFP,
// patch plug, QD coupling or blanking panel) appears flush with the device's front face at the issue's U, is pulled
// out, held (the "swap"), pushed home with a millimetre of click, and its fault LED fades red -> green. Software-only
// fixes get a console strip instead: an amber activity pulse along the alarm card's bottom edge that turns into
// three green ticks. Same tick/start/reset surface as cabling/reseatAnimation.ts so the orchestrator treats them alike.
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.
const U = 0.04445, Y0 = 0.13, D = 1.07;
const FACE_Z = D / 2 - 0.03;            // device bezels sit just inside the frame
const PULL = 0.24;                      // how far a unit is drawn out, m
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const easeOut = (u) => 1 - Math.pow(1 - u, 3);
const RED = 0xff2a1a, GREEN = 0x3dff6e;

const mk = (THREE, color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.35, ...extra });
const skip = (m) => { m.userData.thermalSkip = true; m.castShadow = false; m.receiveShadow = false; m.renderOrder = 16; return m; };

/** Build the proxy geometry for a FRU kind, centred at the origin with its front face toward +z. Returns { group, depth, led }. */
function buildFru(THREE, fru, hU) {
  const g = new THREE.Group();
  const M = { shell: mk(THREE, 0x2a2d33), face: mk(THREE, 0x40454d, { roughness: 0.4 }), handle: mk(THREE, 0x9aa0a8, { metalness: 0.7, roughness: 0.3 }),
    orange: mk(THREE, 0xe0641c, { roughness: 0.5 }), pcb: mk(THREE, 0x1c5a3a, { roughness: 0.6 }), gold: mk(THREE, 0xc9a445, { metalness: 0.8, roughness: 0.3 }),
    blue: mk(THREE, 0x2a62b8, { roughness: 0.6 }), brass: mk(THREE, 0xb08d3c, { metalness: 0.85, roughness: 0.25 }), fan: mk(THREE, 0x15171a, { roughness: 0.7 }) };
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = skip(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)); m.position.set(x, y, z); g.add(m); return m; };
  let depth = 0.14;
  switch (fru) {
    case 'drive': case 'nvme': {
      depth = 0.147; box(0.101, 0.026, depth, M.shell); box(0.101, 0.026, 0.006, M.face, 0, 0, depth / 2);
      box(0.012, 0.022, 0.004, M.orange, -0.038, 0, depth / 2 + 0.004);                      // release latch
      box(0.05, 0.003, 0.004, M.handle, 0.012, 0.007, depth / 2 + 0.004); break;             // pull tab
    }
    case 'gpu_sled': {
      depth = 0.22; box(0.44, Math.max(0.08, hU * U - 0.02), depth, M.shell);
      box(0.44, Math.max(0.08, hU * U - 0.02), 0.006, M.face, 0, 0, depth / 2);
      for (const x of [-0.19, 0.19]) box(0.03, 0.05, 0.012, M.handle, x, 0, depth / 2 + 0.009); // ejector handles
      box(0.36, 0.016, 0.004, M.pcb, 0, -0.02, depth / 2 + 0.004); break;
    }
    case 'sfp': { depth = 0.058; box(0.0138, 0.0086, depth, M.handle); box(0.012, 0.004, 0.02, M.blue, 0, 0.006, depth / 2 - 0.004); break; }
    case 'psu': { depth = 0.2; box(0.10, 0.04, depth, M.shell); box(0.10, 0.04, 0.006, M.face, 0, 0, depth / 2); box(0.03, 0.008, 0.02, M.orange, 0.03, 0, depth / 2 + 0.01); box(0.06, 0.028, 0.004, M.fan, -0.012, 0, depth / 2 + 0.004); break; }
    case 'fan': {
      depth = 0.032; const f = skip(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, depth, 24), M.fan)); f.rotation.x = Math.PI / 2; g.add(f);
      box(0.086, 0.086, 0.004, M.shell, 0, 0, -depth / 2); for (let i = 0; i < 5; i++) { const b = box(0.028, 0.006, 0.002, M.handle, 0, 0, depth / 2 + 0.001); b.position.x = Math.cos(i * 1.2566) * 0.018; b.position.y = Math.sin(i * 1.2566) * 0.018; b.rotation.z = i * 1.2566 + 0.4; } break;
    }
    case 'dimm_tray': { depth = 0.133; box(0.14, 0.004, depth, M.shell, 0, -0.006, 0); box(0.133, 0.03, 0.0015, M.pcb, 0, 0.011, 0); for (let i = 0; i < 8; i++) box(0.01, 0.012, 0.002, M.shell, -0.056 + i * 0.016, 0.014, 0.002); box(0.133, 0.004, 0.0015, M.gold, 0, -0.002, 0); break; }
    case 'blank': { depth = 0.01; box(0.483, hU * U - 0.004, depth, M.face); for (const x of [-0.222, 0.222]) box(0.012, 0.012, 0.004, M.handle, x, 0, depth / 2 + 0.002); break; }
    case 'cable': {
      depth = 0.024; box(0.0116, 0.0082, depth, M.handle, 0, 0, 0); box(0.0116, 0.003, 0.012, M.blue, 0, 0.0055, -0.002);
      const t = skip(new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.12, 8), M.blue)); t.rotation.x = Math.PI / 2 + 0.5; t.position.set(0, -0.035, depth / 2 + 0.05); g.add(t); break;
    }
    case 'qd_coupling': {
      depth = 0.05; const b = skip(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, depth, 16), M.brass)); b.rotation.x = Math.PI / 2; g.add(b);
      const s = skip(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.012, 16), M.handle)); s.rotation.x = Math.PI / 2; s.position.z = 0.01; g.add(s); break;
    }
  }
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: RED, emissiveIntensity: 2.2, toneMapped: false });
  const led = skip(new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.003, 10), ledMat)); led.rotation.x = Math.PI / 2;
  const ledY = fru === 'gpu_sled' ? 0.03 : fru === 'blank' ? 0 : fru === 'fan' ? 0.03 : 0.004;
  const ledX = fru === 'blank' ? 0 : fru === 'gpu_sled' ? -0.15 : fru === 'psu' ? -0.042 : fru === 'drive' || fru === 'nvme' ? 0.042 : 0;
  led.position.set(ledX, ledY, depth / 2 + 0.006); g.add(led);
  return { group: g, depth, led: ledMat };
}

/**
 * Proxy FRU swap at bottom U `u` of a `hU`-tall device. `duration` is the total hands-on time; stages are fractions of it.
 * Blanking panels run in reverse (a panel is fitted, not removed): they start drawn out and are pushed home.
 */
export function createFruSwapAnimation(THREE, { fru, u, hU = 1, duration = 6 }) {
  const root = new THREE.Group(); root.name = `fru_swap_${fru}`;
  const { group, depth, led } = buildFru(THREE, fru, hU);
  root.add(group);
  const yc = Y0 + (u - 1) * U + (hU * U) / 2;
  const seatedZ = FACE_Z - depth / 2 + 0.004, outZ = seatedZ + PULL;
  const reverse = fru === 'blank';
  group.position.set(0, yc, reverse ? outZ : seatedZ);
  group.visible = false;
  const T = { pull: 0.25, hold: 0.15, push: 0.25, click: 0.08, link: 0.27 }; // fractions
  let start = -1, done = false, onDone = null, state = 'idle', clicked = false, onClick = null;
  const red = new THREE.Color(RED), green = new THREE.Color(GREEN);
  const tick = (t) => {
    if (start < 0 || done) return;
    const u01 = (t - start) / duration; let a = 0;
    const seg = (frac) => { const s = a; a += frac; return u01 < a ? (u01 - s) / frac : null; };
    let k;
    if ((k = seg(T.pull)) !== null) { const e = easeInOut(k); group.position.z = reverse ? outZ : seatedZ + PULL * e; group.visible = true; }
    else if ((k = seg(T.hold)) !== null) { group.position.z = outZ; group.rotation.y = Math.sin(k * Math.PI) * 0.06 * (reverse ? -1 : 1); led.emissiveIntensity = 0.4 + 1.8 * (0.5 + 0.5 * Math.sin(k * 40)); }
    else if ((k = seg(T.push)) !== null) { group.rotation.y = 0; const e = k < 0.8 ? Math.pow(k / 0.8, 3) * 0.94 : 0.94 + 0.06 * easeOut((k - 0.8) / 0.2); group.position.z = outZ - PULL * e; led.emissiveIntensity = 2.2; }
    else if ((k = seg(T.click)) !== null) { group.position.z = seatedZ - 0.001 * Math.sin(k * Math.PI) * (1 - k); if (!clicked) { clicked = true; if (onClick) onClick(); } }
    else if ((k = seg(T.link)) !== null) { group.position.z = seatedZ; led.emissive.lerpColors(red, green, easeInOut(k)); led.emissiveIntensity = 2.2 - 0.6 * k; }
    else { led.emissive.copy(green); led.emissiveIntensity = 1.6; state = 'seated'; done = true; group.visible = !reverse ? false : true; if (onDone) onDone(); }
  };
  root.userData = {
    start(t, cb, clickCb) { if (start >= 0) return; start = t; onDone = cb; onClick = clickCb ?? null; state = 'working'; group.visible = true; },
    tick,
    reset() { start = -1; done = false; clicked = false; state = 'idle'; group.visible = false; group.position.z = reverse ? outZ : seatedZ; led.emissive.copy(red); led.emissiveIntensity = 2.2; },
    dispose() { root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); root.parent?.remove(root); },
    get state() { return state; },
    duration,
  };
  return root;
}

/**
 * Software-only remediation (service restart, port bounce): a thin console strip along the bottom edge of the alarm
 * card that pulses amber while the job runs, then lights three green ticks and fades.
 */
export function createConsoleAnimation(THREE, { y, z, duration = 4 }) {
  const root = new THREE.Group(); root.name = 'fru_console';
  const W = 0.44, H = 0.014;
  const mat = new THREE.MeshBasicMaterial({ color: 0xffa726, transparent: true, opacity: 0, toneMapped: false, depthWrite: false, fog: false });
  const strip = skip(new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat)); strip.position.set(0, y, z); root.add(strip);
  const ticks = [];
  for (let i = 0; i < 3; i++) {
    const tm = new THREE.MeshBasicMaterial({ color: 0x3dff6e, transparent: true, opacity: 0, toneMapped: false, depthWrite: false, fog: false });
    const tk = skip(new THREE.Mesh(new THREE.PlaneGeometry(0.018, 0.018), tm)); tk.position.set(-0.03 + i * 0.03, y, z + 0.001); root.add(tk); ticks.push(tm);
  }
  let start = -1, done = false, onDone = null, state = 'idle';
  const tick = (t) => {
    if (start < 0 || done) return;
    const u = (t - start) / duration;
    if (u < 0.7) { mat.opacity = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(u * duration * 9)); strip.scale.x = 0.15 + 0.85 * Math.min(1, u / 0.7); strip.position.x = -W / 2 + (W * strip.scale.x) / 2; }
    else if (u < 0.95) { mat.opacity = Math.max(0, 0.9 - (u - 0.7) * 6); const k = (u - 0.7) / 0.25; ticks.forEach((tm, i) => { tm.opacity = Math.min(1, Math.max(0, (k - i * 0.25) * 4)); }); }
    else if (u < 1) { const k = (u - 0.95) / 0.05; ticks.forEach((tm) => (tm.opacity = 1 - k)); }
    else { ticks.forEach((tm) => (tm.opacity = 0)); mat.opacity = 0; state = 'seated'; done = true; if (onDone) onDone(); }
  };
  root.userData = {
    start(t, cb) { if (start >= 0) return; start = t; onDone = cb; state = 'working'; },
    tick,
    reset() { start = -1; done = false; state = 'idle'; mat.opacity = 0; ticks.forEach((tm) => (tm.opacity = 0)); },
    dispose() { root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); root.parent?.remove(root); },
    get state() { return state; },
    duration,
  };
  return root;
}
