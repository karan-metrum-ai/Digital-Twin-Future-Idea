// @ts-nocheck
/* eslint-disable */
// Electrical infrastructure for the data hall, laid out the way a real 2N hall is:
//   • an overhead busway per rack row (two rails — A feed with an orange stripe, B feed with a blue stripe) with a
//     tap-off box above every rack and a pair of drop cords into each rack's top;
//   • a floor-standing PDU cabinet at the end of each row (beyond the CDU) that the busway terminates into, with a
//     breaker panel, feed LEDs and a load LCD;
//   • three UPS cabinets along the back wall with status LCDs;
//   • a standby genset in the back-left corner (enclosure, exhaust stack, day tank) with a rotating amber beacon
//     that only runs while it is starting or carrying the load.
// Static geometry is merged per material (one draw call per material, mirroring OverheadCabling.ts); the LCDs, LEDs
// and beacon are the only live meshes and are driven through userData.setState / tick.
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ROW_XS, ROW_A_Z, ROW_B_Z, LIVE_RACK_PLACEMENT } from './RackRow';
import { ROOM_BOUNDS } from './Environment';
import { QUALITY } from '../quality';

const BUS_Y = 3.0, BUS_ZA = 0.40, BUS_ZB = 0.56;          // busway rails over row A (row B mirrored)
const RACK_TOP = 0.13 + 42 * 0.04445 + 0.02;
export const PDU_A = { x: 2.95, z: ROW_A_Z, rotY: 0 }, PDU_B = { x: -2.95, z: ROW_B_Z, rotY: Math.PI };
const PDU_W = 0.8, PDU_H = 2.0, PDU_D = 0.6;
const UPS_XS = [-3.3, -2.6, -1.9], UPS_Z = ROOM_BOUNDS.minZ + 0.47, UPS_W = 0.6, UPS_H = 2.0, UPS_D = 0.9;
const GEN = { x: -6.3, z: ROOM_BOUNDS.minZ + 0.75, w: 2.6, h: 1.9, d: 1.1 };
const FONT = (w, px) => `${w} ${px}px "Helvetica Neue", Helvetica, Arial, sans-serif`;

