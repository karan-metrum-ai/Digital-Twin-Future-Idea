// @ts-nocheck
/* eslint-disable */
// 1U network switch (24 or 48 port), with a procedurally-textured RJ45 faceplate and rear I/O plate.
// Returns front-port world coordinates + SFP+ cage X for the cabling pass to route patch/fiber cables from.

export function buildNetworkSwitch(ctx, n, ports) {
  const { chassis, ears, plane, rearFace, beginItem, endItem, explodeDY, explodeDZ, mats, CW, U, ZF } = ctx;
  const grp = beginItem('switch', n);
  const c = chassis(n, 1, 0.46, mats.graphite); ears(n, 1, mats.graphite);
  plane('switch_faceplate', ports === 48 ? mats.switch48 : mats.switch24, CW, U - 0.004, 0, c.yc, ZF + 0.0015);
  rearFace(n, 1, c.zr);
  const cols = ports / 2, portsOut = [];
  for (let i = 0; i < cols; i++) portsOut.push({ x: -0.2185 + 0.024 + i * 0.0125 + 0.00625, y: c.yc + U / 2 - 0.0113, z: ZF + 0.003 });
  endItem(grp, 'switch', ports + 'P-U' + n, 0, explodeDY(c.yc), explodeDZ(n));
  return { yc: c.yc, ports: portsOut, sfpX: -0.2185 + 0.024 + cols * 0.0125 + 0.012 + 0.009 };
}
