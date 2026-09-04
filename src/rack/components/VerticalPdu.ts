// @ts-nocheck
/* eslint-disable */
// Full-height vertical PDU mounted in the rear corner (sx = -1 left, +1 right), with 30 outlet slots tracked
// for the cabling pass to route each server's power cable to the nearest free one.

export function buildVerticalPdu(ctx, sx) {
  const { box, plane, tube, beginItem, endItem, explodePduX, mats } = ctx;
  const x = sx * 0.262, z = -0.44, y0 = 0.30, h = 1.62, yc = y0 + h / 2;
  const grp = beginItem('pdu', sx > 0 ? 'right' : 'left');
  box('vertical_pdu_body', mats.steel, 0.052, h, 0.045, x, yc, z);
  plane('vertical_pdu_face', mats.pdu, 0.045, h, x - sx * 0.0265, yc, z, sx > 0 ? -Math.PI / 2 : Math.PI / 2);
  for (const y of [y0 + 0.05, y0 + h - 0.05]) box('pdu_mount_bracket', mats.steel, 0.03, 0.02, 0.08, sx * 0.275, y, z);
  box('pdu_power_inlet', mats.rubber, 0.012, 0.03, 0.012, x, y0 - 0.02, z);
  const outlets = [];
  for (let k = 0; k < 30; k++) outlets.push({ y: y0 + 0.18 + k * 0.045, used: false });
  tube('pdu_feed_cable', mats.cableBlack, [[x, y0 - 0.03, z], [x, 0.2, z - 0.02], [sx * 0.2, 0.14, -0.5], [0, 0.135, -0.52]], 0.007);
  endItem(grp, 'pdu', sx > 0 ? 'right' : 'left', explodePduX(sx), 0, 0.12);
  return { outlets };
}