export function buildPowerPlant(THREE) {
  const g = new THREE.Group(); g.name = 'power_plant';
  const M = (name, o) => { const m = new THREE.MeshStandardMaterial(o); m.name = name; return m; };
  const mats = {
    cabinet: M('pdu_cabinet_steel', { color: 0x23262b, roughness: 0.5, metalness: 0.55 }),
    cabinetLight: M('ups_shell_steel', { color: 0x2d3036, roughness: 0.55, metalness: 0.5 }),
    trim: M('cabinet_trim', { color: 0x14161a, roughness: 0.6, metalness: 0.5 }),
    panel: M('breaker_panel', { color: 0x9ea3aa, roughness: 0.45, metalness: 0.6 }),
    breaker: M('breaker_toggle', { color: 0x0e0f12, roughness: 0.6, metalness: 0.2 }),
    busway: M('busway_aluminium', { color: 0x8f949b, roughness: 0.4, metalness: 0.85 }),
    stripeA: M('busway_stripe_a', { color: 0xd8641e, roughness: 0.55, metalness: 0.1 }),
    stripeB: M('busway_stripe_b', { color: 0x2560c8, roughness: 0.55, metalness: 0.1 }),
    tap: M('busway_tap_box', { color: 0x1b1d21, roughness: 0.55, metalness: 0.5 }),
    cordA: M('drop_cord_a', { color: 0x8a3a1a, roughness: 0.7, metalness: 0 }),
    cordB: M('drop_cord_b', { color: 0x1f4f9a, roughness: 0.7, metalness: 0 }),
    yellow: M('genset_enclosure', { color: 0xd9a21b, roughness: 0.55, metalness: 0.3 }),
    louvre: M('genset_louvre', { color: 0x2a2a2a, roughness: 0.8, metalness: 0.3 }),
    stack: M('genset_stack', { color: 0x4a4d52, roughness: 0.6, metalness: 0.7 }),
    tank: M('fuel_tank', { color: 0x3c4046, roughness: 0.5, metalness: 0.6 }),
    rod: M('hanger_rod_zinc', { color: 0x7d8288, roughness: 0.55, metalness: 0.8 }),
    vent: M('cabinet_vent', { color: 0x0c0d10, roughness: 0.8, metalness: 0.3 }),
  };
  // Each item (busway, floor PDUs, UPS bank, genset) bakes into its own sub-group so it can be shown/hidden on its own.
  const buckets = new Map(), sections = {}; let cur = 'busway';
  const sec = (name) => { cur = name; if (!sections[name]) { const sg = new THREE.Group(); sg.name = 'power_' + name; g.add(sg); sections[name] = sg; } return sections[name]; };
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
  const add = (mat, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { geo.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s)); const key = cur + '|' + mat.uuid; if (!buckets.has(key)) buckets.set(key, { mat, geos: [], section: cur }); buckets.get(key).geos.push(geo); };
  const box = (mat, w, h, d, x, y, z, ry = 0) => add(mat, new THREE.BoxGeometry(w, h, d), x, y, z, 0, ry, 0);
  const cylY = (mat, r, h, x, yc, z, seg = 16) => add(mat, new THREE.CylinderGeometry(r, r, h, seg), x, yc, z);
  const cylX = (mat, r, h, x, y, z, seg = 16) => add(mat, new THREE.CylinderGeometry(r, r, h, seg), x, y, z, 0, 0, Math.PI / 2);
  const tube = (mat, pts, r, seg = QUALITY.cableTubeSegments) => add(mat, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), seg, r, QUALITY.cableRadialSegments, false));
  const live = []; // dynamic meshes
  const liveMesh = (mesh) => { mesh.userData.thermalSkip = true; mesh.castShadow = false; mesh.receiveShadow = false; sec(cur).add(mesh); live.push(mesh); return mesh; };
  const canvasTex = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = QUALITY.anisotropy; return { c, ctx: c.getContext('2d'), tex }; };
  // Place a local-frame point (x forward-facing frame: +z is the front) into the world for a cabinet at (cx, cz, rotY).
  const place = (cx, cz, rotY) => (lx, ly, lz) => [cx + lx * Math.cos(rotY) + lz * Math.sin(rotY), ly, cz - lx * Math.sin(rotY) + lz * Math.cos(rotY)];

  /* ---------------- busway over each row ---------------- */
  const busRow = (mirror) => {
    // Row A frame; row B is the same thing rotated 180° about the hot-aisle centre (x -> -x, z -> ROW_B_Z - z).
    const T = mirror ? ([x, y, z]) => [-x, y, ROW_B_Z - z] : ([x, y, z]) => [x, y, z];
    const P = (x, y, z) => T([x, y, z]);
    const x0 = -1.95, x1 = 2.95;                                              // far end of the row -> the PDU
    for (const [zr, stripe] of [[BUS_ZA, mats.stripeA], [BUS_ZB, mats.stripeB]]) {
      const [cx, , cz] = P((x0 + x1) / 2, 0, zr);
      box(mats.busway, x1 - x0, 0.12, 0.10, cx, BUS_Y, cz, mirror ? Math.PI : 0);
      box(stripe, x1 - x0 - 0.1, 0.03, 0.104, cx, BUS_Y - 0.03, cz, mirror ? Math.PI : 0);
      for (const hx of [-1.6, -0.3, 1.0, 2.3]) { const [hxw, , hzw] = P(hx, 0, zr); cylY(mats.rod, 0.008, 4.7 - BUS_Y - 0.06, hxw, (4.7 + BUS_Y + 0.06) / 2, hzw, 8); box(mats.tap, 0.08, 0.012, 0.08, hxw, 4.694, hzw); }
    }
    // Feed end: both rails drop into the top of the end-of-row PDU.
    for (const [zr, cord] of [[BUS_ZA, mats.cordA], [BUS_ZB, mats.cordB]]) {
      const pts = [P(x1 - 0.05, BUS_Y - 0.06, zr), P(x1, BUS_Y - 0.4, zr - 0.1), P(x1, PDU_H + 0.15, 0.12), P(x1, PDU_H, 0.06)];
      tube(cord, pts, 0.018, 12);
      const [bx, , bz] = P(x1 - 0.05, 0, zr); box(mats.tap, 0.16, 0.16, 0.14, bx, BUS_Y - 0.14, bz);
    }
    // Tap-off box above every rack, with an A and a B cord dropping into the rack top.
    for (const rx of ROW_XS) {
      for (const [zr, cord, dx] of [[BUS_ZA, mats.cordA, -0.06], [BUS_ZB, mats.cordB, 0.06]]) {
        const [bx, , bz] = P(rx + dx, 0, zr); box(mats.tap, 0.11, 0.14, 0.12, bx, BUS_Y - 0.13, bz);
        tube(cord, [P(rx + dx, BUS_Y - 0.2, zr), P(rx + dx, BUS_Y - 0.55, zr - 0.15), P(rx + dx + 0.08, RACK_TOP + 0.25, -0.15), P(rx + dx + 0.1, RACK_TOP - 0.01, -0.32)], 0.011);
      }
    }
  };
  sec('busway');
  busRow(false); busRow(true);
  // Interactive rack: a short spur off the right-hand wall to a tap-off above it (rack faces -x, so its rear is +x).
  {
    const L = LIVE_RACK_PLACEMENT; const zs = [L.z - 0.12, L.z + 0.04];
    for (const [zr, stripe, cord, dz] of [[zs[0], mats.stripeA, mats.cordA, -0.06], [zs[1], mats.stripeB, mats.cordB, 0.06]]) {
      const xa = L.x + 0.35, xb = ROOM_BOUNDS.maxX;
      box(mats.busway, xb - xa, 0.12, 0.10, (xa + xb) / 2, BUS_Y, zr); box(stripe, xb - xa - 0.1, 0.03, 0.104, (xa + xb) / 2, BUS_Y - 0.03, zr);
      cylY(mats.rod, 0.008, 4.7 - BUS_Y - 0.06, L.x + 1.6, (4.7 + BUS_Y + 0.06) / 2, zr, 8);
      box(mats.tap, 0.11, 0.14, 0.12, xa + 0.1, BUS_Y - 0.13, zr);
      tube(cord, [[xa + 0.1, BUS_Y - 0.2, zr], [xa + 0.05, BUS_Y - 0.55, zr + dz], [L.x + 0.32, RACK_TOP + 0.25, L.z + dz], [L.x + 0.3, RACK_TOP - 0.01, L.z + dz]], 0.011);
    }
  }

  /* ---------------- floor PDUs ---------------- */
  const pduDisplays = [], feedLeds = [];
  const pdu = ({ x, z, rotY }, label) => {
    const W = place(x, z, rotY);
    const at = (lx, ly, lz) => W(lx, ly, lz);
    let p = at(0, PDU_H / 2, 0); box(mats.cabinet, PDU_W, PDU_H, PDU_D, p[0], p[1], p[2], rotY);
    p = at(0, 0.03, 0); box(mats.trim, PDU_W + 0.02, 0.06, PDU_D + 0.02, p[0], p[1], p[2], rotY);
    p = at(0, PDU_H + 0.015, 0); box(mats.trim, PDU_W + 0.02, 0.03, PDU_D + 0.02, p[0], p[1], p[2], rotY);
    p = at(0, 1.25, PDU_D / 2 + 0.004); box(mats.panel, PDU_W - 0.16, 1.05, 0.008, p[0], p[1], p[2], rotY);   // breaker panel
    for (let r = 0; r < 12; r++) for (let c = 0; c < 2; c++) { const lx = -0.16 + c * 0.32, ly = 1.7 - r * 0.075; p = at(lx, ly, PDU_D / 2 + 0.012); box(mats.breaker, 0.09, 0.028, 0.012, p[0], p[1], p[2], rotY); p = at(lx + (c ? 0.06 : -0.06), ly, PDU_D / 2 + 0.014); box(mats.trim, 0.012, 0.018, 0.006, p[0], p[1], p[2], rotY); }
    for (let i = 0; i < 6; i++) { p = at(0, 0.25 + i * 0.05, PDU_D / 2 + 0.004); box(mats.vent, PDU_W - 0.2, 0.018, 0.006, p[0], p[1], p[2], rotY); } // lower vent slots
    // Load LCD + A/B feed LEDs above the panel.
    const { c, ctx, tex } = canvasTex(512, 160);
    const lcd = liveMesh(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.13), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }))); lcd.name = 'pdu_display';
    p = at(0, 1.86, PDU_D / 2 + 0.009); lcd.position.set(p[0], p[1], p[2]); lcd.rotation.y = rotY;
    const draw = (s) => {
      ctx.fillStyle = '#05080e'; ctx.fillRect(0, 0, 512, 160);
      ctx.fillStyle = '#7fb3ff'; ctx.font = FONT(600, 24); ctx.textBaseline = 'top'; ctx.fillText(`${label}  ·  400 V 3Ø  ·  ${s.source.toUpperCase()}`, 18, 14);
      ctx.fillStyle = '#2a3a55'; ctx.fillRect(18, 46, 476, 2);
      const cell = (x0, lab, val, unit) => { ctx.fillStyle = '#8b97ad'; ctx.font = FONT(500, 18); ctx.fillText(lab, x0, 60); ctx.fillStyle = s.source === 'utility' || s.source === 'generator' ? '#eef3ff' : '#ffcf6a'; ctx.font = FONT(600, 46); ctx.fillText(val, x0, 82); const w = ctx.measureText(val).width; ctx.fillStyle = '#8b97ad'; ctx.font = FONT(500, 18); ctx.fillText(unit, x0 + w + 8, 106); };
      cell(18, 'LOAD', s.loadKw.toFixed(1), 'kW'); cell(200, 'CURRENT', (s.loadKw * 1000 / (400 * 1.732 * 0.95)).toFixed(0), 'A'); cell(372, 'PF', '0.95', '');
      tex.needsUpdate = true;
    };
    pduDisplays.push(draw);
    for (const [k, col] of [[0, 0x2ee36a], [1, 0x2ee36a]]) {
      const led = liveMesh(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 0.006), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: col, emissiveIntensity: 1.8, toneMapped: false }))); led.name = `pdu_feed_led_${k ? 'b' : 'a'}`;
      p = at(-0.12 + k * 0.24, 1.96, PDU_D / 2 + 0.008); led.position.set(p[0], p[1], p[2]); led.rotation.y = rotY; feedLeds.push(led.material);
    }
    return c;
  };
  sec('pdu');
  pdu(PDU_A, 'PDU-A1'); pdu(PDU_B, 'PDU-B1');

  /* ---------------- UPS bank along the back wall ---------------- */
  const upsDisplays = [], upsLeds = [];
  sec('ups');
  UPS_XS.forEach((ux, i) => {
    box(mats.cabinetLight, UPS_W, UPS_H, UPS_D, ux, UPS_H / 2, UPS_Z);
    box(mats.trim, UPS_W + 0.02, 0.06, UPS_D + 0.02, ux, 0.03, UPS_Z); box(mats.trim, UPS_W + 0.02, 0.03, UPS_D + 0.02, ux, UPS_H + 0.015, UPS_Z);
    for (let r = 0; r < 9; r++) box(mats.vent, UPS_W - 0.14, 0.02, 0.006, ux, 0.22 + r * 0.055, UPS_Z + UPS_D / 2 + 0.003);       // battery bay vents
    for (let r = 0; r < 7; r++) box(mats.vent, UPS_W - 0.14, 0.02, 0.006, ux, 1.0 + r * 0.055, UPS_Z + UPS_D / 2 + 0.003);        // inverter vents
    box(mats.trim, UPS_W - 0.1, 0.24, 0.01, ux, 1.68, UPS_Z + UPS_D / 2 + 0.004);                                                   // display bezel
    const { c, ctx, tex } = canvasTex(512, 200);
    const lcd = liveMesh(new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.17), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }))); lcd.name = 'ups_display';
    lcd.position.set(ux, 1.68, UPS_Z + UPS_D / 2 + 0.011);
    const draw = (s) => {
      const onBatt = s.source === 'battery';
      ctx.fillStyle = onBatt ? '#1a1206' : '#05080e'; ctx.fillRect(0, 0, 512, 200);
      ctx.fillStyle = onBatt ? '#ffcf6a' : '#7fb3ff'; ctx.font = FONT(600, 24); ctx.textBaseline = 'top'; ctx.fillText(`UPS-${i + 1}  ·  250 kVA  ·  ${s.upsMode}`, 18, 14);
      ctx.fillStyle = onBatt ? '#5a4416' : '#2a3a55'; ctx.fillRect(18, 46, 476, 2);
      const cell = (x0, lab, val, unit) => { ctx.fillStyle = '#8b97ad'; ctx.font = FONT(500, 18); ctx.fillText(lab, x0, 60); ctx.fillStyle = onBatt ? '#ffe2a6' : '#eef3ff'; ctx.font = FONT(600, 48); ctx.fillText(val, x0, 82); const w = ctx.measureText(val).width; ctx.fillStyle = '#8b97ad'; ctx.font = FONT(500, 18); ctx.fillText(unit, x0 + w + 8, 108); };
      cell(18, 'BATTERY', s.upsPct.toFixed(0), '%'); cell(190, 'RUNTIME', s.upsMin.toFixed(0), 'min'); cell(372, 'LOAD', (s.loadKw / 3).toFixed(0), 'kW');
      ctx.fillStyle = '#1f2a3d'; ctx.fillRect(18, 150, 476, 26); ctx.fillStyle = onBatt ? '#ffb020' : '#2ee36a'; ctx.fillRect(20, 152, 472 * (s.upsPct / 100), 22);
      tex.needsUpdate = true;
    };
    upsDisplays.push(draw);
    const led = liveMesh(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.006), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0x2ee36a, emissiveIntensity: 1.8, toneMapped: false }))); led.name = 'ups_status_led';
    led.position.set(ux, 1.84, UPS_Z + UPS_D / 2 + 0.011); upsLeds.push(led.material);
  });
  // Battery-string sign between the cabinets and the wall busbar trunking above them.
  box(mats.busway, UPS_XS[0] - UPS_XS[2] + UPS_W + 0.4, 0.14, 0.12, (UPS_XS[0] + UPS_XS[2]) / 2, UPS_H + 0.35, UPS_Z - 0.2);
  for (const ux of UPS_XS) box(mats.trim, 0.12, 0.28, 0.1, ux, UPS_H + 0.14, UPS_Z - 0.2);

  /* ---------------- standby genset (back-left corner) ---------------- */
  {
    sec('genset');
    const { x, z, w, h, d } = GEN;
    box(mats.yellow, w, h, d, x, 0.12 + h / 2, z); box(mats.trim, w + 0.04, 0.12, d + 0.04, x, 0.06, z);
    for (let i = 0; i < 9; i++) box(mats.louvre, 0.5, 0.05, 0.01, x - w / 2 + 0.45, 0.5 + i * 0.12, z + d / 2 + 0.006);     // intake louvres
    for (let i = 0; i < 9; i++) box(mats.louvre, 0.5, 0.05, 0.01, x + w / 2 - 0.45, 0.5 + i * 0.12, z + d / 2 + 0.006);
    box(mats.trim, 1.0, 1.2, 0.02, x, 1.0, z + d / 2 + 0.01); box(mats.busway, 0.04, 0.5, 0.03, x + 0.42, 1.0, z + d / 2 + 0.03); // access door + handle
    cylY(mats.stack, 0.09, 4.7 - (0.12 + h), x - w / 2 + 0.3, (4.7 + 0.12 + h) / 2, z - 0.25);                                     // exhaust stack to the roof
    cylY(mats.stack, 0.16, 0.5, x - w / 2 + 0.3, 0.12 + h + 0.25, z - 0.25);                                                        // silencer
    cylX(mats.tank, 0.32, 1.3, x + w / 2 + 0.95, 0.52, z + 0.1); box(mats.trim, 1.2, 0.12, 0.7, x + w / 2 + 0.95, 0.12, z + 0.1);   // day tank on saddles
    tube(mats.cordA, [[x + w / 2 + 0.3, 0.4, z + 0.1], [x + w / 2 + 0.05, 0.6, z + 0.1]], 0.02, 6);
    // Signage: model plate on the enclosure.
    const { ctx, tex } = canvasTex(512, 128);
    ctx.fillStyle = '#15161a'; ctx.fillRect(0, 0, 512, 128); ctx.fillStyle = '#f3d27a'; ctx.font = FONT(700, 50); ctx.textBaseline = 'middle'; ctx.fillText('GENSET · 750 kVA', 22, 44);
    ctx.fillStyle = '#9aa3b5'; ctx.font = FONT(500, 26); ctx.fillText('STANDBY · DIESEL · AUTO-START 10 s', 22, 96);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.175), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.2 })); plate.name = 'genset_plate';
    plate.position.set(x, 1.75, z + d / 2 + 0.012); sec('genset').add(plate);
    // Rotating amber beacon on the roof of the enclosure.
    const beaconMat = new THREE.MeshStandardMaterial({ color: 0x3a2a08, emissive: 0xffa020, emissiveIntensity: 0, roughness: 0.3, transparent: true, opacity: 0.9, toneMapped: false });
    const dome = liveMesh(new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), beaconMat)); dome.name = 'genset_beacon'; dome.position.set(x + 0.6, 0.12 + h + 0.05, z);
    box(mats.trim, 0.2, 0.05, 0.2, x + 0.6, 0.12 + h + 0.025, z);
    const sweepMat = new THREE.MeshBasicMaterial({ color: 0xffa020, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const sweep = liveMesh(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.16), sweepMat)); sweep.name = 'genset_beacon_sweep'; sweep.position.set(x + 0.6 + 0.45, 0.12 + h + 0.1, z);
    const sweepPivot = new THREE.Group(); sweepPivot.position.set(x + 0.6, 0, z); sweep.position.set(0.45, 0.12 + h + 0.1, 0); sweep.parent.remove(sweep); sweepPivot.add(sweep); sec('genset').add(sweepPivot);
    g.userData.beacon = { mat: beaconMat, sweepMat, pivot: sweepPivot };
  }

  /* ---------------- bake ---------------- */
  for (const { mat, geos, section } of buckets.values()) {
    const merged = mergeGeometries(geos, false); geos.forEach((gg) => gg.dispose());
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat); m.name = 'power_' + mat.name; m.castShadow = /cabinet|ups_shell|genset/.test(mat.name); m.receiveShadow = false; sections[section].add(m);
  }
  /** Show/hide one item: 'busway' | 'pdu' | 'ups' | 'genset'. */
  g.userData.setVisible = (name, on) => { if (sections[name]) sections[name].visible = on; };

  /* ---------------- live state ---------------- */
  let state = { source: 'utility', upsMode: 'ONLINE · DOUBLE CONVERSION', upsPct: 100, upsMin: 27, loadKw: 84, genRunning: false }, drawnAt = -10;
  g.userData.setState = (s) => { state = { ...state, ...s }; };
  g.userData.tick = (t) => {
    if (t - drawnAt > 0.5) { drawnAt = t; pduDisplays.forEach((d) => d(state)); upsDisplays.forEach((d) => d(state)); }
    const onBatt = state.source === 'battery', lost = state.source === 'none';
    upsLeds.forEach((m) => { m.emissive.setHex(onBatt ? 0xffb020 : lost ? 0xff3a24 : 0x2ee36a); m.emissiveIntensity = onBatt ? 1.4 + 1.2 * (Math.sin(t * 6) > 0 ? 1 : 0) : 1.8; });
    feedLeds.forEach((m, i) => { const ok = state.source === 'utility' || (state.source === 'generator' && i === 1) || (state.source === 'battery'); m.emissive.setHex(ok ? 0x2ee36a : 0xff3a24); m.emissiveIntensity = ok ? 1.8 : 1.2 + 1.2 * (Math.sin(t * 5 + i) > 0 ? 1 : 0); });
    const b = g.userData.beacon;
    if (state.genRunning) { b.mat.emissiveIntensity = 2.6; b.pivot.rotation.y = t * 4.2; b.sweepMat.opacity = 0.55; }
    else { b.mat.emissiveIntensity = 0; b.sweepMat.opacity = 0; }
  };
  g.userData.tick(0);
  return g;
}
