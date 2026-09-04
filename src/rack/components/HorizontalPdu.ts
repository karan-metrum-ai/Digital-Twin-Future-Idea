// @ts-nocheck
/* eslint-disable */
// 1U horizontal rack PDU: 8x C13 outlets, a circuit breaker switch, and an LCD load display.

export function buildHorizontalPdu(ctx, n) {
  const { box, chassis, ears, beginItem, endItem, explodeDY, explodeDZ, mats, ZF } = ctx;
  const grp = beginItem('hpdu', n);
  const c = chassis(n, 1, 0.09, mats.graphite); ears(n, 1, mats.graphite);
  const zf = ZF + 0.002;
  for (let i = 0; i < 8; i++) {
    const x = -0.17 + i * 0.035;
    box('c13_outlet', mats.dark, 0.026, 0.02, 0.004, x, c.yc, zf);
    for (const [ox, oy, w, h] of [[-0.006, 0.002, 0.003, 0.006], [0.006, 0.002, 0.003, 0.006], [0, -0.004, 0.003, 0.005]]) {
      box('outlet_pin', mats.graphite, w, h, 0.001, x + ox, c.yc + oy, zf + 0.0025);
    }
  }
  box('circuit_breaker', mats.dark, 0.03, 0.02, 0.006, 0.145, c.yc, zf);
  box('breaker_switch', mats.cableBlue, 0.008, 0.012, 0.004, 0.145, c.yc, zf + 0.005);
  box('pdu_display', mats.lcd, 0.03, 0.014, 0.002, 0.195, c.yc, zf);
  endItem(grp, 'hpdu', 'U' + n, 0, explodeDY(c.yc), explodeDZ(n));
}
