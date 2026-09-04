// @ts-nocheck
/* eslint-disable */
// Direct-to-chip liquid cooling hardware, modelled on the reference photos of a real DLC row:
//   • overhead stainless supply + return headers running the length of the rack row, hung off unistrut from the
//     ceiling ladder, with a valved (blue = supply, red = return) drop pipe into the top of every rack;
//   • a rack-sized CDU (coolant distribution unit) standing at the end of the row, headers terminating into its
//     top, facility (primary) water dropping out of its back into the raised floor;
//   • inside our rack: two black-anodised rack manifolds mounted at the sides of the rear opening (supply left,
//     return right), fed from the drops by a pair of large black EPDM hoses with stainless couplings coming in
//     over the top; every server gets two black flexible hoses with stainless quick-disconnects, colour-coded by
//     a blue/red collar at the manifold end, looped with realistic slack.
// Coolant flow is visualised as soft particles — cool blue leaving the CDU along the supply header, down the
// drop and manifold and into each branch; warm orange-red coming back up the return side to the CDU. Particle
// speed follows the simulated flow rate, return brightness follows ΔT.
//
// Kept outside the exploded-view item system (it is the infrastructure the items plug into); the branch hoses
// hide as the stack pulls apart, the same way the cabling does.

const SUP_X = -0.205, RET_X = 0.205, MAN_Z = -0.48;             // rack manifolds (rear opening, either side)
const SUP_HDR_Y = 2.32, RET_HDR_Y = 2.50, SUP_HDR_Z = -0.38, RET_HDR_Z = -0.52; // overhead headers
const HDR_X0 = -4.95;                                            // far end of the row
const CDU_X = 3.0, CDU_W = 0.6, CDU_H = 2.0, CDU_D = 1.07;        // end-of-row CDU cabinet
const ROW_RACKS = [0, -2.25, -3.0, -3.75, -4.5];                 // our rack + the ghost racks in the same row

