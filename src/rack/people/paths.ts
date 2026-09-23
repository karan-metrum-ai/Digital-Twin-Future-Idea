// Walkable routes through the data hall for the technician avatar. The hall is a grid of corridors (the cold aisle
// in front of each row, the end-of-row passages outside the CDUs and floor PDUs, and the approach to the free-standing
// interactive rack); every route is a chain of axis-aligned segments along them, so the figure never cuts through a
// rack row, a CDU or the live rack. Pure geometry — no three.js here so it can be unit-checked in isolation.
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.
import type { RackInfo } from '../issues/issues';

export interface XZ { x: number; z: number }

/** Where the technician appears: just inside the front-wall doorway (see Environment.ts DOOR_X). */
export const TECH_SPAWN: XZ = { x: 5.6, z: 7.1 };

// Corridor lines (world metres). Row A fronts are at z = 0.535 and row B fronts at z = -2.805; rack fronts of
// either row are reached from a corridor one metre out. The end-of-row passage runs outside the CDUs (x ±1.9..2.5)
// and the floor PDUs (x ±2.55..3.35); the live rack (x 4.7..5.3, z -1.3..-0.7) is approached from its own lane.
export const COLD_A_Z = 1.0;
export const COLD_B_Z = -3.27;
export const END_E_X = 3.7;
export const END_W_X = -3.7;

/** Rack forward vector in plan: racks face +z at rotY = 0. */
const forward = (info: RackInfo) => ({ x: Math.sin(info.rotY), z: Math.cos(info.rotY) });

/**
 * Where the technician stands to work on `info`: one metre out from the front, a step toward the rack's left so the
 * device face stays visible from the camera's front-right shot, facing the rack.
 */
export function standPoint(info: RackInfo, dist = 1.0, side = -0.38): XZ & { yaw: number } {
  const f = forward(info);
  const rx = Math.cos(info.rotY), rz = -Math.sin(info.rotY); // rack's right-hand side
  const x = info.x + f.x * dist + rx * side, z = info.z + f.z * dist + rz * side;
  return { x, z, yaw: Math.atan2(-f.x, -f.z) };
}

/**
 * The technician's rounds when nothing needs fixing: in from the door, along the front of row A, round the west end,
 * along row B's front, round the east end and back — pausing in front of a few racks to look them over (`look` is
 * the yaw to face). Every point lies on a corridor, so a dispatch can route from anywhere on it.
 */
export const PATROL: (XZ & { look?: number; pauseS?: number })[] = [
  { x: TECH_SPAWN.x, z: COLD_A_Z },
  { x: 1.95, z: COLD_A_Z, look: Math.PI, pauseS: 3 },
  { x: -0.65, z: COLD_A_Z, look: Math.PI, pauseS: 4 },
  { x: END_W_X, z: COLD_A_Z },
  { x: END_W_X, z: COLD_B_Z },
  { x: -1.3, z: COLD_B_Z, look: 0, pauseS: 3 },
  { x: 1.3, z: COLD_B_Z, look: 0, pauseS: 4 },
  { x: END_E_X, z: COLD_B_Z },
  { x: END_E_X, z: COLD_A_Z },
];

/** Index of the patrol point nearest to `p`. */
export function nearestPatrolIndex(p: XZ): number {
  let best = 0, bd = Infinity;
  PATROL.forEach((q, i) => { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = i; } });
  return best;
}

/**
 * Axis-aligned waypoint chain from `from` (anywhere on the corridor network) to the stand point of `info`.
 * Consecutive duplicate points are dropped.
 */
export function buildPath(from: XZ, info: RackInfo): XZ[] {
  const stand = standPoint(info);
  const pts: XZ[] = [from];
  const push = (x: number, z: number) => { const last = pts[pts.length - 1]; if (Math.abs(last.x - x) > 1e-6 || Math.abs(last.z - z) > 1e-6) pts.push({ x, z }); };
  // Get onto the row-A cold-aisle line first. From row B's corridor that means going round the nearer row end;
  // from an end passage or the entrance lane it's a straight walk.
  const onRowB = Math.abs(from.z - COLD_B_Z) < 0.3;
  if (onRowB && info.row === 'B') { push(stand.x, COLD_B_Z); push(stand.x, stand.z); return pts; } // already on row B's corridor
  const onEndLane = Math.abs(Math.abs(from.x) - END_E_X) < 0.05 && from.z < COLD_A_Z + 0.05 && from.z > COLD_B_Z - 0.05;
  if (onEndLane && info.row === 'B') { push(from.x, COLD_B_Z); push(stand.x, COLD_B_Z); push(stand.x, stand.z); return pts; } // already in an end passage: straight down to row B
  if (onRowB) { const endX = from.x >= 0 ? END_E_X : END_W_X; push(endX, COLD_B_Z); push(endX, COLD_A_Z); }
  else push(from.x, COLD_A_Z);
  if (info.row === 'A') {
    push(stand.x, COLD_A_Z);
  } else if (info.row === 'B') {
    const here = pts[pts.length - 1]; const endX = here.x >= 0 ? END_E_X : END_W_X;
    push(endX, COLD_A_Z); push(endX, COLD_B_Z); push(stand.x, COLD_B_Z);
  } else {
    // Free-standing rack: come along the cold-aisle line to its approach lane, then straight in.
    push(stand.x, COLD_A_Z);
  }
  push(stand.x, stand.z);
  return pts;
}

/** Total length of a waypoint chain, metres. */
export function pathLength(pts: XZ[]): number {
  let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); return s;
}
