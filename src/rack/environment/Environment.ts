// @ts-nocheck
/* eslint-disable */
// Contained data-hall room: raised-floor tiles, four walls + roof sized around the two rack rows,
// ceiling lights (the overhead cable-tray frame is built separately in OverheadCabling.ts). ROOM_BOUNDS is shared with the camera so orbit never leaves the enclosure.

/** Inner clear volume the camera must stay inside (metres). Matches the wall/roof geometry below. */
export const ROOM_BOUNDS = {
  minX: -8.3, maxX: 8.6,
  minY: 0.12, maxY: 5.3,
  minZ: -8.5, maxZ: 7.7,
};

const ROOM_W = ROOM_BOUNDS.maxX - ROOM_BOUNDS.minX;
const ROOM_D = ROOM_BOUNDS.maxZ - ROOM_BOUNDS.minZ;
export const ROOM_H = 5.7;
const ROOM_CX = (ROOM_BOUNDS.minX + ROOM_BOUNDS.maxX) / 2;
const ROOM_CZ = (ROOM_BOUNDS.minZ + ROOM_BOUNDS.maxZ) / 2;

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
  const tileTex = new THREE.CanvasTexture(c); tileTex.colorSpace = THREE.SRGBColorSpace; tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
  tileTex.repeat.set(Math.round(ROOM_W / 0.6), Math.round(ROOM_D / 0.6)); tileTex.anisotropy = 4;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.85, metalness: 0.08 }));
  floor.name = 'room_floor'; floor.rotation.x = -Math.PI / 2; floor.position.set(ROOM_CX, -0.002, ROOM_CZ); floor.receiveShadow = true; floor.castShadow = false; e.add(floor);

  // Container shell: cheaper Lambert walls/roof (no env specular) — silhouette still reads, saves PBR cost.
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x5c6168, side: THREE.FrontSide });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x8a9098, side: THREE.FrontSide });
  const trimMat = new THREE.MeshLambertMaterial({ color: 0x3a3d42 });
  const wall = (name, w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat); m.name = name;
    m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = false; m.castShadow = false; e.add(m);
  };
  const midY = ROOM_H / 2;
  wall('room_wall_back', ROOM_W, ROOM_H, ROOM_CX, midY, ROOM_BOUNDS.minZ, 0);
  wall('room_wall_front', ROOM_W, ROOM_H, ROOM_CX, midY, ROOM_BOUNDS.maxZ, Math.PI);
  wall('room_wall_left', ROOM_D, ROOM_H, ROOM_BOUNDS.minX, midY, ROOM_CZ, Math.PI / 2);
  wall('room_wall_right', ROOM_D, ROOM_H, ROOM_BOUNDS.maxX, midY, ROOM_CZ, -Math.PI / 2);
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), roofMat);
  roof.name = 'room_roof'; roof.rotation.x = Math.PI / 2; roof.position.set(ROOM_CX, ROOM_H, ROOM_CZ); roof.receiveShadow = false; roof.castShadow = false; e.add(roof);
  // Baseboard strip along each wall so the floor/wall joint reads clearly.
  for (const [x, z, w, d] of [
    [ROOM_CX, ROOM_BOUNDS.minZ + 0.03, ROOM_W, 0.06],
    [ROOM_CX, ROOM_BOUNDS.maxZ - 0.03, ROOM_W, 0.06],
    [ROOM_BOUNDS.minX + 0.03, ROOM_CZ, 0.06, ROOM_D],
    [ROOM_BOUNDS.maxX - 0.03, ROOM_CZ, 0.06, ROOM_D],
  ]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), trimMat);
    t.name = 'room_baseboard'; t.position.set(x, 0.05, z); e.add(t);
  }

  // Overhead cable trays / wire framing live in OverheadCabling.ts (added to the scene alongside this group).
  const lamp = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe8eefc, emissiveIntensity: 1.5 });
  for (const z of [1.6, -1.135, -3.2]) { const l = new THREE.Mesh(new THREE.BoxGeometry(7, 0.04, 0.12), lamp); l.position.set(0, 5.2, z); e.add(l); }
  return e;
}
