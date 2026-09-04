// Liquid-cooling loop telemetry simulation for the direct-to-chip (DLC) mode. Pure TypeScript, no three.js.
//
// One in-row CDU (coolant distribution unit) drives a secondary loop through a supply and a return manifold in
// the rear of the rack; every server slot is a parallel branch across the two manifolds. The model is a small
// lumped-parameter loop, not CFD: rack heat load comes from the per-slot load temps that also drive the thermal
// camera, a flow controller chases a 10 K design ΔT, and pressure / pump efficiency / pump power follow from the
// flow through affinity-law style curves. On top of the 1 Hz hydraulic samples sit two slow "condition" signals
// with a 30-day history and a linear-regression forecast — pump bearing vibration (ISO 10816 zones) and coolant
// quality (conductivity, pH, particulate) — which feed the predictive-analytics widgets.
import type { Slot } from '../types';

export type Status = 'good' | 'warning' | 'serious' | 'critical';

export interface LoopSample {
  t: number;            // sim time, s
  flowLpm: number;      // secondary-loop flow, L/min
  flowSetLpm: number;   // controller setpoint, L/min
  supplyBar: number;    // manifold supply pressure, bar(g)
  returnBar: number;    // manifold return pressure, bar(g)
  dpBar: number;        // rack differential pressure, bar
  pumpRpm: number;
  pumpEff: number;      // wire-to-water efficiency, %
  pumpKw: number;       // pump electrical power, kW
  cduKw: number;        // total CDU electrical power (pump + controls + secondary), kW
  supplyC: number;      // coolant supply temp, °C
  returnC: number;      // coolant return temp, °C
  dT: number;           // return − supply, K
  heatKw: number;       // rack heat rejected to liquid, kW
  facilityC: number;    // facility (primary) water supply, °C
  vibMmS: number;       // pump bearing vibration, mm/s RMS
  conductivity: number; // coolant conductivity, µS/cm
  ph: number;
  particulate: number;  // particles > 4 µm per mL (ISO 4406 style count)
}

export interface Forecast {
  label: string;
  unit: string;
  /** Daily history, oldest first; last entry is "today". */
  history: number[];
  /** Daily forecast starting tomorrow (linear regression over the history). */
  forecast: number[];
  /** Alarm limit the forecast is projected against. */
  limit: number;
  /** `true` when the limit is a floor (pH), `false` when it is a ceiling. */
  limitIsFloor: boolean;
  slopePerDay: number;
  /** Days until the trend crosses the limit; null when the trend is flat or moving away from it. */
  daysToLimit: number | null;
  status: Status;
  /** Optional named bands drawn behind the chart, low→high (ISO 10816 zones for vibration). */
  bands?: { to: number; status: Status; name: string }[];
}

export interface LoopState {
  latest: LoopSample;
  /** Last N seconds of 1 Hz samples, oldest first. */
  history: LoopSample[];
  vibration: Forecast;
  coolant: { conductivity: Forecast; ph: Forecast; particulate: Forecast };
  health: { pump: number; coolant: number; hydraulic: number; overall: number };
  alerts: { status: Status; text: string }[];
}

export interface LiquidLoopSim {
  /** Update the per-slot load (0..1, same array the thermal view uses). */
  setLoad(temps: number[]): void;
  /** Advance by dt seconds; emits a new 1 Hz sample when due. Returns the current state. */
  step(dt: number): LoopState;
  state(): LoopState;
}

const U = 0.04445;
const HISTORY_S = 180;      // live-chart window
export const DESIGN_DT = 10; // K, controller target
export const BEP_LPM = 72;   // pump best-efficiency-point flow
const SUPPLY_SET = 30;      // °C (ASHRAE W32 class supply)
const FACILITY_C = 18;      // °C primary water
const CP_WATER_KJ = 4.18;   // kJ/(kg·K) — PG25 is ~3.9, close enough for the twin
const ISO_BANDS: NonNullable<Forecast['bands']> = [
  { to: 1.8, status: 'good', name: 'Zone A/B · unrestricted' },
  { to: 2.8, status: 'warning', name: 'Zone C · restricted' },
  { to: 4.5, status: 'serious', name: 'Zone C · plan maintenance' },
  { to: 7, status: 'critical', name: 'Zone D · damage likely' },
];

