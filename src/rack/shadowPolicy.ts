// @ts-nocheck
/* eslint-disable */
// Shadow policy for the digital twin: only large silhouette meshes on the interactive rack cast;
// primarily the floor receives. Tiny parts (cables, LEDs, screws, boots) never cast — they burn
// the shadow map for almost no readable contact. Replicas and liquid fixtures opt out entirely.

/** Name prefixes / substrings that should cast (rack silhouette + large opaque volumes). */
const CAST_RE = /(plinth|top_panel|corner_post|side_panel|mounting_rail|rail_bracket|door_frame|rear_door|front_door|blanking_panel|chassis|bezel_frame|bezel_end_cap|bezel_rail|bezel_hex|bezel_lock_boss|server_|switch_|patch_panel|cable_manager|pdu_|hpdu_|vertical_pdu|horizontal_pdu|nuc_shelf|nuc_body|cdu_|manifold|header_|cabinet|technician_body|technician_leg|ups_shell|pdu_cabinet)/i;

/** Tiny / thin parts that must never cast (even if a parent name matched). */
const NEVER_CAST_RE = /(cable|boot|led|screw|velcro|ring|hose|qd_|collar|flange|clamp|fiber|connector|activity_led|lock_barrel|key_slot|hinge_pin|caster_wheel|caster_hub|leveling_|outlet|pin|breaker|display|badge|brush_)/i;

/**
 * Apply silhouette-only cast + no receive on a root (interactive rack or live liquid fixtures).
 * Floor receive is handled separately on the environment floor mesh.
 */
export function applySilhouetteShadows(root, { cast = true, receive = false } = {}) {
  if (!root) return;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const n = o.name || '';
    const allowCast = cast && CAST_RE.test(n) && !NEVER_CAST_RE.test(n);
    o.castShadow = allowCast;
    o.receiveShadow = receive;
  });
}

/** Disable all shadow cast/receive under a root (replicas, row liquid, walls). */
export function disableShadows(root) {
  if (!root) return;
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = false;
    o.receiveShadow = false;
  });
}

/**
 * Tighten the key light's orthographic shadow camera around the hall footprint so a 1024 map
 * still resolves contact under the live rack.
 */
export function configureKeyShadow(key, bounds) {
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.02;
  const cam = key.shadow.camera;
  const pad = 1.5;
  cam.left = (bounds.minX ?? -8) - pad;
  cam.right = (bounds.maxX ?? 8) + pad;
  cam.top = (bounds.maxZ ?? 7) + pad;
  cam.bottom = (bounds.minZ ?? -8) - pad;
  cam.near = 0.5;
  cam.far = 40;
  cam.updateProjectionMatrix();
}
