// @ts-nocheck
/* eslint-disable */
// The shared build context for one rack instance: constants, textures/materials, low-level mesh primitives,
// exploded-view plumbing, and the handful of compound helpers (ears/chassis/rearFace/frontFrame/sidePanels)
// used by more than one component type. Every component builder in ./components takes this `ctx` as its
// first argument instead of closing over free variables, so each item type can live in its own file.
import { createTextures } from './textures';
import { createMaterials } from './materials';
import { createHexBezelLattice } from './hexBezelLattice';

export function createRackContext(THREE) {
  const U = 0.04445, W = 0.6, D = 1.07, Y0 = 0.13, TOP = Y0 + 42 * U, ZF = 0.40, CW = 0.437;
  const g = new THREE.Group(); g.name = 'server_rack';
  const anim = []; g.userData.animatedLeds = anim;

  const { T, tex } = createTextures(THREE, U, CW);
  const { mats, M, ledMat } = createMaterials(THREE, T, anim);

  // Exploded-view plumbing: procedural helpers below default to `ctx.curG`, the "current" parent group. Each rack
  // item (server, blank, switch, patch panel, cable manager, PDU, NUC…) gets its own THREE.Group via
  // beginItem/endItem so the whole rack can be pulled apart into its constituent components without touching
  // individual mesh positions.
  const items = []; g.userData.items = items; // { group, kind, label, ex, ey, ez, target } — ex/ey/ez = full-explode displacement (m)
  const ctx = {
    THREE, U, W, D, Y0, TOP, ZF, CW, g, curG: g, T, tex, mats, M, ledMat, items,
    F: ZF, // current equipment front plane (per-server recess); mutated by Server, read by chassis/frontFrame/sidePanels
  };

  let idCounter = 0;
  ctx.nextId = () => idCounter++; // for the rare mesh built by hand (bypassing box/plane/cyl) that still wants a unique name suffix
  ctx.beginItem = (kind, label) => { const grp = new THREE.Group(); grp.name = kind + '_' + label; ctx.curG = grp; return grp; };
  ctx.endItem = (grp, kind, label, ex, ey, ez) => { ctx.curG = g; g.add(grp); items.push({ group: grp, kind, label, ex, ey, ez, target: new THREE.Vector3() }); };
  const rackMidY = (Y0 + TOP) / 2;
  ctx.explodeDY = (yc) => (yc - rackMidY) * 0.9; // fan U-items away from the rack's vertical centre
  ctx.explodeDZ = (n) => 0.30 + 0.018 * (n % 5); // pull forward out of the rack, lightly staggered per slot
  ctx.explodePduX = (sx) => sx * 0.34; // vertical PDUs slide sideways instead

  /* ---------------- mesh primitives ---------------- */
  ctx.box = (name, mat, w, h, d, x, y, z, parent) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.name = name + '_' + (idCounter++); m.position.set(x, y, z); (parent || ctx.curG).add(m); return m; };
  ctx.plane = (name, mat, w, h, x, y, z, rotY, parent) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.name = name + '_' + (idCounter++); m.position.set(x, y, z); if (rotY) m.rotation.y = rotY; (parent || ctx.curG).add(m); return m; };
  ctx.cyl = (name, mat, r, h, x, y, z, axis, parent, seg) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg || 20), mat); m.name = name + '_' + (idCounter++); m.position.set(x, y, z); if (axis === 'z') m.rotation.x = Math.PI / 2; if (axis === 'x') m.rotation.z = Math.PI / 2; (parent || ctx.curG).add(m); return m; };
  ctx.tube = (name, mat, pts, r) => { const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))); const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, r, 10, false), mat); m.name = name + '_' + (idCounter++); m.userData.cableRoute = true; ctx.curG.add(m); const boot = ctx.cyl('connector_boot', mats.boot, r * 1.6, r * 6, ...pts[0], 'z', ctx.curG, 10); boot.userData.cableRoute = true; return m; };
  ctx.yb = n => Y0 + (n - 1) * U;
  ctx.grillMesh = (w, h, x, y, z, mat) => { const m = ctx.plane('honeycomb', mat || mats.grill, w, h, x, y, z); if (!m.geometry.attributes.uv._scaled) { const uv = m.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 0.05, uv.getY(i) * h / 0.0433); uv.needsUpdate = true; } return m; };

  /* ---------------- compound helpers shared across component types ---------------- */
  ctx.ears = (n, u, mat) => {
    const h = u * U - 0.003, yc = ctx.yb(n) + u * U / 2;
    for (const sx of [-1, 1]) {
      ctx.box('rack_ear_flange', mat || mats.ear, 0.024, h, 0.003, sx * 0.2305, yc, ZF + 0.0028);
      ctx.box('rack_ear_body', mat || mats.ear, 0.004, h, 0.05, sx * 0.2205, yc, ZF - 0.025);
      for (const f of [0.22, 0.78]) { ctx.cyl('ear_screw', mats.screw, 0.0045, 0.002, sx * 0.2305, ctx.yb(n) + f * u * U, ZF + 0.0053, 'z', ctx.curG, 12); }
    }
  };
  ctx.chassis = (n, u, depth, mat) => {
    const h = u * U - 0.004, yc = ctx.yb(n) + u * U / 2;
    ctx.box('chassis_body', mat, CW, h, depth, 0, yc, ctx.F - depth / 2);
    return { yc, h, zr: ctx.F - depth };
  };
  ctx.rearFace = (n, u, zr) => { const yc = ctx.yb(n) + u * U / 2; ctx.plane('rear_io_plate', mats.rear[u], CW, u * U - 0.004, 0, yc, zr - 0.0015, Math.PI); const h = u * U;
    // world coords derived from the texture layout (canvas left = +x)
    const inlets = [0, 1].map(i => [0.2185 - (0.008 + i * 0.09 + 0.018), yc + h / 2 - (h - 0.042 + 0.019), zr - 0.004, i]);
    return { inlets, nic: [0.2185 - (0.20 + 0.007), yc + h / 2 - (h - 0.02), zr - 0.004] }; };
  ctx.frontFrame = (yc, h, mat) => { ctx.box('front_trim', mat, CW, 0.004, 0.015, 0, yc + h / 2 - 0.002, ctx.F - 0.0025); ctx.box('front_trim', mat, CW, 0.004, 0.015, 0, yc - h / 2 + 0.002, ctx.F - 0.0025); ctx.plane('backplane', mats.dark, CW - 0.004, h - 0.004, 0, yc, ctx.F - 0.004); };
  ctx.sidePanels = (yc, h, ports) => { ctx.plane('control_panel', mats.ctrl, 0.024, h - 0.006, 0.2055, yc, ctx.F + 0.0016); if (ports) ctx.plane('left_status_column', mats.leftStatus, 0.011, h - 0.006, -0.212, yc, ctx.F + 0.0016); };

  // Hex bezel lattice materials (Server's `cover` option only) — cached per U-size for the lifetime of this rack.
  mats.bezelDark = M('bezel_body', { color: 0x1c1d21, roughness: 0.55, metalness: 0.3 });
  mats.bezelGloss = M('bezel_badge_gloss', { color: 0x101114, roughness: 0.15, metalness: 0.6 });
  const hexTiles = {};
  ctx.hexTile = (u) => hexTiles[u] || (hexTiles[u] = createHexBezelLattice(THREE, M, u));

  return ctx;
}
