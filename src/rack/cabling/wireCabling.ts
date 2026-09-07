// @ts-nocheck
/* eslint-disable */
// Runs after every rack item is built: routes patch/fiber cables between the two switch/patch-panel/cable-manager
// stacks, power cables from each server's rear inlets to the nearest free vertical-PDU outlet, and network drop
// cables up to the cable channel. Also finalizes `g.userData.slots` (for the thermal/airflow sims) and
// `g.userData.cableLikeObjects` (routing cables + straps + rings + management arms — tagged with
// `userData.cableRoute` as they're built — hidden together once the exploded view separates their endpoints).

export function wireCabling(ctx, { servers, pduOutlets, swA, swB, ppA, ppB, cmA, cmB }) {
  const { THREE, g, box, tube, mats, M, yb, U, TOP, ZF } = ctx;

  // One patch cable on the 48-port switch is a deliberate fault: its RJ45 plug has backed out of the port and sits
  // a centimetre or so in front of the empty jack, tipped over the way a plug hangs when the latch has let go.
  // The plug is modelled properly (clear housing, latch tab, eight gold contacts, the twisted pairs visible
  // inside, a boot) and the cable is an emissive red that ServerRackTwin pulses in a sharp 'beep' via
  // g.userData.faultCable; the housing itself stays clear white like a real plug.
  const faultMat = M('cable_fault', { color: 0xd8241c, emissive: 0xff2a18, emissiveIntensity: 1.6, roughness: 0.5, metalness: 0, toneMapped: false });
  const plugMat = M('rj45_clear', { color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.12, roughness: 0.10, metalness: 0.0, transparent: true, opacity: 0.48, depthWrite: false });
  const contactMat = M('rj45_contact_gold', { color: 0xd9a92c, roughness: 0.25, metalness: 1.0 });
  const pairMats = [0xff7a1a, 0xffffff, 0x1f9a3a, 0x2c62d9, 0x7a4a1e, 0xffffff, 0x1f9a3a, 0xffffff].map((c, i) => M('rj45_pair_' + i, { color: c, roughness: 0.6, metalness: 0 }));
  const FAULT_INDEX = 2;
  const buildUnseatedPlug = (p) => {
    // Plug body axes: x = width, y = height, nose toward the port (-z), boot/cable out the back (+z).
    const PW = 0.0100, PH = 0.0068, PL = 0.0165, GAP = 0.008, BOOT = 0.0090;
    const plug = new THREE.Group(); plug.name = 'rj45_plug_unseated';
    plug.position.set(p.x, p.y - 0.0015, p.z + GAP + PL / 2);
    plug.rotation.set(0.30, 0.14, 0.05); // rear sags, nose lifts: it's hanging off the cable, not seated
    const part = (geo, mat, x, y, z, name) => { const m = new THREE.Mesh(geo, mat); m.name = name + '_' + ctx.nextId(); m.position.set(x, y, z); m.userData.cableRoute = true; plug.add(m); return m; };
    part(new THREE.BoxGeometry(PW, PH, PL), plugMat, 0, 0, 0, 'rj45_housing');
    part(new THREE.BoxGeometry(PW * 0.5, 0.0022, PL * 0.45), plugMat, 0, PH / 2 + 0.0011, -PL * 0.12, 'rj45_latch'); // latch tab on top
    part(new THREE.BoxGeometry(0.0020, 0.0036, 0.0034), plugMat, 0, PH / 2 + 0.0028, PL * 0.28, 'rj45_latch_tail');
    for (let i = 0; i < 8; i++) {
      const x = -PW / 2 + 0.0015 + i * ((PW - 0.003) / 7);
      part(new THREE.BoxGeometry(0.0005, 0.0030, 0.0038), contactMat, x, -PH / 2 + 0.0019, -PL / 2 + 0.0022, 'rj45_contact'); // gold fingers at the nose
      part(new THREE.CylinderGeometry(0.0005, 0.0005, PL * 0.62, 5), pairMats[i], x, 0.0002, PL * 0.05, 'rj45_pair').rotation.x = Math.PI / 2; // conductor visible through the housing
    }
    const boot = part(new THREE.CylinderGeometry(0.0032, 0.0042, BOOT, 8), faultMat, 0, 0, PL / 2 + BOOT / 2, 'rj45_boot'); boot.rotation.x = Math.PI / 2;
    g.add(plug); plug.updateMatrix();
    const rear = new THREE.Vector3(0, 0, PL / 2 + BOOT).applyMatrix4(plug.matrix);       // where the cable leaves the boot
    const axis = new THREE.Vector3(0, 0, 1).transformDirection(plug.matrix);              // plug's rearward direction
    return { plug, rear, axis };
  };
  const frontPatch = (sw, pp, cmY, mat, count, step, faultAt = -1) => {
    for (let i = 0; i < count; i++) {
      const p = sw.ports[i * step], q = pp.pts[i * 2];
      const route = [[(p.x + q.x) / 2, cmY + 0.003, p.z + 0.05], [q.x, pp.yc + 0.012, p.z + 0.03], [q.x, q.y, q.z]];
      if (i !== faultAt) { tube('patch_cable', mat, [[p.x, p.y, p.z], [p.x, p.y + 0.004, p.z + 0.045], ...route], 0.003); continue; }
      const { plug, rear, axis } = buildUnseatedPlug(p);
      const lead = rear.clone().addScaledVector(axis, 0.015);
      // Own tube (not ctx.tube) so no second boot gets stamped at the cable start — the plug already carries one.
      const curve = new THREE.CatmullRomCurve3([rear, lead, new THREE.Vector3(p.x + 0.006, p.y - 0.004, p.z + 0.07), ...route.map((r) => new THREE.Vector3(...r))]);
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.003, 6, false), faultMat); m.name = 'patch_cable_disconnected_' + ctx.nextId(); m.userData.cableRoute = true; g.add(m);
      g.userData.faultCable = { mesh: m, material: faultMat, plug, plugMaterial: plugMat, port: { x: p.x, y: p.y, z: p.z } };
    }
  };
  frontPatch(swA, ppA, cmA, mats.cableBlue, 6, 4, FAULT_INDEX);
  frontPatch(swB, ppB, cmB, mats.cableBlack, 4, 2);
  for (let i = 0; i < 2; i++) {
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
  servers.filter((s, i) => i % 2 === 0).slice(0, 4).forEach((s, i) => {
    const [nx, ny, nz] = s.rear.nic;
    tube('network_drop_cable', mats.cableBlue, [[-0.1 + i * 0.006, TOP + 0.035, -0.32], [-0.20, TOP - 0.05, -0.34], [-0.245 + i * 0.001, ny + 0.08, -0.33], [-0.2, ny + 0.01, nz - 0.03], [nx, ny, nz]], 0.003);
  });
  for (let k = 0; k < 3; k++) box('velcro_strap', mats.velcro, 0.028, 0.012, 0.028, -0.245, 0.5 + k * 0.5, -0.33).userData.cableRoute = true;
  for (let k = 0; k < 4; k++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0025, 6, 12), mats.bezelPlastic);
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
