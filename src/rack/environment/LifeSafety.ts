// @ts-nocheck
/* eslint-disable */
// Life-safety fit-out for the data hall:
//   • clean-agent fire suppression — a bank of three red agent cylinders with valve heads and a discharge manifold in
//     the back-right corner, a placard, and brass discharge nozzles on the roof over each aisle;
//   • VESDA aspirating smoke detection — the wall-mounted detector with its display and status LED, and the sampling
//     pipe running along the roof with sample points above the aisles;
//   • a manual pull station beside the staff door and horn/strobe units on the front and back walls that flash while
//     the hall is on emergency power.
// Static geometry merged per material; only the strobes and the VESDA LED are live.
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ROOM_BOUNDS, ROOM_H, DOOR_X, DOOR_W } from './Environment';
import { QUALITY } from '../quality';

const FONT = (w, px) => `${w} ${px}px "Helvetica Neue", Helvetica, Arial, sans-serif`;

export function buildLifeSafety(THREE) {
  const g = new THREE.Group(); g.name = 'life_safety';
  const M = (name, o) => { const m = new THREE.MeshStandardMaterial(o); m.name = name; return m; };
  const mats = {
    red: M('agent_cylinder_red', { color: 0xb8221c, roughness: 0.4, metalness: 0.35 }),
    valve: M('agent_valve_brass', { color: 0xb08d3c, roughness: 0.3, metalness: 0.85 }),
    steel: M('suppression_pipe_steel', { color: 0x9a9ea5, roughness: 0.45, metalness: 0.8 }),
    frame: M('cylinder_rack_steel', { color: 0x2a2d33, roughness: 0.6, metalness: 0.5 }),
    vesda: M('vesda_housing', { color: 0xd8dadd, roughness: 0.5, metalness: 0.1 }),
    vesdaDark: M('vesda_trim', { color: 0x2b2f36, roughness: 0.6, metalness: 0.2 }),
    pipe: M('vesda_sampling_pipe', { color: 0xc8341f, roughness: 0.6, metalness: 0.05 }),
    pull: M('pull_station_red', { color: 0xc0261e, roughness: 0.5, metalness: 0.2 }),
    white: M('horn_strobe_white', { color: 0xe9ebee, roughness: 0.5, metalness: 0.05 }),
  };
  // Each item (suppression, VESDA, alarm devices) bakes into its own sub-group so it can be shown/hidden on its own.
  const buckets = new Map(), sections = {}; let cur = 'suppression';
  const sec = (name) => { cur = name; if (!sections[name]) { const sg = new THREE.Group(); sg.name = 'lifesafety_' + name; g.add(sg); sections[name] = sg; } return sections[name]; };
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
  const add = (mat, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { geo.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s)); const key = cur + '|' + mat.uuid; if (!buckets.has(key)) buckets.set(key, { mat, geos: [], section: cur }); buckets.get(key).geos.push(geo); };
  const box = (mat, w, h, d, x, y, z, ry = 0) => add(mat, new THREE.BoxGeometry(w, h, d), x, y, z, 0, ry, 0);
  const cylY = (mat, r, h, x, yc, z, seg = 20) => add(mat, new THREE.CylinderGeometry(r, r, h, seg), x, yc, z);
  const cylZ = (mat, r, h, x, y, zc, seg = 12) => add(mat, new THREE.CylinderGeometry(r, r, h, seg), x, y, zc, Math.PI / 2, 0, 0);
  const cylX = (mat, r, h, xc, y, z, seg = 12) => add(mat, new THREE.CylinderGeometry(r, r, h, seg), xc, y, z, 0, 0, Math.PI / 2);
  const tube = (mat, pts, r, seg = 40) => add(mat, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.05), seg, r, 8, false));
  const liveMesh = (mesh) => { mesh.userData.thermalSkip = true; mesh.castShadow = false; mesh.receiveShadow = false; sec(cur).add(mesh); return mesh; };
  const canvasTex = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = QUALITY.anisotropy; return { ctx: c.getContext('2d'), tex }; };

  /* ---------------- clean-agent cylinder bank (back-right corner) ---------------- */
  {
    sec('suppression');
    const cx = ROOM_BOUNDS.maxX - 0.75, cz = ROOM_BOUNDS.minZ + 0.55, R = 0.2, H = 1.5;
    const xs = [cx - 0.5, cx, cx + 0.5];
    box(mats.frame, 1.7, 0.08, 0.6, cx, 0.04, cz);                                                                     // base frame
    box(mats.frame, 1.7, 0.05, 0.05, cx, 1.05, cz - R - 0.03); box(mats.frame, 1.7, 0.05, 0.05, cx, 0.45, cz - R - 0.03); // wall-side restraint rails
    for (const x of xs) {
      cylY(mats.red, R, H, x, 0.08 + H / 2, cz, 28);
      add(mats.red, new THREE.SphereGeometry(R, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), x, 0.08 + H, cz);           // domed top
      cylY(mats.valve, 0.055, 0.12, x, 0.08 + H + R * 0.6 + 0.02, cz, 16); box(mats.valve, 0.16, 0.03, 0.05, x, 0.08 + H + R * 0.6 + 0.09, cz); // valve + actuator
      cylY(mats.steel, 0.02, 0.5, x, 0.08 + H + R * 0.6 + 0.35, cz, 10);                                                // riser to the manifold
      box(mats.frame, 0.12, 0.02, 0.12, x, 0.04 + 0.05, cz); box(mats.vesdaDark, 0.14, 0.09, 0.005, x, 0.7, cz + R + 0.002); // foot ring + label
      for (const [ky, w] of [[0.5, 0.36], [1.2, 0.36]]) add(mats.frame, new THREE.TorusGeometry(R + 0.012, 0.008, 8, 28), x, 0.08 + ky, cz, Math.PI / 2, 0, 0); // straps
    }
    const manY = 0.08 + H + R * 0.6 + 0.6;
    cylX(mats.steel, 0.035, xs[2] - xs[0] + 0.3, cx, manY, cz, 16);                                                    // discharge manifold
    tube(mats.steel, [[xs[2] + 0.15, manY, cz], [xs[2] + 0.3, manY + 0.2, cz], [xs[2] + 0.3, ROOM_H - 0.12, cz], [xs[2] + 0.3, ROOM_H - 0.08, cz + 1.0]], 0.035, 24);
    // Roof distribution pipe over the hall and brass nozzles above each aisle.
    const py = ROOM_H - 0.08;
    tube(mats.steel, [[xs[2] + 0.3, py, cz + 1.0], [3.5, py, -1.135], [-3.5, py, -1.135]], 0.03, 24);
    for (const nz of [1.6, -1.135, -3.2]) { tube(mats.steel, [[3.5, py, -1.135], [3.5, py, nz], [-3.5, py, nz]], 0.022, 20); for (const nx of [-1.7, 0, 1.7]) { cylY(mats.steel, 0.012, 0.16, nx, py - 0.1, nz, 8); add(mats.valve, new THREE.ConeGeometry(0.04, 0.07, 12), nx, py - 0.22, nz, Math.PI, 0, 0); } }
    // Placard.
    const { ctx, tex } = canvasTex(512, 256);
    ctx.fillStyle = '#f2f2f2'; ctx.fillRect(0, 0, 512, 256); ctx.fillStyle = '#c0261e'; ctx.fillRect(0, 0, 512, 70);
    ctx.fillStyle = '#fff'; ctx.font = FONT(900, 33); ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText('CLEAN AGENT SUPPRESSION', 256, 36);
    ctx.fillStyle = '#1b1d21'; ctx.font = FONT(700, 34); ctx.fillText('NOVEC 1230 · FK-5-1-12', 256, 112);
    ctx.font = FONT(500, 24); ctx.fillStyle = '#3a3d42'; ctx.fillText('3 × 180 L · TOTAL FLOODING · 10 s DISCHARGE', 256, 160);
    ctx.fillText('EVACUATE ON PRE-DISCHARGE ALARM', 256, 200);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0 })); sign.name = 'suppression_placard';
    sign.position.set(cx, 2.4, ROOM_BOUNDS.minZ + 0.012); sec('suppression').add(sign);
  }

  /* ---------------- VESDA (left wall) + sampling pipe ---------------- */
  const vesdaLed = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0x2ee36a, emissiveIntensity: 1.8, toneMapped: false });
  {
    sec('vesda');
    const vx = ROOM_BOUNDS.minX + 0.06, vy = 1.9, vz = 2.5;
    box(mats.vesda, 0.10, 0.28, 0.32, vx, vy, vz); box(mats.vesdaDark, 0.012, 0.12, 0.26, vx + 0.05, vy + 0.02, vz);
    const { ctx, tex } = canvasTex(256, 128);
    ctx.fillStyle = '#0b0f14'; ctx.fillRect(0, 0, 256, 128); ctx.fillStyle = '#7fb3ff'; ctx.font = FONT(700, 22); ctx.textBaseline = 'top'; ctx.fillText('VESDA · VLF', 14, 10);
    ctx.fillStyle = '#2ee36a'; ctx.font = FONT(600, 20); ctx.fillText('NORMAL · 0.004 %/m', 14, 44);
    ctx.fillStyle = '#8b97ad'; ctx.font = FONT(500, 16); ctx.fillText('AIRFLOW 100 %  ·  FILTER OK', 14, 74); ctx.fillText('SECTOR 1 · DATA HALL', 14, 98);
    const disp = liveMesh(new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.12), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }))); disp.name = 'vesda_display';
    disp.position.set(vx + 0.057, vy + 0.02, vz); disp.rotation.y = Math.PI / 2;
    const led = liveMesh(new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.04), vesdaLed)); led.name = 'vesda_led'; led.position.set(vx + 0.053, vy - 0.09, vz - 0.08);
    // Sampling pipe: up the wall, across the roof, then along the aisles with sample holes (little collars).
    tube(mats.pipe, [[vx, vy + 0.14, vz], [vx, ROOM_H - 0.18, vz], [vx + 0.4, ROOM_H - 0.16, vz], [0, ROOM_H - 0.16, 1.6], [3.4, ROOM_H - 0.16, 1.6]], 0.011, 32);
    tube(mats.pipe, [[vx + 0.4, ROOM_H - 0.16, vz], [-3.4, ROOM_H - 0.16, -3.2], [3.4, ROOM_H - 0.16, -3.2]], 0.011, 32);
    for (const [sx, sz] of [[-2.2, 1.6], [0.2, 1.6], [2.6, 1.6], [-2.2, -3.2], [0.2, -3.2], [2.6, -3.2]]) { cylY(mats.vesda, 0.02, 0.03, sx, ROOM_H - 0.19, sz, 10); cylY(mats.pipe, 0.011, 0.03, sx, ROOM_H - 0.2, sz, 8); }
    for (const [hx, hz] of [[-1.2, 1.6], [1.8, 1.6], [-1.2, -3.2], [1.8, -3.2]]) box(mats.vesdaDark, 0.05, 0.02, 0.04, hx, ROOM_H - 0.155, hz); // pipe clips
  }

  /* ---------------- manual pull station + horn/strobes ---------------- */
  const strobes = [];
  {
    sec('alarms');
    const zWall = ROOM_BOUNDS.maxZ;
    const px = DOOR_X - DOOR_W / 2 - 0.35;
    box(mats.pull, 0.11, 0.14, 0.05, px, 1.2, zWall - 0.03); box(mats.white, 0.06, 0.05, 0.012, px, 1.17, zWall - 0.06); // pull handle
    box(mats.vesdaDark, 0.14, 0.03, 0.006, px, 1.32, zWall - 0.055);
    for (const [sx, sz, ry] of [[DOOR_X - 1.5, zWall - 0.05, Math.PI], [0, ROOM_BOUNDS.minZ + 0.05, 0], [ROOM_BOUNDS.minX + 0.05, -0.5, Math.PI / 2], [ROOM_BOUNDS.maxX - 0.05, 2.5, -Math.PI / 2]]) {
      box(mats.white, 0.16, 0.22, 0.06, sx, 3.9, sz, ry);
      const strobeMat = new THREE.MeshStandardMaterial({ color: 0x3a0a08, emissive: 0xff2a1a, emissiveIntensity: 0, transparent: true, opacity: 0.9, toneMapped: false });
      const dome = liveMesh(new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), strobeMat)); dome.name = 'horn_strobe_dome';
      dome.position.set(sx + Math.sin(ry) * 0.04, 3.9, sz + Math.cos(ry) * 0.04); dome.rotation.x = Math.PI / 2; dome.rotation.y = ry;
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xff3a24, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const glow = liveMesh(new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), glowMat)); glow.name = 'horn_strobe_glow'; glow.position.set(sx + Math.sin(ry) * 0.08, 3.9, sz + Math.cos(ry) * 0.08); glow.rotation.y = ry;
      strobes.push({ strobeMat, glowMat });
    }
  }

  /* ---------------- bake ---------------- */
  for (const { mat, geos, section } of buckets.values()) {
    const merged = mergeGeometries(geos, false); geos.forEach((gg) => gg.dispose());
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat); m.name = 'lifesafety_' + mat.name; m.castShadow = /cylinder/.test(mat.name); m.receiveShadow = false; sections[section].add(m);
  }

  let alarm = false;
  g.userData = {
    /** Horn/strobes run while the hall is on emergency power (utility lost / on battery). */
    setAlarm(on) { alarm = on; },
    /** Show/hide one item: 'suppression' | 'vesda' | 'alarms'. */
    setVisible(name, on) { if (sections[name]) sections[name].visible = on; },
    tick(t) {
      const k = alarm ? (Math.sin(t * 9) > 0.6 ? 1 : 0) : 0;
      for (const s of strobes) { s.strobeMat.emissiveIntensity = 3.2 * k; s.glowMat.opacity = 0.45 * k; }
    },
  };
  return g;
}
