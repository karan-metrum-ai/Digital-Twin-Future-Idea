// ServerRackTwin.tsx — self-contained React + TypeScript component (three.js 0.184).
// Usage: <ServerRackTwin temps={[...]} view="visual" />  |  npm i three @types/three
// The procedural model, airflow sim and thermal shader are ported 1:1 from the HTML prototype below.
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

type ThreeNS = typeof THREE;
type Slot = { y: number; h: number; zr: number };
export type RackView = 'visual' | 'thermal';
export interface ServerRackTwinProps {
  /** Per-server-slot load temperature 0..1 (bottom → top). Drives thermal view. */
  temps?: number[];
  view?: RackView;
  onViewChange?: (v: RackView) => void;
  showCovers?: boolean;
  showAirflow?: boolean;
  background?: string;
  className?: string;
  style?: React.CSSProperties;
}

/* ------------------------------------------------------------------ model ------------------------------------------------------------------ */
// @ts-nocheck-region: procedural geometry code kept in loose JS for readability
/* eslint-disable */
// 42U enterprise rack — geometry + procedural canvas textures (brushed metal, honeycomb grills,
// drive faces, switch/patch/PDU faceplates, rear I/O). Units: meters, y-up, front = +z.
function buildRack(THREE) {
  const U = 0.04445, W = 0.6, D = 1.07, Y0 = 0.13, TOP = Y0 + 42 * U, ZF = 0.40, CW = 0.437;
  const g = new THREE.Group(); g.name = 'server_rack';
  const anim = []; g.userData.animatedLeds = anim;

  /* ---------------- textures ---------------- */
  const tex = (name, w, h, draw, opts) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); draw(ctx, w, h);
    const t = new THREE.CanvasTexture(c); t.name = name; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    if (opts && opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...opts.repeat); }
    if (opts && opts.linear) t.colorSpace = THREE.NoColorSpace;
    return t;
  };
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const hexPath = (ctx, cx, cy, r) => { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; ctx[i ? 'lineTo' : 'moveTo'](cx + r * Math.cos(a), cy + r * Math.sin(a)); } ctx.closePath(); };
  const drawHex = (ctx, w, h, bg, hole, r, rim) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    const dx = r * Math.sqrt(3), dy = r * 1.5;
    for (let row = -1; row * dy < h + r; row++) for (let col = -1; col * dx < w + r; col++) {
      const cx = col * dx + (row % 2 ? dx / 2 : 0), cy = row * dy;
      if (rim) { ctx.fillStyle = rim; hexPath(ctx, cx, cy + 1.2, r * 0.8); ctx.fill(); }
      ctx.fillStyle = hole; hexPath(ctx, cx, cy, r * 0.78); ctx.fill();
    }
  };
  const drawSff = (ctx, w, h) => {
    // R550-style 2.5" carrier: light-grey frame, orange ring latch, perforated black body, label at the foot
    ctx.fillStyle = '#8f9297'; ctx.fillRect(0, 0, w, h);
    const gr = ctx.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.28)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    const fx = w * 0.11, latchH = Math.min(h * 0.2, (w - 2 * fx) * 1.1);
    ctx.fillStyle = '#1b1d20'; ctx.fillRect(fx, h * 0.04, w - 2 * fx, latchH);
    const cx = w / 2, cy = h * 0.04 + latchH / 2, r = Math.min((w - 2 * fx) * 0.38, latchH * 0.38);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fillStyle = '#e0702a'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, 7); ctx.fillStyle = '#2a2c30'; ctx.fill();
    ctx.fillStyle = '#3dff6e'; ctx.shadowColor = '#3dff6e'; ctx.shadowBlur = 5; ctx.beginPath(); ctx.arc(w * 0.28, h * 0.075, Math.max(2, w * 0.025), 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#0d0e10'; ctx.fillRect(fx, h * 0.04 + latchH + h * 0.02, w - 2 * fx, h * 0.56);
    const cols = 2, rows = 7, px = (w - 2 * fx) / cols, py = (h * 0.56) / rows;
    for (let r2 = 0; r2 < rows; r2++) for (let c = 0; c < cols; c++) { ctx.fillStyle = '#26282c'; ctx.fillRect(fx + c * px + px * 0.2, h * 0.06 + latchH + r2 * py + py * 0.15, px * 0.6, py * 0.7); ctx.fillStyle = '#000'; ctx.fillRect(fx + c * px + px * 0.28, h * 0.06 + latchH + r2 * py + py * 0.25, px * 0.44, py * 0.5); }
    ctx.fillStyle = '#b9bcc1'; ctx.fillRect(fx + 2, h * 0.86, w - 2 * fx - 4, h * 0.09); ctx.fillStyle = '#4a4d52'; for (let i = 0; i < 3; i++) ctx.fillRect(fx + 6, h * 0.885 + i * h * 0.022, (w - 2 * fx) * 0.6, Math.max(1, h * 0.008));
  };
  const T = {
    brushed: tex('brushed_metal', 512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#c8c8c8'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) { ctx.fillStyle = `rgba(${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},${rnd() > 0.5 ? 255 : 0},${0.03 + rnd() * 0.05})`; ctx.fillRect(rnd() * w, rnd() * h, 40 + rnd() * 300, 1); }
    }, { repeat: [2, 2] }),
    powder: tex('powder_coat', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#b4b4b4'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 6000; i++) { ctx.fillStyle = `rgba(${rnd() > 0.5 ? 255 : 0},255,255,${rnd() * 0.08})`; ctx.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
    }, { repeat: [4, 4] }),
    hexGrill: tex('honeycomb_grill', 256, 222, (ctx, w, h) => drawHex(ctx, w, h, '#33363b', '#07080a', 16, '#5a5e64'), { repeat: [1, 1] }),
    hexAlpha: tex('honeycomb_alpha', 256, 222, (ctx, w, h) => drawHex(ctx, w, h, '#ffffff', '#000000', 16), { repeat: [1, 1], linear: true }),
    rail: tex('rack_rail', 64, 192, (ctx, w, h) => {
      ctx.fillStyle = '#2a2b2e'; ctx.fillRect(0, 0, w, h);
      for (const fy of [0.18, 0.5, 0.82]) { ctx.fillStyle = '#050506'; ctx.fillRect(w / 2 - 12, h * fy - 12, 24, 24); ctx.fillStyle = '#4a4c50'; ctx.fillRect(w / 2 - 12, h * fy - 13, 24, 2); }
      ctx.fillStyle = '#8a8d92'; ctx.fillRect(4, 6, 10, 2); ctx.fillRect(4, h - 8, 10, 2);
    }, { repeat: [1, 42] }),
    sff: tex('sff_drive_face', 64, 320, (ctx, w, h) => drawSff(ctx, w, h)),
    sffSq: tex('sff_drive_face_1u', 160, 144, (ctx, w, h) => {
      // 1U 2.5" carrier seen face-on: thin grey frame, orange release button top-left, LED bar right, perforated body
      ctx.fillStyle = '#8a8d92'; ctx.fillRect(0, 0, w, h);
      const gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#111215'; ctx.fillRect(6, 6, w - 12, h - 12);
      ctx.fillStyle = '#2a2c30'; ctx.fillRect(6, 6, w - 12, 30);
      ctx.beginPath(); ctx.arc(26, 21, 10, 0, 7); ctx.fillStyle = '#e0702a'; ctx.fill(); ctx.beginPath(); ctx.arc(26, 21, 6, 0, 7); ctx.fillStyle = '#26282c'; ctx.fill();
      ctx.fillStyle = '#3dff6e'; ctx.shadowColor = '#3dff6e'; ctx.shadowBlur = 5; ctx.fillRect(w - 20, 12, 4, 18); ctx.shadowBlur = 0; ctx.fillStyle = '#2f8dff'; ctx.fillRect(w - 20, 34, 4, 10);
      for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) { ctx.fillStyle = '#26282c'; ctx.fillRect(12 + c * 16, 42 + r * 15, 11, 10); ctx.fillStyle = '#000'; ctx.fillRect(14 + c * 16, 44 + r * 15, 7, 6); }
      ctx.fillStyle = '#b9bcc1'; ctx.fillRect(12, h - 22, w - 44, 12); ctx.fillStyle = '#4a4d52'; ctx.fillRect(16, h - 18, 60, 2); ctx.fillRect(16, h - 14, 44, 2);
    }),
    sqMesh: tex('square_mesh_vent', 256, 256, (ctx, w, h) => { ctx.fillStyle = '#1f2125'; ctx.fillRect(0, 0, w, h); const c = 6, s = w / c; for (let y = 0; y < c; y++) for (let x = 0; x < c; x++) { ctx.fillStyle = '#040506'; ctx.fillRect(x * s + 4, y * s + 4, s - 8, s - 8); ctx.fillStyle = '#34373d'; ctx.fillRect(x * s + 4, y * s + 2, s - 8, 2); } }, { repeat: [1, 1] }),
    leftStatus: tex('left_status_column', 64, 384, (ctx, w, h) => { ctx.fillStyle = '#1d1f23'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#2f8dff'; ctx.shadowColor = '#2f8dff'; ctx.shadowBlur = 6; ctx.fillRect(w * 0.6, h * 0.12, w * 0.12, h * 0.5); ctx.shadowBlur = 0; for (const [fy, c] of [[0.2, '#a5a8ad'], [0.32, '#a5a8ad'], [0.44, '#a5a8ad'], [0.56, '#3dff6e']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(w * 0.3, h * fy, 3.5, 0, 7); ctx.fill(); } ctx.fillStyle = '#3a3d42'; ctx.fillRect(w * 0.2, h * 0.75, w * 0.6, h * 0.14); }),
    lff: tex('lff_drive_face', 384, 96, (ctx, w, h) => {
      ctx.fillStyle = '#20222a'; ctx.fillRect(0, 0, w, h);
      const gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#33363c'; ctx.lineWidth = 3; ctx.strokeRect(3, 3, w - 6, h - 6);
      for (let i = 0; i < 14; i++) for (let j = 0; j < 3; j++) { ctx.fillStyle = '#08090a'; ctx.beginPath(); ctx.roundRect(24 + i * 20, 16 + j * 20, 12, 12, 3); ctx.fill(); }
      ctx.fillStyle = '#7d8187'; ctx.fillRect(w - 62, 10, 48, h - 20); ctx.fillStyle = '#2c6fd6'; ctx.fillRect(w - 58, 14, 40, 14); ctx.fillStyle = '#0d0e10'; for (let k = 0; k < 8; k++) ctx.fillRect(w - 56 + (k % 4) * 10, 34 + Math.floor(k / 4) * 12, 6, 8);
      ctx.fillStyle = '#d96e1a'; ctx.fillRect(w - 96, h / 2 - 14, 18, 28);
      ctx.fillStyle = '#e8e8e6'; ctx.fillRect(w - 170, h - 30, 60, 16); ctx.fillStyle = '#7a7d82'; ctx.font = '10px Arial'; ctx.textAlign = 'left'; ctx.fillText('SAS 12G', w - 166, h - 18);
      for (const [x, c] of [[w - 22, '#3dff6e'], [w - 38, '#2f8dff']]) { ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 6; ctx.beginPath(); ctx.arc(x, 20, 3.5, 0, 7); ctx.fill(); ctx.shadowBlur = 0; }
    }),
    ctrl: tex('control_panel', 96, 384, (ctx, w, h) => {
      // R550 right control column: power button, USB-A, VGA, iDRAC micro-USB, model strip
      ctx.fillStyle = '#1f2125'; ctx.fillRect(0, 0, w, h);
      const gr = ctx.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#34373c'; ctx.beginPath(); ctx.arc(w / 2, h * 0.1, w * 0.2, 0, 7); ctx.fill();
      ctx.strokeStyle = '#3dff6e'; ctx.shadowColor = '#3dff6e'; ctx.shadowBlur = 6; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(w / 2, h * 0.1, w * 0.11, 0.35 * Math.PI, 2.65 * Math.PI); ctx.stroke(); ctx.beginPath(); ctx.moveTo(w / 2, h * 0.06); ctx.lineTo(w / 2, h * 0.1); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#9a9ea3'; ctx.fillRect(w * 0.3, h * 0.24, w * 0.4, h * 0.03); ctx.fillStyle = '#0a0b0c'; ctx.fillRect(w * 0.34, h * 0.245, w * 0.32, h * 0.02);
      ctx.fillStyle = '#2b6fd6'; ctx.beginPath(); ctx.roundRect(w * 0.22, h * 0.33, w * 0.56, h * 0.07, 6); ctx.fill(); ctx.fillStyle = '#0a0b0c'; for (let i = 0; i < 15; i++) ctx.fillRect(w * 0.28 + (i % 5) * w * 0.09, h * 0.345 + Math.floor(i / 5) * h * 0.017, 3, 3);
      ctx.fillStyle = '#0a0b0c'; for (let i = 0; i < 9; i++) ctx.fillRect(w * 0.3 + (i % 3) * w * 0.14, h * 0.48 + Math.floor(i / 3) * h * 0.03, 4, 4);
      ctx.fillStyle = '#9a9ea3'; ctx.beginPath(); ctx.roundRect(w * 0.38, h * 0.66, w * 0.24, h * 0.025, 4); ctx.fill();
      ctx.fillStyle = '#e4e4e0'; ctx.fillRect(w * 0.15, h * 0.9, w * 0.7, h * 0.05); ctx.fillStyle = '#2b6fd6'; ctx.fillRect(w * 0.15, h * 0.95, w * 0.7, h * 0.008); ctx.fillStyle = '#1a1b1e'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center'; ctx.fillText('R550', w / 2, h * 0.937);
    }),
    leftPorts: tex('left_ports', 96, 384, (ctx, w, h) => {
      ctx.fillStyle = '#c3c6ca'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#0c0d0e'; ctx.beginPath(); ctx.roundRect(w * 0.2, h * 0.3, w * 0.6, h * 0.1, 4); ctx.fill();
      ctx.fillStyle = '#16181a'; ctx.beginPath(); ctx.roundRect(w * 0.2, h * 0.55, w * 0.6, h * 0.08, 4); ctx.fill();
      ctx.fillStyle = '#5a5e62'; ctx.fillRect(w * 0.3, h * 0.18, w * 0.4, 4); ctx.fillRect(w * 0.3, h * 0.72, w * 0.4, 4);
    }),
  };
  // switch / patch / rear / pdu faces drawn in meter space
  const mspace = (ctx, w, h, wm, hm) => { ctx.scale(w / wm, h / hm); };
  const rj45 = (ctx, x, y, w, h) => { ctx.fillStyle = '#5a5d63'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#07080a'; ctx.fillRect(x + w * 0.1, y + h * 0.12, w * 0.8, h * 0.78); ctx.fillStyle = '#c9a54a'; for (let k = 0; k < 8; k++) ctx.fillRect(x + w * 0.18 + k * w * 0.08, y + h * 0.16, w * 0.045, h * 0.3); ctx.fillStyle = '#2a2c30'; ctx.fillRect(x + w * 0.35, y + h * 0.72, w * 0.3, h * 0.16); };
  const ledDot = (ctx, x, y, r, c) => { ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 0.002; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.shadowBlur = 0; };
  const switchTex = (ports) => tex('switch_face_' + ports, 2048, 190, (ctx, w, h) => {
    mspace(ctx, w, h, CW, U); ctx.fillStyle = '#25272b'; ctx.fillRect(0, 0, CW, U);
    const gr = ctx.createLinearGradient(0, 0, 0, U); gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, CW, U);
    const cols = ports / 2, pw = 0.0125;
    for (let r = 0; r < 2; r++) for (let i = 0; i < cols; i++) {
      const x = 0.024 + i * pw, y = r ? 0.0245 : 0.0055; rj45(ctx, x + 0.0012, y, pw - 0.0024, 0.0115);
      ledDot(ctx, x + 0.003, r ? 0.0225 : 0.0195, 0.0008, '#3dff6e'); if (i % 3 !== 1) ledDot(ctx, x + 0.0085, r ? 0.0225 : 0.0195, 0.0008, '#ffb02e');
      if (i % 2 === 0) { ctx.fillStyle = '#9a9ea5'; ctx.font = '0.0028px Arial'; ctx.textAlign = 'center'; ctx.fillText(String(i + 1 + r * cols), x + pw / 2, r ? 0.0405 : 0.004); }
    }
    const sx = 0.024 + cols * pw + 0.012;
    for (let r = 0; r < 2; r++) for (let i = 0; i < 2; i++) { ctx.fillStyle = '#8b8f96'; ctx.fillRect(sx + i * 0.021, r ? 0.0245 : 0.0055, 0.018, 0.0115); ctx.fillStyle = '#0b0c0e'; ctx.fillRect(sx + i * 0.021 + 0.0015, (r ? 0.0245 : 0.0055) + 0.002, 0.015, 0.0075); }
    ctx.fillStyle = '#5a5d63'; ctx.fillRect(0.006, 0.006, 0.013, 0.011); ctx.fillStyle = '#07080a'; ctx.fillRect(0.0075, 0.0075, 0.010, 0.008); ctx.fillStyle = '#12b4d8'; ctx.fillRect(0.006, 0.026, 0.013, 0.011);
    for (let i = 0; i < 3; i++) ledDot(ctx, CW - 0.03 + i * 0.008, 0.012, 0.0012, i ? '#3dff6e' : '#2f8dff');
    ctx.fillStyle = '#c9ccd1'; ctx.font = 'bold 0.004px Arial'; ctx.textAlign = 'right'; ctx.fillText(ports + 'P 10G', CW - 0.008, 0.034);
    ctx.fillStyle = '#0a0b0c'; for (let i = 0; i < 12; i++) ctx.fillRect(CW - 0.062 + (i % 4) * 0.006, 0.02 + Math.floor(i / 4) * 0.006, 0.004, 0.004);
  });
  T.switch48 = switchTex(48); T.switch24 = switchTex(24);
  T.patch = tex('patch_panel_face', 2048, 190, (ctx, w, h) => {
    mspace(ctx, w, h, CW, U); ctx.fillStyle = '#1e2024'; ctx.fillRect(0, 0, CW, U);
    for (let i = 0; i < 24; i++) { const x = 0.0125 + i * 0.0172; ctx.fillStyle = '#2f3237'; ctx.fillRect(x - 0.0005, 0.011, 0.016, 0.02); rj45(ctx, x, 0.013, 0.015, 0.016); ctx.fillStyle = '#e6e6e2'; ctx.fillRect(x + 0.0025, 0.0025, 0.01, 0.006); ctx.fillStyle = '#222'; ctx.font = 'bold 0.0045px Arial'; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), x + 0.0075, 0.0072); }
    ctx.fillStyle = '#3a3d43'; ctx.fillRect(0, 0.036, CW, 0.0045);
  });
  T.pdu = tex('vertical_pdu_face', 128, 2048, (ctx, w, h) => {
    mspace(ctx, w, h, 0.045, 1.62); ctx.fillStyle = '#1b1c1f'; ctx.fillRect(0, 0, 0.045, 1.62);
    for (let k = 0; k < 30; k++) { const y = 1.62 - (0.18 + k * 0.045), big = k > 12 && k < 17, oh = big ? 0.026 : 0.02, ow = big ? 0.032 : 0.026; ctx.fillStyle = '#0c0d0f'; ctx.fillRect(0.0225 - ow / 2, y - oh / 2, ow, oh); ctx.fillStyle = '#3a3d42'; ctx.fillRect(0.0225 - ow * 0.28, y - oh * 0.28, 0.003, 0.006); ctx.fillRect(0.0225 + ow * 0.28 - 0.003, y - oh * 0.28, 0.003, 0.006); ctx.fillRect(0.0225 - 0.0015, y + 0.002, 0.003, 0.005); if (k % 6 === 0) ledDot(ctx, 0.005, y, 0.0012, '#3dff6e'); }
    ctx.fillStyle = '#0d2b1e'; ctx.fillRect(0.008, 0.06, 0.029, 0.03); ctx.fillStyle = '#3dff6e'; ctx.font = 'bold 0.009px Arial'; ctx.textAlign = 'center'; ctx.fillText('6.4A', 0.0225, 0.079);
    ctx.fillStyle = '#2a2c31'; ctx.fillRect(0.008, 1.50, 0.029, 0.06); ctx.fillStyle = '#c8361c'; ctx.fillRect(0.016, 1.515, 0.013, 0.03);
  });
  const rearTex = (u) => tex('rear_face_' + u + 'u', 1024, Math.round(1024 * u * U / CW), (ctx, w, h) => {
    const H = u * U; mspace(ctx, w, h, CW, H);
    ctx.fillStyle = '#2c2f34'; ctx.fillRect(0, 0, CW, H);
    // hex fan exhaust: canvas left = world +x (plane rotated 180°) → PSUs drawn left, fans right
    const fanW = u === 1 ? 0.16 : 0.2, fanH = Math.min(H - 0.006, 0.08);
    ctx.save(); ctx.beginPath(); ctx.rect(CW - fanW - 0.008, 0.003, fanW, fanH); ctx.clip(); ctx.translate(CW - fanW - 0.008, 0.003); ctx.scale(0.0009, 0.0009); drawHex(ctx, fanW / 0.0009, fanH / 0.0009, '#1c1e22', '#050607', 5, '#4a4d53'); ctx.restore();
    // low-profile PCIe slot brackets (4 on 2U, R550-style) with blue release latches
    if (u >= 2) { const slots = u >= 3 ? 6 : 4; for (let i = 0; i < slots; i++) { const x = 0.195 + i * 0.023; ctx.fillStyle = '#5a5e65'; ctx.fillRect(x, 0.006, 0.02, 0.06); ctx.fillStyle = '#1a1c20'; for (let k = 0; k < 6; k++) ctx.fillRect(x + 0.003, 0.012 + k * 0.008, 0.014, 0.004); ctx.fillStyle = '#2b6fd6'; ctx.fillRect(x + 0.004, 0.0015, 0.012, 0.004); } ctx.fillStyle = '#4a4d53'; ctx.fillRect(0.195, 0.068, 0.09, 0.006); }
    // BOSS-S2 module + system ID button
    if (u >= 2) { ctx.fillStyle = '#3a3d43'; ctx.fillRect(0.34, H - 0.02, 0.045, 0.012); ctx.fillStyle = '#0a0b0d'; ctx.fillRect(0.343, H - 0.017, 0.018, 0.006); ctx.fillRect(0.364, H - 0.017, 0.018, 0.006); ledDot(ctx, 0.33, H - 0.014, 0.0015, '#2f8dff'); }
    // PSUs bottom-left (canvas) = world right
    for (let i = 0; i < 2; i++) { const x = 0.008 + i * 0.09, y = H - 0.042; ctx.fillStyle = '#222428'; ctx.fillRect(x, y, 0.084, 0.038); ctx.strokeStyle = '#4c5057'; ctx.lineWidth = 0.0008; ctx.strokeRect(x, y, 0.084, 0.038); ctx.save(); ctx.beginPath(); ctx.rect(x + 0.034, y + 0.004, 0.044, 0.03); ctx.clip(); ctx.translate(x + 0.034, y + 0.004); ctx.scale(0.0007, 0.0007); drawHex(ctx, 0.044 / 0.0007, 0.03 / 0.0007, '#1c1e22', '#050607', 5); ctx.restore(); ctx.fillStyle = '#0a0b0c'; ctx.fillRect(x + 0.008, y + 0.011, 0.02, 0.016); ctx.fillStyle = '#4a4d52'; ctx.fillRect(x + 0.012, y + 0.015, 0.003, 0.008); ctx.fillRect(x + 0.021, y + 0.015, 0.003, 0.008); ctx.fillRect(x + 0.0165, y + 0.013, 0.003, 0.004); ctx.fillStyle = '#d96e1a'; ctx.fillRect(x + 0.079, y + 0.006, 0.004, 0.026); ledDot(ctx, x + 0.03, y + 0.033, 0.0012, '#3dff6e'); }
    // I/O block: NICs, mgmt, VGA, USB
    const iy = H - 0.02, ix = 0.20;
    for (let k = 0; k < 4; k++) rj45(ctx, ix + k * 0.0155, iy - 0.006, 0.0135, 0.0115);
    ctx.fillStyle = '#12b4d8'; ctx.fillRect(ix + 0.066, iy - 0.006, 0.0135, 0.0115);
    ctx.fillStyle = '#2b6fd6'; ctx.fillRect(ix + 0.085, iy - 0.005, 0.017, 0.009);
    ctx.fillStyle = '#0a0b0c'; ctx.fillRect(ix + 0.107, iy - 0.0035, 0.013, 0.006);
    ctx.fillStyle = '#e8e8e6'; ctx.fillRect(0.008, 0.005, 0.03, 0.007);
  });
  T.rear = { 1: rearTex(1), 2: rearTex(2), 3: rearTex(3), 4: rearTex(4) };

  /* ---------------- materials ---------------- */
  const M = (n, o) => { const m = new THREE.MeshStandardMaterial(o); m.name = n; return m; };
  const mats = {
    steel: M('powder_coated_steel', { color: 0x1c1d20, roughness: 0.62, metalness: 0.55, map: T.powder }),
    silver: M('brushed_silver_chassis', { color: 0xc4c8cd, roughness: 0.32, metalness: 0.85, map: T.brushed }),
    graphite: M('graphite_chassis', { color: 0x4a4e55, roughness: 0.4, metalness: 0.8, map: T.brushed }),
    trim: M('chassis_trim', { color: 0xd2d5d9, roughness: 0.25, metalness: 0.9 }),
    ear: M('rack_ear_metal', { color: 0xb7bbbf, roughness: 0.35, metalness: 0.85 }),
    dark: M('backplane_dark', { color: 0x15161a, roughness: 0.6, metalness: 0.5 }),
    bezelPlastic: M('bezel_plastic', { color: 0x2a2c30, roughness: 0.7, metalness: 0.1 }),
    grill: M('honeycomb_grill', { color: 0x8e9196, roughness: 0.45, metalness: 0.7, map: T.hexGrill, alphaMap: T.hexAlpha, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }),
    grillSolid: M('honeycomb_vent', { color: 0xffffff, roughness: 0.6, metalness: 0.5, map: T.hexGrill }),
    doorMesh: M('perforated_door', { color: 0x9a9ca1, roughness: 0.55, metalness: 0.6, map: T.hexGrill, alphaMap: T.hexAlpha, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }),
    rail: M('mounting_rail', { color: 0xffffff, roughness: 0.55, metalness: 0.6, map: T.rail }),
    sff: M('sff_drive', { map: T.sff, roughness: 0.5, metalness: 0.35 }),
    sffSq: M('sff_drive_1u', { map: T.sffSq, roughness: 0.5, metalness: 0.35 }),
    sqMesh: M('square_mesh_vent', { map: T.sqMesh, roughness: 0.9, metalness: 0.05 }),
    leftStatus: M('left_status_column', { map: T.leftStatus, roughness: 0.5, metalness: 0.4 }),
    lff: M('lff_drive', { map: T.lff, roughness: 0.5, metalness: 0.35 }),
    driveSide: M('drive_carrier_side', { color: 0x1a1c1e, roughness: 0.6, metalness: 0.4 }),
    ctrl: M('control_panel', { map: T.ctrl, roughness: 0.4, metalness: 0.55 }),
    leftPorts: M('left_ports', { map: T.leftPorts, roughness: 0.4, metalness: 0.55 }),
    switch48: M('switch_faceplate_48', { map: T.switch48, roughness: 0.5, metalness: 0.4 }),
    switch24: M('switch_faceplate_24', { map: T.switch24, roughness: 0.5, metalness: 0.4 }),
    patch: M('patch_panel_faceplate', { map: T.patch, roughness: 0.55, metalness: 0.4 }),
    pdu: M('pdu_faceplate', { map: T.pdu, roughness: 0.6, metalness: 0.3 }),
    rear: { 1: M('rear_io_1u', { map: T.rear[1], roughness: 0.55, metalness: 0.45 }), 2: M('rear_io_2u', { map: T.rear[2], roughness: 0.55, metalness: 0.45 }), 3: M('rear_io_3u', { map: T.rear[3], roughness: 0.55, metalness: 0.45 }), 4: M('rear_io_4u', { map: T.rear[4], roughness: 0.55, metalness: 0.45 }) },
    screw: M('zinc_screw', { color: 0xb8bcc2, roughness: 0.3, metalness: 0.9 }),
    rubber: M('rubber', { color: 0x141416, roughness: 0.95, metalness: 0 }),
    cableBlue: M('cable_blue', { color: 0x1f56c4, roughness: 0.6, metalness: 0 }),
    cableBlack: M('cable_black', { color: 0x161719, roughness: 0.7, metalness: 0 }),
    cableYellow: M('cable_yellow_fiber', { color: 0xe2bd1e, roughness: 0.6, metalness: 0 }),
    boot: M('connector_boot', { color: 0x0e0f11, roughness: 0.5, metalness: 0.1 }),
    velcro: M('velcro_strap', { color: 0x0a0a0b, roughness: 0.95, metalness: 0 }),
    brush: M('brush_grommet', { color: 0x2a2b2e, roughness: 1, metalness: 0 }),
    lcd: M('lcd_display', { color: 0x1a2a20, roughness: 0.4, metalness: 0, emissive: 0x143a24, emissiveIntensity: 0.8 }),
    cyan: M('indicator_bar_cyan', { color: 0x0abfcf, emissive: 0x00d4e8, emissiveIntensity: 1.8, roughness: 0.3, metalness: 0.5, toneMapped: false }),
  };
  const ledMat = (hex) => { const m = M('led_' + hex.toString(16), { color: 0x0a2012, emissive: hex, emissiveIntensity: 1.6, toneMapped: false }); anim.push(m); return m; };

  /* ---------------- helpers ---------------- */
  let id = 0;
  const box = (name, mat, w, h, d, x, y, z, parent) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.name = name + '_' + (id++); m.position.set(x, y, z); (parent || g).add(m); return m; };
  const plane = (name, mat, w, h, x, y, z, rotY, parent) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.name = name + '_' + (id++); m.position.set(x, y, z); if (rotY) m.rotation.y = rotY; (parent || g).add(m); return m; };
  const cyl = (name, mat, r, h, x, y, z, axis, parent, seg) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg || 20), mat); m.name = name + '_' + (id++); m.position.set(x, y, z); if (axis === 'z') m.rotation.x = Math.PI / 2; if (axis === 'x') m.rotation.z = Math.PI / 2; (parent || g).add(m); return m; };
  const tube = (name, mat, pts, r) => { const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))); const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, r, 10, false), mat); m.name = name + '_' + (id++); g.add(m); cyl('connector_boot', mats.boot, r * 1.6, r * 6, ...pts[0], 'z', g, 10); return m; };
  const yb = n => Y0 + (n - 1) * U;
  const grillMesh = (w, h, x, y, z, mat) => { const m = plane('honeycomb', mat || mats.grill, w, h, x, y, z); const t = (mat || mats.grill).map; if (!m.geometry.attributes.uv._scaled) { const uv = m.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 0.05, uv.getY(i) * h / 0.0433); uv.needsUpdate = true; } return m; };

  /* ---------------- frame ---------------- */
  box('base_plinth', mats.steel, W, 0.06, D, 0, 0.10, 0);
  box('top_panel', mats.steel, W, 0.03, D, 0, TOP + 0.015, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box('corner_post', mats.steel, 0.04, TOP - 0.13, 0.04, sx * (W / 2 - 0.02), (TOP + 0.13) / 2, sz * (D / 2 - 0.02));
    const wx = sx * (W / 2 - 0.08), wz = sz * (D / 2 - 0.1);
    box('caster_bracket', mats.steel, 0.04, 0.03, 0.05, wx, 0.06, wz);
    cyl('caster_wheel', mats.rubber, 0.035, 0.028, wx, 0.035, wz, 'x', g, 24);
    cyl('caster_hub', mats.screw, 0.012, 0.032, wx, 0.035, wz, 'x', g, 16);
    cyl('leveling_foot', mats.screw, 0.012, 0.05, sx * (W / 2 - 0.16), 0.045, sz * (D / 2 - 0.06), 'y', g, 16);
    cyl('leveling_pad', mats.rubber, 0.022, 0.012, sx * (W / 2 - 0.16), 0.006, sz * (D / 2 - 0.06), 'y', g, 16);
  }
  for (const sx of [-1, 1]) box('side_panel', mats.steel, 0.0025, TOP - 0.13, D - 0.08, sx * (W / 2 - 0.001), (TOP + 0.13) / 2, 0);
  for (const sx of [-1, 1]) for (const [z, face] of [[ZF, 1], [-0.36, -1]]) {
    box('mounting_rail_body', mats.steel, 0.018, TOP - Y0, 0.0025, sx * 0.235, (TOP + Y0) / 2, z);
    plane('mounting_rail_face', mats.rail, 0.018, TOP - Y0, sx * 0.235, (TOP + Y0) / 2, z + face * 0.0014, face < 0 ? Math.PI : 0);
    box('rail_bracket', mats.steel, 0.05, TOP - Y0, 0.02, sx * 0.27, (TOP + Y0) / 2, z - 0.012);
  }
  for (const z of [0.22, -0.32]) { box('top_cable_cutout', mats.dark, 0.26, 0.004, 0.09, 0, TOP + 0.031, z); box('brush_strip', mats.brush, 0.24, 0.006, 0.07, 0, TOP + 0.032, z); }
  const doorParts = (parent, w, h) => {
    grillMesh(w - 0.08, h - 0.08, 0, 0, 0, mats.doorMesh);
    const gm = parent.children[parent.children.length - 1] || null;
    const last = g.children.pop(); parent.add(last);
    for (const [bw, bh, x, y] of [[w, 0.05, 0, h / 2 - 0.025], [w, 0.05, 0, -h / 2 + 0.025], [0.05, h, w / 2 - 0.025, 0], [0.05, h, -w / 2 + 0.025, 0]]) box('door_frame', mats.steel, bw, bh, 0.02, x, y, 0, parent);
    box('door_frame', mats.steel, w - 0.08, 0.03, 0.015, 0, 0, 0, parent);
  };
  const rd = new THREE.Group(); rd.name = 'rear_door'; rd.position.set(0, (TOP + 0.13) / 2, -D / 2 - 0.012); g.add(rd);
  doorParts(rd, W - 0.02, TOP - 0.13);
  box('rear_handle', mats.graphite, 0.03, 0.2, 0.02, -0.24, 0.05, -0.02, rd); cyl('rear_lock', mats.screw, 0.008, 0.01, -0.24, 0.16, -0.02, 'z', rd, 16);
  const hinge = new THREE.Group(); hinge.name = 'front_door_hinge'; hinge.position.set(-(W / 2 - 0.01), (TOP + 0.13) / 2, D / 2 + 0.012); hinge.rotation.y = Math.PI * 0.64; g.add(hinge);
  const fd = new THREE.Group(); fd.name = 'front_door'; fd.position.set((W - 0.02) / 2, 0, 0); hinge.add(fd);
  doorParts(fd, W - 0.02, TOP - 0.13);
  box('front_handle', mats.graphite, 0.03, 0.2, 0.02, 0.24, 0.05, 0.02, fd); cyl('front_lock', mats.screw, 0.008, 0.01, 0.24, 0.16, 0.025, 'z', fd, 16);
  for (const hy of [-0.75, 0, 0.75]) cyl('door_hinge_pin', mats.screw, 0.008, 0.08, 0, hy, 0, 'y', hinge, 12);

  /* ---------------- equipment ---------------- */
  const ears = (n, u, mat) => {
    const h = u * U - 0.003, yc = yb(n) + u * U / 2;
    for (const sx of [-1, 1]) {
      box('rack_ear_flange', mat || mats.ear, 0.024, h, 0.003, sx * 0.2305, yc, ZF + 0.0028);
      box('rack_ear_body', mat || mats.ear, 0.004, h, 0.05, sx * 0.2205, yc, ZF - 0.025);
      for (const f of [0.22, 0.78]) { cyl('ear_screw', mats.screw, 0.0045, 0.002, sx * 0.2305, yb(n) + f * u * U, ZF + 0.0053, 'z', g, 12); }
    }
  };
  let F = ZF; // current equipment front plane (per-server recess)
  const chassis = (n, u, depth, mat) => {
    const h = u * U - 0.004, yc = yb(n) + u * U / 2;
    box('chassis_body', mat, CW, h, depth, 0, yc, F - depth / 2);
    return { yc, h, zr: F - depth };
  };
  const rearFace = (n, u, zr) => { const yc = yb(n) + u * U / 2; plane('rear_io_plate', mats.rear[u], CW, u * U - 0.004, 0, yc, zr - 0.0015, Math.PI); const h = u * U;
    // world coords derived from the texture layout (canvas left = +x)
    const inlets = [0, 1].map(i => [0.2185 - (0.008 + i * 0.09 + 0.018), yc + h / 2 - (h - 0.042 + 0.019), zr - 0.004, i]);
    return { inlets, nic: [0.2185 - (0.20 + 0.007), yc + h / 2 - (h - 0.02), zr - 0.004] }; };
  const sffDrive = (x, y, z, w, h, sq) => { const face = sq ? mats.sffSq : mats.sff; const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.006), [mats.driveSide, mats.driveSide, mats.driveSide, mats.driveSide, face, mats.driveSide]); m.name = 'sff_drive_carrier_' + (id++); m.position.set(x, y, z); g.add(m); const l = cyl('activity_led', ledMat(0x3dff6e), 0.0008, 0.001, sq ? x + w * 0.39 : x - w * 0.22, sq ? y + h * 0.35 : y + h * 0.425, z + 0.0035, 'z', g, 8); l.userData.phase = x * 40 + y * 17; };
  const lffDrive = (x, y, z, w, h) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.006), [mats.driveSide, mats.driveSide, mats.driveSide, mats.driveSide, mats.lff, mats.driveSide]); m.name = 'lff_drive_carrier_' + (id++); m.position.set(x, y, z); g.add(m); const l = cyl('activity_led', ledMat(0x3dff6e), 0.0009, 0.001, x + w / 2 - w * 0.057, y + h / 2 - h * 0.2, z + 0.0035, 'z', g, 8); l.userData.phase = x * 30 + y * 23; };
  const frontFrame = (yc, h, mat) => { box('front_trim', mat, CW, 0.004, 0.015, 0, yc + h / 2 - 0.002, F - 0.0025); box('front_trim', mat, CW, 0.004, 0.015, 0, yc - h / 2 + 0.002, F - 0.0025); plane('backplane', mats.dark, CW - 0.004, h - 0.004, 0, yc, F - 0.004); };
  const sidePanels = (yc, h, ports) => { plane('control_panel', mats.ctrl, 0.024, h - 0.006, 0.2055, yc, F + 0.0016); if (ports) plane('left_status_column', mats.leftStatus, 0.011, h - 0.006, -0.212, yc, F + 0.0016); };
  const sqVent = (x, yc, w, h, z) => { const geo = new THREE.PlaneGeometry(w, h); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 0.03, uv.getY(i) * h / 0.03); uv.needsUpdate = true; const m = new THREE.Mesh(geo, mats.sqMesh); m.name = 'square_mesh_vent_' + (id++); m.position.set(x, yc, z); g.add(m); };
  const cyanBar = (yc, h) => { box('indicator_bar', mats.cyan, 0.006, h * 0.42, 0.0015, 0.2135, yc + h * 0.29 - h * 0.21, F + 0.0015); };
  const bezel = (yc, h) => { grillMesh(CW - 0.045, h - 0.01, 0, yc, ZF + 0.012); for (const sx of [-1, 1]) box('bezel_frame', mats.bezelPlastic, 0.02, h - 0.006, 0.012, sx * (CW / 2 - 0.014), yc, ZF + 0.007); box('bezel_frame', mats.bezelPlastic, CW - 0.045, 0.004, 0.012, 0, yc + h / 2 - 0.004, ZF + 0.007); box('bezel_frame', mats.bezelPlastic, CW - 0.045, 0.004, 0.012, 0, yc - h / 2 + 0.004, ZF + 0.007); cyl('bezel_lock', mats.screw, 0.005, 0.002, CW / 2 - 0.014, yc, ZF + 0.014, 'z', g, 16); box('bezel_badge', mats.trim, 0.03, 0.008, 0.001, -CW / 2 + 0.06, yc - h / 2 + 0.012, ZF + 0.0185); };
  // PowerEdge 15G/16G-style hex bezel: ONE plane carrying a tiling alpha map (apertures), a normal map (rib land +
  // chamfers) and a shaded colour map, over the drive bays a few mm behind for real parallax. Graphite plastic.
  // Pointy-top lattice: row pitch 1.5R, column pitch sqrt(3)R; tile = one column x two rows (sqrt(3)R x 3R).
  const bezelDark = M('bezel_body', { color: 0x1c1d21, roughness: 0.55, metalness: 0.3 });
  const bezelGloss = M('bezel_badge_gloss', { color: 0x101114, roughness: 0.15, metalness: 0.6 });
  const hexTiles = {};
  const hexTile = (u) => {
    if (hexTiles[u]) return hexTiles[u];
    const R = { 1: 0.0125, 2: 0.0245, 4: 0.0245 }[u] || 0.0245, rib = R * 0.38, land = rib * 0.34;
    const TW = 384, TH = Math.round(TW * Math.sqrt(3) / 3);
    const pxm = (3 * R) / TW;                 // metres per pixel
    const a = R * Math.sqrt(3) / 2;                      // inradius
    const hgt = new Float32Array(TW * TH), alpha = new Uint8ClampedArray(TW * TH);
    const nrm = [[0, 1], [Math.sqrt(3) / 2, 0.5], [Math.sqrt(3) / 2, -0.5]];
    const cubeRound = (q, r) => { let x = q, z = r, y = -x - z, rx = Math.round(x), ry = Math.round(y), rz = Math.round(z); const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z); if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry; return [rx, rz]; };
    for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i++) {
      const x = i * pxm, y = j * pxm;
      const q = (Math.sqrt(3) / 3 * y - x / 3) / R, r = (2 / 3 * x) / R; const [rq, rr] = cubeRound(q, r);
      const cy = R * Math.sqrt(3) * (rq + rr / 2), cx = R * 1.5 * rr;
      const dxp = x - cx, dyp = y - cy; let d = 0; for (const n of nrm) d = Math.max(d, Math.abs(dxp * n[0] + dyp * n[1]));
      const e = a - d;                                   // distance inward from the shared edge line
      const k = j * TW + i;
      if (e > rib / 2) { hgt[k] = 0; alpha[k] = 0; }
      else if (e < land / 2) { hgt[k] = 1; alpha[k] = 255; }
      else { const t = (e - land / 2) / (rib / 2 - land / 2); hgt[k] = 1 - t * t; alpha[k] = 255; }
    }
    const mk = (fill) => { const c = document.createElement('canvas'); c.width = TW; c.height = TH; const ctx = c.getContext('2d'); const im = ctx.createImageData(TW, TH); fill(im.data); ctx.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
    const H = (i, j) => hgt[((j + TH) % TH) * TW + ((i + TW) % TW)];
    const normal = mk(d => { for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i++) { const k = (j * TW + i) * 4; const gx = (H(i + 1, j) - H(i - 1, j)) * 0.5, gy = (H(i, j + 1) - H(i, j - 1)) * 0.5; const s = 5.0; let nx = -gx * s, ny = gy * s, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l; d[k] = (nx * 0.5 + 0.5) * 255; d[k + 1] = (ny * 0.5 + 0.5) * 255; d[k + 2] = (nz * 0.5 + 0.5) * 255; d[k + 3] = 255; } });
    const color = mk(d => { let sd = 3; const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647; for (let k = 0; k < TW * TH; k++) { const h = hgt[k], v = 52 + h * 46 + (rn() - 0.5) * 10; d[k * 4] = v; d[k * 4 + 1] = v; d[k * 4 + 2] = v - 3; d[k * 4 + 3] = 255; } }); color.colorSpace = THREE.SRGBColorSpace;
    const alphaT = mk(d => { for (let k = 0; k < TW * TH; k++) { d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = alpha[k]; d[k * 4 + 3] = 255; } });
    const rough = mk(d => { for (let k = 0; k < TW * TH; k++) { const v = 150 + (1 - hgt[k]) * 50; d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = v; d[k * 4 + 3] = 255; } });
    const mat = M('bezel_hex_lattice_' + u + 'u', { map: color, alphaMap: alphaT, normalMap: normal, normalScale: new THREE.Vector2(1, 1), roughnessMap: rough, roughness: 1, metalness: 0.05, color: 0x7c7c78, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
    hexTiles[u] = { mat, R, tw: 3 * R, th: Math.sqrt(3) * R }; return hexTiles[u];
  };
  const cover = (yc, h, u) => {
    const cap = 0.036, lw = CW - 2 * cap, lh = h - 0.008, depth = 0.01384, zFace = ZF + depth, z0 = ZF + 0.004;
    const Tl = hexTile(u);
    const geo = new THREE.PlaneGeometry(lw, lh); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * lw / Tl.tw, uv.getY(i) * lh / Tl.th + 0.5 - (lh / Tl.th) / 2); uv.needsUpdate = true;
    const face = new THREE.Mesh(geo, Tl.mat); face.name = 'bezel_hex_face_' + (id++); face.position.set(0, yc, zFace - 0.001); g.add(face);
    // recessed web floor: dark plane behind the lattice, drives still visible through the apertures beyond it
    const floorMat = M('bezel_web_floor', { color: 0x0d0e10, roughness: 0.9, metalness: 0, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
    plane('bezel_web_floor', floorMat, lw, lh, 0, yc, ZF + 0.0065);
    // frame: end caps, top/bottom rails, side returns
    for (const sx of [-1, 1]) { box('bezel_end_cap', bezelDark, cap, h, depth, sx * (CW / 2 - cap / 2), yc, ZF + depth / 2); box('bezel_end_cap_inset', mats.dark, cap - 0.01, h - 0.012, 0.0015, sx * (CW / 2 - cap / 2), yc, zFace + 0.0005); }
    box('bezel_rail', bezelDark, lw, 0.005, depth - 0.002, 0, yc + h / 2 - 0.0025, ZF + depth / 2 - 0.001); box('bezel_rail', bezelDark, lw, 0.005, depth - 0.002, 0, yc - h / 2 + 0.0025, ZF + depth / 2 - 0.001);
    // raised cylindrical boss with barrel lock, far left
    const bx = -lw / 2 + 0.022, by = yc;
    cyl('bezel_lock_boss', bezelDark, 0.011, 0.006, bx, by, zFace + 0.002, 'z', g, 32);
    cyl('bezel_lock_barrel', mats.screw, 0.0055, 0.002, bx, by, zFace + 0.0055, 'z', g, 24);
    box('bezel_key_slot', mats.dark, 0.0012, 0.006, 0.001, bx, by, zFace + 0.0065);
    // inset glossy badge plate, centre (brand mark omitted)
    box('bezel_badge_recess', bezelDark, 0.046, 0.016, 0.003, 0, yc, zFace - 0.0015); box('bezel_badge_plate', bezelGloss, 0.04, 0.011, 0.001, 0, yc, zFace + 0.0002);
  };
  const servers = [];
  const server = (n, u, kind, opt) => {
    const depth = { 1: 0.72, 2: 0.76, 3: 0.78, 4: 0.80 }[u], mat = opt && opt.graphite ? mats.graphite : mats.silver;
    F = ZF + [0, -0.004, -0.002, -0.006, -0.001][n % 5];
    const c = chassis(n, u, depth, mat); ears(n, u, opt && opt.graphite ? mats.graphite : mats.ear); frontFrame(c.yc, c.h, opt && opt.graphite ? mats.graphite : mats.trim);
    const zf = F + 0.003, top = c.yc + c.h / 2, bot = c.yc - c.h / 2;
    if (u === 1) { for (let i = 0; i < 10; i++) sffDrive(-0.1875 + i * 0.0393, c.yc, zf, 0.038, c.h - 0.006, true); sidePanels(c.yc, c.h, true); }
    // 2U follows the PowerEdge R550 16 x 2.5" layout: drives left, square-mesh vent block right, control column
    else if (u === 2 && kind === 'sff') { for (let i = 0; i < 16; i++) sffDrive(-0.1965 + i * 0.0192, c.yc, zf, 0.0184, c.h - 0.006); sqVent(0.145, c.yc, 0.092, c.h - 0.008, zf + 0.002); sidePanels(c.yc, c.h, true); }
    else if (u === 2) { for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) lffDrive(-0.155 + i * 0.098, top - 0.0225 - r * 0.039, zf, 0.096, 0.036); sidePanels(c.yc, c.h, true); }
    else if (u === 3) { for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) lffDrive(-0.147 + i * 0.098, bot + 0.016 + r * 0.0275, zf, 0.096, 0.0265); grillMesh(0.39, 0.04, -0.005, top - 0.025, zf, mats.grillSolid); sidePanels(c.yc, c.h, true); }
    // 4U XE-style: 8 x 2.5" hot-swap drives top row, fan wall behind square mesh, 4 x E3.S modules with orange release buttons at the foot
    else if (u === 4 && kind === 'gpu') { for (let i = 0; i < 8; i++) sffDrive(-0.19 + i * 0.0182, top - 0.044, zf, 0.0175, 0.075); sqVent(0.073, top - 0.044, 0.255, 0.078, zf + 0.002); sqVent(0, c.yc - 0.03, CW - 0.06, 0.06, zf + 0.002); for (let i = 0; i < 4; i++) { const x = -0.15 + i * 0.1; box('e3s_module', mats.driveSide, 0.094, 0.026, 0.006, x, bot + 0.017, zf); box('e3s_release_button', M('orange_release', { color: 0xe0702a, roughness: 0.5 }), 0.008, 0.008, 0.002, x - 0.03, bot + 0.017, zf + 0.004); box('e3s_button_ring', mats.dark, 0.011, 0.011, 0.0015, x - 0.03, bot + 0.017, zf + 0.0035); const l = cyl('activity_led', ledMat(0x3dff6e), 0.001, 0.001, x - 0.03, bot + 0.026, zf + 0.0035, 'z', g, 8); l.userData.phase = i; } sidePanels(c.yc, c.h, true); }
    else { for (let r = 0; r < 6; r++) for (let i = 0; i < 4; i++) lffDrive(-0.155 + i * 0.098, top - 0.016 - r * 0.0285, zf, 0.096, 0.0275); sidePanels(c.yc, c.h, true); }
    if (opt && opt.bezel) bezel(c.yc, c.h);
    if (opt && opt.cover) cover(c.yc, c.h, u);
    servers.push({ n, u, rear: rearFace(n, u, c.zr) });
    F = ZF;
  };
  const blank = (n, u) => { const h = u * U - 0.003; box('blanking_panel', mats.steel, 0.48, h, 0.003, 0, yb(n) + u * U / 2, ZF + 0.0035); grillMesh(0.42, h - 0.012, 0, yb(n) + u * U / 2, ZF + 0.0052, mats.grillSolid); for (const sx of [-1, 1]) for (const f of [0.25, 0.75]) cyl('blank_screw', mats.screw, 0.0045, 0.002, sx * 0.235, yb(n) + f * u * U, ZF + 0.006, 'z', g, 12); };
  const netSwitch = (n, ports) => {
    const c = chassis(n, 1, 0.46, mats.graphite); ears(n, 1, mats.graphite);
    plane('switch_faceplate', ports === 48 ? mats.switch48 : mats.switch24, CW, U - 0.004, 0, c.yc, ZF + 0.0015);
    rearFace(n, 1, c.zr);
    const cols = ports / 2, portsOut = [];
    for (let i = 0; i < cols; i++) portsOut.push({ x: -0.2185 + 0.024 + i * 0.0125 + 0.00625, y: c.yc + U / 2 - 0.0113, z: ZF + 0.003 });
    return { yc: c.yc, ports: portsOut, sfpX: -0.2185 + 0.024 + cols * 0.0125 + 0.012 + 0.009 };
  };
  const patchPanel = (n) => { const yc = yb(n) + U / 2; ears(n, 1, mats.graphite); box('patch_panel_body', mats.graphite, CW, U - 0.004, 0.025, 0, yc, ZF - 0.0125); plane('patch_faceplate', mats.patch, CW, U - 0.004, 0, yc, ZF + 0.0015); box('patch_cable_bar', mats.graphite, 0.4, 0.008, 0.06, 0, yc - 0.024, ZF - 0.04); const pts = []; for (let i = 0; i < 24; i++) pts.push({ x: -0.2185 + 0.0125 + i * 0.0172 + 0.0075, y: yc + U / 2 - 0.021, z: ZF + 0.003 }); return { yc, pts }; };
  const cableManager = (n) => { const yc = yb(n) + U / 2; ears(n, 1, mats.graphite); box('cable_manager_bar', mats.graphite, CW, 0.012, 0.03, 0, yc - 0.015, ZF + 0.01); for (let i = 0; i < 5; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.003, 10, 28), mats.bezelPlastic); ring.name = 'cable_ring_' + (id++); ring.position.set(-0.16 + i * 0.08, yc + 0.003, ZF + 0.03); ring.rotation.y = Math.PI / 2; g.add(ring); } return yc; };
  const hPdu = (n) => { const c = chassis(n, 1, 0.09, mats.graphite); ears(n, 1, mats.graphite); const zf = ZF + 0.002; for (let i = 0; i < 8; i++) { const x = -0.17 + i * 0.035; box('c13_outlet', mats.dark, 0.026, 0.02, 0.004, x, c.yc, zf); for (const [ox, oy, w, h] of [[-0.006, 0.002, 0.003, 0.006], [0.006, 0.002, 0.003, 0.006], [0, -0.004, 0.003, 0.005]]) box('outlet_pin', mats.graphite, w, h, 0.001, x + ox, c.yc + oy, zf + 0.0025); } box('circuit_breaker', mats.dark, 0.03, 0.02, 0.006, 0.145, c.yc, zf); box('breaker_switch', mats.cableBlue, 0.008, 0.012, 0.004, 0.145, c.yc, zf + 0.005); box('pdu_display', mats.lcd, 0.03, 0.014, 0.002, 0.195, c.yc, zf); };
  const pduOutlets = { '-1': [], '1': [] };
  for (const sx of [-1, 1]) {
    const x = sx * 0.262, z = -0.44, y0 = 0.30, h = 1.62, yc = y0 + h / 2;
    box('vertical_pdu_body', mats.steel, 0.052, h, 0.045, x, yc, z);
    plane('vertical_pdu_face', mats.pdu, 0.045, h, x - sx * 0.0265, yc, z, sx > 0 ? -Math.PI / 2 : Math.PI / 2);
    for (const y of [y0 + 0.05, y0 + h - 0.05]) box('pdu_mount_bracket', mats.steel, 0.03, 0.02, 0.08, sx * 0.275, y, z);
    box('pdu_power_inlet', mats.rubber, 0.012, 0.03, 0.012, x, y0 - 0.02, z);
    for (let k = 0; k < 30; k++) pduOutlets[sx].push({ y: y0 + 0.18 + k * 0.045, used: false });
    tube('pdu_feed_cable', mats.cableBlack, [[x, y0 - 0.03, z], [x, 0.2, z - 0.02], [sx * 0.2, 0.14, -0.5], [0, 0.135, -0.52]], 0.007);
  }

  /* ---------------- layout (bottom -> top) ---------------- */
  server(1, 4, 'storage', { cover: true }); blank(5, 1); server(6, 3, 'storage', { graphite: true }); server(9, 2, 'sff', { cover: true }); server(11, 2, 'lff');
  server(13, 1, null, { cover: true }); server(14, 1); server(15, 1); server(16, 1, null, { cover: true }); server(17, 2, 'sff'); blank(19, 1);
  server(20, 4, 'gpu', { cover: true }); server(24, 1, null, { cover: true }); server(25, 1); server(26, 1, null, { graphite: true }); server(27, 1, null, { graphite: true }); server(28, 2, 'sff', { cover: true }); blank(30, 1);
  hPdu(31); server(32, 1, null, { cover: true }); server(33, 1); server(34, 1); blank(35, 1);
  const ppB = patchPanel(36); const cmB = cableManager(37); const swB = netSwitch(38, 24);
  const ppA = patchPanel(39); const cmA = cableManager(40); const swA = netSwitch(41, 48); blank(42, 1);

  /* ---------------- cabling ---------------- */
  const frontPatch = (sw, pp, cmY, mat, count, step) => { for (let i = 0; i < count; i++) { const p = sw.ports[i * step], q = pp.pts[i * 2]; tube('patch_cable', mat, [[p.x, p.y, p.z], [p.x, p.y + 0.004, p.z + 0.045], [(p.x + q.x) / 2, cmY + 0.003, p.z + 0.05], [q.x, pp.yc + 0.012, p.z + 0.03], [q.x, q.y, q.z]], 0.003); } };
  frontPatch(swA, ppA, cmA, mats.cableBlue, 12, 2);
  frontPatch(swB, ppB, cmB, mats.cableBlack, 8, 1);
  for (let i = 0; i < 4; i++) { const x = swA.sfpX + (i % 2) * 0.021, y = swA.yc + U / 2 - (i < 2 ? 0.0113 : 0.0303); tube('fiber_patch_cable', mats.cableYellow, [[x, y, ZF + 0.004], [x + 0.01, y + 0.01, ZF + 0.06], [0.06 + i * 0.008, TOP - 0.02, ZF - 0.1], [0.04 + i * 0.008, TOP + 0.035, 0.22]], 0.0016); }
  for (const y of [swA.yc + 0.03, TOP - 0.06]) box('velcro_strap', mats.velcro, 0.05, 0.01, 0.03, 0.06, y, y > TOP - 0.1 ? ZF - 0.08 : ZF + 0.055);
  const pickOutlet = (sx, y) => { const list = pduOutlets[sx]; let best = 0; for (let i = 1; i < list.length; i++) if (Math.abs(list[i].y - y) < Math.abs(list[best].y - y)) best = i; while (list[best] && list[best].used) best++; list[best].used = true; return list[best].y; };
  servers.forEach(s => s.rear.inlets.forEach(([x, y, z, i]) => { const sx = i === 0 ? 1 : -1, oy = pickOutlet(sx, y); tube('power_cable', mats.cableBlack, [[x, y, z], [x, y - 0.012, z - 0.07], [sx * 0.10, Math.min(y, oy) - 0.03, -0.49], [sx * 0.22, oy, -0.47], [sx * 0.2345, oy, -0.44]], 0.0042); }));
  servers.filter((s, i) => i % 2 === 0).slice(0, 7).forEach((s, i) => { const [nx, ny, nz] = s.rear.nic; tube('network_drop_cable', mats.cableBlue, [[-0.1 + i * 0.006, TOP + 0.035, -0.32], [-0.20, TOP - 0.05, -0.34], [-0.245 + i * 0.001, ny + 0.08, -0.33], [-0.2, ny + 0.01, nz - 0.03], [nx, ny, nz]], 0.003); });
  for (let k = 0; k < 6; k++) box('velcro_strap', mats.velcro, 0.028, 0.012, 0.028, -0.245, 0.5 + k * 0.25, -0.33);
  for (let k = 0; k < 7; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0025, 8, 24), mats.bezelPlastic); r.name = 'vertical_cable_ring_' + (id++); r.position.set(-0.245, 0.4 + k * 0.22, -0.33); r.rotation.x = Math.PI / 2; g.add(r); }
  [servers[3], servers[7]].forEach(s => { const zr = ZF - 0.76, y = yb(s.n) + s.u * U / 2; box('cable_management_arm', mats.graphite, 0.22, 0.012, 0.03, 0.06, y, zr - 0.05); box('cable_management_arm', mats.graphite, 0.012, 0.012, 0.09, 0.17, y, zr - 0.09); box('cable_management_arm', mats.graphite, 0.012, 0.012, 0.05, -0.05, y, zr - 0.025); });
  g.userData.slots = servers.map(s => ({ y: yb(s.n) + s.u * U / 2, h: s.u * U, zr: ZF - ({ 1: 0.72, 2: 0.76, 3: 0.78, 4: 0.80 }[s.u]) }));
  return g;
}

