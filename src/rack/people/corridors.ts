// @ts-nocheck
/* eslint-disable */
// Keyboard driving for the technician: the hall's corridor network as axis-aligned segments, movement along it
// (`advance` — walks a distance along the network, taking a queued 90° turn at the next junction that has the
// branch, otherwise continuing straight or stopping at a dead end), the rack stops (one stand point in front of
// every rack, always on a corridor line), and a small controller that turns held keys into a per-frame position /
// heading / speed for Technician.drive(). Pure geometry — no three.js — so it can be unit-checked in node
// (scripts/corridors.check.mjs); hence the explicit `.ts` extension on the local import.
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.
import { COLD_A_Z, COLD_B_Z, END_E_X, END_W_X, TECH_SPAWN, standPoint } from './paths.ts';

export const SPUR_X = 4.0;                 // approach lane to the free-standing live rack X-01
export const SPUR_END_Z = -1.38;           // == X-01's stand point, the lane's dead end

/** axis = the coordinate that varies along the segment, `at` = the fixed one; from < to. */
export const SEGMENTS = [
  { id: 'rowA', axis: 'x', at: COLD_A_Z, from: END_W_X, to: TECH_SPAWN.x },     // row A cold aisle, running on east to the door lane
  { id: 'door', axis: 'z', at: TECH_SPAWN.x, from: COLD_A_Z, to: TECH_SPAWN.z }, // lane in from the staff door
  { id: 'west', axis: 'z', at: END_W_X, from: COLD_B_Z, to: COLD_A_Z },
  { id: 'rowB', axis: 'x', at: COLD_B_Z, from: END_W_X, to: END_E_X },
  { id: 'east', axis: 'z', at: END_E_X, from: COLD_B_Z, to: COLD_A_Z },
  { id: 'spur', axis: 'z', at: SPUR_X, from: SPUR_END_Z, to: COLD_A_Z },
];

const ON_SEG_TOL = 0.03;
const NODE_TOL = 1e-4;
const fixedOf = (axis) => (axis === 'x' ? 'z' : 'x');

/* ---------------- headings ---------------- */
// A heading is one of the four cardinals. yaw = atan2(dx, dz), the same convention Technician.tick uses.
export const yawOf = (h) => Math.atan2(h.dx, h.dz);
export const turnLeft = (h) => ({ dx: h.dz, dz: -h.dx });    // facing +z the character's right is -x, so left is +x
export const turnRight = (h) => ({ dx: -h.dz, dz: h.dx });
export const reverse = (h) => ({ dx: -h.dx, dz: -h.dz });
export const sameHeading = (a, b) => a.dx === b.dx && a.dz === b.dz;
const CARDINALS = [{ dx: 1, dz: 0 }, { dx: -1, dz: 0 }, { dx: 0, dz: 1 }, { dx: 0, dz: -1 }];

/* ---------------- network queries ---------------- */
export function segmentsThrough(p, tol = ON_SEG_TOL) {
  return SEGMENTS.filter((s) => Math.abs(p[fixedOf(s.axis)] - s.at) <= tol && p[s.axis] >= s.from - tol && p[s.axis] <= s.to + tol);
}

/** Closest point on the network to `p`, with the segment it lies on. */
export function snapToCorridor(p) {
  let best = null, bd = Infinity;
  for (const s of SEGMENTS) {
    const along = Math.min(s.to, Math.max(s.from, p[s.axis]));
    const q = s.axis === 'x' ? { x: along, z: s.at } : { x: s.at, z: along };
    const d = Math.hypot(q.x - p.x, q.z - p.z);
    if (d < bd) { bd = d; best = { ...q, seg: s, dist: d }; }
  }
  return best;
}

let _nodes = null;
/** Distinct segment endpoints (junctions and dead ends). */
export function nodes() {
  if (_nodes) return _nodes;
  const out = [];
  for (const s of SEGMENTS) for (const along of [s.from, s.to]) {
    const q = s.axis === 'x' ? { x: along, z: s.at } : { x: s.at, z: along };
    if (!out.some((n) => Math.abs(n.x - q.x) < NODE_TOL && Math.abs(n.z - q.z) < NODE_TOL)) out.push(q);
  }
  return (_nodes = out);
}
export const isNode = (p) => nodes().some((n) => Math.abs(n.x - p.x) < NODE_TOL && Math.abs(n.z - p.z) < NODE_TOL);

/** Distance from `pos` along `seg` in direction `sign` to the next node on that segment (a junction in the middle of
 *  the aisle counts, e.g. the east passage and the spur both meet row A part-way along it), or to the segment end. */
function roomToNextNode(seg, pos, sign) {
  const here = pos[seg.axis];
  let room = sign > 0 ? seg.to - here : here - seg.from;
  for (const n of nodes()) {
    if (Math.abs(n[fixedOf(seg.axis)] - seg.at) > NODE_TOL) continue;
    const along = n[seg.axis]; if (along < seg.from - NODE_TOL || along > seg.to + NODE_TOL) continue;
    const d = sign > 0 ? along - here : here - along;
    if (d > 1e-9 && d < room) room = d;
  }
  return Math.max(0, room);
}

