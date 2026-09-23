// @ts-nocheck
/* eslint-disable */
// Life-safety fit-out for the data hall: VESDA aspirating smoke detection — the wall-mounted detector with its display
// and status LED, and the sampling pipe running along the roof with sample points above the aisles.
// Static geometry merged per material; only the VESDA display/LED are live meshes.
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ROOM_BOUNDS, ROOM_H } from './Environment';
import { QUALITY } from '../quality';

const FONT = (w, px) => `${w} ${px}px "Helvetica Neue", Helvetica, Arial, sans-serif`;

export function buildLifeSafety(THREE) {
  const g = new THREE.Group(); g.name = 'life_safety';
  const M = (name, o) => { const m = new THREE.MeshStandardMaterial(o); m.name = name; return m; };
  const mats = {
    vesda: M('vesda_housing', { color: 0xd8dadd, roughness: 0.5, metalness: 0.1 }),
    vesdaDark: M('vesda_trim', { color: 0x2b2f36, roughness: 0.6, metalness: 0.2 }),
    pipe: M('vesda_sampling_pipe', { color: 0xc8341f, roughness: 0.6, metalness: 0.05 }),
  };
  // Each item bakes into its own sub-group so it can be shown/hidden on its own.
  const buckets = new Map(), sections = {}; let cur = 'vesda';
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

  /* ---------------- bake ---------------- */
  for (const { mat, geos, section } of buckets.values()) {
    const merged = mergeGeometries(geos, false); geos.forEach((gg) => gg.dispose());
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat); m.name = 'lifesafety_' + mat.name; m.castShadow = false; m.receiveShadow = false; sections[section].add(m);
  }

  g.userData = {
    /** Show/hide one item: 'vesda'. */
    setVisible(name, on) { if (sections[name]) sections[name].visible = on; },
  };
  return g;
}
