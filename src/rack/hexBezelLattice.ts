// @ts-nocheck
/* eslint-disable */
// PowerEdge 15G/16G-style hex bezel: ONE plane carrying a tiling alpha map (apertures), a normal map (rib land +
// chamfers) and a shaded colour map, over the drive bays a few mm behind for real parallax. Graphite plastic.
// Pointy-top lattice: row pitch 1.5R, column pitch sqrt(3)R; tile = one column x two rows (sqrt(3)R x 3R).
// Used only by the Server bezel cover; `M` (the material factory) is passed in rather than imported so this
// stays a pure function of its inputs.

export function createHexBezelLattice(THREE, M, u) {
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
  return { mat, R, tw: 3 * R, th: Math.sqrt(3) * R };
}
