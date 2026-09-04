// @ts-nocheck
/* eslint-disable */
// Non-exported environment: speckled raised-floor tiles, neighbour racks, overhead ladder + lights.

export function buildEnvironment(THREE) {
  const e = new THREE.Group(); e.name = 'environment';
  // Raised-access-floor tile: light grey high-pressure-laminate panel (the real data-hall look — see reference
  // photo), with a beveled grout seam (dark groove + a thin highlight catching the light) along the tile's
  // top/left edges — tiling this repeats the bevel at every tile boundary in both directions, reading as a
  // real seamed access-floor grid rather than flat noise.
  const c = document.createElement('canvas'); c.width = c.height = 512; const ctx = c.getContext('2d');
  ctx.fillStyle = '#cdd0d2'; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6000; i++) { const v = 190 + Math.random() * 40; ctx.fillStyle = `rgba(${v},${v + 1},${v + 2},0.35)`; ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
  ctx.fillStyle = '#8d9092'; ctx.fillRect(0, 0, 512, 5); ctx.fillRect(0, 0, 5, 512);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(0, 5, 512, 2); ctx.fillRect(5, 0, 2, 512);
  const tileTex = new THREE.CanvasTexture(c); tileTex.colorSpace = THREE.SRGBColorSpace; tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping; tileTex.repeat.set(40, 40); tileTex.anisotropy = 8;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.85, metalness: 0.08 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0.3, -0.002, 0.3); floor.receiveShadow = true; e.add(floor);
  // (Neighbour racks are real replicas of the procedural rack now — see RackRow.ts — so no dummy boxes here.)
  // Overhead cable ladder: one run above each row's front and one above the hot aisle between the rows.
  const ladder = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.6, metalness: 0.4 });
  for (const z of [0.3, -1.135, -2.57]) { const l = new THREE.Mesh(new THREE.BoxGeometry(6, 0.03, 0.3), ladder); l.position.set(0, 2.75, z); e.add(l); }
  const lamp = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe8eefc, emissiveIntensity: 1.5 });
  for (const z of [1.6, -1.135, -3.9]) { const l = new THREE.Mesh(new THREE.BoxGeometry(5, 0.04, 0.12), lamp); l.position.set(0, 3.2, z); e.add(l); }
  return e;
}
