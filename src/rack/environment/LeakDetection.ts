// @ts-nocheck
/* eslint-disable */
// Leak detection for the liquid-cooled rows: an orange sensing rope laid on the floor tracing beneath each row's
// overhead supply/return headers (row-local z of the headers, mirrored for row B — see liquid/LiquidLoop.ts) and
// looping around the CDU plinth and its facility-water penetrations, plus a wall-mounted leak controller per row
// with a zone LED that goes red while a zone reads wet. Always visible (unlike the liquid loop itself, which only
// shows in the liquid view) — a leak rope on the floor is part of the hall in every view.
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ROW_B_Z } from './RackRow';
import { QUALITY } from '../quality';

const SUP_HDR_Z = -0.38, RET_HDR_Z = -0.52, HDR_X0 = -1.85, CDU_X = 2.2, CDU_D = 1.07;
const ROPE_Y = 0.006, ROPE_R = 0.0055;
const FONT = (w, px) => `${w} ${px}px "Helvetica Neue", Helvetica, Arial, sans-serif`;

export function buildLeakDetection(THREE) {
  const g = new THREE.Group(); g.name = 'leak_detection';
  const M = (name, o) => { const m = new THREE.MeshStandardMaterial(o); m.name = name; return m; };
  const mats = {
    rope: M('leak_rope_orange', { color: 0xf07a1c, roughness: 0.8, metalness: 0 }),
    clip: M('leak_rope_clip', { color: 0xdedfe2, roughness: 0.5, metalness: 0.1 }),
    box: M('leak_controller', { color: 0xd8dadd, roughness: 0.5, metalness: 0.1 }),
    dark: M('leak_controller_trim', { color: 0x2b2f36, roughness: 0.6, metalness: 0.2 }),
    cable: M('leak_lead_cable', { color: 0x1a1b1e, roughness: 0.8, metalness: 0 }),
  };
  const buckets = new Map();
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
  const add = (mat, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { geo.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s)); if (!buckets.has(mat)) buckets.set(mat, []); buckets.get(mat).push(geo); };
  const box = (mat, w, h, d, x, y, z, ry = 0) => add(mat, new THREE.BoxGeometry(w, h, d), x, y, z, 0, ry, 0);
  const tube = (mat, pts, r, seg) => add(mat, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.2), seg ?? Math.max(24, pts.length * 8), r, 6, false));
  const canvasTex = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = QUALITY.anisotropy; return { ctx: c.getContext('2d'), tex }; };

  const zones = []; // { led, draw, wet }
  const buildRow = (xf, rot, zoneNo) => {
    const P = (x, y, z) => xf([x, y, z]);
    // Rope: a serpentine under both headers along the row, then around the CDU plinth and its water penetrations.
    const pts = [];
    for (let x = HDR_X0; x <= 1.85; x += 0.37) { pts.push(P(x, ROPE_Y, SUP_HDR_Z + 0.03)); pts.push(P(x + 0.18, ROPE_Y, RET_HDR_Z - 0.03)); }
    const cz0 = -CDU_D / 2 - 0.3, cz1 = CDU_D / 2 + 0.06, cx0 = CDU_X - 0.36, cx1 = CDU_X + 0.36;
    pts.push(P(cx0, ROPE_Y, RET_HDR_Z - 0.03), P(cx0, ROPE_Y, cz0), P(cx1, ROPE_Y, cz0), P(cx1, ROPE_Y, cz1), P(cx0, ROPE_Y, cz1), P(cx0, ROPE_Y, 0.2));
    tube(mats.rope, pts, ROPE_R, 160);
    // Floor clips every so often along the run.
    for (let i = 2; i < pts.length; i += 3) { const [x, , z] = pts[i]; box(mats.clip, 0.03, 0.006, 0.014, x, 0.003, z, rot); }
    // Wall-mount leak controller on the CDU's outer flank, lead cable down to the rope.
    const bx = CDU_X + 0.36, by = 1.3, bz = -0.1;
    const [wx, wy, wz] = P(bx, by, bz);
    box(mats.box, 0.05, 0.16, 0.2, wx, wy, wz, rot); box(mats.dark, 0.006, 0.09, 0.15, ...P(bx + 0.028, by + 0.015, bz), rot);
    tube(mats.cable, [P(bx + 0.01, by - 0.08, bz), P(bx + 0.02, 0.5, bz), P(bx + 0.02, ROPE_Y + 0.01, cz1 - 0.1)], 0.004, 24);
    const { ctx, tex } = canvasTex(256, 160);
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.085), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); disp.name = 'leak_display'; disp.userData.thermalSkip = true;
    disp.position.set(...P(bx + 0.032, by + 0.015, bz)); disp.rotation.y = Math.PI / 2 + rot; g.add(disp);
    const ledMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0x2ee36a, emissiveIntensity: 1.8, toneMapped: false });
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.03), ledMat); led.name = 'leak_led'; led.userData.thermalSkip = true;
    led.position.set(...P(bx + 0.028, by - 0.055, bz - 0.06)); led.rotation.y = rot; g.add(led);
    const draw = (wet) => {
      ctx.fillStyle = wet ? '#1c0806' : '#0b0f14'; ctx.fillRect(0, 0, 256, 160);
      ctx.fillStyle = '#7fb3ff'; ctx.font = FONT(700, 22); ctx.textBaseline = 'top'; ctx.fillText(`LEAK CTRL · ZONE ${zoneNo}`, 12, 10);
      ctx.fillStyle = wet ? '#ff6a5a' : '#2ee36a'; ctx.font = FONT(700, 26); ctx.fillText(wet ? 'WET · 14.2 m' : 'DRY', 12, 46);
      ctx.fillStyle = '#8b97ad'; ctx.font = FONT(500, 16); ctx.fillText(wet ? 'SUPPLY HEADER · A-04 DROP' : 'CABLE OK · 38.0 m', 12, 86); ctx.fillText('SUPERVISED · 24 V', 12, 112);
      tex.needsUpdate = true;
    };
    draw(false);
    zones.push({ zone: zoneNo, ledMat, draw, wet: false });
  };
  buildRow((p) => p, 0, 1);
  buildRow(([x, y, z]) => [-x, y, -z + ROW_B_Z], Math.PI, 2);

  for (const [mat, geos] of buckets) {
    const merged = mergeGeometries(geos, false); geos.forEach((gg) => gg.dispose());
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat); m.name = 'leak_' + mat.name; m.castShadow = false; m.receiveShadow = false; g.add(m);
  }

  g.userData = {
    /** Mark a zone (1 = row A, 2 = row B) wet or dry. */
    setZoneWet(zone, wet) { const z = zones.find((q) => q.zone === zone); if (!z || z.wet === wet) return; z.wet = wet; z.draw(wet); },
    tick(t) { for (const z of zones) { if (z.wet) { z.ledMat.emissive.setHex(0xff3a24); z.ledMat.emissiveIntensity = Math.sin(t * 7) > 0 ? 2.6 : 0.4; } else { z.ledMat.emissive.setHex(0x2ee36a); z.ledMat.emissiveIntensity = 1.8; } } },
  };
  return g;
}
