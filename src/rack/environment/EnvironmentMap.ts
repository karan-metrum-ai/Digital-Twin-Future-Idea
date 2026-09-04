// @ts-nocheck
/* eslint-disable */
// Procedural studio room for image-based lighting (replaces RoomEnvironment, which the import map doesn't expose).

export function buildEnvMap(THREE, renderer) {
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
