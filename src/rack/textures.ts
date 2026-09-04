// @ts-nocheck
/* eslint-disable */
// Procedural canvas textures: brushed metal, honeycomb grills, drive faces, switch/patch/PDU faceplates, rear I/O.
// Ported 1:1 from the original ServerRackTwin.tsx — only the module boundary changed.

/** Creates the shared texture set `T`, plus the low-level `tex` factory (reused by Nuc for its custom face texture). */
export function createTextures(THREE, U, CW) {
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

  return { T, tex };
}
