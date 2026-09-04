// @ts-nocheck
/* eslint-disable */
// Thermal view: swaps every scene material for a "temperature" shader while active. Each server slot gets a
// load-driven temperature; surfaces are coloured through an ironbow LUT by proximity to hot slots (front cool
// intake, rear hot exhaust), with a scan-line + sensor-noise post look. Restores originals on exit.

export function buildThermalView(THREE, scene, rack, slots) {
  const N = Math.max(1, slots.length);
  const slotArr = new Float32Array(64 * 4); // y, h, zr, temp(0..1) per slot (padded to 64)
  const temps = slots.map((s, i) => 0.35 + 0.5 * Math.abs(Math.sin(i * 1.7 + 0.4)) * (s.h > 0.1 ? 1.25 : 1));
  slots.forEach((s, i) => { slotArr[i * 4] = s.y; slotArr[i * 4 + 1] = s.h; slotArr[i * 4 + 2] = s.zr; slotArr[i * 4 + 3] = Math.min(1, temps[i]); });
  const uniforms = { uTime: { value: 0 }, uSlots: { value: slotArr }, uCount: { value: N }, uAmbient: { value: 0.24 }, uGain: { value: 1.0 } };
  const vert = `
    varying vec3 vW; varying vec3 vN;
    void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
  const frag = `
    precision highp float;
    varying vec3 vW; varying vec3 vN;
    uniform float uTime, uAmbient, uGain; uniform vec4 uSlots[64]; uniform int uCount;
    float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 ironbow(float t) {
      t = clamp(t, 0.0, 1.0);
      vec3 c0 = vec3(0.0, 0.0, 0.0), c1 = vec3(0.13, 0.0, 0.38), c2 = vec3(0.62, 0.0, 0.62), c3 = vec3(0.92, 0.28, 0.12), c4 = vec3(1.0, 0.74, 0.0), c5 = vec3(1.0, 1.0, 0.9);
      if (t < 0.2) return mix(c0, c1, t / 0.2); if (t < 0.4) return mix(c1, c2, (t - 0.2) / 0.2); if (t < 0.6) return mix(c2, c3, (t - 0.4) / 0.2); if (t < 0.8) return mix(c3, c4, (t - 0.6) / 0.2); return mix(c4, c5, (t - 0.8) / 0.2);
    }
    void main() {
      float T = uAmbient;
      // floor and far room sit a touch cooler than rack metal; rack steel reads slightly warmer than ambient air
      if (vW.y < 0.02) T = uAmbient - 0.06; else if (abs(vW.x) > 0.31 || abs(vW.z) > 0.56) T = uAmbient - 0.03; else T = uAmbient + 0.03;
      // floor & air fall-off, exhaust plume rising behind the rack
      for (int i = 0; i < 64; i++) {
        if (i >= uCount) break;
        vec4 s = uSlots[i];
        float dy = abs(vW.y - s.x) / max(s.y * 0.75, 0.02);
        float inSlot = exp(-dy * dy * 1.6);
        float rearZ = s.z;
        // chassis body heat grows toward the rear
        float along = clamp((0.40 - vW.z) / max(0.40 - rearZ, 0.1), 0.0, 1.0);
        float body = inSlot * s.w * (0.35 + 0.65 * along) * step(rearZ - 0.03, vW.z) * step(vW.z, 0.42) * step(abs(vW.x), 0.245);
        // rear exhaust cloud (cables, PDUs, doors pick it up), drifting upward
        float dz = vW.z - rearZ; float plume = exp(-max(0.0, -dz) * 3.0) * step(vW.z, rearZ + 0.02);
        float rise = clamp((vW.y - s.x) / 0.5, 0.0, 1.0);
        float dyp = abs(vW.y - s.x - rise * 0.3) / (s.y * 0.6 + rise * 0.35);
        float cloud = plume * s.w * exp(-dyp * dyp) * 0.75 * step(abs(vW.x), 0.35);
        // front face stays cool (intake)
        float front = inSlot * s.w * 0.22 * step(0.40, vW.z) * step(vW.z, 0.47) * step(abs(vW.x), 0.245);
        T = max(T, max(body, max(cloud, front)));
      }
      // facing-dependent apparent emissivity so cold geometry still shows edges
      float facing = 0.6 + 0.4 * abs(dot(vN, normalize(cameraPosition - vW)));
      T *= facing * uGain;
      // sensor noise + slow flicker
      float n = (h(floor(gl_FragCoord.xy / 2.0) + floor(uTime * 12.0)) - 0.5) * 0.035;
      T += n;
      vec3 col = ironbow(T);
      // scanlines
      col *= 0.92 + 0.08 * sin(gl_FragCoord.y * 1.4);
      gl_FragColor = vec4(col, 1.0);
    }`;
  const thermalMat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide });
  thermalMat.name = 'thermal_view';
  const saved = new Map();
  let active = false, prevBg = null, prevFog = null, prevEnv = null;
  const api = {
    get active() { return active; },
    set(on) {
      if (on === active) return; active = on;
      if (on) {
        prevBg = scene.background; prevFog = scene.fog; prevEnv = scene.environment;
        scene.background = new THREE.Color(0x000000); scene.fog = null; scene.environment = null;
        scene.traverse(o => { if (o.isMesh && o.name !== 'airflow_heat_sim' && !o.userData.thermalSkip) { saved.set(o, o.material); o.material = thermalMat; } });
      } else {
        saved.forEach((m, o) => o.material = m); saved.clear();
        scene.background = prevBg; scene.fog = prevFog; scene.environment = prevEnv;
      }
    },
    tick(t) { uniforms.uTime.value = t; },
    setTemps(arr) { arr.forEach((v, i) => { if (i < 64) slotArr[i * 4 + 3] = Math.min(1, Math.max(0, v)); }); },
    temps,
  };
  return api;
}
