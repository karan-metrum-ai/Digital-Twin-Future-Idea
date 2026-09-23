// @ts-nocheck
/* eslint-disable */
// Materials built from the texture set `T`. `M` (the material factory) and `ledMat` (blinking LED material
// factory, registered into `anim` for the idle-blink animation loop) are exposed for reuse by item builders
// (Server's hex bezel + orange release button, NUC's chassis/face materials, etc.).

export function createMaterials(THREE, T, anim) {
  const M = (n, o) => { const m = new THREE.MeshStandardMaterial(o); m.name = n; return m; };
  const mats = {
    steel: M('powder_coated_steel', { color: 0x1c1d20, roughness: 0.62, metalness: 0.55, map: T.powder }),
    silver: M('brushed_silver_chassis', { color: 0xc4c8cd, roughness: 0.32, metalness: 0.85, map: T.brushed }),
    graphite: M('graphite_chassis', { color: 0x4a4e55, roughness: 0.4, metalness: 0.8, map: T.brushed }),
    trim: M('chassis_trim', { color: 0xd2d5d9, roughness: 0.25, metalness: 0.9 }),
    ear: M('rack_ear_metal', { color: 0xb7bbbf, roughness: 0.35, metalness: 0.85 }),
    dark: M('backplane_dark', { color: 0x15161a, roughness: 0.6, metalness: 0.5 }),
    bezelPlastic: M('bezel_plastic', { color: 0x2a2c30, roughness: 0.7, metalness: 0.1 }),
    grill: M('honeycomb_grill', { color: 0x8e9196, roughness: 0.45, metalness: 0.7, map: T.hexGrill, alphaMap: T.hexAlpha, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }),
    grillSolid: M('honeycomb_vent', { color: 0xffffff, roughness: 0.6, metalness: 0.5, map: T.hexGrill }),
    doorMesh: M('perforated_door', { color: 0x9a9ca1, roughness: 0.55, metalness: 0.6, map: T.hexGrill, alphaMap: T.hexAlpha, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }),
    rail: M('mounting_rail', { color: 0xffffff, roughness: 0.55, metalness: 0.6, map: T.rail }),
    sff: M('sff_drive', { map: T.sff, roughness: 0.5, metalness: 0.35 }),
    sffSq: M('sff_drive_1u', { map: T.sffSq, roughness: 0.5, metalness: 0.35 }),
    sqMesh: M('square_mesh_vent', { map: T.sqMesh, roughness: 0.9, metalness: 0.05 }),
    leftStatus: M('left_status_column', { map: T.leftStatus, roughness: 0.5, metalness: 0.4 }),
    lff: M('lff_drive', { map: T.lff, roughness: 0.5, metalness: 0.35 }),
    driveSide: M('drive_carrier_side', { color: 0x1a1c1e, roughness: 0.6, metalness: 0.4 }),
    ctrl: M('control_panel', { map: T.ctrl, roughness: 0.4, metalness: 0.55 }),
    leftPorts: M('left_ports', { map: T.leftPorts, roughness: 0.4, metalness: 0.55 }),
    switch48: M('switch_faceplate_48', { map: T.switch48, roughness: 0.5, metalness: 0.4 }),
    switch24: M('switch_faceplate_24', { map: T.switch24, roughness: 0.5, metalness: 0.4 }),
    patch: M('patch_panel_faceplate', { map: T.patch, roughness: 0.55, metalness: 0.4 }),
    pdu: M('pdu_faceplate', { map: T.pdu, color: 0xffffff, roughness: 0.35, metalness: 0.75 }),
    rear: { 1: M('rear_io_1u', { map: T.rear[1], roughness: 0.55, metalness: 0.45 }), 2: M('rear_io_2u', { map: T.rear[2], roughness: 0.55, metalness: 0.45 }), 3: M('rear_io_3u', { map: T.rear[3], roughness: 0.55, metalness: 0.45 }), 4: M('rear_io_4u', { map: T.rear[4], roughness: 0.55, metalness: 0.45 }) },
    screw: M('zinc_screw', { color: 0xb8bcc2, roughness: 0.3, metalness: 0.9 }),
    rubber: M('rubber', { color: 0x141416, roughness: 0.95, metalness: 0 }),
    cableBlue: M('cable_blue', { color: 0x1f56c4, roughness: 0.6, metalness: 0 }),
    cableBlack: M('cable_black', { color: 0x161719, roughness: 0.7, metalness: 0 }),
    cableYellow: M('cable_yellow_fiber', { color: 0xe2bd1e, roughness: 0.6, metalness: 0 }),
    boot: M('connector_boot', { color: 0x0e0f11, roughness: 0.5, metalness: 0.1 }),
    velcro: M('velcro_strap', { color: 0x0a0a0b, roughness: 0.95, metalness: 0 }),
    brush: M('brush_grommet', { color: 0x2a2b2e, roughness: 1, metalness: 0 }),
    lcd: M('lcd_display', { color: 0x1a2a20, roughness: 0.4, metalness: 0, emissive: 0x143a24, emissiveIntensity: 0.8 }),
    cyan: M('indicator_bar_cyan', { color: 0x0abfcf, emissive: 0x00d4e8, emissiveIntensity: 1.8, roughness: 0.3, metalness: 0.5, toneMapped: false }),
  };
  // LED materials are pooled per (colour, pattern) — a handful of materials per pattern so the fleet doesn't blink in
  // lockstep, but few enough that the baked replicas (merged per material) stay at a sane draw-call count. Each
  // material carries its pattern + a seed for ledPatterns.ledIntensity; ServerRackTwin drives them every frame.
  const LED_POOL = 6, ledPools = new Map();
  const ledMat = (hex, pattern = 'activity') => {
    const key = hex + ':' + pattern; let pool = ledPools.get(key);
    if (!pool) { pool = { i: 0, mats: [] }; ledPools.set(key, pool); }
    if (pool.mats.length < LED_POOL) { const m = M('led_' + hex.toString(16) + '_' + pattern + '_' + pool.mats.length, { color: 0x0a2012, emissive: hex, emissiveIntensity: 1.6, toneMapped: false }); m.userData.pattern = pattern; m.userData.seed = anim.length * 1.7 + pool.mats.length * 3.1; anim.push(m); pool.mats.push(m); return m; }
    return pool.mats[pool.i++ % LED_POOL];
  };

  return { mats, M, ledMat };
}
