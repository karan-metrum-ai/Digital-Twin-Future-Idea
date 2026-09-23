// @ts-nocheck
/* eslint-disable */
// The technician's uniform as a shader, not as meshes. The mannequin is one skinned surface; instead of strapping rigid
// bands around it (which float off the body and never follow a bend), every garment is drawn per pixel in the fragment
// shader from two extra vertex attributes: the vertex's REST-POSE position in body space (metres, feet at y = 0, front
// = +z) and a body-region id from its dominant bone. Garment edges, the hi-vis vest with its reflective stripes, the
// front zip, collar, belt and buckle are analytic in rest space — crisp at any vertex density — and because they live
// on the skinned surface they deform with it. Cloth gets a fine woven grain, the stripes go glossy/emissive, seams get
// a dark hairline so layers read as layers. Adding detail later (logos, patches, name tape) is a few more lines here.
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.

/** Body regions from the dominant bone (see Technician.ts). */
export const REGION = { skin: 0, hair: 1, polo: 2, trouser: 3, boot: 4 };

// Colours are given as sRGB hex; THREE.Color already stores them in the linear working space (ColorManagement is on).
const srgb = (THREE, hex) => new THREE.Color(hex);

export function createUniformMaterial(THREE, { joint = false } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0.0, envMapIntensity: 0.7 });
  const uniforms = {
    uSkin: { value: srgb(THREE, 0xc98f6b) }, uHair: { value: srgb(THREE, 0x2b2118) },
    uPolo: { value: srgb(THREE, 0x2b4d84) }, uPoloDark: { value: srgb(THREE, 0x203a66) }, uCollar: { value: srgb(THREE, 0xe8ebef) },
    uVest: { value: srgb(THREE, 0xd4ef2a) }, uStripe: { value: srgb(THREE, 0xdfe3e8) },
    uTrouser: { value: srgb(THREE, 0x30343b) }, uBelt: { value: srgb(THREE, 0x15171a) }, uBuckle: { value: srgb(THREE, 0xb9bdc2) }, uBoot: { value: srgb(THREE, 0x141414) },
    uJoint: { value: joint ? 0.94 : 1.0 },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', 'attribute vec3 aRest; attribute float aRegion; varying vec3 vRest; varying float vRegion;\n#include <common>')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = aRest; vRegion = aRegion;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vRest; varying float vRegion;
uniform vec3 uSkin, uHair, uPolo, uPoloDark, uCollar, uVest, uStripe, uTrouser, uBelt, uBuckle, uBoot; uniform float uJoint;
float uHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float uNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(uHash(i), uHash(i + vec2(1, 0)), f.x), mix(uHash(i + vec2(0, 1)), uHash(i + vec2(1, 1)), f.x), f.y); }
// Woven cloth grain: fine two-octave value noise in rest space (so it stays put on the body).
float uGrain(vec3 r) { return 0.6 * uNoise(r.xy * 260.0 + r.z * 90.0) + 0.4 * uNoise(r.zy * 520.0 + r.x * 40.0); }
// Garment shading result: colour, roughness, metalness, emissive strength.
struct Garment { vec3 col; float rough; float metal; float glow; };
Garment uniformAt(vec3 r, float region) {
  Garment g; g.col = uSkin; g.rough = 0.55; g.metal = 0.0; g.glow = 0.0;
  float grain = uGrain(r);
  float ax = abs(r.x);
  if (region < 0.5) { g.col = uSkin * (0.97 + 0.05 * grain); g.rough = 0.55; return g; }                   // skin
  if (region < 1.5) { g.col = uHair * (0.9 + 0.2 * grain); g.rough = 0.7; return g; }                     // hair
  bool front = r.z > 0.03;
  // Hi-vis vest over the torso (polo AND the top of the trousers, so the hem is a clean line at 1.02 m rather than the
  // vertex boundary between the two regions): waist to shoulder, arm holes outside |x| 0.19, straps |x| < 0.125 over
  // the trapezius, zip gap at the front. The collar and the open throat sit above it.
  if (region > 1.5 && region < 3.5) {
    if (r.y > 1.41 && front && ax < 0.05 - (r.y - 1.41) * 0.3) { g.col = uSkin; g.rough = 0.55; return g; }   // open throat
    if (r.y > 1.43 && ax < 0.075) { g.col = uCollar * (0.94 + 0.08 * grain); g.rough = 0.8; return g; }        // polo collar
    float top = r.y > 1.36 ? 0.125 : 0.19;
    bool vestBody = r.y > 1.02 && r.y < 1.47 && ax < top;
    bool zip = front && ax < 0.012 && r.y > 1.02;
    if (vestBody && !zip) {
      // Seam hairline where the vest meets the polo (bottom hem, arm holes) so it reads as a layer on top.
      float edge = min(min(r.y - 1.02, top - ax), 1.47 - r.y);
      float seam = smoothstep(0.0, 0.007, edge);
      vec3 vest = uVest * (0.9 + 0.18 * grain);
      // Two reflective bands round the body, and one down each shoulder strap (front and back).
      bool band = abs(r.y - 1.13) < 0.017 || abs(r.y - 1.285) < 0.017;
      bool shoulder = r.y > 1.20 && abs(ax - 0.07) < 0.017 && (ax < top - 0.01);
      if (band || shoulder) { g.col = uStripe * (0.92 + 0.12 * grain); g.rough = 0.32; g.metal = 0.45; g.glow = 0.12; }
      else { g.col = vest; g.rough = 0.82; }
      g.col *= mix(0.45, 1.0, seam);
      return g;
    }
    // Zip: dark tape with a lighter tooth line down the middle.
    if (zip && r.y < 1.47) { g.col = ax < 0.004 ? uBuckle * 0.8 : uPoloDark * 0.9; g.rough = 0.5; g.metal = ax < 0.004 ? 0.6 : 0.0; return g; }
  }
  if (region < 2.5) {                                                                                     // polo
    g.col = mix(uPoloDark, uPolo, 0.55 + 0.45 * grain); g.rough = 0.86;
    // Sleeve hem: a slightly darker band where the polo sleeve ends on the upper arm (rest pose is a T, arms along x).
    if (ax > 0.31 && ax < 0.325) g.col *= 0.8;
    return g;
  }
  if (region < 3.5) {                                                                                     // trousers + belt
    g.col = uTrouser * (0.9 + 0.18 * grain); g.rough = 0.88;
    if (r.y > 0.975 && r.y < 1.025) {
      g.col = uBelt * (0.9 + 0.1 * grain); g.rough = 0.5;
      if (r.z > 0.06 && ax < 0.028) { g.col = uBuckle; g.rough = 0.3; g.metal = 0.85; }
      return g;
    }
    // Knee-pad panels: a tone darker over the knees (0.42..0.58 m).
    if (r.y > 0.42 && r.y < 0.58 && r.z > -0.02) g.col *= 0.82;
    return g;
  }
  g.col = uBoot * (0.85 + 0.3 * grain); g.rough = 0.45; g.metal = 0.05;                                   // boots
  if (r.y > 0.10 && r.y < 0.115) g.col = uBoot * 1.9;                                                     // welt line
  return g;
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
Garment gm = uniformAt(vRest, vRegion);
diffuseColor.rgb = gm.col * uJoint;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = gm.rough;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
metalnessFactor = gm.metal;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += gm.col * gm.glow;`);
  };
  mat.customProgramCacheKey = () => 'technician_uniform_' + (joint ? 'joint' : 'main');
  mat.userData.uniforms = uniforms;
  return mat;
}

/**
 * Fill `aRest` (rest-pose body-space position, metres) and `aRegion` on a skinned mesh's geometry. `regionOfBone`
 * maps a sanitised bone name to a REGION id; `toBody` is the mesh's matrixWorld at load (model at the origin, feet on
 * the floor). Hair is the top of the head region above `hairFromY`.
 */
export function bakeUniformAttributes(THREE, mesh, regionOfBone, toBody, hairFromY) {
  const g = mesh.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  if (!si || !sw || !mesh.skeleton) return;
  const names = mesh.skeleton.bones.map((b) => b.name.replace(/^DEF-/, '').replace(/\./g, ''));
  const rest = new Float32Array(pos.count * 3), region = new Float32Array(pos.count), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
    v.fromBufferAttribute(pos, i).applyMatrix4(toBody);
    rest[i * 3] = v.x; rest[i * 3 + 1] = v.y; rest[i * 3 + 2] = v.z;
    let r = regionOfBone(names[best] ?? '');
    if (r === REGION.hair) r = v.y > hairFromY ? REGION.hair : REGION.skin; // 'head' bone: hair only on the top of the skull
    region[i] = r;
  }
  g.setAttribute('aRest', new THREE.BufferAttribute(rest, 3));
  g.setAttribute('aRegion', new THREE.BufferAttribute(region, 1));
}
