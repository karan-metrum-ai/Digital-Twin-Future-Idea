// @ts-nocheck
/* eslint-disable */
// Two-row hot-aisle layout: five racks facing +z (row A) and five racks rotated 180° (row B) so the two rows
// stand back-to-back with their rears facing each other across a contained hot aisle. All ten racks in the two
// rows are static replicas of the procedural rack: every mesh of the built rack is baked into world space and
// merged per material, so a whole replica costs a few dozen draw calls instead of several thousand. They share
// geometry buffers' source materials (so LED blink / thermal swap still apply) but carry none of the interactive
// plumbing (doors, exploded view, cabling toggles, liquid hoses). The interactive rack itself has been pulled out
// of the row (see LIVE_RACK_PLACEMENT) and stands on its own elsewhere in the hall — its old spot, row A's centre
// slot, is filled in like every other slot.
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const ROW_PITCH = 0.65;                                        // rack-to-rack pitch along the row, m
export const ROW_XS = [-2, -1, 0, 1, 2].map((i) => i * ROW_PITCH);    // five racks per row
export const RACK_DEPTH = 1.07;
export const HOT_AISLE = 1.2;                                         // clear width between the two rows' rears, m
export const ROW_B_Z = -(RACK_DEPTH + HOT_AISLE);                     // row B centre line (row A is at z = 0)
export const ROW_A_Z = 0;

// Where the interactive rack stands now that it's been pulled out of row A's centre slot: off to the side of
// the hall, clear of both rows, turned to face back toward them.
export const LIVE_RACK_PLACEMENT = { x: 5.0, z: -1.0, rotY: -Math.PI / 2 };

/** World transform of the rack at index `i` in row `row` (`'A'` faces +z, `'B'` is rotated 180° to face −z). */
export function rackPlacement(row, i) {
  return row === 'A' ? { x: ROW_XS[i], z: ROW_A_Z, rotY: 0 } : { x: -ROW_XS[i], z: ROW_B_Z, rotY: Math.PI };
}

export function buildRackReplicas(THREE, rack) {
  const group = new THREE.Group(); group.name = 'rack_replicas';
  rack.updateMatrixWorld(true);
  // Bake the rack into one geometry per (material, attribute layout).
  const buckets = new Map();
  const skipRe = /^(airflow_heat_sim|cooling_vapor|coolant_flow)$/;
  rack.traverse((o) => {
    if (!o.isMesh || !o.visible || skipRe.test(o.name) || o.isSprite) return;
    let visible = true; for (let p = o.parent; p && p !== rack; p = p.parent) if (!p.visible) { visible = false; break; }
    if (!visible) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.length !== 1) return; // multi-material meshes are not produced by the rack builders
    let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    geo.applyMatrix4(o.matrixWorld);
    const key = mats[0].uuid;
    if (!buckets.has(key)) buckets.set(key, { mat: mats[0], geos: [] });
    buckets.get(key).geos.push(geo);
  });
  const template = new THREE.Group(); template.name = 'rack_replica_template';
  for (const { mat, geos } of buckets.values()) {
    const merged = mergeGeometries(geos, false); geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat); m.name = 'replica_' + (mat.name || 'part'); m.castShadow = false; m.receiveShadow = false;
    template.add(m);
  }
  // Place all ten copies (both full rows — the interactive rack no longer occupies row A's centre slot, so it's
  // filled with a replica like every other slot); copies share the merged geometry buffers with the template,
  // so the memory cost is one baked rack.
  for (const row of ['A', 'B']) for (let i = 0; i < ROW_XS.length; i++) {
    const { x, z, rotY } = rackPlacement(row, i);
    const copy = new THREE.Group(); copy.name = `rack_replica_${row}${i}`;
    template.children.forEach((m) => { const c = m.clone(); copy.add(c); });
    copy.position.set(x, 0, z); copy.rotation.y = rotY;
    group.add(copy);
  }
  return group;
}
