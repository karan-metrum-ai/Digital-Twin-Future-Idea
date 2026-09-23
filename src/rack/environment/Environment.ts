// @ts-nocheck
/* eslint-disable */
// Contained data-hall room: raised-floor tiles, four walls + roof sized around the two rack rows, ceiling light
// strips (with red emergency strips that only light during a utility-loss event), and the staff entrance on the
// front wall — a steel door with push bar, badge reader and EXIT sign — that the technician comes and goes through.
// The overhead cable-tray frame is built separately in OverheadCabling.ts. ROOM_BOUNDS is shared with the camera so
// orbit never leaves the enclosure.
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.

/** Inner clear volume the camera must stay inside (metres). Matches the wall/roof geometry below. */
export const ROOM_BOUNDS = {
  minX: -8.3, maxX: 8.6,
  minY: 0.12, maxY: 4.3,
  minZ: -8.5, maxZ: 7.7,
};

const ROOM_W = ROOM_BOUNDS.maxX - ROOM_BOUNDS.minX;
const ROOM_D = ROOM_BOUNDS.maxZ - ROOM_BOUNDS.minZ;
export const ROOM_H = 4.7;
const ROOM_CX = (ROOM_BOUNDS.minX + ROOM_BOUNDS.maxX) / 2;
const ROOM_CZ = (ROOM_BOUNDS.minZ + ROOM_BOUNDS.maxZ) / 2;
/** Staff door on the front wall: centre x, clear width and height. */
export const DOOR_X = 5.6, DOOR_W = 1.1, DOOR_H = 2.2;

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
  // Front wall in three pieces around the staff doorway: left of it, right of it, and the lintel above.
  const dl = DOOR_X - DOOR_W / 2, dr = DOOR_X + DOOR_W / 2;
  wall('room_wall_front', dl - ROOM_BOUNDS.minX, ROOM_H, (ROOM_BOUNDS.minX + dl) / 2, midY, ROOM_BOUNDS.maxZ, Math.PI);
  wall('room_wall_front', ROOM_BOUNDS.maxX - dr, ROOM_H, (dr + ROOM_BOUNDS.maxX) / 2, midY, ROOM_BOUNDS.maxZ, Math.PI);
  wall('room_wall_front', DOOR_W, ROOM_H - DOOR_H, DOOR_X, DOOR_H + (ROOM_H - DOOR_H) / 2, ROOM_BOUNDS.maxZ, Math.PI);
  wall('room_wall_left', ROOM_D, ROOM_H, ROOM_BOUNDS.minX, midY, ROOM_CZ, Math.PI / 2);
  wall('room_wall_right', ROOM_D, ROOM_H, ROOM_BOUNDS.maxX, midY, ROOM_CZ, -Math.PI / 2);
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), roofMat);
  roof.name = 'room_roof'; roof.rotation.x = Math.PI / 2; roof.position.set(ROOM_CX, ROOM_H, ROOM_CZ); roof.receiveShadow = false; roof.castShadow = false; e.add(roof);
  // Baseboard strip along each wall so the floor/wall joint reads clearly (the front one breaks at the doorway).
  for (const [x, z, w, d] of [
    [ROOM_CX, ROOM_BOUNDS.minZ + 0.03, ROOM_W, 0.06],
    [(ROOM_BOUNDS.minX + dl) / 2, ROOM_BOUNDS.maxZ - 0.03, dl - ROOM_BOUNDS.minX, 0.06],
    [(dr + ROOM_BOUNDS.maxX) / 2, ROOM_BOUNDS.maxZ - 0.03, ROOM_BOUNDS.maxX - dr, 0.06],
    [ROOM_BOUNDS.minX + 0.03, ROOM_CZ, 0.06, ROOM_D],
    [ROOM_BOUNDS.maxX - 0.03, ROOM_CZ, 0.06, ROOM_D],
  ]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), trimMat);
    t.name = 'room_baseboard'; t.position.set(x, 0.05, z); e.add(t);
  }

  /* ---------------- staff entrance ---------------- */
  // Everything about the doorway (frame, leaf, reader, sign) lives in one group so it can be hidden as a unit — the
  // opening in the wall stays, reading as an open doorway.
  const doorGrp = new THREE.Group(); doorGrp.name = 'staff_door'; e.add(doorGrp);
  const eAdd = e.add.bind(e); e.add = (o) => doorGrp.add(o);
  const steel = new THREE.MeshStandardMaterial({ color: 0x3f444b, roughness: 0.55, metalness: 0.5 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.5, metalness: 0.6 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.25, metalness: 0.9 });
  const zWall = ROOM_BOUNDS.maxZ;
  const jamb = (x) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, DOOR_H + 0.04, 0.14), frameMat); m.name = 'door_frame'; m.position.set(x, (DOOR_H + 0.04) / 2, zWall - 0.02); e.add(m); };
  jamb(dl - 0.04); jamb(dr + 0.04);
  const header = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W + 0.16, 0.08, 0.14), frameMat); header.name = 'door_frame'; header.position.set(DOOR_X, DOOR_H + 0.04, zWall - 0.02); e.add(header);
  // The leaf hangs off a hinge group at the left jamb; positive yaw swings it into the room.
  const hinge = new THREE.Group(); hinge.name = 'door_hinge'; hinge.position.set(dl + 0.01, 0, zWall - 0.05); e.add(hinge);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W - 0.02, DOOR_H - 0.02, 0.045), steel); leaf.name = 'door_leaf'; leaf.position.set((DOOR_W - 0.02) / 2, DOOR_H / 2, 0); leaf.castShadow = true; hinge.add(leaf);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, DOOR_W * 0.7, 12), chrome); bar.name = 'door_pushbar'; bar.rotation.z = Math.PI / 2; bar.position.set((DOOR_W - 0.02) / 2, 1.05, -0.06); hinge.add(bar);
  for (const dx of [-DOOR_W * 0.33, DOOR_W * 0.33]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.06), chrome); s.position.set((DOOR_W - 0.02) / 2 + dx, 1.05, -0.035); hinge.add(s); }
  const kick = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W - 0.06, 0.25, 0.004), chrome); kick.position.set((DOOR_W - 0.02) / 2, 0.16, -0.025); hinge.add(kick);
  const window_ = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.05), new THREE.MeshStandardMaterial({ color: 0x9fb4c8, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.55 })); window_.position.set((DOOR_W - 0.02) / 2 + 0.2, 1.55, 0); hinge.add(window_);
  // Badge reader beside the door with a status LED (green idle, blue while a badge is read).
  const reader = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.03), new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.4, metalness: 0.3 })); reader.name = 'badge_reader';
  reader.position.set(dr + 0.32, 1.15, zWall - 0.02); e.add(reader);
  const badgeLed = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0x2ee36a, emissiveIntensity: 1.8, toneMapped: false });
  const bled = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 0.004), badgeLed); bled.name = 'badge_led'; bled.userData.thermalSkip = true; bled.position.set(dr + 0.32, 1.19, zWall - 0.037); e.add(bled);
  const readerGlyph = new THREE.Mesh(new THREE.RingGeometry(0.012, 0.02, 20), new THREE.MeshBasicMaterial({ color: 0x8a9099 })); readerGlyph.position.set(dr + 0.32, 1.14, zWall - 0.036); readerGlyph.rotation.y = Math.PI; e.add(readerGlyph);
  // Illuminated EXIT sign above the lintel.
  const sc = document.createElement('canvas'); sc.width = 256; sc.height = 96; const sx = sc.getContext('2d');
  sx.fillStyle = '#0b1f12'; sx.fillRect(0, 0, 256, 96); sx.strokeStyle = '#2ee36a'; sx.lineWidth = 6; sx.strokeRect(6, 6, 244, 84);
  sx.fillStyle = '#2ee36a'; sx.font = '900 62px "Helvetica Neue", Helvetica, Arial, sans-serif'; sx.textAlign = 'center'; sx.textBaseline = 'middle'; sx.fillText('EXIT', 128, 50);
  const signTex = new THREE.CanvasTexture(sc); signTex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.158), new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false })); sign.name = 'exit_sign';
  sign.position.set(DOOR_X, DOOR_H + 0.28, zWall - 0.06); sign.rotation.y = Math.PI; sign.userData.thermalSkip = true; e.add(sign);
  const signBox = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.18, 0.06), frameMat); signBox.position.set(DOOR_X, DOOR_H + 0.28, zWall - 0.03); e.add(signBox);

  e.add = eAdd;

  /* ---------------- lighting ---------------- */
  // Overhead cable trays / wire framing live in OverheadCabling.ts (added to the scene alongside this group).
  const lamp = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe8eefc, emissiveIntensity: 1.5 });
  const lamps = [];
  for (const z of [1.6, -1.135, -3.2]) { const l = new THREE.Mesh(new THREE.BoxGeometry(7, 0.04, 0.12), lamp); l.name = 'ceiling_lamp'; l.userData.thermalSkip = true; l.position.set(0, ROOM_H - 0.5, z); e.add(l); lamps.push(l); }
  // Emergency strips: dark until the utility drops, then a red wash from both end walls and above the door.
  const emergency = new THREE.MeshStandardMaterial({ color: 0x1a0806, emissive: 0xff3a24, emissiveIntensity: 0, toneMapped: false });
  for (const [x, z] of [[ROOM_BOUNDS.minX + 0.6, ROOM_CZ], [ROOM_BOUNDS.maxX - 0.6, ROOM_CZ], [DOOR_X, zWall - 0.6], [ROOM_CX, ROOM_BOUNDS.minZ + 0.6]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.12), emergency); m.name = 'emergency_lamp'; m.userData.thermalSkip = true; m.position.set(x, ROOM_H - 0.42, z); e.add(m);
  }

  /* ---------------- per-frame ---------------- */
  let doorTarget = 0, badgeBlinkUntil = -1;
  const tick = (t) => {
    hinge.rotation.y += (doorTarget - hinge.rotation.y) * 0.06;
    if (badgeBlinkUntil > t) { const k = Math.sin(t * 18) > 0 ? 1 : 0.15; badgeLed.emissive.setHex(0x3b8fe8); badgeLed.emissiveIntensity = 2.6 * k; }
    else if (badgeBlinkUntil >= 0) { badgeBlinkUntil = -1; badgeLed.emissive.setHex(0x2ee36a); badgeLed.emissiveIntensity = 1.8; }
  };
  e.userData = {
    lamps: { material: lamp, meshes: lamps }, emergency, badgeLed, tick, door: doorGrp,
    /** Swing the staff door open (toward the room) or closed. */
    setDoorOpen(on) { doorTarget = on ? 1.35 : 0; },
    /** Blue "badge read" flash for `secs` seconds of scene time from `t`. */
    badgeRead(t, secs = 1.2) { badgeBlinkUntil = t + secs; },
  };
  return e;
}