/* Non-exported environment: speckled raised-floor tiles, neighbour racks, overhead ladder + lights. */
function buildEnvironment(THREE) {
  const e = new THREE.Group(); e.name = 'environment';
  const c = document.createElement('canvas'); c.width = c.height = 512; const ctx = c.getContext('2d');
  ctx.fillStyle = '#2d2f34'; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) { const v = 30 + Math.random() * 90; ctx.fillStyle = `rgb(${v},${v + 2},${v + 6})`; ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
  ctx.fillStyle = '#101114'; ctx.fillRect(0, 0, 512, 5); ctx.fillRect(0, 0, 5, 512);
  const tileTex = new THREE.CanvasTexture(c); tileTex.colorSpace = THREE.SRGBColorSpace; tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping; tileTex.repeat.set(40, 40); tileTex.anisotropy = 8;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.75, metalness: 0.15 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0.3, -0.002, 0.3); floor.receiveShadow = true; e.add(floor);
  const rackMat = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.6, metalness: 0.5 });
  const glow = new THREE.MeshStandardMaterial({ color: 0x3a6fd8, emissive: 0x2a5fc8, emissiveIntensity: 0.6 });
  const ghostRack = (x, z) => { const r = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.03, 1.07), rackMat); r.position.set(x, 1.015, z); e.add(r); for (let k = 0; k < 14; k++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.003, 0.002), glow); s.position.set(x, 0.3 + k * 0.12, z + 0.536); e.add(s); } };
  for (let i = -4; i <= 4; i++) ghostRack(i * 0.75, -3.6);
  for (let i = -6; i <= 6; i++) if (i <= -3 || i >= 5) ghostRack(i * 0.75, 0);
  const ladder = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.6, metalness: 0.4 });
  for (const z of [0.3, -0.35, -3.3]) { const l = new THREE.Mesh(new THREE.BoxGeometry(12, 0.03, 0.3), ladder); l.position.set(0, 2.75, z); e.add(l); }
  const lamp = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe8eefc, emissiveIntensity: 1.5 });
  for (const z of [1.6, -1.8]) { const l = new THREE.Mesh(new THREE.BoxGeometry(6, 0.04, 0.12), lamp); l.position.set(0, 3.2, z); e.add(l); }
  return e;
}

