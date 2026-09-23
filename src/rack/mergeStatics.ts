// @ts-nocheck
/* eslint-disable */
// Draw-call reduction for the interactive rack: within each exploded-view item (a server, a switch, a PDU…) the
// small purely-decorative parts — drive carriers, rack ears and their screws, front trims, outlet pins, backplanes,
// I/O plates, side panels, chassis bodies, activity-LED dots — are merged into one mesh per material. Nothing that
// is toggled, animated, referenced or picked individually is touched (bezels/covers, doors, cables, ports, anything
// flagged cableRoute/thermalSkip), and the merge stays inside the item group so the exploded view, the per-mesh
// thermal material swap and the shadow policy all keep working. A multi-material box is split by its groups so each
// face lands in the bucket of its own material. Typical result: the rack's ~1150 meshes drop to roughly half.
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Part-name prefixes that are safe to merge (see RackContext / components for where they are created). */
export const MERGEABLE_RE = /^(sff_drive_carrier|lff_drive_carrier|rack_ear_flange|rack_ear_body|ear_screw|front_trim|outlet_pin|backplane|rear_io_plate|control_panel|left_status_column|chassis_body|activity_led|blank_screw|honeycomb|square_mesh_vent)_\d+$/;

/**
 * Merge the mergeable parts of every item group under `rack`. Returns { before, after } visible-mesh counts for the
 * whole rack so callers/tooling can see what it bought.
 */
export function mergeItemStatics(THREE, rack) {
  const items = rack.userData.items ?? [];
  const count = () => { let n = 0; rack.traverse((o) => { if (o.isMesh) n++; }); return n; };
  const before = count();
  rack.updateMatrixWorld(true);
  const inv = new THREE.Matrix4(), rel = new THREE.Matrix4();

  for (const it of items) {
    const group = it.group; if (!group) continue;
    inv.copy(group.matrixWorld).invert();
    const candidates = [];
    group.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || !o.visible) return;
      if (!MERGEABLE_RE.test(o.name || '')) return;
      if (o.userData.cableRoute || o.userData.thermalSkip) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some((m) => !m || m.transparent || m.isShaderMaterial)) return;
      if (o.children.length) return; // something hangs off it; leave the hierarchy alone
      candidates.push(o);
    });
    if (candidates.length < 2) continue;

    // Bucket geometry by material; every piece is baked into the item group's frame and made non-indexed so any mix
    // of Box/Plane/Cylinder/split-face geometry merges cleanly.
    const buckets = new Map(); // material.uuid -> { material, geos, cast, kinds }
    const put = (material, geo, src) => {
      let b = buckets.get(material.uuid);
      if (!b) { b = { material, geos: [], cast: false, kinds: new Set(), merged: false }; buckets.set(material.uuid, b); }
      b.geos.push(geo); b.cast = b.cast || src.castShadow; b.kinds.add(src.name.replace(/_\d+$/, ''));
    };
    for (const o of candidates) {
      rel.multiplyMatrices(inv, o.matrixWorld);
      const g = o.geometry;
      if (Array.isArray(o.material)) {
        for (const grp of g.groups) { const piece = sliceGroup(THREE, g, grp); if (!piece) continue; piece.applyMatrix4(rel); put(o.material[grp.materialIndex] ?? o.material[0], piece, o); }
      } else {
        const piece = (g.index ? g.toNonIndexed() : g.clone()); stripToPNU(THREE, piece); piece.applyMatrix4(rel); put(o.material, piece, o);
      }
    }
    for (const b of buckets.values()) {
      if (b.geos.length < 2) { b.geos.forEach((g) => g.dispose()); continue; }
      const merged = mergeGeometries(b.geos, false); b.geos.forEach((g) => g.dispose());
      if (!merged) continue;
      b.merged = true;
      const m = new THREE.Mesh(merged, b.material);
      m.name = 'merged_' + [...b.kinds].join('+'); m.castShadow = b.cast; m.receiveShadow = false; m.userData.merged = true;
      group.add(m);
    }
    // Drop the originals that went into a merged mesh (every one of their materials produced a merged bucket).
    const mergedMats = new Set([...buckets.values()].filter((b) => b.merged).map((b) => b.material.uuid));
    for (const o of candidates) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (!mats.every((mm) => mergedMats.has(mm.uuid))) continue; // a face of it stayed unmerged: keep the whole part
      o.parent.remove(o); o.geometry.dispose();
    }
  }
  return { before, after: count() };
}

/** Non-indexed position/normal/uv geometry for one material group of `g`. */
function sliceGroup(THREE, g, grp) {
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv; if (!pos) return null;
  const n = grp.count === Infinity ? (g.index ? g.index.count : pos.count) - grp.start : grp.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const vi = g.index ? g.index.getX(grp.start + i) : grp.start + i;
    P[i * 3] = pos.getX(vi); P[i * 3 + 1] = pos.getY(vi); P[i * 3 + 2] = pos.getZ(vi);
    if (nor) { N[i * 3] = nor.getX(vi); N[i * 3 + 1] = nor.getY(vi); N[i * 3 + 2] = nor.getZ(vi); }
    if (uv) { U[i * 2] = uv.getX(vi); U[i * 2 + 1] = uv.getY(vi); }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  if (!nor) out.computeVertexNormals();
  return out;
}

/** Keep only position/normal/uv (adding what is missing) so every piece has the same attribute layout. */
function stripToPNU(THREE, geo) {
  for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  geo.clearGroups();
}
