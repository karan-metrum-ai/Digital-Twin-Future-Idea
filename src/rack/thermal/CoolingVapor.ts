// @ts-nocheck
/* eslint-disable */
// Cold-air vapour: small blue wisps rising off the raised-floor cooling grill (CoolingFloor.ts), pulled forward
// and in as they rise until they vanish just past the bezel plane — read as being drawn inside the rack rather
// than dispersing into the room. Kept as its own particle system, separate from the existing airflow_heat_sim
// (which handles the servers' own hot rear exhaust), so the two stay easy to reason about independently. Tied
// to the same "Airflow & heat" toggle.

export function buildCoolingVapor(THREE, density = 1) {
  const N = Math.max(80, Math.round(600 * density));
  const seed = new Float32Array(N);
  let s = 5; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < N; i++) seed[i] = rnd();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aSeed;
      uniform float uTime, uPixelRatio;
      varying float vAlpha;
      float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
      void main() {
        float s2 = h1(aSeed * 7.0), s3 = h1(aSeed * 13.0), s4 = h1(aSeed * 29.0);
        float speed = 0.16 + 0.13 * s3;
        float p = fract(uTime * speed + aSeed);          // 0..1 life: spawn on the grill -> rise -> drawn inside the rack
        float x0 = (aSeed - 0.5) * 0.5;                    // spread across the two grill tiles' width
        float z0 = 0.38 + s2 * 1.08;                        // spread across the two grill tiles' depth
        float rise = smoothstep(0.0, 1.0, p);
        float y = p * 0.8;                                    // stays low — a floor-level stream, not room fog
        float x = x0 * (1.0 - rise * 0.35) + sin(uTime * 0.7 + aSeed * 30.0) * 0.015 * (1.0 - rise);
        float z = mix(z0, 0.365, rise);                         // pulled forward off the grill and just past the bezel
        vec3 pos = vec3(x, y, z);
        vAlpha = smoothstep(0.0, 0.12, p) * smoothstep(1.0, 0.7, p) * 0.4;
        gl_PointSize = (4.0 + 4.0 * s4) * uPixelRatio;
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize *= 1.6 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float soft = smoothstep(0.5, 0.05, d);
        vec3 col = vec3(0.35, 0.75, 1.0);
        gl_FragColor = vec4(col, soft * vAlpha);
      }`,
  });
  const pts = new THREE.Points(geo, mat); pts.name = 'cooling_vapor'; pts.frustumCulled = false;
  pts.userData.tick = (t, pr) => { mat.uniforms.uTime.value = t; mat.uniforms.uPixelRatio.value = pr; };
  return pts;
}