export function buildLiquidLoop(THREE, slots, TOP = 0.13 + 42 * 0.04445) {
  const g = new THREE.Group(); g.name = 'liquid_loop'; g.visible = false;
  const M = (o) => new THREE.MeshStandardMaterial(o);
  const mats = {
    stainless: M({ color: 0xc9cdd2, roughness: 0.28, metalness: 0.95 }),
    stainlessDull: M({ color: 0x9da2a8, roughness: 0.45, metalness: 0.9 }),
    strut: M({ color: 0x8c9096, roughness: 0.6, metalness: 0.7 }),
    hose: M({ color: 0x141517, roughness: 0.92, metalness: 0.04 }),
    hoseBig: M({ color: 0x1a1b1e, roughness: 0.85, metalness: 0.05 }),
    manifold: M({ color: 0x1f2126, roughness: 0.5, metalness: 0.6 }),
    blue: M({ color: 0x1f5fd0, roughness: 0.5, metalness: 0.3 }),
    red: M({ color: 0xc3322b, roughness: 0.5, metalness: 0.3 }),
    yellow: M({ color: 0xe0b021, roughness: 0.6, metalness: 0.2 }),
    cabinet: M({ color: 0x1d1e22, roughness: 0.55, metalness: 0.45 }),
    cabinetTrim: M({ color: 0x2c2e34, roughness: 0.5, metalness: 0.5 }),
    louvre: M({ color: 0x0e0f12, roughness: 0.8, metalness: 0.3 }),
    insulation: M({ color: 0x3a3c42, roughness: 0.95, metalness: 0.0 }),
  };
  const box = (name, mat, w, h, d, x, y, z, parent = g) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.name = name; m.position.set(x, y, z); parent.add(m); return m; };
  const cyl = (name, mat, r, h, x, y, z, axis, parent = g, seg = 20) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); m.name = name; m.position.set(x, y, z); if (axis === 'z') m.rotation.x = Math.PI / 2; if (axis === 'x') m.rotation.z = Math.PI / 2; parent.add(m); return m; };
  const tube = (name, mat, pts, r, parent = g, seg = 64, tension = 0.5) => { const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal', tension); const m = new THREE.Mesh(new THREE.TubeGeometry(curve, seg, r, 14, false), mat); m.name = name; parent.add(m); return m; };
  const torus = (name, mat, r, tr, x, y, z, axis, parent = g) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, tr, 10, 28), mat); m.name = name; m.position.set(x, y, z); if (axis === 'y') m.rotation.x = Math.PI / 2; if (axis === 'x') m.rotation.y = Math.PI / 2; parent.add(m); return m; };
  const flowPaths = [];

  /* ---------------- overhead headers + support frame ---------------- */
  const hdrX1 = CDU_X - 0.05;
  const HR = 0.048;
  for (const [y, z, mat, name] of [[SUP_HDR_Y, SUP_HDR_Z, mats.stainless, 'supply_header'], [RET_HDR_Y, RET_HDR_Z, mats.stainless, 'return_header']]) {
    cyl(name, mat, HR, hdrX1 - HDR_X0, (HDR_X0 + hdrX1) / 2, y, z, 'x', g, 28);
    cyl(name + '_end_cap', mats.stainlessDull, HR + 0.006, 0.02, HDR_X0, y, z, 'x', g, 28);
    for (let x = HDR_X0 + 0.9; x < hdrX1; x += 1.8) torus(name + '_flange', mats.stainlessDull, HR + 0.002, 0.012, x, y, z, 'x'); // weld/flange couplings
    // elbow down into the CDU top
    tube(name + '_cdu_elbow', mat, [[hdrX1 - 0.02, y, z], [hdrX1 + 0.08, y, z], [hdrX1 + 0.10, y - 0.06, z], [hdrX1 + 0.10, CDU_H + 0.02, z]], HR, g, 32);
  }
  // unistrut trapeze hangers off the ceiling ladder (which sits at y 2.75, z -0.35 in Environment.ts)
  for (let x = HDR_X0 + 0.45; x < hdrX1; x += 1.5) {
    for (const z of [SUP_HDR_Z - 0.13, RET_HDR_Z + 0.13]) box('header_hanger_rod', mats.strut, 0.014, 0.55, 0.014, x, 2.75 - 0.275, z);
    box('header_trapeze', mats.strut, 0.04, 0.03, RET_HDR_Z - SUP_HDR_Z + 0.34, x, 2.22, (SUP_HDR_Z + RET_HDR_Z) / 2);
    for (const [y, z] of [[SUP_HDR_Y, SUP_HDR_Z], [RET_HDR_Y, RET_HDR_Z]]) torus('pipe_clamp', mats.strut, HR + 0.006, 0.006, x, y, z, 'x');
  }

  /* ---------------- valved drop pipes into every rack in the row ---------------- */
  const DR = 0.018; // drop pipe radius
  const dropTopY = TOP + 0.03; // just above the rack top panel
  const dropX = (rx, side) => rx + side * 0.10; // supply drop left of centre, return right
  for (const rx of ROW_RACKS) {
    for (const [side, hdrY, hdrZ, colMat, name] of [[-1, SUP_HDR_Y, SUP_HDR_Z, mats.blue, 'supply_drop'], [1, RET_HDR_Y, RET_HDR_Z, mats.red, 'return_drop']]) {
      const x = dropX(rx, side);
      cyl(name + '_tee', mats.stainlessDull, HR * 0.55, 0.06, x, hdrY - HR - 0.01, hdrZ, 'y', g, 20);
      cyl(name, mats.stainless, DR, hdrY - dropTopY, x, (hdrY + dropTopY) / 2, hdrZ, 'y', g, 18);
      // ball valve with colour-coded lever handle + tag
      const vy = hdrY - 0.16;
      cyl(name + '_valve_body', mats.stainlessDull, DR * 1.7, 0.06, x, vy, hdrZ, 'y', g, 16);
      cyl(name + '_valve_stem', mats.stainlessDull, 0.005, 0.03, x + DR * 1.7 + 0.01, vy, hdrZ, 'x', g, 8);
      box(name + '_valve_handle', colMat, 0.012, 0.014, 0.075, x + DR * 1.7 + 0.03, vy, hdrZ - 0.02);
      box(name + '_tag', mats.yellow, 0.002, 0.03, 0.045, x - DR - 0.004, vy - 0.06, hdrZ);
      // union coupling where the drop meets the rack's hose
      cyl(name + '_union', mats.stainlessDull, DR * 1.5, 0.035, x, dropTopY + 0.02, hdrZ, 'y', g, 16);
      torus(name + '_union_ring', colMat, DR * 1.5 + 0.002, 0.004, x, dropTopY + 0.045, hdrZ, 'y');
    }
  }

  /* ---------------- our rack: manifolds + top feed hoses ---------------- */
  const manTop = TOP - 0.07, manBot = 0.24;
  for (const [x, colMat, name] of [[SUP_X, mats.blue, 'supply_manifold'], [RET_X, mats.red, 'return_manifold']]) {
    box(name, mats.manifold, 0.042, manTop - manBot, 0.052, x, (manTop + manBot) / 2, MAN_Z);
    box(name + '_id_band', colMat, 0.044, 0.05, 0.054, x, manTop - 0.06, MAN_Z);
    box(name + '_id_band', colMat, 0.044, 0.03, 0.054, x, manBot + 0.05, MAN_Z);
    cyl(name + '_top_port', mats.stainless, 0.02, 0.05, x, manTop + 0.025, MAN_Z, 'y', g, 16);
    cyl(name + '_top_coupling', mats.stainlessDull, 0.028, 0.04, x, manTop + 0.06, MAN_Z, 'y', g, 16);
    cyl(name + '_drain', mats.stainlessDull, 0.008, 0.03, x, manBot - 0.015, MAN_Z, 'y', g, 10);
    for (const y of [0.5, 1.1, 1.7]) { box(name + '_bracket', mats.strut, 0.06, 0.02, 0.01, x + (x < 0 ? -0.02 : 0.02), y, MAN_Z - 0.031); }
    // pressure/temperature sensor pocket
    cyl(name + '_sensor', mats.stainlessDull, 0.007, 0.03, x, manTop - 0.16, MAN_Z + 0.035, 'z', g, 10);
  }
  // big black feed hoses from the drop unions over the top of the rack down onto the manifold couplings
  const supFeed = [[dropX(0, -1), dropTopY + 0.06, SUP_HDR_Z], [dropX(0, -1) - 0.02, dropTopY + 0.16, SUP_HDR_Z - 0.06], [SUP_X - 0.03, TOP + 0.12, MAN_Z - 0.10], [SUP_X, manTop + 0.09, MAN_Z]];
  const retFeed = [[RET_X, manTop + 0.09, MAN_Z], [RET_X + 0.03, TOP + 0.13, MAN_Z - 0.10], [dropX(0, 1) + 0.02, dropTopY + 0.17, RET_HDR_Z - 0.05], [dropX(0, 1), dropTopY + 0.06, RET_HDR_Z]];
  tube('supply_feed_hose', mats.hoseBig, supFeed, 0.022, g, 40);
  tube('return_feed_hose', mats.hoseBig, retFeed, 0.022, g, 40);
  for (const p of [supFeed[0], supFeed[3], retFeed[0], retFeed[3]]) cyl('feed_hose_ferrule', mats.stainless, 0.026, 0.05, p[0], p[1], p[2], 'y', g, 16);
  flowPaths.push(
    { pts: [[hdrX1 + 0.10, CDU_H + 0.02, SUP_HDR_Z], [hdrX1 + 0.08, SUP_HDR_Y, SUP_HDR_Z], [HDR_X0 + 0.02, SUP_HDR_Y, SUP_HDR_Z]], kind: 0, weight: 4 },
    { pts: [[dropX(0, -1), SUP_HDR_Y, SUP_HDR_Z], [dropX(0, -1), dropTopY + 0.06, SUP_HDR_Z], ...supFeed.slice(1), [SUP_X, manTop, MAN_Z], [SUP_X, manBot, MAN_Z]], kind: 0, weight: 3 },
    { pts: [[RET_X, manBot, MAN_Z], [RET_X, manTop, MAN_Z], ...retFeed, [dropX(0, 1), RET_HDR_Y, RET_HDR_Z]], kind: 1, weight: 3 },
    { pts: [[HDR_X0 + 0.02, RET_HDR_Y, RET_HDR_Z], [hdrX1 + 0.08, RET_HDR_Y, RET_HDR_Z], [hdrX1 + 0.10, CDU_H + 0.02, RET_HDR_Z]], kind: 1, weight: 4 },
  );

  /* ---------------- per-server branch hoses with quick-disconnects ---------------- */
  const hoses = new THREE.Group(); hoses.name = 'branch_hoses'; g.add(hoses);
  slots.forEach((s, i) => {
    const y = s.y, zr = s.zr - 0.014, slackZ = -0.06 - (i % 4) * 0.012, dip = -0.03 - (i % 3) * 0.012;
    for (const [side, colMat] of [[-1, mats.blue], [1, mats.red]]) {
      const mx = side < 0 ? SUP_X : RET_X, portX = mx - side * 0.026, srvX = side * 0.07;
      // hose: leaves the manifold port sideways, loops back/down with slack, comes into the server rear
      const pts = [[portX, y, MAN_Z], [portX - side * 0.05, y + dip * 0.6, MAN_Z + slackZ], [(portX + srvX) / 2, y + dip, MAN_Z + slackZ * 0.5], [srvX, y + dip * 0.15, zr - 0.05], [srvX, y, zr]];
      tube('branch_hose', mats.hose, pts, 0.0065, hoses, 28, 0.35);
      // manifold quick-disconnect: stainless body + colour collar, on a short spigot
      cyl('manifold_spigot', mats.stainlessDull, 0.007, 0.02, mx - side * 0.02, y, MAN_Z, 'x', hoses, 10);
      cyl('manifold_qd', mats.stainless, 0.0105, 0.03, portX, y, MAN_Z, 'x', hoses, 14);
      cyl('qd_collar', colMat, 0.0115, 0.009, portX - side * 0.012, y, MAN_Z, 'x', hoses, 14);
      // server-side quick-disconnect
      cyl('server_qd', mats.stainless, 0.0095, 0.03, srvX, y, zr - 0.006, 'z', hoses, 12);
      cyl('server_qd_collar', mats.stainlessDull, 0.0112, 0.008, srvX, y, zr - 0.02, 'z', hoses, 12);
      flowPaths.push({ pts: side < 0 ? pts : pts.slice().reverse(), kind: side < 0 ? 0 : 1, weight: 1 });
    }
  });

  /* ---------------- end-of-row CDU cabinet ---------------- */
  const cdu = new THREE.Group(); cdu.name = 'cdu_cabinet'; g.add(cdu);
  box('cdu_body', mats.cabinet, CDU_W, CDU_H, CDU_D, CDU_X, CDU_H / 2, 0, cdu);
  box('cdu_top_cap', mats.cabinetTrim, CDU_W + 0.01, 0.02, CDU_D + 0.01, CDU_X, CDU_H + 0.01, 0, cdu);
  box('cdu_plinth', mats.louvre, CDU_W - 0.02, 0.06, CDU_D - 0.02, CDU_X, 0.03, 0, cdu);
  const fz = CDU_D / 2 + 0.001;
  box('cdu_front_door', mats.cabinetTrim, CDU_W - 0.03, CDU_H - 0.12, 0.006, CDU_X, CDU_H / 2 + 0.02, fz, cdu);
  for (let k = 0; k < 22; k++) box('cdu_louvre', mats.louvre, CDU_W - 0.10, 0.010, 0.004, CDU_X, 0.20 + k * 0.03, fz + 0.005, cdu);
  const disp = makeDisplay(THREE); disp.mesh.position.set(CDU_X, CDU_H - 0.32, fz + 0.006); cdu.add(disp.mesh);
  box('cdu_display_bezel', mats.louvre, 0.30, 0.15, 0.004, CDU_X, CDU_H - 0.32, fz + 0.004, cdu);
  const ledOk = M({ color: 0x1ea85e, emissive: 0x1ea85e, emissiveIntensity: 2.2 });
  const ledPump = M({ color: 0x3b8fe8, emissive: 0x3b8fe8, emissiveIntensity: 2.0 });
  const ledWarn = M({ color: 0xf0a020, emissive: 0xf0a020, emissiveIntensity: 0.4 });
  for (const [dx, mat] of [[-0.09, ledOk], [-0.03, ledPump], [0.03, ledPump], [0.09, ledWarn]]) cyl('cdu_status_led', mat, 0.005, 0.003, CDU_X + dx, CDU_H - 0.46, fz + 0.008, 'z', cdu, 10);
  box('cdu_handle', mats.stainlessDull, 0.014, 0.22, 0.014, CDU_X + CDU_W / 2 - 0.05, CDU_H / 2 - 0.1, fz + 0.012, cdu);
  // top connections: header elbows land on two stub flanges
  for (const z of [SUP_HDR_Z, RET_HDR_Z]) cyl('cdu_top_flange', mats.stainlessDull, HR + 0.012, 0.02, hdrX1 + 0.10, CDU_H + 0.03, z, 'y', cdu, 24);
  // facility (primary) water tie-in: two insulated pipes out of the rear-bottom into the raised floor
  for (const [x, mat] of [[CDU_X - 0.14, mats.blue], [CDU_X + 0.14, mats.red]]) {
    tube('facility_pipe', mats.insulation, [[x, 0.30, -CDU_D / 2 + 0.02], [x, 0.30, -CDU_D / 2 - 0.16], [x, 0.0, -CDU_D / 2 - 0.16]], 0.034, cdu, 24);
    torus('facility_id_band', mat, 0.036, 0.005, x, 0.14, -CDU_D / 2 - 0.16, 'y', cdu);
    cyl('facility_flange', mats.stainlessDull, 0.046, 0.012, x, 0.006, -CDU_D / 2 - 0.16, 'y', cdu, 16);
  }
  const badge = makeBadge(THREE); badge.position.set(CDU_X - CDU_W / 2 - 0.001, 1.15, 0); badge.rotation.y = -Math.PI / 2; cdu.add(badge);

  /* ---------------- coolant flow particles ---------------- */
  const paths = flowPaths.map((p) => {
    const v = p.pts.map((q) => new THREE.Vector3(...q)); const seg = []; let len = 0;
    for (let i = 1; i < v.length; i++) { const l = v[i - 1].distanceTo(v[i]); seg.push({ a: v[i - 1], b: v[i], l0: len, l }); len += l; }
    return { ...p, seg, len };
  });
  const totalW = paths.reduce((s, p) => s + p.weight * Math.max(p.len, 0.15), 0);
  const N = 2200;
  const pathId = new Int16Array(N), phase = new Float32Array(N), jit = new Float32Array(N * 2);
  let s = 3; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  { let i = 0; for (let p = 0; p < paths.length && i < N; p++) { const n = Math.max(2, Math.round((N * paths[p].weight * Math.max(paths[p].len, 0.15)) / totalW)); for (let k = 0; k < n && i < N; k++, i++) { pathId[i] = p; phase[i] = rnd(); jit[i * 2] = (rnd() - 0.5) * 0.012; jit[i * 2 + 1] = (rnd() - 0.5) * 0.012; } } for (; i < N; i++) { pathId[i] = 0; phase[i] = rnd(); } }
  const pos = new Float32Array(N * 3), kindAttr = new Float32Array(N);
  for (let i = 0; i < N; i++) kindAttr[i] = paths[pathId[i]].kind;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aKind', new THREE.BufferAttribute(kindAttr, 1));
  const flowMat = new THREE.ShaderMaterial({
    uniforms: { uPixelRatio: { value: 1 }, uWarm: { value: 0.5 }, uFlow: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aKind; uniform float uPixelRatio, uFlow; varying float vKind;
      void main() { vKind = aKind; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = (5.0 + 2.5 * uFlow) * uPixelRatio * 1.6 / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      varying float vKind; uniform float uWarm;
      void main() { float d = length(gl_PointCoord - 0.5); float soft = smoothstep(0.5, 0.08, d);
        vec3 cool = vec3(0.30, 0.65, 1.0); vec3 warm = mix(vec3(1.0, 0.62, 0.30), vec3(1.0, 0.30, 0.12), uWarm);
        gl_FragColor = vec4(mix(cool, warm, vKind), soft * 0.85); }`,
  });
  const pts = new THREE.Points(geo, flowMat); pts.name = 'coolant_flow'; pts.frustumCulled = false; pts.userData.thermalSkip = true; g.add(pts);
  const tmp = new THREE.Vector3();
  const place = (i) => {
    const p = paths[pathId[i]]; const d = phase[i] * p.len; let sg = p.seg[p.seg.length - 1];
    for (const q of p.seg) if (d <= q.l0 + q.l) { sg = q; break; }
    tmp.lerpVectors(sg.a, sg.b, sg.l ? Math.min(1, Math.max(0, (d - sg.l0) / sg.l)) : 0);
    pos[i * 3] = tmp.x + jit[i * 2]; pos[i * 3 + 1] = tmp.y; pos[i * 3 + 2] = tmp.z + jit[i * 2 + 1];
  };
  for (let i = 0; i < N; i++) place(i);

  let lastT = 0, flowLpm = 60, dT = 10, dispAt = -1;
  g.userData.tick = (t, pr) => {
    const dt = Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
    if (!g.visible) return;
    const v = 0.25 + (flowLpm / 60) * 0.40; // m/s along the loop
    for (let i = 0; i < N; i++) { const p = paths[pathId[i]]; phase[i] += (v * dt) / Math.max(p.len, 0.05); if (phase[i] >= 1) phase[i] -= 1; place(i); }
    geo.attributes.position.needsUpdate = true;
    flowMat.uniforms.uPixelRatio.value = pr; flowMat.uniforms.uFlow.value = Math.min(2, flowLpm / 60); flowMat.uniforms.uWarm.value = Math.min(1, Math.max(0, (dT - 6) / 10));
    ledPump.emissiveIntensity = 1.4 + 0.8 * Math.sin(t * 6.0);
    if (t - dispAt > 1) { dispAt = t; disp.draw(g.userData.sample); }
  };
  g.userData.setTelemetry = (sample) => { g.userData.sample = sample; flowLpm = sample.flowLpm; dT = sample.dT; ledWarn.emissiveIntensity = sample.vibMmS > 2.8 ? 2.0 : 0.35; };
  g.userData.setExploded = (t) => { hoses.visible = t < 0.04; };
  return g;
}

/* CDU front-panel display: a small canvas texture redrawn ~1 Hz with the live loop numbers. */
function makeDisplay(THREE) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.29, 0.145), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  mesh.name = 'cdu_display'; mesh.userData.thermalSkip = true;
  const font = (w, px) => `${w} ${px}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  const draw = (sp) => {
    ctx.fillStyle = '#06090f'; ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#7fb3ff'; ctx.font = font(600, 26); ctx.textBaseline = 'top';
    ctx.fillText('CDU-01  ·  SECONDARY LOOP', 22, 18); ctx.fillStyle = '#2a3a55'; ctx.fillRect(22, 54, 468, 2);
    const cell = (x, y, label, val, unit) => { ctx.fillStyle = '#8b97ad'; ctx.font = font(500, 20); ctx.fillText(label, x, y); ctx.fillStyle = '#eef3ff'; ctx.font = font(600, 44); ctx.fillText(val, x, y + 26); const w = ctx.measureText(val).width; ctx.fillStyle = '#8b97ad'; ctx.font = font(500, 20); ctx.fillText(unit, x + w + 8, y + 46); };
    if (sp) { cell(22, 74, 'FLOW', sp.flowLpm.toFixed(1), 'L/min'); cell(270, 74, 'SUPPLY', sp.supplyBar.toFixed(2), 'bar'); cell(22, 160, 'SUPPLY T', sp.supplyC.toFixed(1), '°C'); cell(270, 160, 'ΔT', sp.dT.toFixed(1), 'K'); }
    else { ctx.fillStyle = '#eef3ff'; ctx.font = font(600, 40); ctx.fillText('STANDBY', 22, 110); }
    tex.needsUpdate = true;
  };
  draw(null);
  return { mesh, draw };
}

function makeBadge(THREE) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const ctx = c.getContext('2d');
  ctx.fillStyle = '#15161a'; ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#cfd6e6'; ctx.font = '700 54px "Helvetica Neue", Helvetica, Arial, sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText('CDU · 80 kW', 24, 46);
  ctx.fillStyle = '#6f7a92'; ctx.font = '500 26px "Helvetica Neue", Helvetica, Arial, sans-serif'; ctx.fillText('LIQUID-TO-LIQUID  ·  PG25  ·  N+1 PUMPS', 24, 98);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.2 }));
  m.name = 'cdu_badge'; return m;
}