/** Cardinals along which a corridor leaves `p`. */
export function branchesAt(p) {
  // A branch exists in direction d when a segment running ALONG d passes through p and extends past it that way
  // (no along-axis tolerance here: a passage that ENDS at this node must not read as continuing beyond it).
  return CARDINALS.filter((d) => {
    const axis = d.dx ? 'x' : 'z', sign = d.dx || d.dz, probe = p[axis] + sign * 0.01;
    return SEGMENTS.some((s) => s.axis === axis && Math.abs(p[fixedOf(axis)] - s.at) <= ON_SEG_TOL && probe >= s.from && probe <= s.to);
  });
}

/** The cardinal along a corridor through `p` that is closest to `yaw` (for starting a drive from any facing). */
export function headingFor(p, yaw) {
  const segs = segmentsThrough(p);
  const cands = segs.length ? CARDINALS.filter((d) => segs.some((s) => (s.axis === 'x') === (d.dx !== 0))) : CARDINALS;
  let best = cands[0], bs = -Infinity;
  for (const d of cands) { const s = Math.cos(yaw - yawOf(d)); if (s > bs) { bs = s; best = d; } }
  return best;
}

/* ---------------- movement ---------------- */
/**
 * Walk `dist` metres from `p` along the network in direction `travel` (== `facing`, or reverse(facing) when
 * back-pedalling). At a junction: take `pending` ('left' | 'right', relative to `facing`) if that branch exists,
 * else carry straight on if a collinear segment continues, else stop there (blocked). With dist 0 at a node only
 * the junction logic runs (turn in place). Positions only ever come from clamping along a known segment, so the
 * result is always on the network.
 */
export function advance(p, facing, travel, dist, pending = null) {
  const snapped = snapToCorridor(p); const pos = { x: snapped.x, z: snapped.z };
  let h = facing, remaining = dist, turned = false, tr = travel;
  const junction = () => {
    if (pending) {
      const want = pending === 'left' ? turnLeft(h) : turnRight(h);
      if (branchesAt(pos).some((b) => sameHeading(b, want))) { h = want; tr = want; pending = null; turned = true; return 'turned'; }
    }
    return branchesAt(pos).some((b) => sameHeading(b, tr)) ? 'straight' : 'blocked';
  };
  if (dist <= 0) {
    if (isNode(pos)) { const r = junction(); return { p: pos, h, blocked: r === 'blocked', turned }; }
    return { p: pos, h, blocked: false, turned };
  }
  for (let guard = 0; guard < 8; guard++) {
    const axis = tr.dx ? 'x' : 'z', sign = tr.dx || tr.dz;
    const seg = segmentsThrough(pos).find((s) => s.axis === axis);
    if (!seg) return { p: pos, h, blocked: true, turned };
    const room = roomToNextNode(seg, pos, sign);
    const step = Math.min(remaining, room);
    const target = pos[axis] + sign * room;
    pos[axis] += sign * step; remaining -= step;
    // Land exactly on the node when we reach it so the node tests below are exact.
    if (room - step < 1e-9) pos[axis] = Math.round(target * 1e6) / 1e6;
    if (remaining <= 1e-9 && room - step >= 1e-9) return { p: pos, h, blocked: false, turned };
    const r = junction();
    if (r === 'blocked') return { p: pos, h, blocked: true, turned };
    if (remaining <= 1e-9) return { p: pos, h, blocked: false, turned };
  }
  return { p: pos, h, blocked: true, turned };
}

/* ---------------- stops ---------------- */
/** One stop per rack: its stand point (paths.standPoint) plus the corridor segment it lies on. */
export function buildStops(racks) {
  return racks.map((r) => { const s = standPoint(r); const snap = snapToCorridor(s); return { id: r.id, x: s.x, z: s.z, yaw: s.yaw, segId: snap.seg.id, offSeg: snap.dist }; });
}

/** The stop within `radius` of `p` that shares a corridor segment with it (nearest wins), or null. */
export function nearestStop(p, stops, radius = 0.5) {
  const segIds = new Set(segmentsThrough(p).map((s) => s.id));
  let best = null, bd = radius;
  for (const s of stops) { if (!segIds.has(s.segId)) continue; const d = Math.hypot(s.x - p.x, s.z - p.z); if (d <= bd) { bd = d; best = s; } }
  return best;
}

/* ---------------- controller ---------------- */
/**
 * Held keys -> per-frame kinematics. Up/Down walk forward / back-pedal (facing unchanged); Left/Right queue a 90°
 * turn that is taken at the next junction with that branch (immediately when already standing at one). Standing
 * still within `stopRadius` of a rack's stand point eases onto it and reports a 'stop' event; the next key press
 * reports 'leave'.
 */
