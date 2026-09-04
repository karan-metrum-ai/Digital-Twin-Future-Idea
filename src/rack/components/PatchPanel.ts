// @ts-nocheck
/* eslint-disable */
// 1U 24-port copper patch panel. Returns its RJ45 world coordinates for the cabling pass.

export function buildPatchPanel(ctx, n) {
  const { box, plane, ears, beginItem, endItem, explodeDY, explodeDZ, mats, yb, U, CW, ZF } = ctx;
  const yc = yb(n) + U / 2;
  const grp = beginItem('patch', n);
  ears(n, 1, mats.graphite);
  box('patch_panel_body', mats.graphite, CW, U - 0.004, 0.025, 0, yc, ZF - 0.0125);
  plane('patch_faceplate', mats.patch, CW, U - 0.004, 0, yc, ZF + 0.0015);
  box('patch_cable_bar', mats.graphite, 0.4, 0.008, 0.06, 0, yc - 0.024, ZF - 0.04);
  const pts = [];
  for (let i = 0; i < 24; i++) pts.push({ x: -0.2185 + 0.0125 + i * 0.0172 + 0.0075, y: yc + U / 2 - 0.021, z: ZF + 0.003 });
  endItem(grp, 'patch', 'U' + n, 0, explodeDY(yc), explodeDZ(n));
  return { yc, pts };
}
