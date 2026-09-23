// @ts-nocheck
/* eslint-disable */
// NOC video wall on the hall's left wall: a bezelled 3.2 × 1.35 m display over an operator desk with two monitors,
// redrawn at ~1 Hz from the same numbers the rest of the twin runs on — PUE (IT + cooling + distribution loss over
// IT), IT load, coolant supply / ΔT, open alarms by severity, the power source, and a rolling IT-load sparkline.
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ROOM_BOUNDS } from './Environment';
import { QUALITY } from '../quality';

const WALL_X = ROOM_BOUNDS.minX, WALL_Z = -1.0, WALL_Y = 2.35, W = 3.2, H = 1.35;
const FONT = (w, px) => `${w} ${px}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
const SEV_COLOR = { critical: '#d03b3b', major: '#ec835a', minor: '#fab219' };

export function buildNocWall(THREE) {
  const g = new THREE.Group(); g.name = 'noc_wall';
  const M = (name, o) => { const m = new THREE.MeshStandardMaterial(o); m.name = name; return m; };
  const mats = {
    bezel: M('noc_bezel', { color: 0x0f1114, roughness: 0.45, metalness: 0.6 }),
    desk: M('noc_desk', { color: 0x3b3f46, roughness: 0.7, metalness: 0.2 }),
    deskTop: M('noc_desk_top', { color: 0xbfc3c8, roughness: 0.5, metalness: 0.1 }),
    monitor: M('noc_monitor', { color: 0x15171b, roughness: 0.5, metalness: 0.4 }),
    chrome: M('noc_chrome', { color: 0xaeb3ba, roughness: 0.3, metalness: 0.9 }),
  };
  const buckets = new Map();
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
  const add = (mat, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { geo.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s)); if (!buckets.has(mat)) buckets.set(mat, []); buckets.get(mat).push(geo); };
  const box = (mat, w, h, d, x, y, z, ry = 0) => add(mat, new THREE.BoxGeometry(w, h, d), x, y, z, 0, ry, 0);

  // Video wall (faces +x into the room) and its bezel; 2×2 tile seams drawn into the canvas.
  box(mats.bezel, 0.08, H + 0.1, W + 0.1, WALL_X + 0.04, WALL_Y, WALL_Z);
  const c = document.createElement('canvas'); c.width = 1536; c.height = 648; const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = QUALITY.anisotropy;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); screen.name = 'noc_screen'; screen.userData.thermalSkip = true;
  screen.position.set(WALL_X + 0.085, WALL_Y, WALL_Z); screen.rotation.y = Math.PI / 2; g.add(screen);
  // Operator desk with two monitors. No chair: the operator works standing at the desk (see ServerRackTwin standAtNoc).
  const dx = WALL_X + 0.9, dz = WALL_Z;
  box(mats.deskTop, 0.8, 0.04, 2.2, dx, 0.74, dz); for (const [ox, oz] of [[-0.32, -1.0], [0.32, -1.0], [-0.32, 1.0], [0.32, 1.0]]) box(mats.desk, 0.06, 0.72, 0.06, dx + ox, 0.36, dz + oz);
  box(mats.desk, 0.7, 0.4, 2.0, dx, 0.5, dz); // modesty panel / drawer
  for (const oz of [-0.5, 0.5]) { box(mats.monitor, 0.02, 0.36, 0.62, dx - 0.2, 1.05, dz + oz, 0); box(mats.chrome, 0.16, 0.02, 0.2, dx - 0.15, 0.77, dz + oz); box(mats.chrome, 0.03, 0.12, 0.04, dx - 0.2, 0.83, dz + oz); }
  const mons = [];
  for (const oz of [-0.5, 0.5]) { const mc = document.createElement('canvas'); mc.width = 512; mc.height = 300; const mtex = new THREE.CanvasTexture(mc); mtex.colorSpace = THREE.SRGBColorSpace; const mm = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.34), new THREE.MeshBasicMaterial({ map: mtex, toneMapped: false })); mm.userData.thermalSkip = true; mm.position.set(dx - 0.188, 1.05, dz + oz); mm.rotation.y = Math.PI / 2; g.add(mm); mons.push({ ctx: mc.getContext('2d'), tex: mtex }); }
  box(mats.monitor, 0.3, 0.02, 0.12, dx + 0.1, 0.77, dz + 0.1); // keyboard

  for (const [mat, geos] of buckets) {
    const merged = mergeGeometries(geos, false); geos.forEach((gg) => gg.dispose());
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat); m.name = 'noc_' + mat.name; m.castShadow = /desk/.test(mat.name); m.receiveShadow = false; g.add(m);
  }

  /* ---------------- drawing ---------------- */
  const loadHist = [];
  const tile = (x, y, w, h, title, value, unit, sub, color = '#eef3ff') => {
    ctx.fillStyle = 'rgba(255,255,255,0.035)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#8b97ad'; ctx.font = FONT(600, 22); ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillText(title, x + 22, y + 18);
    ctx.fillStyle = color; ctx.font = FONT(700, 72); ctx.fillText(value, x + 22, y + 52);
    const vw = ctx.measureText(value).width; ctx.fillStyle = '#8b97ad'; ctx.font = FONT(500, 26); ctx.fillText(unit, x + 22 + vw + 12, y + 92);
    if (sub) { ctx.fillStyle = '#aeb3bc'; ctx.font = FONT(500, 20); ctx.fillText(sub, x + 22, y + h - 40); }
  };
  const draw = ({ loop, issues, power }) => {
    const s = loop?.latest; const itKw = s ? s.heatKw + 8 : 92; const coolKw = s ? s.cduKw + itKw * 0.09 : 18; const lossKw = itKw * 0.045 + 6;
    const pue = (itKw + coolKw + lossKw) / itKw;
    loadHist.push(itKw); if (loadHist.length > 90) loadHist.shift();
    const src = power?.source ?? 'utility';
    ctx.fillStyle = '#05080e'; ctx.fillRect(0, 0, 1536, 648);
    // Header bar.
    ctx.fillStyle = '#0c1220'; ctx.fillRect(0, 0, 1536, 74);
    ctx.fillStyle = '#7fb3ff'; ctx.font = FONT(700, 32); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText('HALL 1 · DCIM OVERVIEW', 28, 37);
    const now = new Date(); ctx.fillStyle = '#aeb3bc'; ctx.font = FONT(500, 26); ctx.textAlign = 'right'; ctx.fillText(`${now.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })}  ${now.toLocaleTimeString()}`, 1508, 37);
    const srcColor = src === 'utility' ? '#2ee36a' : src === 'generator' ? '#ffa020' : '#ff6a5a';
    ctx.fillStyle = srcColor; ctx.beginPath(); ctx.arc(700, 37, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#eef3ff'; ctx.font = FONT(600, 24); ctx.textAlign = 'left'; ctx.fillText(`POWER · ${src === 'none' ? 'TRANSFER' : src.toUpperCase()}`, 720, 37);
    // Tiles.
    const crit = issues.filter((i) => i.severity === 'critical').length, maj = issues.filter((i) => i.severity === 'major').length, min = issues.filter((i) => i.severity === 'minor').length;
    tile(28, 98, 350, 180, 'PUE (LIVE)', pue.toFixed(2), '', `IT ${itKw.toFixed(0)} kW · cooling ${coolKw.toFixed(0)} kW · loss ${lossKw.toFixed(0)} kW`, pue < 1.35 ? '#2ee36a' : '#ffcf6a');
    tile(398, 98, 350, 180, 'IT LOAD', itKw.toFixed(1), 'kW', `${Math.round((itKw / 240) * 100)} % of 240 kW design`);
    tile(768, 98, 350, 180, 'COOLANT SUPPLY', s ? s.supplyC.toFixed(1) : '—', '°C', s ? `ΔT ${s.dT.toFixed(1)} K · ${s.flowLpm.toFixed(0)} L/min` : 'loop standby');
    tile(1138, 98, 370, 180, 'OPEN ALARMS', String(issues.length), '', '', issues.length ? '#ffcf6a' : '#2ee36a');
    // Severity chips inside the alarms tile.
    let cx = 1160; for (const [n, sev] of [[crit, 'critical'], [maj, 'major'], [min, 'minor']]) { ctx.fillStyle = SEV_COLOR[sev]; ctx.beginPath(); ctx.roundRect(cx, 228, 104, 34, 8); ctx.fill(); ctx.fillStyle = '#0b0d11'; ctx.font = FONT(700, 20); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${n} ${sev.slice(0, 4).toUpperCase()}`, cx + 52, 245); cx += 116; }
    // Sparkline.
    ctx.fillStyle = 'rgba(255,255,255,0.035)'; ctx.fillRect(28, 302, 1000, 318); ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.strokeRect(28, 302, 1000, 318);
    ctx.fillStyle = '#8b97ad'; ctx.font = FONT(600, 22); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('IT LOAD · LAST 90 s', 50, 320);
    const lo = Math.min(...loadHist) - 4, hi = Math.max(...loadHist) + 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; for (let k = 0; k < 4; k++) { const y = 360 + k * 70; ctx.beginPath(); ctx.moveTo(50, y); ctx.lineTo(1006, y); ctx.stroke(); }
    ctx.beginPath(); loadHist.forEach((v, i) => { const x = 50 + (i / 89) * 956, y = 590 - ((v - lo) / (hi - lo)) * 230; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.strokeStyle = '#3987e5'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#8b97ad'; ctx.font = FONT(500, 20); ctx.textAlign = 'right'; ctx.fillText(`${hi.toFixed(0)} kW`, 1006, 350); ctx.fillText(`${lo.toFixed(0)} kW`, 1006, 596);
    // Alarm list (right column).
    ctx.fillStyle = 'rgba(255,255,255,0.035)'; ctx.fillRect(1048, 302, 460, 318); ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.strokeRect(1048, 302, 460, 318);
    ctx.fillStyle = '#8b97ad'; ctx.font = FONT(600, 22); ctx.textAlign = 'left'; ctx.fillText('ACTIVE INCIDENTS', 1070, 320);
    const sorted = [...issues].sort((a, b) => ({ critical: 0, major: 1, minor: 2 })[a.severity] - ({ critical: 0, major: 1, minor: 2 })[b.severity]).slice(0, 7);
    sorted.forEach((i, k) => { const y = 358 + k * 36; ctx.fillStyle = SEV_COLOR[i.severity]; ctx.beginPath(); ctx.arc(1082, y + 12, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#eef3ff'; ctx.font = FONT(600, 21); ctx.fillText(`${i.rackId} U${i.u}`, 1100, y); ctx.fillStyle = '#aeb3bc'; ctx.font = FONT(500, 20); let t = i.title.replace(/\s+—\s+/g, ' · '); while (t.length > 4 && ctx.measureText(t).width > 290) t = t.slice(0, -2).trimEnd() + '…'; ctx.fillText(t, 1205, y); });
    if (!issues.length) { ctx.fillStyle = '#2ee36a'; ctx.font = FONT(600, 26); ctx.fillText('No open incidents', 1070, 370); }
    // Tile seams of the 2×2 video wall.
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(766, 0, 4, 648); ctx.fillRect(0, 322, 1536, 4);
    tex.needsUpdate = true;
    // Desk monitors: a ticket queue and a camera grid stand-in.
    mons.forEach(({ ctx: m, tex: mt }, idx) => {
      m.fillStyle = '#0b0f14'; m.fillRect(0, 0, 512, 300);
      if (idx === 0) { m.fillStyle = '#7fb3ff'; m.font = FONT(700, 22); m.textBaseline = 'top'; m.textAlign = 'left'; m.fillText('TICKET QUEUE', 16, 14); sorted.slice(0, 6).forEach((i, k) => { m.fillStyle = SEV_COLOR[i.severity]; m.fillRect(16, 52 + k * 38, 8, 26); m.fillStyle = '#eef3ff'; m.font = FONT(600, 18); m.fillText(`${i.id} · ${i.rackId}`, 34, 56 + k * 38); }); }
      else { for (let r = 0; r < 2; r++) for (let q = 0; q < 3; q++) { m.fillStyle = `hsl(${210 + q * 8},20%,${12 + r * 4 + q * 2}%)`; m.fillRect(12 + q * 166, 12 + r * 142, 154, 130); m.fillStyle = '#ff3a24'; m.beginPath(); m.arc(28 + q * 166, 28 + r * 142, 4, 0, Math.PI * 2); m.fill(); m.fillStyle = '#c9ccd3'; m.font = FONT(600, 13); m.textBaseline = 'top'; m.fillText(`CAM-${r * 3 + q + 1} · HALL 1`, 38 + q * 166, 20 + r * 142); } }
      mt.needsUpdate = true;
    });
  };
  g.userData = { draw };
  return g;
}
