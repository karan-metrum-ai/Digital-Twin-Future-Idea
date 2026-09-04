// @ts-nocheck
/* eslint-disable */
// Raised-floor cooling grill: two perforated tiles set into the floor in the cold aisle in front of the rack —
// modelled on real data-hall perforated access-floor panels (light high-pressure-laminate top, dense grid of
// small square punched holes, a shade darker than the surrounding plain tiles so the airflow path reads
// clearly). The tile itself stays neutral; the cold-blue read comes from the CoolingVapor particles rising
// off it, not from tinting the panel.

export function buildCoolingFloor(THREE) {
  const grp = new THREE.Group(); grp.name = 'cooling_floor';

  const c = document.createElement('canvas'); c.width = c.height = 512; const ctx = c.getContext('2d');
  ctx.fillStyle = '#b7b8b6'; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 3000; i++) { const v = 150 + Math.random() * 40; ctx.fillStyle = `rgba(${v},${v},${v - 2},0.35)`; ctx.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5); }
  // dense grid of small square punched holes with a soft inset shadow for real perforation depth
  const cols = 22, s = 512 / cols, hole = s * 0.56;
  for (let y = 0; y < cols; y++) for (let x = 0; x < cols; x++) {
    const cx = x * s + s / 2, cy = y * s + s / 2;
    const gr = ctx.createRadialGradient(cx, cy, hole * 0.1, cx, cy, hole * 0.6);
    gr.addColorStop(0, '#0c0d0e'); gr.addColorStop(1, '#3a3b3a');
    ctx.fillStyle = gr; ctx.fillRect(cx - hole / 2, cy - hole / 2, hole, hole);
  }
  ctx.strokeStyle = '#7d807e'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 506, 506);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, metalness: 0.18 });

  const tileW = 0.56, tileD = 0.56, gap = 0.01;
  for (const dz of [0, tileD + gap]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(tileW, tileD), mat);
    m.name = 'raised_floor_grill_tile'; m.rotation.x = -Math.PI / 2; m.position.set(0, 0.001, 0.64 + dz);
    grp.add(m);
  }
  // faint cold-air glow, low and tight to the grill — most of the "blue" reads through the vapour particles above
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 1.24), new THREE.MeshBasicMaterial({ color: 0x2f8dff, transparent: true, opacity: 0.06, depthWrite: false }));
  glow.name = 'cooling_floor_glow'; glow.rotation.x = -Math.PI / 2; glow.position.set(0, 0.0006, 0.64 + tileD + gap / 2 - 0.05);
  grp.add(glow);

  return grp;
}
