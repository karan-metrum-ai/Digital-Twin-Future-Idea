// @ts-nocheck
/* eslint-disable */
// Airflow / heat visualisation: cool intake streaks drawn into the server fronts, hot exhaust
// plumes leaving the rear and rising. GPU-driven points; only a time uniform changes per frame.

export function buildHeatSim(THREE, slots, density = 1) {
  const N = Math.max(200, Math.round(1400 * density));
  const seed = new Float32Array(N), slotY = new Float32Array(N), slotH = new Float32Array(N), slotZr = new Float32Array(N), kind = new Float32Array(N);
  let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < N; i++) { const sl = slots[Math.floor(rnd() * slots.length)]; seed[i] = rnd(); slotY[i] = sl.y; slotH[i] = sl.h; slotZr[i] = sl.zr; kind[i] = i % 5 === 0 ? 1 : 0; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aY', new THREE.BufferAttribute(slotY, 1));
  geo.setAttribute('aH', new THREE.BufferAttribute(slotH, 1));
  geo.setAttribute('aZr', new THREE.BufferAttribute(slotZr, 1));
  geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aSeed, aY, aH, aZr, aKind;
      uniform float uTime, uPixelRatio;
      varying float vHeat, vAlpha;
      float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
      void main() {
        float s2 = h1(aSeed * 7.0), s3 = h1(aSeed * 13.0), s4 = h1(aSeed * 29.0);
        float speed = 0.38 + 0.25 * s3;
        float p = fract(uTime * speed * 0.5 + aSeed);              // 0..1 life
        vec3 pos; float heat, alpha;
        if (aKind < 0.5) {
          // intake streak: 0.0-0.45 in front of the bezel, then exhaust 0.55-1.0 behind the rack
          float x = (aSeed - 0.5) * 0.40, y = aY + (s2 - 0.5) * aH * 0.8;
          if (p < 0.45) {
            float q = p / 0.45;
            pos = vec3(x * (1.0 + (1.0 - q) * 0.6), y + (1.0 - q) * (s3 - 0.5) * 0.08, 0.42 + (1.0 - q) * 0.45);
            heat = 0.0; alpha = smoothstep(0.0, 0.15, q) * 0.9;
          } else {
            float q = clamp((p - 0.55) / 0.45, 0.0, 1.0);
            float wob = sin(uTime * 2.0 + aSeed * 40.0) * 0.02 * q;
            pos = vec3(x * (1.0 + q * 0.5) + wob, y + q * q * 0.9 + q * 0.05, aZr - 0.02 - q * 0.55);
            heat = 1.0; alpha = (p < 0.55 ? 0.0 : 1.0) * (1.0 - q) * 0.85;
          }
          gl_PointSize = (8.0 + heat * 3.0) * uPixelRatio;   // larger, softer motes: readable from the aisle without going dense
        } else {
          // heat haze: large soft blobs rising off the rear exhaust
          float q = p, x = (aSeed - 0.5) * 0.5 + sin(uTime * 0.8 + s4 * 30.0) * 0.06 * q;
          pos = vec3(x, aY + (s2 - 0.5) * aH + q * q * 1.2, aZr - 0.1 - q * 0.5 + sin(uTime + s3 * 20.0) * 0.04);
          heat = 1.0; alpha = (1.0 - q) * q * 0.26;
          gl_PointSize = (30.0 + 44.0 * q) * uPixelRatio;
        }
        vHeat = heat; vAlpha = alpha;
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize *= 1.6 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vHeat, vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float soft = smoothstep(0.5, 0.0, d) * 0.9;  // wide feathered falloff keeps the bigger points light
        vec3 cool = vec3(0.50, 0.88, 1.0), hot = vec3(1.0, 0.50, 0.15);
        gl_FragColor = vec4(mix(cool, hot, vHeat), soft * vAlpha);
      }`,
  });
  const pts = new THREE.Points(geo, mat); pts.name = 'airflow_heat_sim'; pts.frustumCulled = false;
  pts.userData.tick = (t, pr) => { mat.uniforms.uTime.value = t; mat.uniforms.uPixelRatio.value = pr; };
  return pts;
}
