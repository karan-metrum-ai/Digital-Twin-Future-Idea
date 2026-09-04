// @ts-nocheck
/* eslint-disable */
// NUC (shelf-mounted mini PC accessory): a perforated 1U rack shelf carrying a small mini-PC with a glowing
// power ring, two WiFi antenna stubs, an activity LED and a power brick. Its face texture + chassis materials
// are created lazily on first use and cached on `ctx.mats` for the life of this rack.

function ensureNucMaterials(ctx) {
  const { mats, tex, M, T } = ctx;
  if (mats.nuc) return;
  const nucFace = tex('nuc_face', 128, 128, (ctx2, w, h) => {
    ctx2.fillStyle = '#1c1d20'; ctx2.fillRect(0, 0, w, h);
    const gr = ctx2.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0.32)'); ctx2.fillStyle = gr; ctx2.fillRect(0, 0, w, h);
    ctx2.beginPath(); ctx2.arc(w / 2, h * 0.4, w * 0.16, 0, 7); ctx2.fillStyle = '#2a2d32'; ctx2.fill();
    ctx2.strokeStyle = '#2f8dff'; ctx2.shadowColor = '#2f8dff'; ctx2.shadowBlur = 6; ctx2.lineWidth = 3; ctx2.beginPath(); ctx2.arc(w / 2, h * 0.4, w * 0.1, 0, 6.1); ctx2.stroke(); ctx2.shadowBlur = 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 9; j++) { ctx2.fillStyle = '#0a0b0c'; ctx2.fillRect(w * 0.14 + i * w * 0.1, h * 0.64 + j * 3, w * 0.06, 2); }
    ctx2.fillStyle = '#8a8d92'; ctx2.font = 'bold 11px Arial'; ctx2.textAlign = 'center'; ctx2.fillText('NUC', w / 2, h * 0.95);
  });
  mats.nuc = M('nuc_chassis', { color: 0xc4c8cd, roughness: 0.35, metalness: 0.6, map: T.brushed });
  mats.nucFace = M('nuc_face', { map: nucFace, roughness: 0.4, metalness: 0.3 });
}

export function buildNuc(ctx, n) {
  ensureNucMaterials(ctx);
  const { box, plane, cyl, ears, beginItem, endItem, explodeDY, explodeDZ, mats, ledMat, yb, U, CW, ZF } = ctx;
  const yc = yb(n) + U / 2, floorY = yc - U / 2 + 0.004;
  const grp = beginItem('nuc', n);
  ears(n, 1, mats.graphite);
  box('nuc_shelf', mats.steel, CW - 0.03, 0.005, 0.26, 0, floorY, ZF - 0.15);
  ctx.grillMesh(CW - 0.09, 0.15, 0, floorY + 0.003, ZF - 0.15, mats.grillSolid);
  const bw = 0.115, bd = 0.115, bh = 0.028, bz = ZF - 0.02 - bd / 2, by = floorY + 0.0025 + bh / 2;
  box('nuc_body', mats.nuc, bw, bh, bd, 0, by, bz);
  plane('nuc_face', mats.nucFace, bw - 0.008, bh - 0.004, 0, by, bz + bd / 2 + 0.0005);
  for (const ax of [-1, 1]) cyl('nuc_antenna', mats.dark, 0.0025, 0.045, ax * bw * 0.32, by + bh / 2 + 0.0225, bz, 'y', ctx.curG, 10);
  const l = cyl('activity_led', ledMat(0x2f8dff), 0.001, 0.001, 0, by, bz + bd / 2 + 0.0012, 'z', ctx.curG, 8); l.userData.phase = n;
  box('nuc_power_brick', mats.dark, 0.05, 0.018, 0.028, 0.15, floorY + 0.011, ZF - 0.26);
  endItem(grp, 'nuc', 'U' + n, 0, explodeDY(yc), explodeDZ(n));
}
