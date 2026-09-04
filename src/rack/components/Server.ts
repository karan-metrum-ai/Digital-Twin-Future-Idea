// @ts-nocheck
/* eslint-disable */
// Server (1U/2U/3U/4U chassis): drive layouts (SFF/LFF/GPU), optional perforated bezel or PowerEdge-style hex
// bezel cover, rear I/O plate. This is the largest and most varied rack component, so its private per-server
// helpers (drive carriers, vent, bezel/cover) live here rather than on the shared RackContext.
// (Uses ctx.hexTile(u), which wraps hexBezelLattice.ts's createHexBezelLattice with a per-rack cache.)

const sffDrive = (ctx, x, y, z, w, h, sq) => {
  const { THREE, mats, ledMat, cyl } = ctx;
  const face = sq ? mats.sffSq : mats.sff;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.006), [mats.driveSide, mats.driveSide, mats.driveSide, mats.driveSide, face, mats.driveSide]);
  m.name = 'sff_drive_carrier_' + ctx.nextId(); m.position.set(x, y, z); ctx.curG.add(m);
  const l = cyl('activity_led', ledMat(0x3dff6e), 0.0008, 0.001, sq ? x + w * 0.39 : x - w * 0.22, sq ? y + h * 0.35 : y + h * 0.425, z + 0.0035, 'z', ctx.curG, 8);
  l.userData.phase = x * 40 + y * 17;
};
const lffDrive = (ctx, x, y, z, w, h) => {
  const { THREE, mats, ledMat, cyl } = ctx;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.006), [mats.driveSide, mats.driveSide, mats.driveSide, mats.driveSide, mats.lff, mats.driveSide]);
  m.name = 'lff_drive_carrier_' + ctx.nextId(); m.position.set(x, y, z); ctx.curG.add(m);
  const l = cyl('activity_led', ledMat(0x3dff6e), 0.0009, 0.001, x + w / 2 - w * 0.057, y + h / 2 - h * 0.2, z + 0.0035, 'z', ctx.curG, 8);
  l.userData.phase = x * 30 + y * 23;
};
const sqVent = (ctx, x, yc, w, h, z) => {
  const { THREE, mats } = ctx;
  const geo = new THREE.PlaneGeometry(w, h); const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 0.03, uv.getY(i) * h / 0.03); uv.needsUpdate = true;
  const m = new THREE.Mesh(geo, mats.sqMesh); m.name = 'square_mesh_vent_' + ctx.nextId(); m.position.set(x, yc, z); ctx.curG.add(m);
};
// Perforated grille bezel (opt.bezel) — a simpler alternative to the hex-lattice `cover` below.
const bezel = (ctx, yc, h) => {
  const { box, cyl, grillMesh, mats, CW, ZF } = ctx;
  grillMesh(CW - 0.045, h - 0.01, 0, yc, ZF + 0.012);
  for (const sx of [-1, 1]) box('bezel_frame', mats.bezelPlastic, 0.02, h - 0.006, 0.012, sx * (CW / 2 - 0.014), yc, ZF + 0.007);
  box('bezel_frame', mats.bezelPlastic, CW - 0.045, 0.004, 0.012, 0, yc + h / 2 - 0.004, ZF + 0.007);
  box('bezel_frame', mats.bezelPlastic, CW - 0.045, 0.004, 0.012, 0, yc - h / 2 + 0.004, ZF + 0.007);
  cyl('bezel_lock', mats.screw, 0.005, 0.002, CW / 2 - 0.014, yc, ZF + 0.014, 'z', ctx.curG, 16);
  box('bezel_badge', mats.trim, 0.03, 0.008, 0.001, -CW / 2 + 0.06, yc - h / 2 + 0.012, ZF + 0.0185);
};
// PowerEdge-style hex-lattice cover (opt.cover): one plane carrying the tiling normal/alpha/colour maps from
// createHexBezelLattice, framed with end caps, rails and a lock boss. See hexBezelLattice.ts for the pixel math.
const cover = (ctx, yc, h, u) => {
  const { THREE, box, plane, cyl, mats, M, CW, ZF } = ctx;
  const cap = 0.036, lw = CW - 2 * cap, lh = h - 0.008, depth = 0.01384, zFace = ZF + depth;
  const Tl = ctx.hexTile(u);
  const geo = new THREE.PlaneGeometry(lw, lh); const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * lw / Tl.tw, uv.getY(i) * lh / Tl.th + 0.5 - (lh / Tl.th) / 2); uv.needsUpdate = true;
  const face = new THREE.Mesh(geo, Tl.mat); face.name = 'bezel_hex_face_' + ctx.nextId(); face.position.set(0, yc, zFace - 0.001); ctx.curG.add(face);
  // recessed web floor: dark plane behind the lattice, drives still visible through the apertures beyond it
  const floorMat = M('bezel_web_floor', { color: 0x0d0e10, roughness: 0.9, metalness: 0, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
  plane('bezel_web_floor', floorMat, lw, lh, 0, yc, ZF + 0.0065);
  // frame: end caps, top/bottom rails, side returns
  for (const sx of [-1, 1]) { box('bezel_end_cap', mats.bezelDark, cap, h, depth, sx * (CW / 2 - cap / 2), yc, ZF + depth / 2); box('bezel_end_cap_inset', mats.dark, cap - 0.01, h - 0.012, 0.0015, sx * (CW / 2 - cap / 2), yc, zFace + 0.0005); }
  box('bezel_rail', mats.bezelDark, lw, 0.005, depth - 0.002, 0, yc + h / 2 - 0.0025, ZF + depth / 2 - 0.001); box('bezel_rail', mats.bezelDark, lw, 0.005, depth - 0.002, 0, yc - h / 2 + 0.0025, ZF + depth / 2 - 0.001);
  // raised cylindrical boss with barrel lock, far left
  const bx = -lw / 2 + 0.022, by = yc;
  cyl('bezel_lock_boss', mats.bezelDark, 0.011, 0.006, bx, by, zFace + 0.002, 'z', ctx.curG, 32);
  cyl('bezel_lock_barrel', mats.screw, 0.0055, 0.002, bx, by, zFace + 0.0055, 'z', ctx.curG, 24);
  box('bezel_key_slot', mats.dark, 0.0012, 0.006, 0.001, bx, by, zFace + 0.0065);
  // inset glossy badge plate, centre (brand mark omitted)
  box('bezel_badge_recess', mats.bezelDark, 0.046, 0.016, 0.003, 0, yc, zFace - 0.0015); box('bezel_badge_plate', mats.bezelGloss, 0.04, 0.011, 0.001, 0, yc, zFace + 0.0002);
};

/**
 * Builds one server chassis (1U/2U/3U/4U) at slot `n`, with a drive layout picked by `u` + `kind`:
 *  - 1U: 10x 2.5" SFF drives
 *  - 2U 'sff': PowerEdge R550-style 16x 2.5" + square-mesh vent + control column
 *  - 2U (default): 2x4 LFF drives
 *  - 3U: 3x4 LFF drives + top vent
 *  - 4U 'gpu': 8x 2.5" SFF top row + fan wall + 4x E3.S modules
 *  - 4U (default) / other: 6x4 LFF drives
 * `opt`: { graphite?, bezel?, cover? }. Returns `{ n, u, rear }` for cabling.
 */
export function buildServer(ctx, n, u, kind, opt) {
  const { box, cyl, chassis, ears, frontFrame, sidePanels, rearFace, beginItem, endItem, explodeDY, explodeDZ, mats, ledMat, M, CW, ZF } = ctx;
  const depth = { 1: 0.72, 2: 0.76, 3: 0.78, 4: 0.80 }[u], mat = opt && opt.graphite ? mats.graphite : mats.silver;
  ctx.F = ZF + [0, -0.004, -0.002, -0.006, -0.001][n % 5];
  const grp = beginItem('server', n);
  const c = chassis(n, u, depth, mat); ears(n, u, opt && opt.graphite ? mats.graphite : mats.ear); frontFrame(c.yc, c.h, opt && opt.graphite ? mats.graphite : mats.trim);
  const zf = ctx.F + 0.003, top = c.yc + c.h / 2, bot = c.yc - c.h / 2;
  if (u === 1) { for (let i = 0; i < 10; i++) sffDrive(ctx, -0.1875 + i * 0.0393, c.yc, zf, 0.038, c.h - 0.006, true); sidePanels(c.yc, c.h, true); }
  // 2U follows the PowerEdge R550 16 x 2.5" layout: drives left, square-mesh vent block right, control column
  else if (u === 2 && kind === 'sff') { for (let i = 0; i < 16; i++) sffDrive(ctx, -0.1965 + i * 0.0192, c.yc, zf, 0.0184, c.h - 0.006); sqVent(ctx, 0.145, c.yc, 0.092, c.h - 0.008, zf + 0.002); sidePanels(c.yc, c.h, true); }
  else if (u === 2) { for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) lffDrive(ctx, -0.155 + i * 0.098, top - 0.0225 - r * 0.039, zf, 0.096, 0.036); sidePanels(c.yc, c.h, true); }
  else if (u === 3) { for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) lffDrive(ctx, -0.147 + i * 0.098, bot + 0.016 + r * 0.0275, zf, 0.096, 0.0265); ctx.grillMesh(0.39, 0.04, -0.005, top - 0.025, zf, mats.grillSolid); sidePanels(c.yc, c.h, true); }
  // 4U XE-style: 8 x 2.5" hot-swap drives top row, fan wall behind square mesh, 4 x E3.S modules with orange release buttons at the foot
  else if (u === 4 && kind === 'gpu') {
    for (let i = 0; i < 8; i++) sffDrive(ctx, -0.19 + i * 0.0182, top - 0.044, zf, 0.0175, 0.075);
    sqVent(ctx, 0.073, top - 0.044, 0.255, 0.078, zf + 0.002); sqVent(ctx, 0, c.yc - 0.03, CW - 0.06, 0.06, zf + 0.002);
    for (let i = 0; i < 4; i++) {
      const x = -0.15 + i * 0.1;
      box('e3s_module', mats.driveSide, 0.094, 0.026, 0.006, x, bot + 0.017, zf);
      box('e3s_release_button', M('orange_release', { color: 0xe0702a, roughness: 0.5 }), 0.008, 0.008, 0.002, x - 0.03, bot + 0.017, zf + 0.004);
      box('e3s_button_ring', mats.dark, 0.011, 0.011, 0.0015, x - 0.03, bot + 0.017, zf + 0.0035);
      const l = cyl('activity_led', ledMat(0x3dff6e), 0.001, 0.001, x - 0.03, bot + 0.026, zf + 0.0035, 'z', ctx.curG, 8); l.userData.phase = i;
    }
    sidePanels(c.yc, c.h, true);
  }
  else { for (let r = 0; r < 6; r++) for (let i = 0; i < 4; i++) lffDrive(ctx, -0.155 + i * 0.098, top - 0.016 - r * 0.0285, zf, 0.096, 0.0275); sidePanels(c.yc, c.h, true); }
  if (opt && opt.bezel) bezel(ctx, c.yc, c.h);
  if (opt && opt.cover) cover(ctx, c.yc, c.h, u);
  const rear = rearFace(n, u, c.zr);
  endItem(grp, 'server', 'U' + n + '-' + (n + u - 1), 0, explodeDY(c.yc), explodeDZ(n));
  ctx.F = ZF;
  return { n, u, rear };
}
