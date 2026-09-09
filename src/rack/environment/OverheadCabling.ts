// @ts-nocheck
/* eslint-disable */
// Overhead cable-tray / wire-framing system suspended above the two rack rows (modelled on a real data-hall
// ceiling grid — see reference photo): threaded hanger rods off the roof slab carry black unistrut trapezes;
// black longitudinal stringers and a wide ladder rack over the hot aisle plus four wire-basket trays rest on
// them, held down with tray clamps. Silver patch enclosures hang under the ladder rack with blue trunk-cable
// loops between them, blue bundles lie in every tray, and a controlled bundle drops from the enclosures into
// the top of each rack (both rows and the interactive rack). Everything is baked into one merged geometry per
// material (about eight draw calls for the whole ceiling), no shadows, static.
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ROOM_H } from './Environment';
import { ROW_XS, ROW_A_Z, ROW_B_Z, RACK_DEPTH, LIVE_RACK_PLACEMENT } from './RackRow';

const RACK_TOP = 0.13 + 42 * 0.04445;                 // rack top panel height (m)
const ROOF_Y = ROOM_H;                                // hanger rods anchor to the roof slab
const TRAPEZE_Y = 3.55;                               // unistrut cross-channel centre line
const TRAY_Y0 = TRAPEZE_Y + 0.025;                    // tray floor sits on the trapezes
const TRAY_H = 0.10;                                  // basket / ladder side-rail height
const X0 = -3.4, X1 = 3.4;                            // main hall trunk extent (past both end-of-row CDUs)
const X1_LADDER = 5.75;                               // hot-aisle ladder continues out to the interactive rack
const HOT_Z = (ROW_A_Z + ROW_B_Z) / 2;                // hot-aisle centre line (ladder rack runs above it)
const LADDER_W = 0.9;
const BASKET_W = 0.30, BASKET_ZS = [0.35, -0.30, HOT_Z * 2 - (-0.30), HOT_Z * 2 - 0.35]; // two per row, mirrored about the aisle
const FRAME_Z0 = 0.62, FRAME_Z1 = HOT_Z * 2 - 0.62;   // outer stringers / trapeze span
const TRAPEZE_XS = [-3.0, -1.8, -0.6, 0.6, 1.8, 3.0];
const LADDER_EXT_XS = [4.2, 5.4];                     // shorter trapezes carrying only the ladder extension
const ENCLOSURE_XS = [-1.95, -0.65, 0.65, 1.95];
const ENC_W = 0.50, ENC_H = 0.09, ENC_D = 0.28, ENC_TOP = TRAY_Y0 - 0.06;

