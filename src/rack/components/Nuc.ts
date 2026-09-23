// @ts-nocheck
/* eslint-disable */
// NUC shelf (3U): a black steel rack tray carrying eight Intel-NUC-class mini PCs standing on edge in a row,
// each with a blue patch lead looping out of its rear, up and over the tray's back wall — modelled on the
// common multi-NUC rack-shelf kit. One explodable item; the mini PCs ride with the tray. Materials are
// created lazily on first use and cached on `ctx.mats` for the life of this rack.

const NUC_COUNT = 8, NUC_W = 0.038, NUC_H = 0.112, NUC_D = 0.117, PITCH = 0.05;

function ensureNucMaterials(ctx) {
  const { mats, tex, M, T } = ctx;
  if (mats.nucBody) return;
  // front panel seen with the unit on its side: power button + blue ring at the top, 2x USB-A, 3.5 mm jack,
  // status LED, vent slots at the foot
  const face = tex('nuc_face_vertical', 64, 192, (c, w, h) => {
    c.fillStyle = '#22252a'; c.fillRect(0, 0, w, h);
    const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#3a3e45'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, w - 3, h - 3);
    c.beginPath(); c.arc(w / 2, h * 0.1, w * 0.2, 0, 7); c.fillStyle = '#15171b'; c.fill();
    c.strokeStyle = '#2f8dff'; c.shadowColor = '#2f8dff'; c.shadowBlur = 6; c.lineWidth = 2.5; c.beginPath(); c.arc(w / 2, h * 0.1, w * 0.12, 0.35 * Math.PI, 2.65 * Math.PI); c.stroke(); c.beginPath(); c.moveTo(w / 2, h * 0.055); c.lineTo(w / 2, h * 0.1); c.stroke(); c.shadowBlur = 0;
    for (const fy of [0.3, 0.42]) { c.fillStyle = '#8d9197'; c.beginPath(); c.roundRect(w * 0.22, h * fy, w * 0.56, h * 0.045, 2); c.fill(); c.fillStyle = '#0a0b0c'; c.fillRect(w * 0.28, h * fy + h * 0.012, w * 0.44, h * 0.02); }
    c.beginPath(); c.arc(w / 2, h * 0.56, w * 0.09, 0, 7); c.fillStyle = '#0a0b0c'; c.fill();
    c.fillStyle = '#3dff6e'; c.shadowColor = '#3dff6e'; c.shadowBlur = 4; c.fillRect(w * 0.42, h * 0.64, w * 0.16, h * 0.012); c.shadowBlur = 0;
    c.fillStyle = '#0d0e10'; for (let i = 0; i < 6; i++) c.fillRect(w * 0.2, h * 0.74 + i * h * 0.035, w * 0.6, h * 0.014);
  });
  mats.nucBody = M('nuc_chassis', { color: 0x2b2e34, roughness: 0.42, metalness: 0.65, map: T.brushed });
  mats.nucFace = M('nuc_face', { map: face, roughness: 0.45, metalness: 0.3 });
  mats.nucLid = M('nuc_lid', { color: 0x4a4f57, roughness: 0.5, metalness: 0.5 });
}

export function buildNuc(ctx, n) {
  ensureNucMaterials(ctx);
  const { THREE, box, plane, cyl, ears, beginItem, endItem, explodeDY, explodeDZ, mats, ledMat, yb, U, CW, ZF } = ctx;
  const u = 3, yc = yb(n) + u * U / 2, floorY = yb(n) + 0.004;
  const grp = beginItem('nuc', n);
  ears(n, u, mats.graphite);
  // tray: base plate, tall back wall the leads hook over, low front lip
  const trayD = 0.26, trayFront = ZF - 0.02, trayRear = trayFront - trayD;
  box('nuc_shelf', mats.steel, CW - 0.03, 0.005, trayD, 0, floorY, trayFront - trayD / 2);
  box('nuc_shelf_back_wall', mats.steel, CW - 0.03, 0.125, 0.006, 0, floorY + 0.0625, trayRear + 0.003);
  box('nuc_shelf_front_lip', mats.steel, CW - 0.03, 0.012, 0.004, 0, floorY + 0.006, trayFront - 0.002);
  // eight units on edge, evenly pitched across the tray, front panels facing out
  const nucZ = ZF - 0.03 - NUC_D / 2, nucY = floorY + 0.0025 + NUC_H / 2, x0 = -((NUC_COUNT - 1) * PITCH) / 2;
  for (let i = 0; i < NUC_COUNT; i++) {
    const x = x0 + i * PITCH;
    box('nuc_body', mats.nucBody, NUC_W, NUC_H, NUC_D, x, nucY, nucZ);
    box('nuc_lid', mats.nucLid, NUC_W + 0.002, 0.004, NUC_D + 0.002, x, nucY + NUC_H / 2 + 0.002, nucZ);
    plane('nuc_face', mats.nucFace, NUC_W - 0.004, NUC_H - 0.006, x, nucY, nucZ + NUC_D / 2 + 0.0005);
    const l = cyl('activity_led', ledMat(0x2f8dff, 'heartbeat'), 0.0008, 0.001, x, nucY + NUC_H * 0.4, nucZ + NUC_D / 2 + 0.0012, 'z', ctx.curG, 8); l.userData.phase = n + i * 1.3;
    // blue patch lead: out of the rear-top port, arcing up and over the back wall (kept under the 3U ceiling)
    const yTop = nucY + NUC_H / 2, zRear = nucZ - NUC_D / 2;
    const pts = [[x, yTop - 0.02, zRear], [x, yTop + 0.012, zRear - 0.03], [x + 0.006, floorY + 0.122, trayRear + 0.012], [x + 0.008, floorY + 0.06, trayRear - 0.012]].map(p => new THREE.Vector3(...p));
    const lead = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.0028, 8, false), mats.cableBlue);
    lead.name = 'nuc_patch_lead_' + ctx.nextId(); ctx.curG.add(lead);
  }
  endItem(grp, 'nuc', 'U' + n + '-' + (n + u - 1), 0, explodeDY(yc), explodeDZ(n));
}
