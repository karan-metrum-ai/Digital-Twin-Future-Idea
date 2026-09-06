// @ts-nocheck
/* eslint-disable */
// Thermal view: swaps every scene material for a "temperature" shader while active. The interactive rack gets
// a load-driven temperature per server slot (front cool intake, rear hot exhaust) exactly as before, coloured
// through an authentic IR-camera "rainbow" LUT (cold blue -> cyan -> green -> yellow -> orange -> hot red/white,
// the same palette real FLIR/Seek thermal cameras default to) with a scan-line + sensor-noise post look. Every
// other rack in the room (the nine baked replicas from RackRow) gets the *same* per-slot heat model applied in
// its own local frame — undoing that rack's placement (position + 180° turn for row B) before running the slot
// lookup — plus its own randomised load profile and a slow, independently-phased live flicker, so the thermal
// camera reads as a working datacenter: every rack runs its own mix of idle/loaded gear and its hot/cool spots
// drift over time, rather than ten identical copies of the rack the user is driving. Restores every original
// material on exit.
import { rackPlacement, ROW_XS } from '../environment/RackRow';

const VERT = `
  uniform float uRackX, uRackZ, uRackRotY;
  varying vec3 vW; varying vec3 vL; varying vec3 vN;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    // undo this rack instance's placement so the slot lookup below always runs in rack-local space,
    // whichever of the ten racks in the room this vertex belongs to.
    float rx = w.x - uRackX, rz = w.z - uRackZ;
    float cs = cos(-uRackRotY), sn = sin(-uRackRotY);
    vL = vec3(rx * cs - rz * sn, w.y, rx * sn + rz * cs);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const FRAG = `
  precision highp float;
  varying vec3 vW; varying vec3 vL; varying vec3 vN;
  uniform float uTime, uAmbient, uGain, uPhase; uniform vec4 uSlots[64]; uniform int uCount;
  float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  // Authentic thermal-imaging "rainbow" LUT — the palette real FLIR / Seek Thermal cameras default to:
  // black/navy (coldest) -> blue -> cyan -> green -> yellow -> orange -> red -> white (hottest).
  vec3 rainbow(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c0 = vec3(0.0, 0.0, 0.02);   // near-black cold background
    vec3 c1 = vec3(0.05, 0.0, 0.55);  // deep blue
    vec3 c2 = vec3(0.0, 0.55, 0.95);  // cyan-blue
    vec3 c3 = vec3(0.0, 0.75, 0.25);  // green
    vec3 c4 = vec3(0.85, 0.92, 0.0);  // yellow
    vec3 c5 = vec3(1.0, 0.45, 0.0);   // orange
    vec3 c6 = vec3(0.9, 0.05, 0.05);  // red
    vec3 c7 = vec3(1.0, 0.95, 0.85);  // white-hot
    if (t < 0.14) return mix(c0, c1, t / 0.14);
    if (t < 0.30) return mix(c1, c2, (t - 0.14) / 0.16);
    if (t < 0.46) return mix(c2, c3, (t - 0.30) / 0.16);
    if (t < 0.62) return mix(c3, c4, (t - 0.46) / 0.16);
    if (t < 0.76) return mix(c4, c5, (t - 0.62) / 0.14);
    if (t < 0.90) return mix(c5, c6, (t - 0.76) / 0.14);
    return mix(c6, c7, (t - 0.90) / 0.10);
  }
  void main() {
    float T = uAmbient;
    // floor and far room sit a touch cooler than rack metal; rack steel reads slightly warmer than ambient air
    // (evaluated in this rack's own local frame, so it lines up for every rack, not just the one at the origin)
    if (vL.y < 0.02) T = uAmbient - 0.06; else if (abs(vL.x) > 0.31 || abs(vL.z) > 0.56) T = uAmbient - 0.03; else T = uAmbient + 0.03;
    // floor & air fall-off, exhaust plume rising behind the rack
    for (int i = 0; i < 64; i++) {
      if (i >= uCount) break;
      vec4 s = uSlots[i];
      // gentle, per-rack-phased live drift on top of the slot's base load so every rack's hotspots breathe
      // independently instead of sitting frozen at one temperature.
      float w = clamp(s.w + 0.12 * sin(uTime * 0.17 + uPhase + float(i) * 0.9), 0.0, 1.0);
      float dy = abs(vL.y - s.x) / max(s.y * 0.75, 0.02);
      float inSlot = exp(-dy * dy * 1.6);
      float rearZ = s.z;
      // chassis body heat grows toward the rear
      float along = clamp((0.40 - vL.z) / max(0.40 - rearZ, 0.1), 0.0, 1.0);
      float body = inSlot * w * (0.35 + 0.65 * along) * step(rearZ - 0.03, vL.z) * step(vL.z, 0.42) * step(abs(vL.x), 0.245);
      // rear exhaust cloud (cables, PDUs, doors pick it up), drifting upward
      float dz = vL.z - rearZ; float plume = exp(-max(0.0, -dz) * 3.0) * step(vL.z, rearZ + 0.02);
      float rise = clamp((vL.y - s.x) / 0.5, 0.0, 1.0);
      float dyp = abs(vL.y - s.x - rise * 0.3) / (s.y * 0.6 + rise * 0.35);
      float cloud = plume * w * exp(-dyp * dyp) * 0.75 * step(abs(vL.x), 0.35);
      // front face stays cool (intake)
      float front = inSlot * w * 0.22 * step(0.40, vL.z) * step(vL.z, 0.47) * step(abs(vL.x), 0.245);
      T = max(T, max(body, max(cloud, front)));
    }
    // facing-dependent apparent emissivity so cold geometry still shows edges
    float facing = 0.6 + 0.4 * abs(dot(vN, normalize(cameraPosition - vW)));
    T *= facing * uGain;
    // sensor noise + slow flicker
    float n = (h(floor(gl_FragCoord.xy / 2.0) + floor(uTime * 12.0)) - 0.5) * 0.035;
    T += n;
    vec3 col = rainbow(T);
    // scanlines
    col *= 0.92 + 0.08 * sin(gl_FragCoord.y * 1.4);
    gl_FragColor = vec4(col, 1.0);
  }`;

export function buildThermalView(THREE, scene, rack, slots, liveX = 0, liveZ = 0, liveRotY = 0) {
  const N = Math.max(1, slots.length);

  // Builds one rack's worth of per-slot temperatures (padded vec4 array: y, h, zr, temp), genuinely randomised
  // around a per-rack load bias so each rack ends up with its own mix of idle and heavily-loaded gear — some
  // racks read mostly cool, some mostly hot, most a real mix — rather than every rack following the same curve.
  function makeSlotData(loadBias) {
    const arr = new Float32Array(64 * 4);
    const temps = slots.map((s, i) => {
      const jitter = (Math.random() - 0.5) * 0.6;         // per-slot randomness
      const spike = s.h > 0.1 ? 1.15 : 1;                  // multi-U gear (GPU/storage) runs a bit hotter
      return Math.min(1, Math.max(0.05, (loadBias + jitter) * spike));
    });
    slots.forEach((s, i) => { arr[i * 4] = s.y; arr[i * 4 + 1] = s.h; arr[i * 4 + 2] = s.zr; arr[i * 4 + 3] = Math.min(1, temps[i]); });
    return { arr, temps };
  }

  function makeMaterial(phase, x, z, rotY, slotData, count) {
    const uniforms = {
      uTime: { value: 0 }, uSlots: { value: slotData.arr }, uCount: { value: count },
      uAmbient: { value: 0.24 }, uGain: { value: 1.0 }, uPhase: { value: phase },
      uRackX: { value: x }, uRackZ: { value: z }, uRackRotY: { value: rotY },
    };
    const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide });
    mat.name = 'thermal_view';
    return { mat, uniforms, slotData };
  }

  // The interactive rack: driven live by setTemps()/the `temps` prop, placed wherever it's actually standing
  // now (RackRow.LIVE_RACK_PLACEMENT — it no longer sits in row A's centre slot).
  const mainSlots = makeSlotData(0.5);
  const mainRack = makeMaterial(Math.random() * 1000, liveX, liveZ, liveRotY, mainSlots, N);

  // Generic material for everything that isn't rack chassis (room, floor, cooling/liquid plumbing, replica
  // floor grilles, …) — no slots, so it just falls back to the ambient/room/floor look above.
  const ambient = makeMaterial(0, 0, 0, 0, { arr: new Float32Array(64 * 4), temps: [] }, 0);

  // The ten baked replica racks filling both full rows (RackRow.buildRackReplicas, including the dummy that now
  // stands in the interactive rack's old centre slot): same slot geometry, each with its own randomised load
  // bias (some racks running mostly idle, some near max) and its own live-flicker phase, so the room reads as a
  // real datacenter rather than mirrored copies of the main rack.
  const replicas = new Map(); // 'A0' | 'B3' | … -> { mat, uniforms, slotData }
  for (const row of ['A', 'B']) for (let i = 0; i < ROW_XS.length; i++) {
    const { x, z, rotY } = rackPlacement(row, i);
    const loadBias = 0.2 + Math.random() * 0.7;   // this rack's overall load, 0.2 (mostly idle) .. 0.9 (heavily loaded)
    const phase = Math.random() * 1000;           // independent live-flicker timing
    replicas.set(row + i, makeMaterial(phase, x, z, rotY, makeSlotData(loadBias), N));
  }

  const allMats = [mainRack, ambient, ...replicas.values()];

  // Walks up from a mesh to find which rack (if any) it belongs to: the interactive rack's own group, or one
  // of the nine `rack_replica_<row><i>` wrapper groups RackRow.buildRackReplicas places each baked copy under.
  const replicaRe = /^rack_replica_(A|B)(\d+)$/;
  function rackKeyFor(o) {
    for (let p = o; p; p = p.parent) {
      if (p.name === 'server_rack') return 'main';
      const m = replicaRe.exec(p.name || '');
      if (m) return m[1] + m[2];
    }
    return null;
  }

  const saved = new Map();
  let active = false, prevBg = null, prevFog = null, prevEnv = null;
  const api = {
    get active() { return active; },
    set(on) {
      if (on === active) return; active = on;
      if (on) {
        prevBg = scene.background; prevFog = scene.fog; prevEnv = scene.environment;
        scene.background = new THREE.Color(0x000000); scene.fog = null; scene.environment = null;
        scene.traverse(o => {
          if (!o.isMesh || o.name === 'airflow_heat_sim' || o.userData.thermalSkip) return;
          const key = rackKeyFor(o);
          const target = key === 'main' ? mainRack.mat : key ? (replicas.get(key)?.mat ?? ambient.mat) : ambient.mat;
          saved.set(o, o.material); o.material = target;
        });
      } else {
        saved.forEach((m, o) => o.material = m); saved.clear();
        scene.background = prevBg; scene.fog = prevFog; scene.environment = prevEnv;
      }
    },
    tick(t) { for (const { uniforms } of allMats) uniforms.uTime.value = t; },
    setTemps(arr) { arr.forEach((v, i) => { if (i < 64) mainSlots.arr[i * 4 + 3] = Math.min(1, Math.max(0, v)); }); },
    temps: mainSlots.temps,
  };
  return api;
}
