// @ts-nocheck
/* eslint-disable */
// Blanking panel: a plain perforated 1U (or taller) filler plate for unused rack slots.

export function buildBlankPanel(ctx, n, u) {
  const { box, cyl, grillMesh, beginItem, endItem, explodeDY, explodeDZ, mats, yb, U, ZF } = ctx;
  const h = u * U - 0.003, yc = yb(n) + u * U / 2;
  const grp = beginItem('blank', n);
  box('blanking_panel', mats.steel, 0.48, h, 0.003, 0, yc, ZF + 0.0035);
  grillMesh(0.42, h - 0.012, 0, yc, ZF + 0.0052, mats.grillSolid);
  for (const sx of [-1, 1]) for (const f of [0.25, 0.75]) cyl('blank_screw', mats.screw, 0.0045, 0.002, sx * 0.235, yb(n) + f * u * U, ZF + 0.006, 'z', ctx.curG, 12);
  endItem(grp, 'blank', 'U' + n, 0, explodeDY(yc), explodeDZ(n));
}
