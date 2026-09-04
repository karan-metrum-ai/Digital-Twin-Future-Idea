// @ts-nocheck
/* eslint-disable */
// 1U horizontal cable manager: a finger bar with five routing rings mounted below the front rail.

export function buildCableManager(ctx, n) {
  const { THREE, box, ears, beginItem, endItem, explodeDY, explodeDZ, mats, yb, U, CW, ZF } = ctx;
  const yc = yb(n) + U / 2;
  const grp = beginItem('cablemgr', n);
  ears(n, 1, mats.graphite);
  box('cable_manager_bar', mats.graphite, CW, 0.012, 0.03, 0, yc - 0.015, ZF + 0.01);
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.003, 10, 28), mats.bezelPlastic);
    ring.name = 'cable_ring_' + ctx.nextId();
    ring.position.set(-0.16 + i * 0.08, yc + 0.003, ZF + 0.03);
    ring.rotation.y = Math.PI / 2;
    ctx.curG.add(ring);
  }
  endItem(grp, 'cablemgr', 'U' + n, 0, explodeDY(yc), explodeDZ(n));
  return yc;
}
