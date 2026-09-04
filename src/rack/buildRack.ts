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

  return ctx.g;
}