/* Procedural studio room for image-based lighting (replaces RoomEnvironment, which the import map doesn't expose). */
function buildEnvMap(THREE, renderer) {
  const room = new THREE.Scene();
  const wall = new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 1, side: THREE.BackSide });
  room.add(new THREE.Mesh(new THREE.BoxGeometry(12, 8, 12), wall));
  const panel = (w, h, x, y, z, ry, rx, c, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c })); m.material.color.multiplyScalar(i); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); room.add(m); };
  for (const z of [-3, 0, 3]) panel(8, 0.5, 0, 3.9, z, 0, Math.PI / 2, 0xeef2ff, 6);
  panel(4, 3, -5.9, 1.5, 0, Math.PI / 2, 0, 0xdfe6f2, 2.5);
  panel(4, 3, 5.9, 1.5, 0, -Math.PI / 2, 0, 0xcfd8ee, 1.8);
  panel(6, 3, 0, 1.5, 5.9, Math.PI, 0, 0xffffff, 1.2);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(room, 0.04).texture; pmrem.dispose();
  return env;
}


// Airflow / heat visualisation: cool intake streaks drawn into the server fronts, hot exhaust
// plumes leaving the rear and rising. GPU-driven points; only a time uniform changes per frame.
function buildHeatSim(THREE, slots) {
  const N = 2600;
  const seed = new Float32Array(N), slotY = new Float32Array(N), slotH = new Float32Array(N), slotZr = new Float32Array(N), kind = new Float32Array(N);
  let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < N; i++) { const sl = slots[Math.floor(rnd() * slots.length)]; seed[i] = rnd(); slotY[i] = sl.y; slotH[i] = sl.h; slotZr[i] = sl.zr; kind[i] = i % 5 === 0 ? 1 : 0; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aY', new THREE.BufferAttribute(slotY, 1));
  geo.setAttribute('aH', new THREE.BufferAttribute(slotH, 1));
  geo.setAttribute('aZr', new THREE.BufferAttribute(slotZr, 1));
  geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aSeed, aY, aH, aZr, aKind;
      uniform float uTime, uPixelRatio;
      varying float vHeat, vAlpha;
      float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
      void main() {
        float s2 = h1(aSeed * 7.0), s3 = h1(aSeed * 13.0), s4 = h1(aSeed * 29.0);
        float speed = 0.38 + 0.25 * s3;
        float p = fract(uTime * speed * 0.5 + aSeed);              // 0..1 life
        vec3 pos; float heat, alpha;
        if (aKind < 0.5) {
          // intake streak: 0.0-0.45 in front of the bezel, then exhaust 0.55-1.0 behind the rack
          float x = (aSeed - 0.5) * 0.40, y = aY + (s2 - 0.5) * aH * 0.8;
          if (p < 0.45) {
            float q = p / 0.45;
            pos = vec3(x * (1.0 + (1.0 - q) * 0.6), y + (1.0 - q) * (s3 - 0.5) * 0.08, 0.42 + (1.0 - q) * 0.45);
            heat = 0.0; alpha = smoothstep(0.0, 0.15, q) * 1.0;
          } else {
            float q = clamp((p - 0.55) / 0.45, 0.0, 1.0);
            float wob = sin(uTime * 2.0 + aSeed * 40.0) * 0.02 * q;
            pos = vec3(x * (1.0 + q * 0.5) + wob, y + q * q * 0.9 + q * 0.05, aZr - 0.02 - q * 0.55);
            heat = 1.0; alpha = (p < 0.55 ? 0.0 : 1.0) * (1.0 - q) * 0.8;
          }
          gl_PointSize = (4.5 + heat * 2.0) * uPixelRatio;
        } else {
          // heat haze: large soft blobs rising off the rear exhaust
          float q = p, x = (aSeed - 0.5) * 0.5 + sin(uTime * 0.8 + s4 * 30.0) * 0.06 * q;
          pos = vec3(x, aY + (s2 - 0.5) * aH + q * q * 1.2, aZr - 0.1 - q * 0.5 + sin(uTime + s3 * 20.0) * 0.04);
          heat = 1.0; alpha = (1.0 - q) * q * 0.22;
          gl_PointSize = (40.0 + 70.0 * q) * uPixelRatio;
        }
        vHeat = heat; vAlpha = alpha;
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize *= 1.6 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vHeat, vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float soft = smoothstep(0.5, 0.05, d);
        vec3 cool = vec3(0.45, 0.85, 1.0), hot = vec3(1.0, 0.45, 0.12);
        gl_FragColor = vec4(mix(cool, hot, vHeat), soft * vAlpha);
      }`,
  });
  const pts = new THREE.Points(geo, mat); pts.name = 'airflow_heat_sim'; pts.frustumCulled = false;
  pts.userData.tick = (t, pr) => { mat.uniforms.uTime.value = t; mat.uniforms.uPixelRatio.value = pr; };
  return pts;
}


// Thermal view: swaps every scene material for a "temperature" shader while active. Each server slot gets a
// load-driven temperature; surfaces are coloured through an ironbow LUT by proximity to hot slots (front cool
// intake, rear hot exhaust), with a scan-line + sensor-noise post look. Restores originals on exit.
function buildThermalView(THREE, scene, rack, slots) {
  const N = Math.max(1, slots.length);
  const slotArr = new Float32Array(64 * 4); // y, h, zr, temp(0..1) per slot (padded to 64)
  const temps = slots.map((s, i) => 0.35 + 0.5 * Math.abs(Math.sin(i * 1.7 + 0.4)) * (s.h > 0.1 ? 1.25 : 1));
  slots.forEach((s, i) => { slotArr[i * 4] = s.y; slotArr[i * 4 + 1] = s.h; slotArr[i * 4 + 2] = s.zr; slotArr[i * 4 + 3] = Math.min(1, temps[i]); });
  const uniforms = { uTime: { value: 0 }, uSlots: { value: slotArr }, uCount: { value: N }, uAmbient: { value: 0.24 }, uGain: { value: 1.0 } };
  const vert = `
    varying vec3 vW; varying vec3 vN;
    void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
  const frag = `
    precision highp float;
    varying vec3 vW; varying vec3 vN;
    uniform float uTime, uAmbient, uGain; uniform vec4 uSlots[64]; uniform int uCount;
    float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 ironbow(float t) {
      t = clamp(t, 0.0, 1.0);
      vec3 c0 = vec3(0.0, 0.0, 0.0), c1 = vec3(0.13, 0.0, 0.38), c2 = vec3(0.62, 0.0, 0.62), c3 = vec3(0.92, 0.28, 0.12), c4 = vec3(1.0, 0.74, 0.0), c5 = vec3(1.0, 1.0, 0.9);
      if (t < 0.2) return mix(c0, c1, t / 0.2); if (t < 0.4) return mix(c1, c2, (t - 0.2) / 0.2); if (t < 0.6) return mix(c2, c3, (t - 0.4) / 0.2); if (t < 0.8) return mix(c3, c4, (t - 0.6) / 0.2); return mix(c4, c5, (t - 0.8) / 0.2);
    }
    void main() {
      float T = uAmbient;
      // floor and far room sit a touch cooler than rack metal; rack steel reads slightly warmer than ambient air
      if (vW.y < 0.02) T = uAmbient - 0.06; else if (abs(vW.x) > 0.31 || abs(vW.z) > 0.56) T = uAmbient - 0.03; else T = uAmbient + 0.03;
      // floor & air fall-off, exhaust plume rising behind the rack
      for (int i = 0; i < 64; i++) {
        if (i >= uCount) break;
        vec4 s = uSlots[i];
        float dy = abs(vW.y - s.x) / max(s.y * 0.75, 0.02);
        float inSlot = exp(-dy * dy * 1.6);
        float rearZ = s.z;
        // chassis body heat grows toward the rear
        float along = clamp((0.40 - vW.z) / max(0.40 - rearZ, 0.1), 0.0, 1.0);
        float body = inSlot * s.w * (0.35 + 0.65 * along) * step(rearZ - 0.03, vW.z) * step(vW.z, 0.42) * step(abs(vW.x), 0.245);
        // rear exhaust cloud (cables, PDUs, doors pick it up), drifting upward
        float dz = vW.z - rearZ; float plume = exp(-max(0.0, -dz) * 3.0) * step(vW.z, rearZ + 0.02);
        float rise = clamp((vW.y - s.x) / 0.5, 0.0, 1.0);
        float dyp = abs(vW.y - s.x - rise * 0.3) / (s.y * 0.6 + rise * 0.35);
        float cloud = plume * s.w * exp(-dyp * dyp) * 0.75 * step(abs(vW.x), 0.35);
        // front face stays cool (intake)
        float front = inSlot * s.w * 0.22 * step(0.40, vW.z) * step(vW.z, 0.47) * step(abs(vW.x), 0.245);
        T = max(T, max(body, max(cloud, front)));
      }
      // facing-dependent apparent emissivity so cold geometry still shows edges
      float facing = 0.6 + 0.4 * abs(dot(vN, normalize(cameraPosition - vW)));
      T *= facing * uGain;
      // sensor noise + slow flicker
      float n = (h(floor(gl_FragCoord.xy / 2.0) + floor(uTime * 12.0)) - 0.5) * 0.035;
      T += n;
      vec3 col = ironbow(T);
      // scanlines
      col *= 0.92 + 0.08 * sin(gl_FragCoord.y * 1.4);
      gl_FragColor = vec4(col, 1.0);
    }`;
  const thermalMat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide });
  thermalMat.name = 'thermal_view';
  const saved = new Map();
  let active = false, prevBg = null, prevFog = null, prevEnv = null;
  const api = {
    get active() { return active; },
    set(on) {
      if (on === active) return; active = on;
      if (on) {
        prevBg = scene.background; prevFog = scene.fog; prevEnv = scene.environment;
        scene.background = new THREE.Color(0x000000); scene.fog = null; scene.environment = null;
        scene.traverse(o => { if (o.isMesh && o.name !== 'airflow_heat_sim' && !o.userData.thermalSkip) { saved.set(o, o.material); o.material = thermalMat; } });
      } else {
        saved.forEach((m, o) => o.material = m); saved.clear();
        scene.background = prevBg; scene.fog = prevFog; scene.environment = prevEnv;
      }
    },
    tick(t) { uniforms.uTime.value = t; },
    setTemps(arr) { arr.forEach((v, i) => { if (i < 64) slotArr[i * 4 + 3] = Math.min(1, Math.max(0, v)); }); },
    temps,
  };
  return api;
}