export function createDriveController(stops, opts = {}) {
  const o = { walk: 1.5, back: 0.9, settle: 0.8, accel: 8, decel: 18, stopRadius: 0.5, junctionSnap: 0.35, ...opts }; // decel: brake fast on release so the figure parks where the key was let go
  const st = { pos: { x: 0, z: 0 }, facing: { dx: 0, dz: 1 }, speed: 0, held: new Set(), pending: null, atStop: null, settleTo: null, leavePending: false };
  const approach = (cur, goal, dt, rate) => cur + (goal - cur) * (1 - Math.exp(-rate * dt));
  const leaveStop = () => { if (st.atStop) { st.atStop = null; st.leavePending = true; } st.settleTo = null; };
  const nodeWithBranchNear = () => {
    const want = st.pending === 'left' ? turnLeft(st.facing) : turnRight(st.facing);
    let best = null, bd = o.junctionSnap;
    for (const n of nodes()) {
      const d = Math.hypot(n.x - st.pos.x, n.z - st.pos.z);
      if (d <= bd && segmentsThrough(n).some((s) => segmentsThrough(st.pos).some((t) => t.id === s.id)) && branchesAt(n).some((b) => sameHeading(b, want))) { bd = d; best = n; }
    }
    return best;
  };
  const tick = (dt) => {
    const fwd = st.held.has('up') && !st.held.has('down') ? 1 : st.held.has('down') && !st.held.has('up') ? -1 : 0;
    const targetSpeed = fwd > 0 ? o.walk : fwd < 0 ? -o.back : 0;
    st.speed = approach(st.speed, targetSpeed, dt, targetSpeed === 0 ? o.decel : o.accel);
    if (Math.abs(st.speed) < 0.02 && fwd === 0) st.speed = 0;
    let event = st.leavePending ? 'leave' : null; st.leavePending = false;
    let settleSpeed = 0;
    if (Math.abs(st.speed) > 0) {
      const forward = st.speed > 0;
      const r = advance(st.pos, st.facing, forward ? st.facing : reverse(st.facing), Math.abs(st.speed) * dt, forward ? st.pending : null);
      st.pos = r.p; if (r.turned) { st.facing = r.h; st.pending = null; }
      if (r.blocked) st.speed = 0;
    } else if (fwd === 0) {
      if (st.pending && !st.settleTo) {
        if (isNode(st.pos)) { const r = advance(st.pos, st.facing, st.facing, 0, st.pending); if (r.turned) { st.facing = r.h; st.pending = null; } }
        else { const n = nodeWithBranchNear(); if (n) st.settleTo = { x: n.x, z: n.z, node: true }; }
      }
      if (!st.settleTo && !st.atStop) { const s = nearestStop(st.pos, stops, o.stopRadius); if (s) st.settleTo = { x: s.x, z: s.z, stop: s }; }
      if (st.settleTo) {
        const dx = st.settleTo.x - st.pos.x, dz = st.settleTo.z - st.pos.z, d = Math.hypot(dx, dz), step = Math.min(o.settle * dt, d);
        if (d > 1e-6) { st.pos = { x: st.pos.x + dx / d * step, z: st.pos.z + dz / d * step }; settleSpeed = o.settle; }
        if (d - step <= 1e-6) {
          st.pos = { x: st.settleTo.x, z: st.settleTo.z };
          if (st.settleTo.stop) { st.atStop = st.settleTo.stop; event = 'stop'; }
          else if (st.pending) { const r = advance(st.pos, st.facing, st.facing, 0, st.pending); if (r.turned) { st.facing = r.h; st.pending = null; } }
          st.settleTo = null; settleSpeed = 0;
        }
      }
    }
    const moving = Math.abs(st.speed) > 0.02 || settleSpeed > 0;
    return { x: st.pos.x, z: st.pos.z, yaw: st.atStop ? st.atStop.yaw : yawOf(st.facing), speed: settleSpeed || st.speed, moving, stop: st.atStop, event, anyKey: st.held.size > 0 };
  };
  return {
    begin(p, yaw) { const s = snapToCorridor(p); st.pos = { x: s.x, z: s.z }; st.facing = headingFor(st.pos, yaw); st.speed = 0; st.pending = null; st.atStop = null; st.settleTo = null; st.leavePending = false; st.held.clear(); },
    press(k) {
      if (k === 'up' || k === 'down') { st.held.add(k); leaveStop(); }
      else if (k === 'left' || k === 'right') { st.pending = k; leaveStop(); }
    },
    release(k) { st.held.delete(k); },
    releaseAll() { st.held.clear(); },
    /** Dev/tooling: forward -1|0|1 sets the held walk keys; turn -1 (left) | 1 (right) queues a turn. */
    setAxes(forward, turn = 0) { st.held.clear(); if (forward > 0) this.press('up'); if (forward < 0) this.press('down'); if (turn) this.press(turn < 0 ? 'left' : 'right'); },
    tick,
    get state() { return { pos: { ...st.pos }, facing: { ...st.facing }, pending: st.pending, atStop: st.atStop, speed: st.speed, settling: !!st.settleTo }; },
  };
}
