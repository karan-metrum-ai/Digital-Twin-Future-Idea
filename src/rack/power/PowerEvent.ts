// Scripted utility-loss event for the data hall, timed the way a real 2N site rides one out:
//   0.0 s  utility lost      — hall lighting flickers and drops to the emergency level, UPS takes the load
//   1.5 s  on battery        — UPS discharging, load shed on the IT side, genset auto-start
//   9.0 s  generator         — genset carries the load, lighting back to normal, UPS recharging
//  14.0 s  utility restored  — retransfer to utility, genset cools down
//  18.0 s  back to normal
// Pure state machine over scene time: the caller wires `deps` to lights, LED patterns, the power plant's displays
// and the audio bed, and polls `info` each frame.
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.
export type PowerPhase = 'utility' | 'utility_lost' | 'on_battery' | 'generator' | 'utility_restored';
export type PowerSource = 'utility' | 'none' | 'battery' | 'generator';
export type LedMode = 'normal' | 'dark' | 'battery' | 'generator';

export interface PowerInfo {
  phase: PowerPhase;
  source: PowerSource;
  /** 0..1 multiplier for the hall's general lighting. */
  lightLevel: number;
  /** 0..1 intensity of the red emergency strips. */
  emergency: number;
  upsPct: number;
  upsMin: number;
  upsMode: string;
  genRunning: boolean;
  ledMode: LedMode;
  /** Seconds since the trigger, or -1 when idle. */
  elapsed: number;
}

export interface PowerEventDeps {
  onPhase?: (phase: PowerPhase) => void;
}

const T_BATTERY = 1.5, T_GEN = 9.0, T_RESTORE = 14.0, T_END = 18.0;

export function createPowerEvent(deps: PowerEventDeps = {}) {
  let startT = -1;
  let seed = 4242; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const info: PowerInfo = { phase: 'utility', source: 'utility', lightLevel: 1, emergency: 0, upsPct: 100, upsMin: 27, upsMode: 'ONLINE · DOUBLE CONVERSION', genRunning: false, ledMode: 'normal', elapsed: -1 };
  let flickerHold = 0, flickerVal = 1;

  const setPhase = (p: PowerPhase) => { if (info.phase !== p) { info.phase = p; deps.onPhase?.(p); } };
  const smooth = (a: number, b: number, u: number) => a + (b - a) * Math.min(1, Math.max(0, u));

  const tick = (t: number) => {
    if (startT < 0) return;
    const e = t - startT; info.elapsed = e;
    if (e < T_BATTERY) {
      setPhase('utility_lost'); info.source = 'none'; info.ledMode = 'dark';
      // Fluorescent-style flicker: hold random levels for a few frames each, decaying toward the emergency level.
      if (t > flickerHold) { flickerHold = t + 0.04 + rnd() * 0.08; flickerVal = e < 0.7 ? (rnd() < 0.5 ? 0.15 + rnd() * 0.3 : 0.7 + rnd() * 0.3) : 0.25; }
      info.lightLevel = e < 0.7 ? flickerVal : smooth(flickerVal, 0.25, (e - 0.7) / 0.4);
      info.emergency = smooth(0, 1, (e - 0.4) / 0.6);
      info.upsMode = 'ON BATTERY · TRANSFER'; info.upsPct = 100; info.upsMin = 27; info.genRunning = false;
    } else if (e < T_GEN) {
      setPhase('on_battery'); info.source = 'battery'; info.ledMode = 'battery';
      info.lightLevel = 0.25; info.emergency = 1;
      const u = (e - T_BATTERY) / (T_GEN - T_BATTERY);
      info.upsPct = 100 - 6 * u; info.upsMin = 27 - 3 * u; info.upsMode = e < T_GEN - 2.5 ? 'ON BATTERY · DISCHARGING' : 'ON BATTERY · GEN STARTING';
      info.genRunning = e > T_GEN - 3.0;
    } else if (e < T_RESTORE) {
      setPhase('generator'); info.source = 'generator'; info.ledMode = 'generator';
      const u = (e - T_GEN) / 1.6;
      info.lightLevel = smooth(0.25, 1, u); info.emergency = smooth(1, 0, u);
      info.upsPct = smooth(94, 97, (e - T_GEN) / (T_RESTORE - T_GEN)); info.upsMin = 26; info.upsMode = 'ONLINE · GENERATOR SOURCE'; info.genRunning = true;
    } else if (e < T_END) {
      setPhase('utility_restored'); info.source = 'utility'; info.ledMode = 'normal';
      info.lightLevel = 1; info.emergency = 0; info.upsPct = smooth(97, 100, (e - T_RESTORE) / (T_END - T_RESTORE)); info.upsMin = 27; info.upsMode = 'ONLINE · RECHARGING'; info.genRunning = e < T_RESTORE + 2.5; // cooldown
    } else {
      startT = -1; info.elapsed = -1; info.lightLevel = 1; info.emergency = 0; info.upsPct = 100; info.upsMin = 27; info.upsMode = 'ONLINE · DOUBLE CONVERSION'; info.genRunning = false; info.source = 'utility'; info.ledMode = 'normal';
      setPhase('utility');
    }
  };

  return {
    /** Start the event at scene time `t` (ignored while one is running). */
    trigger(t: number) { if (startT >= 0) return false; startT = t; flickerHold = 0; return true; },
    tick,
    get info() { return info; },
    get active() { return startT >= 0; },
  };
}
