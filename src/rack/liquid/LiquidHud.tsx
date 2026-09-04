// Liquid-cooling HUD: the telemetry panel shown over the 3D scene in the "Liquid cooling" view. Three blocks, top
// to bottom — hydraulic telemetry (flow / pressure gauges + stat tiles), 1 Hz time-series charts (pump efficiency,
// supply/return/ΔT, CDU energy), and predictive analytics (pump bearing vibration against ISO 10816 zones with a
// 30-day forecast to the alarm limit, and coolant quality degradation: conductivity, pH, particulate).
import type React from 'react';
import { BEP_LPM, DESIGN_DT, type Forecast, type LoopState } from './LiquidLoopSim';
import { Gauge, HealthBar, INK, LineChart, Section, SERIES, Stat, STATUS, STATUS_ICON, StatusChip, type Series } from './charts';

export function LiquidHud({ state }: { state: LoopState | null }) {
  const panel: React.CSSProperties = { position: 'absolute', top: 18, right: 20, bottom: 18, width: 400, overflowY: 'auto', overflowX: 'hidden', background: INK.surface, border: `1px solid ${INK.border}`, borderRadius: 10, padding: '14px 16px 16px', backdropFilter: 'blur(10px)', color: INK.primary, fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: 12, scrollbarWidth: 'thin' };
  if (!state) return <aside style={panel}><div style={{ color: INK.muted }}>Priming secondary loop…</div></aside>;
  const { latest: L, history, vibration, coolant, health, alerts } = state;
  const n = history.length;
  const live = (i: number) => (i === n - 1 ? 'now' : `${i - (n - 1)} s`);
  const overall = health.overall >= 75 ? 'good' : health.overall >= 50 ? 'warning' : health.overall >= 30 ? 'serious' : 'critical';
  const col = (k: keyof typeof L) => history.map((s) => s[k] as number);

  return (
    <aside style={panel} aria-label="Liquid cooling telemetry">
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.06em' }}>LIQUID COOLING · DIRECT-TO-CHIP</div>
          <div style={{ color: INK.muted, fontSize: 11, marginTop: 2 }}>CDU-01 secondary loop · PG25 · ASHRAE W32</div>
        </div>
        <span style={{ marginLeft: 'auto' }}><StatusChip status={overall} text={`Health ${health.overall}`} /></span>
      </header>
      {alerts.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {alerts.map((a, i) => <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11, color: INK.secondary, background: `${STATUS[a.status]}14`, border: `1px solid ${STATUS[a.status]}44`, borderRadius: 6, padding: '5px 8px' }}><span style={{ color: STATUS[a.status], flex: 'none' }}>{STATUS_ICON[a.status]}</span>{a.text}</li>)}
        </ul>
      )}

      <Section title="Hydraulic telemetry" sub="live">
        <div style={{ display: 'flex', gap: 8 }}>
          <Gauge label="Loop flow" unit="L/min" value={L.flowLpm} min={0} max={120} marker={L.flowSetLpm} markerLabel="setpoint" zones={[{ to: 20, status: 'serious' }, { to: 100, status: 'good' }, { to: 120, status: 'warning' }]} />
          <Gauge label="Rack ΔP" unit="bar" value={L.dpBar} min={0} max={2} format={(v) => v.toFixed(2)} zones={[{ to: 1.2, status: 'good' }, { to: 1.6, status: 'warning' }, { to: 2, status: 'serious' }]} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 6 }}>
          <Stat label="Supply press." value={L.supplyBar.toFixed(2)} unit="bar" sub="manifold, gauge" />
          <Stat label="Return press." value={L.returnBar.toFixed(2)} unit="bar" sub="manifold, gauge" />
          <Stat label="Pump speed" value={Math.round(L.pumpRpm).toLocaleString()} unit="rpm" sub={`BEP ${BEP_LPM} L/min`} />
          <Stat label="Heat to liquid" value={L.heatKw.toFixed(1)} unit="kW" sub="from slot loads" />
          <Stat label="Supply temp" value={L.supplyC.toFixed(1)} unit="°C" sub={`facility ${L.facilityC.toFixed(1)} °C`} />
          <Stat label="Return temp" value={L.returnC.toFixed(1)} unit="°C" sub={`ΔT ${L.dT.toFixed(1)} K`} status={L.dT > DESIGN_DT + 3 ? 'warning' : undefined} />
        </div>
      </Section>

      <Section title="Time series" sub="1 Hz · last 3 min">
        <LineChart title="Pump efficiency" unit="%" series={[{ name: 'wire-to-water', color: SERIES.aqua, values: col('pumpEff') }]} xLabel={live} yDomain={[30, 80]} refLines={[{ y: 74, label: 'peak' }]} note={`BEP ${BEP_LPM} L/min`} format={(v) => v.toFixed(0)} />
        <LineChart title="Supply / return temperature" unit="°C" series={[{ name: 'supply', color: SERIES.blue, values: col('supplyC') }, { name: 'return', color: SERIES.orange, values: col('returnC') }]} xLabel={live} />
        <LineChart title="Thermal gradient ΔT" unit="K" series={[{ name: 'return − supply', color: SERIES.violet, values: col('dT') }]} xLabel={live} refLines={[{ y: DESIGN_DT, label: 'design' }]} />
        <LineChart title="CDU energy" unit="kW" series={[{ name: 'CDU total', color: SERIES.yellow, values: col('cduKw') }, { name: 'pump', color: SERIES.blue, values: col('pumpKw') }]} xLabel={live} format={(v) => v.toFixed(2)} note={`PUE share ${(L.cduKw / Math.max(1, L.heatKw) * 100).toFixed(1)} % of IT`} />
      </Section>

      <Section title="Predictive analytics" sub="30 d history · 30 d forecast">
        <ForecastChart f={vibration} color={SERIES.orange} yDomain={[0, 5.5]} format={(v) => v.toFixed(1)} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
          <Stat label="Bearing RUL" value={vibration.daysToLimit === null ? '—' : `${vibration.daysToLimit}`} unit={vibration.daysToLimit === null ? undefined : 'days'} sub="to 4.5 mm/s alarm" status={vibration.status} />
          <Stat label="Vibration" value={L.vibMmS.toFixed(2)} unit="mm/s" sub={zoneName(vibration)} />
          <Stat label="Trend" value={`${vibration.slopePerDay >= 0 ? '+' : ''}${(vibration.slopePerDay * 7).toFixed(2)}`} unit="mm/s · wk" sub="linear fit, 30 d" />
        </div>
        <ForecastChart f={coolant.conductivity} color={SERIES.blue} yDomain={[0, 6]} format={(v) => v.toFixed(1)} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          <Stat label="Conductivity" value={L.conductivity.toFixed(2)} unit="µS/cm" sub={days(coolant.conductivity, 'spec 5.0')} status={coolant.conductivity.status} />
          <Stat label="pH" value={L.ph.toFixed(2)} sub={days(coolant.ph, 'floor 7.5')} status={coolant.ph.status} />
          <Stat label="Particulate" value={Math.round(L.particulate).toString()} unit="/mL" sub={days(coolant.particulate, '> 4 µm, limit 400')} status={coolant.particulate.status} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
          <HealthBar label="Pump" value={health.pump} />
          <HealthBar label="Coolant" value={health.coolant} />
          <HealthBar label="Hydraulics" value={health.hydraulic} />
        </div>
      </Section>
    </aside>
  );
}

