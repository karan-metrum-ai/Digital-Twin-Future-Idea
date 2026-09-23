// Placement of the issue detail modal beside the alarm card it was opened from. Pure arithmetic in container pixels
// so the React component (IssueDetail.tsx) and the render loop (ServerRackTwin.tsx, which re-places the open modal
// every frame as the camera moves) share one rule: beside the card on its right, flipped to its left when that would
// run off the edge, header roughly level with the card, and always fully inside the container.
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.

/** Modal placement in container pixels (top-left corner). */
export interface DetailPlace { left: number; top: number }
export const DETAIL_W = 328;          // px, modal width
export const DETAIL_MAX_H = 520;      // px, modal height cap when anchored (the log pane scrolls)
export const DETAIL_TOP_MIN = 64;     // px, keeps the modal clear of the toolbar
export const DETAIL_PAD = 12;         // px, minimum distance to the container edges
const DETAIL_GAP = 26;                // px, clearance between the alarm card and the modal

/**
 * Where to put the modal for an alarm card at container pixel (x, y) in a container of w×h. `modalH` is the rendered
 * height when known (the cap otherwise) — it only matters for the bottom clamp.
 */
export function placeDetail(x: number, y: number, w: number, h: number, modalH: number = DETAIL_MAX_H): DetailPlace {
  let left = x + DETAIL_GAP;
  if (left + DETAIL_W > w - DETAIL_PAD) left = x - DETAIL_GAP - DETAIL_W;
  left = Math.max(DETAIL_PAD, Math.min(w - DETAIL_W - DETAIL_PAD, left));
  const mh = Math.min(modalH, DETAIL_MAX_H);
  const top = Math.max(DETAIL_TOP_MIN, Math.min(h - mh - DETAIL_PAD, y - 36));
  return { left: Math.round(left), top: Math.round(top) };
}
