// Sound bed for the data hall, synthesised with the Web Audio API (no samples, no dependencies): the low fan hum of
// the rows (two detuned sawtooths under a low-pass) plus band-passed noise for moving air, mixed by how close the
// camera is to the rack rows/CDUs; a 40 Hz rumble layer while the genset carries the load; and short synthesised
// chirps — alarm beeps, the badge reader, an FRU latching home. Browsers refuse to start audio before a user gesture,
// so the context is created lazily on the first pointer-down, and the bed stays muted until the speaker toggle is on.
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.
export type ChirpKind = 'alarm' | 'badge' | 'click' | 'transfer';

export interface Ambience {
  /** Create the AudioContext (call from a user gesture). Safe to call repeatedly. */
  unlock(): void;
  mute(on: boolean): void;
  readonly muted: boolean;
  /** Per-frame mix: `proximity` 0..1 (how close the camera is to the noisy kit), `generator` 0..1. */
  tick(proximity: number, generator: number): void;
  chirp(kind: ChirpKind): void;
  dispose(): void;
}

export function createAmbience(initialMuted = true): Ambience {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null, humGain: GainNode | null = null, airGain: GainNode | null = null, genGain: GainNode | null = null;
  let muted = initialMuted, built = false;

  const build = () => {
    if (built || !ctx) return; built = true;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
    // Fan hum: two sawtooths a fifth apart, heavily low-passed.
    humGain = ctx.createGain(); humGain.gain.value = 0.0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 0.7; lp.connect(humGain); humGain.connect(master);
    for (const [f, g] of [[62, 0.5], [124, 0.28], [93, 0.18]] as [number, number][]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 12; const og = ctx.createGain(); og.gain.value = g; o.connect(og); og.connect(lp); o.start(); }
    // Moving air: looped white noise through a band-pass.
    const N = ctx.sampleRate * 2, buf = ctx.createBuffer(1, N, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < N; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.5;
    airGain = ctx.createGain(); airGain.gain.value = 0.0; src.connect(bp); bp.connect(airGain); airGain.connect(master); src.start();
    // Genset rumble: sub oscillator with slow amplitude wobble.
    genGain = ctx.createGain(); genGain.gain.value = 0.0; genGain.connect(master);
    const sub = ctx.createOscillator(); sub.type = 'triangle'; sub.frequency.value = 41; sub.connect(genGain); sub.start();
    const sub2 = ctx.createOscillator(); sub2.type = 'sawtooth'; sub2.frequency.value = 82; const sg = ctx.createGain(); sg.gain.value = 0.35; const slp = ctx.createBiquadFilter(); slp.type = 'lowpass'; slp.frequency.value = 160; sub2.connect(sg); sg.connect(slp); slp.connect(genGain); sub2.start();
  };

  const unlock = () => {
    if (ctx) { if (ctx.state === 'suspended') void ctx.resume(); return; }
    try { ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); build(); } catch { ctx = null; }
  };

  const env = (node: AudioNode, peak: number, attack: number, hold: number, release: number, at: number) => {
    if (!ctx || !master) return;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + attack); g.gain.setValueAtTime(peak, at + attack + hold); g.gain.exponentialRampToValueAtTime(0.0005, at + attack + hold + release);
    node.connect(g); g.connect(master);
  };
  const tone = (freq: number, type: OscillatorType, peak: number, at: number, dur: number) => {
    if (!ctx) return; const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; env(o, peak, 0.005, dur, 0.06, at); o.start(at); o.stop(at + dur + 0.1);
  };
  const chirp = (kind: ChirpKind) => {
    if (!ctx || muted) return; const t = ctx.currentTime + 0.01;
    switch (kind) {
      case 'alarm': tone(1800, 'square', 0.07, t, 0.08); tone(1800, 'square', 0.07, t + 0.16, 0.08); break;
      case 'badge': tone(1200, 'sine', 0.09, t, 0.12); tone(1600, 'sine', 0.06, t + 0.13, 0.08); break;
      case 'transfer': tone(520, 'square', 0.05, t, 0.05); tone(390, 'square', 0.05, t + 0.07, 0.09); break;
      case 'click': { const N = Math.floor(ctx.sampleRate * 0.03), b = ctx.createBuffer(1, N, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < N; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / N); const s = ctx.createBufferSource(); s.buffer = b; const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500; s.connect(hp); env(hp, 0.12, 0.002, 0.02, 0.02, t); s.start(t); break; }
    }
  };

  const tick = (proximity: number, generator: number) => {
    if (!ctx || !humGain || !airGain || !genGain) return;
    const p = Math.min(1, Math.max(0, proximity)), k = 0.25 + 0.75 * p;
    humGain.gain.setTargetAtTime(0.12 * k, ctx.currentTime, 0.2);
    airGain.gain.setTargetAtTime(0.045 * k, ctx.currentTime, 0.2);
    genGain.gain.setTargetAtTime(0.16 * generator, ctx.currentTime, 0.3);
  };

  return {
    unlock, tick, chirp,
    mute(on) { muted = on; if (master && ctx) master.gain.setTargetAtTime(on ? 0 : 1, ctx.currentTime, 0.08); if (!on) unlock(); },
    get muted() { return muted; },
    dispose() { try { ctx?.close(); } catch { /* already closed */ } ctx = null; built = false; },
  };
}