/** History as a solid line, regression forecast dashed from today, alarm limit as a reference line. */
function ForecastChart({ f, color, yDomain, format }: { f: Forecast; color: string; yDomain: [number, number]; format: (v: number) => string }) {
  const h = f.history.length;
  const hist: (number | null)[] = [...f.history, ...f.forecast.map(() => null)];
  const fc: (number | null)[] = [...f.history.map((v, i) => (i === h - 1 ? v : null)), ...f.forecast];
  const series: Series[] = [{ name: 'measured', color, values: hist }, { name: 'forecast', color, values: fc, dashed: true }];
  const bands = f.bands?.map((b, i, arr) => ({ from: i === 0 ? 0 : arr[i - 1].to, to: b.to, status: b.status, name: b.name }));
  const xLabel = (i: number) => (i === h - 1 ? 'today' : i < h - 1 ? `${i - (h - 1)} d` : `+${i - (h - 1)} d`);
  return <LineChart title={f.label} unit={f.unit} series={series} xLabel={xLabel} yDomain={yDomain} bands={bands} refLines={[{ y: f.limit, label: f.limitIsFloor ? 'floor' : 'alarm', color: STATUS.critical }]} splitAt={h - 1} format={format} height={120} note={f.daysToLimit === null ? 'trend flat' : `limit in ~${f.daysToLimit} d`} />;
}

const zoneName = (f: Forecast) => { const v = f.history[f.history.length - 1]; return f.bands?.find((b) => v < b.to)?.name ?? f.bands?.[f.bands.length - 1]?.name ?? ''; };
const days = (f: Forecast, limitText: string) => (f.daysToLimit === null ? `${limitText} · trend flat` : `${limitText} · ~${f.daysToLimit} d`);
