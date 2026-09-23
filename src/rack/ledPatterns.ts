// Idle LED behaviour for the rack fleet. Real front panels don't all blink in one rhythm: drive activity LEDs
// flicker with I/O, power LEDs hold steady, NIC/link LEDs strobe fast with a few dark (unlinked) ports, and small
// appliances heartbeat once a second. Each LED material carries a pattern + seed; this table turns (pattern, time,
// seed) into an emissive intensity, dimmed or killed by the hall's power state during a utility-loss event.
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.
import type { LedMode } from './power/PowerEvent';

export type LedPattern = 'activity' | 'heartbeat' | 'link' | 'power';

const HI = 3.2, LO = 1.15, OFF = 0.05;

/** Deterministic 0..1 hash of a seed so "dark" ports and phase offsets are stable across frames. */
const hash = (s: number) => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };

export function ledIntensity(pattern: LedPattern, t: number, seed: number, mode: LedMode = 'normal'): number {
  let v: number;
  switch (pattern) {
    case 'power': v = HI * 0.8; break;
    case 'heartbeat': { const ph = (t * 1.0 + hash(seed)) % 1; v = ph < 0.08 ? HI : ph < 0.14 ? LO : ph < 0.2 ? HI * 0.8 : LO * 0.6; break; }
    case 'link': { if (hash(seed + 7) < 0.3) { v = OFF; break; } const b = Math.sin(t * (8 + 7 * hash(seed)) + seed * 2.1) + Math.sin(t * 13.7 + seed); v = b > 0.9 ? HI : LO; break; }
    case 'activity': default: { const b = Math.sin(t * 11 + seed * 1.17) + Math.sin(t * 5.3 + seed * 2.5) + 0.6 * Math.sin(t * 23 + seed * 0.7); v = b > 0.9 ? HI : LO; break; }
  }
  // Power state: 'dark' is the transfer gap — panels drop out then come back as the UPS picks up (staggered by seed);
  // on battery everything runs a little dimmer; on generator it is back to full.
  if (mode === 'dark') return hash(seed + 3) < 0.7 ? OFF : v * 0.5;
  if (mode === 'battery') return v * 0.65;
  return v;
}