export function buildOverheadCabling(THREE) {
  const g = new THREE.Group(); g.name = 'overhead_cabling';
  const M = (name, o) => { const m = new THREE.MeshStandardMaterial(o); m.name = name; return m; };
  const mats = {
    steel: M('tray_black_steel', { color: 0x15161a, roughness: 0.55, metalness: 0.6 }),
    rod: M('hanger_rod_zinc', { color: 0x7d8288, roughness: 0.55, metalness: 0.8 }),
    enclosure: M('patch_enclosure_silver', { color: 0xb9bdc2, roughness: 0.35, metalness: 0.8 }),
    face: M('patch_enclosure_faceplate', { color: 0x1a1c20, roughness: 0.6, metalness: 0.4 }),
    port: M('patch_enclosure_port', { color: 0x3b6fd8, roughness: 0.5, metalness: 0.1 }),
    blueA: M('trunk_cable_blue', { color: 0x2a63d6, roughness: 0.58, metalness: 0 }),
    blueB: M('trunk_cable_blue_dark', { color: 0x1f56c4, roughness: 0.6, metalness: 0 }),
    velcro: M('velcro_wrap', { color: 0x0a0a0b, roughness: 0.95, metalness: 0 }),
  };
  const buckets = new Map();
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
  const add = (mat, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    geo.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s));
    if (!buckets.has(mat)) buckets.set(mat, []);
    buckets.get(mat).push(geo);
  };
  const box = (mat, w, h, d, x, y, z, ry = 0) => add(mat, new THREE.BoxGeometry(w, h, d), x, y, z, 0, ry, 0);
  const rodY = (mat, r, h, x, yc, z, seg = 8) => add(mat, new THREE.CylinderGeometry(r, r, h, seg), x, yc, z);
  const wrap = (mat, r, h, x, y, z, axis) => add(mat, new THREE.CylinderGeometry(r, r, h, 10), x, y, z, axis === 'z' ? Math.PI / 2 : 0, 0, axis === 'x' ? Math.PI / 2 : 0);
  const tube = (mat, pts, r, seg = 48) => add(mat, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), seg, r, 6, false));
  const rnd = (() => { let s = 1234567; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })(); // deterministic jitter

  /* ---------------- suspension: roof anchors, threaded rods, nuts, unistrut trapezes, stringers ---------------- */
  const hanger = (x, z) => {
    box(mats.steel, 0.10, 0.012, 0.10, x, ROOF_Y - 0.006, z);                                 // ceiling anchor plate
    rodY(mats.rod, 0.008, ROOF_Y - TRAPEZE_Y, x, (ROOF_Y + TRAPEZE_Y) / 2, z);                // threaded rod
    box(mats.rod, 0.028, 0.012, 0.028, x, TRAPEZE_Y + 0.027, z);                              // top nut + washer
    box(mats.rod, 0.028, 0.012, 0.028, x, TRAPEZE_Y - 0.027, z);                              // bottom nut
    box(mats.rod, 0.05, 0.003, 0.05, x, TRAPEZE_Y + 0.022, z);                                // washer
  };
  const trapeze = (x, z0, z1) => {
    hanger(x, z0); hanger(x, z1);
    box(mats.steel, 0.041, 0.041, Math.abs(z0 - z1) + 0.10, x, TRAPEZE_Y, (z0 + z1) / 2);   // unistrut channel
    box(mats.steel, 0.034, 0.006, Math.abs(z0 - z1) + 0.10, x, TRAPEZE_Y - 0.023, (z0 + z1) / 2); // channel lip
  };
  for (const x of TRAPEZE_XS) trapeze(x, FRAME_Z0, FRAME_Z1);
  for (const x of LADDER_EXT_XS) trapeze(x, HOT_Z + LADDER_W / 2 + 0.06, HOT_Z - LADDER_W / 2 - 0.06);
  // Longitudinal stringers (black channel) along both outer edges of the frame, sitting on the trapezes.
  for (const z of [FRAME_Z0, FRAME_Z1]) box(mats.steel, X1 - X0 + 0.2, 0.041, 0.041, (X0 + X1) / 2, TRAPEZE_Y + 0.041, z);
  // Diagonal sway braces at the two end trapezes (rod from the top of one hanger to the foot of the next).
  for (const [xa, xb] of [[-3.0, -1.8], [1.8, 3.0]]) for (const z of [FRAME_Z0, FRAME_Z1]) {
    const dx = xb - xa, dy = ROOF_Y - 0.3 - (TRAPEZE_Y + 0.05); const len = Math.hypot(dx, dy);
    add(mats.rod, new THREE.CylinderGeometry(0.006, 0.006, len, 6), (xa + xb) / 2, (ROOF_Y - 0.3 + TRAPEZE_Y + 0.05) / 2, z, 0, 0, Math.atan2(dx, dy));
  }

  /* ---------------- wire-basket trays (four, along the rows) ---------------- */
  const basket = (zc, xa, xb) => {
    const L = xb - xa, xc = (xa + xb) / 2, hw = BASKET_W / 2;
    for (const dz of [-hw, -hw / 3, hw / 3, hw]) box(mats.steel, L, 0.010, 0.010, xc, TRAY_Y0 + 0.005, zc + dz);         // floor wires
    for (const dz of [-hw, hw]) { box(mats.steel, L, 0.010, 0.010, xc, TRAY_Y0 + TRAY_H / 2, zc + dz); box(mats.steel, L, 0.013, 0.013, xc, TRAY_Y0 + TRAY_H, zc + dz); } // side + top rails
    for (let x = xa + 0.05; x < xb; x += 0.10) {                                                                            // U-shaped rungs
      box(mats.steel, 0.010, 0.010, BASKET_W, x, TRAY_Y0 + 0.005, zc);
      for (const dz of [-hw, hw]) box(mats.steel, 0.010, TRAY_H, 0.010, x, TRAY_Y0 + TRAY_H / 2, zc + dz);
    }
    for (const x of TRAPEZE_XS) box(mats.steel, 0.05, 0.016, BASKET_W + 0.05, x, TRAY_Y0 - 0.002, zc);                    // hold-down clamps
    for (const x of [xa, xb]) box(mats.steel, 0.012, TRAY_H + 0.01, BASKET_W + 0.01, x, TRAY_Y0 + TRAY_H / 2, zc);         // end plates
  };
  for (const z of BASKET_ZS) basket(z, X0, X1);

  /* ---------------- ladder rack over the hot aisle (continues out to the interactive rack) ---------------- */
  {
    const hw = LADDER_W / 2, L = X1_LADDER - X0, xc = (X0 + X1_LADDER) / 2;
    for (const dz of [-hw, hw]) box(mats.steel, L, TRAY_H, 0.02, xc, TRAY_Y0 + TRAY_H / 2, HOT_Z + dz);                   // side rails
    for (let x = X0 + 0.1; x < X1_LADDER; x += 0.23) box(mats.steel, 0.025, 0.02, LADDER_W, x, TRAY_Y0 + 0.01, HOT_Z);   // rungs
    for (const x of [...TRAPEZE_XS, ...LADDER_EXT_XS]) box(mats.steel, 0.05, 0.016, LADDER_W + 0.06, x, TRAY_Y0 - 0.002, HOT_Z); // clamps
    for (const x of [X0, X1_LADDER]) box(mats.steel, 0.02, TRAY_H, LADDER_W + 0.02, x, TRAY_Y0 + TRAY_H / 2, HOT_Z);     // end plates
  }

  /* ---------------- blue trunk bundles lying in the trays ---------------- */
  const layIn = (zc, xa, xb, n, spread, mat) => {
    for (let i = 0; i < n; i++) {
      const dz = -spread / 2 + (spread * i) / Math.max(1, n - 1), y = TRAY_Y0 + 0.02 + (i % 2) * 0.017;
      const pts = []; for (let x = xa + 0.06; x <= xb - 0.06 + 1e-6; x += 0.7) pts.push([x, y, zc + dz + (rnd() - 0.5) * 0.03]);
      tube(mat, pts, 0.0085, 64);
    }
  };
  BASKET_ZS.forEach((z, i) => layIn(z, X0, X1, 5, BASKET_W - 0.12, i % 2 ? mats.blueA : mats.blueB));
  layIn(HOT_Z, X0, X1_LADDER, 6, LADDER_W - 0.5, mats.blueA);
  layIn(HOT_Z, X0, X1, 5, LADDER_W - 0.3, mats.blueB);

  /* ---------------- patch enclosures under the ladder rack, blue loops between them ---------------- */
  for (const x of ENCLOSURE_XS) {
    box(mats.enclosure, ENC_W, ENC_H, ENC_D, x, ENC_TOP - ENC_H / 2, HOT_Z);
    for (const dx of [-0.19, 0.19]) box(mats.steel, 0.03, TRAY_Y0 - ENC_TOP + 0.005, 0.03, x + dx, (TRAY_Y0 + ENC_TOP) / 2, HOT_Z); // hanger brackets
    for (const s of [1, -1]) {
      const zf = HOT_Z + s * (ENC_D / 2 + 0.002);
      box(mats.face, ENC_W - 0.04, 0.05, 0.004, x, ENC_TOP - ENC_H / 2, zf);                 // faceplate
      for (let k = 0; k < 20; k++) box(mats.port, 0.014, 0.016, 0.004, x - 0.19 + k * 0.02, ENC_TOP - ENC_H / 2, zf + s * 0.003); // port row
    }
  }
  for (let i = 0; i + 1 < ENCLOSURE_XS.length; i++) {
    const xa = ENCLOSURE_XS[i] + ENC_W / 2, xb = ENCLOSURE_XS[i + 1] - ENC_W / 2, y = ENC_TOP - ENC_H / 2;
    for (let k = 0; k < 8; k++) {
      const dz = -0.10 + 0.2 * (k / 7), sag = 0.30 + rnd() * 0.10;
      tube(k % 2 ? mats.blueA : mats.blueB, [[xa - 0.05, y, HOT_Z + dz], [xa + 0.04, y - 0.05, HOT_Z + dz * 1.1], [(xa + xb) / 2, y - sag, HOT_Z + dz * 1.5], [xb - 0.04, y - 0.05, HOT_Z + dz * 1.1], [xb + 0.05, y, HOT_Z + dz]], 0.009, 32);
    }
  }

  /* ---------------- controlled drops from the enclosures into every rack top ---------------- */
  const nearestEnc = (x) => ENCLOSURE_XS.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
  const drop = (xe, ze, xr, zr, zMid) => {
    // xe/ze: enclosure exit; xr/zr: entry point on the rack top; zMid: the vertical run's z (just off the rack's rear edge)
    const y0 = ENC_TOP - ENC_H / 2;
    for (let k = 0; k < 4; k++) {
      const jx = (k % 2 ? 1 : -1) * 0.012 * (1 + Math.floor(k / 2)), jz = (k < 2 ? 1 : -1) * 0.012;
      tube(k % 2 ? mats.blueA : mats.blueB, [
        [xe, y0, ze], [xe * 0.6 + xr * 0.4 + jx, y0 - 0.12, ze * 0.55 + zMid * 0.45 + jz], [xr + jx, y0 - 0.45, zMid + jz],
        [xr + jx, 2.6, zMid + jz], [xr + jx, RACK_TOP + 0.10, zr + jz * 0.5], [xr + jx * 0.5, RACK_TOP - 0.02, zr],
      ], 0.008, 40);
    }
    for (const y of [3.0, 2.45]) wrap(mats.velcro, 0.03, 0.02, xr, y, zMid, 'y');           // velcro wraps on the vertical run
  };
  for (const x of ROW_XS) {
    const xe = nearestEnc(x), dir = x >= xe ? 1 : -1, xExit = xe + dir * (ENC_W / 2 - 0.05);
    drop(xExit, HOT_Z + (ENC_D / 2 - 0.02), x, ROW_A_Z - RACK_DEPTH / 2 + 0.10, ROW_A_Z - RACK_DEPTH / 2 + 0.06);   // row A rear top
    drop(xExit, HOT_Z - (ENC_D / 2 - 0.02), -x, ROW_B_Z + RACK_DEPTH / 2 - 0.10, ROW_B_Z + RACK_DEPTH / 2 - 0.06); // row B rear top
  }
  // Interactive rack: its rear faces +x, so the ladder extension's bundle waterfalls off the ladder end into its top.
  {
    const { x: lx, z: lz } = LIVE_RACK_PLACEMENT, xr = lx + RACK_DEPTH / 2 - 0.10, y = TRAY_Y0 + 0.03;
    for (let k = 0; k < 4; k++) {
      const jz = -0.03 + 0.02 * k, jx = (k % 2) * 0.012;
      tube(k % 2 ? mats.blueA : mats.blueB, [[lx - 0.6, y, lz + jz], [xr + 0.1, y, lz + jz], [xr + 0.28 + jx, y - 0.10, lz + jz], [xr + 0.28 + jx, 2.6, lz + jz], [xr + 0.05, RACK_TOP + 0.10, lz + jz * 0.5], [xr, RACK_TOP - 0.02, lz + jz * 0.3]], 0.008, 40);
    }
    for (const yy of [3.0, 2.45]) wrap(mats.velcro, 0.03, 0.02, xr + 0.28, yy, lz, 'y');
  }

  /* ---------------- bake: one mesh per material ---------------- */
  for (const [mat, geos] of buckets) {
    const merged = mergeGeometries(geos, false); geos.forEach((gg) => gg.dispose());
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat); m.name = 'overhead_' + mat.name; m.castShadow = false; m.receiveShadow = false; m.frustumCulled = true;
    g.add(m);
  }
  return g;
}
