// @ts-nocheck
/* eslint-disable */
// Runs after every rack item is built: routes patch/fiber cables between the two switch/patch-panel/cable-manager
// stacks, power cables from each server's rear inlets to the nearest free vertical-PDU outlet, and network drop
// cables up to the cable channel. Also finalizes `g.userData.slots` (for the thermal/airflow sims) and
// `g.userData.cableLikeObjects` (routing cables + straps + rings + management arms — tagged with
// `userData.cableRoute` as they're built — hidden together once the exploded view separates their endpoints).

export function wireCabling(ctx, { servers, pduOutlets, swA, swB, ppA, ppB, cmA, cmB }) {
  const { THREE, g, box, tube, mats, yb, U, TOP, ZF } = ctx;

  const frontPatch = (sw, pp, cmY, mat, count, step) => {
    for (let i = 0; i < count; i++) {
      const p = sw.ports[i * step], q = pp.pts[i * 2];
      tube('patch_cable', mat, [[p.x, p.y, p.z], [p.x, p.y + 0.004, p.z + 0.045], [(p.x + q.x) / 2, cmY + 0.003, p.z + 0.05], [q.x, pp.yc + 0.012, p.z + 0.03], [q.x, q.y, q.z]], 0.003);
    }
  };
  frontPatch(swA, ppA, cmA, mats.cableBlue, 12, 2);
  frontPatch(swB, ppB, cmB, mats.cableBlack, 8, 1);
  for (let i = 0; i < 4; i++) {
    const x = swA.sfpX + (i % 2) * 0.021, y = swA.yc + U / 2 - (i < 2 ? 0.0113 : 0.0303);
    tube('fiber_patch_cable', mats.cableYellow, [[x, y, ZF + 0.004], [x + 0.01, y + 0.01, ZF + 0.06], [0.06 + i * 0.008, TOP - 0.02, ZF - 0.1], [0.04 + i * 0.008, TOP + 0.035, 0.22]], 0.0016);
  }
  for (const y of [swA.yc + 0.03, TOP - 0.06]) box('velcro_strap', mats.velcro, 0.05, 0.01, 0.03, 0.06, y, y > TOP - 0.1 ? ZF - 0.08 : ZF + 0.055).userData.cableRoute = true;

  const pickOutlet = (sx, y) => {
    const list = pduOutlets[sx]; let best = 0;
    for (let i = 1; i < list.length; i++) if (Math.abs(list[i].y - y) < Math.abs(list[best].y - y)) best = i;
    while (list[best] && list[best].used) best++;
    list[best].used = true; return list[best].y;
  };
  servers.forEach(s => s.rear.inlets.forEach(([x, y, z, i]) => {
    const sx = i === 0 ? 1 : -1, oy = pickOutlet(sx, y);
    tube('power_cable', mats.cableBlack, [[x, y, z], [x, y - 0.012, z - 0.07], [sx * 0.10, Math.min(y, oy) - 0.03, -0.49], [sx * 0.22, oy, -0.47], [sx * 0.2345, oy, -0.44]], 0.0042);
  }));
  servers.filter((s, i) => i % 2 === 0).slice(0, 7).forEach((s, i) => {
    const [nx, ny, nz] = s.rear.nic;
    tube('network_drop_cable', mats.cableBlue, [[-0.1 + i * 0.006, TOP + 0.035, -0.32], [-0.20, TOP - 0.05, -0.34], [-0.245 + i * 0.001, ny + 0.08, -0.33], [-0.2, ny + 0.01, nz - 0.03], [nx, ny, nz]], 0.003);
  });
  for (let k = 0; k < 6; k++) box('velcro_strap', mats.velcro, 0.028, 0.012, 0.028, -0.245, 0.5 + k * 0.25, -0.33).userData.cableRoute = true;
  for (let k = 0; k < 7; k++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0025, 8, 24), mats.bezelPlastic);
    r.name = 'vertical_cable_ring_' + ctx.nextId();
    r.position.set(-0.245, 0.4 + k * 0.22, -0.33); r.rotation.x = Math.PI / 2; r.userData.cableRoute = true;
    g.add(r);
  }
  [servers[3], servers[7]].forEach(s => {
    const zr = ZF - 0.76, y = yb(s.n) + s.u * U / 2;
    box('cable_management_arm', mats.graphite, 0.22, 0.012, 0.03, 0.06, y, zr - 0.05).userData.cableRoute = true;
    box('cable_management_arm', mats.graphite, 0.012, 0.012, 0.09, 0.17, y, zr - 0.09).userData.cableRoute = true;
    box('cable_management_arm', mats.graphite, 0.012, 0.012, 0.05, -0.05, y, zr - 0.025).userData.cableRoute = true;
  });

  g.userData.slots = servers.map(s => ({ y: yb(s.n) + s.u * U / 2, h: s.u * U, zr: ZF - ({ 1: 0.72, 2: 0.76, 3: 0.78, 4: 0.80 }[s.u]) }));
  const cableLikeObjects = []; g.traverse((o) => { if (o.userData && o.userData.cableRoute) cableLikeObjects.push(o); });
  g.userData.cableLikeObjects = cableLikeObjects;
}