/* eslint-enable */

/* ------------------------------------------------------------------ component ------------------------------------------------------------------ */
export default function ServerRackTwin({ temps, view, onViewChange, showCovers = true, showAirflow = true, background = '#16171b', className, style }: ServerRackTwinProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [internalView, setInternalView] = useState<RackView>('visual');
  const v = view ?? internalView;
  const setView = (nv: RackView) => { setInternalView(nv); onViewChange?.(nv); };

  useEffect(() => {
    const host = hostRef.current; if (!host) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 500);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.08;
    const hemi = new THREE.HemisphereLight(0xdfe6f2, 0x2a2d34, 0.55); scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(3.5, 5, 4); key.castShadow = true; key.shadow.mapSize.set(4096, 4096); key.shadow.bias = -0.0001; key.shadow.normalBias = 0.002; scene.add(key);
    const fill = new THREE.DirectionalLight(0xcfd9ff, 0.5); fill.position.set(-4, 3, -2); scene.add(fill);
    const front = new THREE.DirectionalLight(0xe6ecff, 1.2); front.position.set(-1.5, 2.5, 5); scene.add(front);
    scene.environment = buildEnvMap(THREE, renderer);
    scene.fog = new THREE.FogExp2(0x16171b, 0.07);
    const rack = buildRack(THREE); rack.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(rack);
    scene.add(buildEnvironment(THREE));
    const heat = buildHeatSim(THREE, rack.userData.slots as Slot[]); scene.add(heat);
    const thermal = buildThermalView(THREE, scene, rack, rack.userData.slots as Slot[]);
    const covers: THREE.Object3D[] = []; rack.traverse((o) => { if (/^bezel_/.test(o.name)) covers.push(o); });
    camera.position.set(2.2, 1.5, -1.9); controls.target.set(0, 1.1, -0.3); controls.update();
    const fit = () => { const w = host.clientWidth || 1, h = host.clientHeight || 1; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    fit(); const ro = new ResizeObserver(fit); ro.observe(host);
    const leds: THREE.MeshStandardMaterial[] = rack.userData.animatedLeds;
    let raf = 0; const t0 = performance.now();
    const loop = () => { const t = (performance.now() - t0) / 1000; heat.userData.tick(t, renderer.getPixelRatio()); thermal.tick(t); if (!thermal.active) leds.forEach((m, i) => { const b = Math.sin(t * 11 + i * 1.17) + Math.sin(t * 5.3 + i * 2.5); m.emissiveIntensity = b > 0.7 ? 3.2 : 1.2; }); controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    apiRef.current = {
      setThermal(on: boolean) { if (on) { heat.visible = false; renderer.toneMapping = THREE.NoToneMapping; } else { heat.visible = apiRef.current.airflow; renderer.toneMapping = THREE.ACESFilmicToneMapping; } thermal.set(on); },
      setCovers(on: boolean) { covers.forEach((m) => (m.visible = on)); },
      setAirflow(on: boolean) { apiRef.current.airflow = on; if (!thermal.active) heat.visible = on; },
      setTemps(a: number[]) { thermal.setTemps(a); },
      airflow: showAirflow,
      async exportGLB() { const blob: Blob = await new Promise((res) => new GLTFExporter().parse(rack, (r) => res(new Blob([r as ArrayBuffer], { type: 'model/gltf-binary' })), () => {}, { binary: true })); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'server-rack-42u.glb'; a.click(); },
      slots: rack.userData.slots as Slot[], temps: thermal.temps as number[],
    };
    return () => { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); host.removeChild(renderer.domElement); apiRef.current = null; };
  }, []);

  useEffect(() => { apiRef.current?.setThermal(v === 'thermal'); }, [v]);
  useEffect(() => { apiRef.current?.setCovers(showCovers); }, [showCovers]);
  useEffect(() => { apiRef.current?.setAirflow(showAirflow); }, [showAirflow]);
  useEffect(() => { if (temps) apiRef.current?.setTemps(temps); }, [temps]);

  const thermalOn = v === 'thermal';
  const hottest = (() => { const a = apiRef.current; if (!a) return null; const t: number[] = temps ?? a.temps; const i = t.indexOf(Math.max(...t)); const s = a.slots[i]; if (!s) return null; const u = Math.round((s.y - s.h / 2 - 0.13) / 0.04445) + 1; return `HOTTEST U${u} · ${Math.round(s.h / 0.04445)}U · ${(19.5 + Math.min(1, t[i]) * 28.5).toFixed(1)} °C`; })();

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%', background: thermalOn ? '#000' : background, overflow: 'hidden', fontFamily: '"Helvetica Neue", Helvetica, sans-serif', ...style }}>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
      <div role="tablist" style={{ position: 'absolute', top: 18, left: 20, display: 'flex', gap: 2, background: 'rgba(12,13,16,0.72)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, padding: 3, backdropFilter: 'blur(8px)' }}>
        {(['visual', 'thermal'] as RackView[]).map((k) => (
          <button key={k} onClick={() => setView(k)} aria-pressed={v === k} style={{ appearance: 'none', border: 0, background: v === k ? '#eef0f4' : 'transparent', color: v === k ? '#16171b' : '#aeb3bc', font: '500 12px/1 inherit', letterSpacing: '0.04em', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}>{k === 'visual' ? 'Visual' : 'Thermal camera'}</button>
        ))}
        <button onClick={() => apiRef.current?.exportGLB()} style={{ appearance: 'none', border: 0, background: 'transparent', color: '#aeb3bc', font: '500 12px/1 inherit', letterSpacing: '0.04em', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}>Download GLB</button>
      </div>
      {thermalOn && (
        <>
          <div style={{ position: 'absolute', right: 20, top: 18, display: 'flex', flexDirection: 'column', gap: 8, color: '#eef0f4', font: '12px/1.3 "SF Mono", Menlo, monospace', letterSpacing: '0.04em', textShadow: '0 1px 2px #000' }}>
            <div>FLIR-SIM · IRONBOW · ε 0.95</div>
            <div style={{ display: 'grid', gridTemplateColumns: '14px auto', gap: 10 }}>
              <div style={{ width: 14, height: 220, border: '1px solid rgba(255,255,255,0.5)', background: 'linear-gradient(to top, #000, #210061, #9e009e, #eb471f, #ffbd00, #fffff0)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}><span>48.0 °C</span><span>38.5</span><span>29.0</span><span>19.5 °C</span></div>
            </div>
            {hottest && <div style={{ opacity: 0.8 }}>{hottest}</div>}
            <div style={{ opacity: 0.8 }}>ΔT inlet→exhaust 12.4 °C</div>
          </div>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {[['left', 'top'], ['right', 'top'], ['left', 'bottom'], ['right', 'bottom']].map(([x, y]) => (
              <div key={x + y} style={{ position: 'absolute', [x]: 60, [y]: 60, width: 36, height: 36, borderTop: y === 'top' ? '1px solid rgba(255,255,255,0.45)' : 0, borderBottom: y === 'bottom' ? '1px solid rgba(255,255,255,0.45)' : 0, borderLeft: x === 'left' ? '1px solid rgba(255,255,255,0.45)' : 0, borderRight: x === 'right' ? '1px solid rgba(255,255,255,0.45)' : 0 } as React.CSSProperties} />
            ))}
            <div style={{ position: 'absolute', left: '50%', top: '50%', width: 26, height: 1, background: 'rgba(255,255,255,0.55)', transform: 'translate(-50%,-50%)' }} />
            <div style={{ position: 'absolute', left: '50%', top: '50%', width: 1, height: 26, background: 'rgba(255,255,255,0.55)', transform: 'translate(-50%,-50%)' }} />
          </div>
        </>
      )}
      <div style={{ position: 'absolute', left: 20, bottom: 18, color: '#c9ccd3', fontSize: 12, letterSpacing: '0.04em', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <b style={{ fontSize: 14, color: '#eef0f4' }}>42U enterprise rack</b>
        <span>Drag to orbit · wheel to zoom · right-drag to pan</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ playground ------------------------------------------------------------------ */
export function Playground() {
  const [view, setView] = useState<RackView>('visual');
  const [covers, setCovers] = useState(true);
  const [airflow, setAirflow] = useState(true);
  const [temps, setTemps] = useState<number[] | undefined>(undefined);
  const randomize = () => setTemps(Array.from({ length: 20 }, () => 0.3 + Math.random() * 0.7));
  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100vh', background: '#0f1013', color: '#c9ccd3', fontFamily: '"Helvetica Neue", Helvetica, sans-serif', fontSize: 12 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={covers} onChange={(e) => setCovers(e.target.checked)} /> Front covers</label>
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={airflow} onChange={(e) => setAirflow(e.target.checked)} /> Airflow &amp; heat</label>
        <button onClick={randomize} style={{ background: '#1e2026', color: '#eef0f4', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Randomize load temps</button>
        <button onClick={() => setTemps(undefined)} style={{ background: 'transparent', color: '#aeb3bc', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Reset</button>
        <span style={{ marginLeft: 'auto', opacity: 0.7 }}>view: {view}</span>
      </div>
      <ServerRackTwin view={view} onViewChange={setView} showCovers={covers} showAirflow={airflow} temps={temps} />
    </div>
  );
}
