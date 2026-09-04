// @ts-nocheck
/* eslint-disable */
// The static enclosure: base/top panels, corner posts, casters, side panels, mounting rails, and the front/rear
// perforated doors. This stays outside the exploded-view system — it's the shell the components live inside.

export function buildRackFrame(ctx) {
  const { box, plane, cyl, grillMesh, mats, W, D, Y0, TOP, ZF } = ctx;
  const { THREE, g } = ctx;

  box('base_plinth', mats.steel, W, 0.06, D, 0, 0.10, 0);
  box('top_panel', mats.steel, W, 0.03, D, 0, TOP + 0.015, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box('corner_post', mats.steel, 0.04, TOP - 0.13, 0.04, sx * (W / 2 - 0.02), (TOP + 0.13) / 2, sz * (D / 2 - 0.02));
    const wx = sx * (W / 2 - 0.08), wz = sz * (D / 2 - 0.1);
    box('caster_bracket', mats.steel, 0.04, 0.03, 0.05, wx, 0.06, wz);
    cyl('caster_wheel', mats.rubber, 0.035, 0.028, wx, 0.035, wz, 'x', g, 24);
    cyl('caster_hub', mats.screw, 0.012, 0.032, wx, 0.035, wz, 'x', g, 16);
    cyl('leveling_foot', mats.screw, 0.012, 0.05, sx * (W / 2 - 0.16), 0.045, sz * (D / 2 - 0.06), 'y', g, 16);
    cyl('leveling_pad', mats.rubber, 0.022, 0.012, sx * (W / 2 - 0.16), 0.006, sz * (D / 2 - 0.06), 'y', g, 16);
  }
  for (const sx of [-1, 1]) box('side_panel', mats.steel, 0.0025, TOP - 0.13, D - 0.08, sx * (W / 2 - 0.001), (TOP + 0.13) / 2, 0);
  for (const sx of [-1, 1]) for (const [z, face] of [[ZF, 1], [-0.36, -1]]) {
    box('mounting_rail_body', mats.steel, 0.018, TOP - Y0, 0.0025, sx * 0.235, (TOP + Y0) / 2, z);
    plane('mounting_rail_face', mats.rail, 0.018, TOP - Y0, sx * 0.235, (TOP + Y0) / 2, z + face * 0.0014, face < 0 ? Math.PI : 0);
    box('rail_bracket', mats.steel, 0.05, TOP - Y0, 0.02, sx * 0.27, (TOP + Y0) / 2, z - 0.012);
  }
  for (const z of [0.22, -0.32]) { box('top_cable_cutout', mats.dark, 0.26, 0.004, 0.09, 0, TOP + 0.031, z); box('brush_strip', mats.brush, 0.24, 0.006, 0.07, 0, TOP + 0.032, z); }
  const doorParts = (parent, w, h) => {
    grillMesh(w - 0.08, h - 0.08, 0, 0, 0, mats.doorMesh);
    const last = g.children.pop(); parent.add(last);
    for (const [bw, bh, x, y] of [[w, 0.05, 0, h / 2 - 0.025], [w, 0.05, 0, -h / 2 + 0.025], [0.05, h, w / 2 - 0.025, 0], [0.05, h, -w / 2 + 0.025, 0]]) box('door_frame', mats.steel, bw, bh, 0.02, x, y, 0, parent);
    box('door_frame', mats.steel, w - 0.08, 0.03, 0.015, 0, 0, 0, parent);
  };
  const rd = new THREE.Group(); rd.name = 'rear_door'; rd.position.set(0, (TOP + 0.13) / 2, -D / 2 - 0.012); g.add(rd);
  doorParts(rd, W - 0.02, TOP - 0.13);
  box('rear_handle', mats.graphite, 0.03, 0.2, 0.02, -0.24, 0.05, -0.02, rd); cyl('rear_lock', mats.screw, 0.008, 0.01, -0.24, 0.16, -0.02, 'z', rd, 16);
  const hinge = new THREE.Group(); hinge.name = 'front_door_hinge'; hinge.position.set(-(W / 2 - 0.01), (TOP + 0.13) / 2, D / 2 + 0.012); hinge.rotation.y = Math.PI * 0.64; g.add(hinge);
  const fd = new THREE.Group(); fd.name = 'front_door'; fd.position.set((W - 0.02) / 2, 0, 0); hinge.add(fd);
  doorParts(fd, W - 0.02, TOP - 0.13);
  box('front_handle', mats.graphite, 0.03, 0.2, 0.02, 0.24, 0.05, 0.02, fd); cyl('front_lock', mats.screw, 0.008, 0.01, 0.24, 0.16, 0.025, 'z', fd, 16);
  for (const hy of [-0.75, 0, 0.75]) cyl('door_hinge_pin', mats.screw, 0.008, 0.08, 0, hy, 0, 'y', hinge, 12);
  g.userData.doors = { hinge, hingeClosedY: hinge.rotation.y, rd, rdClosedZ: rd.position.z };
}
