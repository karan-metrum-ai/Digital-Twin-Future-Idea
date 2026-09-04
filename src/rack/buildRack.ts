// @ts-nocheck
/* eslint-disable */
// Assembles the full 42U rack: frame, every equipment item in bottom-to-top layout order, the two vertical
// PDUs, and finally the cabling pass. This is the only place that knows the rack's physical layout — each
// component module only knows how to build itself at a given U position.
import { createRackContext } from './RackContext';
import { buildRackFrame } from './frame/RackFrame';
import { buildServer } from './components/Server';
import { buildBlankPanel } from './components/BlankPanel';
import { buildNetworkSwitch } from './components/NetworkSwitch';
import { buildPatchPanel } from './components/PatchPanel';
import { buildCableManager } from './components/CableManager';
import { buildHorizontalPdu } from './components/HorizontalPdu';
import { buildVerticalPdu } from './components/VerticalPdu';
import { buildNuc } from './components/Nuc';
import { wireCabling } from './cabling/wireCabling';

export function buildRack(THREE) {
  const ctx = createRackContext(THREE);
  buildRackFrame(ctx);

  const pduLeft = buildVerticalPdu(ctx, -1);
  const pduRight = buildVerticalPdu(ctx, 1);
  const pduOutlets = { '-1': pduLeft.outlets, '1': pduRight.outlets };

  const servers = [];
  const s = (...args) => { servers.push(buildServer(ctx, ...args)); };

  /* ---------------- layout (bottom -> top) ---------------- */
  s(1, 4, 'storage', { cover: true }); buildBlankPanel(ctx, 5, 1); s(6, 3, 'storage', { graphite: true }); s(9, 2, 'sff', { cover: true }); s(11, 2, 'lff');
  s(13, 1, null, { cover: true }); s(14, 1); s(15, 1); s(16, 1, null, { cover: true }); s(17, 2, 'sff'); buildBlankPanel(ctx, 19, 1);
  s(20, 4, 'gpu', { cover: true }); s(24, 1, null, { cover: true }); s(25, 1); s(26, 1, null, { graphite: true }); s(27, 1, null, { graphite: true }); s(28, 2, 'sff', { cover: true });
  buildHorizontalPdu(ctx, 30); s(31, 1, null, { cover: true }); s(32, 1); s(33, 1);
  const ppB = buildPatchPanel(ctx, 34); const cmB = buildCableManager(ctx, 35); const swB = buildNetworkSwitch(ctx, 36, 24);
  const ppA = buildPatchPanel(ctx, 37); const cmA = buildCableManager(ctx, 38); const swA = buildNetworkSwitch(ctx, 39, 48);
  buildNuc(ctx, 40); // 3U NUC shelf (U40-42) at the top of the rack

  wireCabling(ctx, { servers, pduOutlets, swA, swB, ppA, ppB, cmA, cmB });
  layoutExplodedView(ctx);

  return ctx.g;
}

// Exploded-view targets. Rather than fanning items symmetrically about the rack's mid-height (which pushed the
// bottom half through the floor), every U-mounted item is re-stacked in its original order in front of the
// rack with an even gap between neighbours, starting just above the floor — so each one is separately
// readable without the stack outgrowing the room. The vertical PDUs keep their sideways slide. Each item also
// records its bounding box so ServerRackTwin can hang a name label off it.
function layoutExplodedView(ctx) {
  const { THREE, items } = ctx;
  const GAP = 0.035, FLOOR_Y = 0.16, PULL_Z = 0.45;
  const measured = items.map((it) => { const b = new THREE.Box3().setFromObject(it.group); it.bbox = b; return { it, yc: (b.min.y + b.max.y) / 2, h: b.max.y - b.min.y }; });
  let y = FLOOR_Y;
  for (const m of measured.filter((m) => m.it.kind !== 'pdu').sort((a, b) => a.yc - b.yc)) {
    m.it.ey = (y + m.h / 2) - m.yc;
    m.it.ez = PULL_Z;
    y += m.h + GAP;
  }
}
