// Unit checks for the technician's corridor network (src/rack/people/corridors.ts): stops sit on the network,
// turn algebra, `advance` never leaves the corridors, junction behaviour, and the drive controller's stop events.
// Run: node scripts/corridors.check.mjs
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.
import { yawOf, turnLeft, turnRight, sameHeading, snapToCorridor, isNode, advance, buildStops, nearestStop, createDriveController } from '../src/rack/people/corridors.ts';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`); if (!ok) fails++; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

// The 11 racks, from RackRow / issues constants (issues.ts cannot load in node: it imports three.js).
const ROW_XS = [-2, -1, 0, 1, 2].map((i) => i * 0.65);
const racks = [
  ...ROW_XS.map((x, i) => ({ id: `A-0${i + 1}`, row: 'A', index: i, x, z: 0, rotY: 0, live: false })),
  ...ROW_XS.map((x, i) => ({ id: `B-0${i + 1}`, row: 'B', index: i, x: -x, z: -2.27, rotY: Math.PI, live: false })),
  { id: 'X-01', row: 'X', index: 0, x: 5.0, z: -1.0, rotY: -Math.PI / 2, live: true },
];
const stops = buildStops(racks);

// 1. stops on the network, each recovers itself
check('11 stops', stops.length === 11);
check('every stop lies on its segment', stops.every((s) => s.offSeg < 1e-6), JSON.stringify(stops.map((s) => [s.id, s.segId, +s.offSeg.toFixed(6)])));
check('nearestStop from each stand returns itself', stops.every((s) => nearestStop({ x: s.x, z: s.z }, stops)?.id === s.id));
// 2. same-segment rule
check('east passage does not claim X-01', nearestStop({ x: 3.7, z: -1.38 }, stops) === null);
check('(-1.0, 1.0) -> A-02', nearestStop({ x: -1.0, z: 1.0 }, stops)?.id === 'A-02');
// 3. turn algebra
const cards = [{ dx: 1, dz: 0 }, { dx: -1, dz: 0 }, { dx: 0, dz: 1 }, { dx: 0, dz: -1 }];
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
check('turnLeft = yaw + 90°', cards.every((h) => near(wrap(yawOf(turnLeft(h)) - yawOf(h) - Math.PI / 2), 0)));
check('turnRight(turnLeft(h)) == h', cards.every((h) => sameHeading(turnRight(turnLeft(h)), h)));
// 4. random walk never leaves the network; blocked only at nodes
let seed = 42; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
let p = { x: 0, z: 1.0 }, h = { dx: 1, dz: 0 }, off = 0, badBlock = 0, turns = 0;
for (let i = 0; i < 20000; i++) {
  const pending = rnd() < 0.1 ? (rnd() < 0.5 ? 'left' : 'right') : null;
  const back = rnd() < 0.15;
  const r = advance(p, h, back ? { dx: -h.dx, dz: -h.dz } : h, rnd() * 0.3, back ? null : pending);
  p = r.p; if (r.turned) { h = r.h; turns++; }
  off = Math.max(off, snapToCorridor(p).dist);
  if (r.blocked && !isNode(p)) badBlock++;
  if (r.blocked && rnd() < 0.5) h = { dx: -h.dx, dz: -h.dz }; // turn round at dead ends now and then
}
check('random walk stays on the network', off < 1e-6, `max off-network ${off.toExponential(2)}, turns taken ${turns}`);
check('blocked only at nodes', badBlock === 0, `${badBlock} bad blocks`);
// 5. junctions
let r = advance({ x: 0, z: 1.0 }, { dx: 1, dz: 0 }, { dx: 1, dz: 0 }, 6.0, 'right');
check('pending right runs past 3.7/4.0 and turns onto the door lane', near(r.p.x, 5.6) && r.p.z > 1.0 && sameHeading(r.h, { dx: 0, dz: 1 }), JSON.stringify(r));
r = advance({ x: 0, z: 1.0 }, { dx: 1, dz: 0 }, { dx: 1, dz: 0 }, 4.5, 'left');
check('pending left turns down the east passage at 3.7, not the spur', near(r.p.x, 3.7) && r.p.z < 1.0 && sameHeading(r.h, { dx: 0, dz: -1 }), JSON.stringify(r));
r = advance({ x: 4.0, z: 0.5 }, { dx: 0, dz: -1 }, { dx: 0, dz: -1 }, 5, null);
check('spur dead-ends at X-01 stand', r.blocked && near(r.p.x, 4.0) && near(r.p.z, -1.38) && nearestStop(r.p, stops)?.id === 'X-01', JSON.stringify(r));
r = advance({ x: 3.7, z: 1.0 }, { dx: 1, dz: 0 }, { dx: 1, dz: 0 }, 0, 'left');
check('turn in place at a node', r.turned && sameHeading(r.h, { dx: 0, dz: -1 }), JSON.stringify(r));
// 6. controller
const c = createDriveController(stops);
c.begin({ x: -3.0, z: 1.0 }, Math.PI / 2);
c.press('up'); for (let i = 0; i < 60; i++) c.tick(1 / 60);
const x2 = c.state.pos.x;
check('held up for 1 s advances ~1.3-1.5 m', x2 > -1.75 && x2 < -1.5, `x = ${x2.toFixed(2)}`);
// keep walking and let go 0.2 m short of A-03's stand (-0.38, 1.0): the brake glide is ~0.08 m
let guard = 0; while (c.state.pos.x < -0.58 && guard++ < 400) c.tick(1 / 60);
c.release('up');
let stopEv = null, leaveEv = null;
for (let i = 0; i < 120; i++) { const f = c.tick(1 / 60); if (f.event === 'stop') stopEv = f.stop; }
check('release near a stand -> one stop event for A-03', stopEv?.id === 'A-03' && c.state.atStop?.id === 'A-03', `stop ${stopEv?.id}, pos ${JSON.stringify(c.state.pos)}`);
const f0 = c.tick(1 / 60); check('yaw at stop faces the rack (π for row A)', near(wrap(f0.yaw - Math.PI), 0), `${f0.yaw.toFixed(2)}`);
c.press('up'); for (let i = 0; i < 3; i++) { const f = c.tick(1 / 60); if (f.event === 'leave') leaveEv = true; }
check('next press -> leave event', leaveEv === true);
for (let i = 0; i < 20; i++) c.tick(1 / 60); c.release('up');
// now roughly 0.5-0.7 m past A-03 (toward A-04 at 0.27): where are we?
const px = c.state.pos.x; let ev2 = null; for (let i = 0; i < 120; i++) { const f = c.tick(1 / 60); if (f.event === 'stop') ev2 = f.stop.id; }
const expected = nearestStop({ x: px, z: 1.0 }, stops)?.id ?? null;
check('release elsewhere -> stop only if within radius', ev2 === expected, `released at x=${px.toFixed(2)}, event ${ev2}, expected ${expected}`);
// queued turn while standing near a junction: from (3.5, 1.0) facing +x, press left -> walks to 3.7 and turns
const c2 = createDriveController(stops); c2.begin({ x: 3.5, z: 1.0 }, Math.PI / 2); c2.press('left');
for (let i = 0; i < 90; i++) c2.tick(1 / 60);
check('queued turn near a junction walks there and turns', near(c2.state.pos.x, 3.7) && sameHeading(c2.state.facing, { dx: 0, dz: -1 }) && c2.state.pending === null, JSON.stringify(c2.state));
// back-pedal keeps facing
const c3 = createDriveController(stops); c3.begin({ x: 0, z: 1.0 }, Math.PI / 2); c3.press('down'); for (let i = 0; i < 60; i++) c3.tick(1 / 60);
check('back-pedal moves -x and keeps facing +x', c3.state.pos.x < -0.5 && sameHeading(c3.state.facing, { dx: 1, dz: 0 }), JSON.stringify(c3.state.pos));

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