export function createLiquidLoopSim(slots: Slot[], initialTemps: number[]): LiquidLoopSim {
  let seed = 8675309; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const noise = (amp: number) => (rnd() - 0.5) * 2 * amp;

  let temps = initialTemps.slice();
  const heatLoad = () => slots.reduce((kw, s, i) => kw + (s.h / U) * (0.28 + 1.05 * Math.min(1, Math.max(0, temps[i] ?? 0.5))), 0);

  // Slow condition signals: 30-day daily history with a realistic drift (bearing wear, inhibitor depletion,
  // filter loading). The "today" value is what the live sample reports on top of a small flow-dependent term.
  const dailySeries = (start: number, perDay: number, jitter: number, accel = 0) => { const a: number[] = []; for (let d = 0; d < 30; d++) a.push(start + perDay * d + accel * d * d + noise(jitter)); return a; };
  const vibHist = dailySeries(1.32, 0.026, 0.05, 0.0006);  // → ~2.6 mm/s today, curving up: a bearing beginning to go
  const condHist = dailySeries(2.05, 0.046, 0.04);          // µS/cm, rising as the corrosion inhibitor depletes
  const phHist = dailySeries(8.62, -0.017, 0.015);          // drifting down toward the 7.5 floor
  const partHist = dailySeries(118, 2.4, 6);                // particles/mL > 4 µm — filter loading

  const history: LoopSample[] = [];
  let t = 0, acc = 0, flow = 0, supply = SUPPLY_SET, sampleN = 0;
  let stateCache: LoopState | null = null;

  const sample = (): LoopSample => {
    const heatKw = heatLoad();
    const flowSet = Math.min(120, Math.max(18, (heatKw * 60) / (CP_WATER_KJ * DESIGN_DT)));
    if (flow === 0) flow = flowSet;
    flow += (flowSet - flow) * 0.14 + noise(0.35);           // controller ramp + turbulence
    supply += (SUPPLY_SET + 0.35 * Math.sin(t / 47) - supply) * 0.2 + noise(0.04);
    const dT = (heatKw * 60) / (CP_WATER_KJ * Math.max(flow, 1));
    const returnC = supply + dT;
    const dp = 0.25 + 0.00016 * flow * flow + noise(0.008);
    const supplyBar = 1.6 + 0.00022 * flow * flow + noise(0.01);
    const returnBar = supplyBar - dp;
    const pumpRpm = 1150 + flow * 22.5 + noise(12);
    const eff = Math.max(30, 74 - 0.0028 * (flow - BEP_LPM) ** 2 + noise(0.4));
    const pumpKw = (((supplyBar - 0.9) * 1e5) * (flow / 60000)) / 1000 / (eff / 100);
    const cduKw = pumpKw + 0.32 + 0.004 * heatKw + noise(0.006);
    const vibMmS = vibHist[29] + 0.11 * (flow / 60) ** 2 + noise(0.06);
    return {
      t, flowLpm: flow, flowSetLpm: flowSet, supplyBar, returnBar, dpBar: dp, pumpRpm, pumpEff: eff, pumpKw, cduKw,
      supplyC: supply, returnC, dT, heatKw, facilityC: FACILITY_C + noise(0.1), vibMmS,
      conductivity: condHist[29] + noise(0.015), ph: phHist[29] + noise(0.004), particulate: partHist[29] + noise(2),
    };
  };

  const regress = (h: number[]) => { const n = h.length, mx = (n - 1) / 2; let sxy = 0, sxx = 0, my = 0; for (const v of h) my += v / n; h.forEach((v, i) => { sxy += (i - mx) * (v - my); sxx += (i - mx) ** 2; }); const slope = sxy / sxx; return { slope, intercept: my - slope * mx }; };
  const forecast = (label: string, unit: string, h: number[], limit: number, limitIsFloor: boolean, bands?: Forecast['bands']): Forecast => {
    const { slope, intercept } = regress(h);
    const out: number[] = []; for (let d = 30; d < 60; d++) out.push(intercept + slope * d);
    const today = h[h.length - 1];
    const toward = limitIsFloor ? slope < -1e-6 : slope > 1e-6;
    const daysToLimit = toward ? Math.max(0, Math.round((limit - today) / slope)) : null;
    const frac = Math.min(1, Math.max(0, Math.abs(today - h[0]) / (Math.abs(limit - h[0]) || 1))); // progress from baseline → limit
    const crossed = limitIsFloor ? today <= limit : today >= limit;
    let status: Status = 'good';
    if (crossed) status = 'critical'; else if (daysToLimit !== null && daysToLimit <= 14) status = 'serious'; else if (frac >= 0.6 || (daysToLimit !== null && daysToLimit <= 45)) status = 'warning';
    if (bands) { const z = bands.find((b) => today < b.to) ?? bands[bands.length - 1]; status = worst(status, z.status); }
    return { label, unit, history: h, forecast: out, limit, limitIsFloor, slopePerDay: slope, daysToLimit, status, bands };
  };

  const build = (): LoopState => {
    const latest = history[history.length - 1];
    const vibration = forecast('Pump bearing vibration', 'mm/s', vibHist.slice(0, 29).concat(latest.vibMmS), 4.5, false, ISO_BANDS);
    const conductivity = forecast('Coolant conductivity', 'µS/cm', condHist.slice(0, 29).concat(latest.conductivity), 5.0, false);
    const ph = forecast('Coolant pH', '', phHist.slice(0, 29).concat(latest.ph), 7.5, true);
    const particulate = forecast('Particulate > 4 µm', '/mL', partHist.slice(0, 29).concat(latest.particulate), 400, false);
    const pump = Math.round(100 * clamp01(1 - (latest.vibMmS - 0.7) / (4.5 - 0.7)) * (0.75 + 0.25 * clamp01((latest.pumpEff - 30) / 44)));
    const coolantH = Math.round(100 * Math.min(remaining(conductivity), remaining(ph), remaining(particulate)));
    const hydraulic = Math.round(100 * clamp01(1 - Math.abs(latest.dT - DESIGN_DT) / 8) * clamp01(1 - Math.abs(latest.flowLpm - latest.flowSetLpm) / 25));
    const alerts: LoopState['alerts'] = [];
    if (vibration.status !== 'good') alerts.push({ status: vibration.status, text: vibration.daysToLimit !== null ? `Bearing vibration trend reaches the 4.5 mm/s alarm in ~${vibration.daysToLimit} d — schedule a pump cartridge swap` : 'Pump vibration above Zone B' });
    for (const f of [conductivity, ph, particulate]) if (f.status !== 'good') alerts.push({ status: f.status, text: f.daysToLimit !== null ? `${f.label} reaches its spec limit in ~${f.daysToLimit} d` : `${f.label} out of spec` });
    if (latest.dT > DESIGN_DT + 3) alerts.push({ status: 'warning', text: `ΔT ${latest.dT.toFixed(1)} K above design — flow is lagging the heat load` });
    if (latest.pumpEff < 55) alerts.push({ status: 'warning', text: `Pump running ${latest.pumpEff.toFixed(0)} % efficient — far from BEP (${BEP_LPM} L/min)` });
    return { latest, history: history.slice(), vibration, coolant: { conductivity, ph, particulate }, health: { pump, coolant: coolantH, hydraulic, overall: Math.min(pump, coolantH, hydraulic) }, alerts };
  };

  // Pre-roll so the live charts open with a full window instead of a single dot.
  for (let i = 0; i < HISTORY_S; i++) { t = i; history.push(sample()); }
  t = HISTORY_S; sampleN = HISTORY_S;

  return {
    setLoad(a) { temps = a.slice(); },
    step(dt) {
      acc += dt;
      if (acc >= 1) {
        const n = Math.min(5, Math.floor(acc)); acc -= n;
        for (let i = 0; i < n; i++) { t = ++sampleN; history.push(sample()); if (history.length > HISTORY_S) history.shift(); }
        stateCache = null;
      }
      return (stateCache ??= build());
    },
    state() { return (stateCache ??= build()); },
  };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const remaining = (f: Forecast) => { const today = f.history[f.history.length - 1], base = f.history[0]; return clamp01(1 - Math.abs(today - base) / (Math.abs(f.limit - base) || 1)); };
const RANK: Record<Status, number> = { good: 0, warning: 1, serious: 2, critical: 3 };
const worst = (a: Status, b: Status): Status => (RANK[a] >= RANK[b] ? a : b);
