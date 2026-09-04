// Small hand-rolled SVG chart kit for the liquid-cooling HUD (no chart library in this project). Follows the
// data-viz conventions used across the twin: thin 2 px lines, recessive hairline grid, a legend whenever there are
// two or more series plus a direct label at each line's end, a crosshair + tooltip hover layer, text in ink
// tokens (never the series colour), and a table view behind every chart for the non-visual reading.
import React, { useState } from 'react';
import type { Status } from './LiquidLoopSim';

export const INK = { primary: '#eef0f4', secondary: '#aeb3bc', muted: '#7c8290', grid: 'rgba(255,255,255,0.07)', axis: 'rgba(255,255,255,0.16)', surface: 'rgba(12,13,16,0.80)', card: 'rgba(255,255,255,0.035)', border: 'rgba(255,255,255,0.10)' };
/** Categorical slots (validated for the dark HUD surface): blue, orange, aqua, yellow, violet. */
export const SERIES = { blue: '#3987e5', orange: '#d95926', aqua: '#199e70', yellow: '#c98500', violet: '#9085e9' };
export const STATUS: Record<Status, string> = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' };
export const STATUS_ICON: Record<Status, string> = { good: '✓', warning: '▲', serious: '◆', critical: '✕' };
export const STATUS_LABEL: Record<Status, string> = { good: 'OK', warning: 'Watch', serious: 'Action', critical: 'Alarm' };
const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const NUM: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

export interface Series { name: string; color: string; values: (number | null)[]; dashed?: boolean }
export interface Band { from: number; to: number; status: Status; name: string }
export interface RefLine { y: number; label: string; color?: string }

interface LineChartProps {
  title: string;
  unit: string;
  series: Series[];
  /** Label for sample index i (axis ticks + tooltip). */
  xLabel: (i: number) => string;
  height?: number;
  yDomain?: [number, number];
  bands?: Band[];
  refLines?: RefLine[];
  /** Index at which forecast begins: shades the region and marks "today". */
  splitAt?: number;
  format?: (v: number) => string;
  /** Right-hand note (e.g. "BEP 72 L/min"). */
  note?: string;
}

const W = 352, PAD_L = 36, PAD_R = 44, PAD_T = 8, PAD_B = 18;

export function LineChart({ title, unit, series, xLabel, height = 110, yDomain, bands, refLines, splitAt, format = (v) => v.toFixed(1), note }: LineChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const n = Math.max(...series.map((s) => s.values.length));
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null && Number.isFinite(v));
  const refYs = (refLines ?? []).map((r) => r.y);
  let lo = yDomain ? yDomain[0] : Math.min(...all, ...refYs), hi = yDomain ? yDomain[1] : Math.max(...all, ...refYs);
  if (!yDomain) { const pad = (hi - lo) * 0.15 || 1; lo -= pad; hi += pad; }
  const H = height, iw = W - PAD_L - PAD_R, ih = H - PAD_T - PAD_B;
  const x = (i: number) => PAD_L + (i / Math.max(1, n - 1)) * iw;
  const y = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo || 1)) * ih;
  const ticks = [0, 1 / 3, 2 / 3, 1].map((f) => lo + f * (hi - lo));
  const xt = [0, Math.floor((n - 1) / 2), n - 1];
  const path = (vals: (number | null)[]) => { let d = '', pen = false; vals.forEach((v, i) => { if (v === null || !Number.isFinite(v)) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true; }); return d; };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => { const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; setHover(Math.max(0, Math.min(n - 1, Math.round(((px - PAD_L) / iw) * (n - 1))))); };
  const legend = series.length >= 2;
  const lastIdx = (s: Series) => { for (let i = s.values.length - 1; i >= 0; i--) if (s.values[i] !== null) return i; return -1; };

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
        <span style={{ color: INK.primary, fontSize: 12, fontWeight: 600 }}>{title}</span>
        <span style={{ color: INK.muted, fontSize: 11 }}>{unit}</span>
        {note && <span style={{ color: INK.muted, fontSize: 11, marginLeft: 'auto' }}>{note}</span>}
        <button onClick={() => setTable((t) => !t)} aria-pressed={table} title={table ? 'Show chart' : 'Show as table'} style={{ marginLeft: note ? 0 : 'auto', appearance: 'none', border: `1px solid ${INK.border}`, background: table ? INK.primary : 'transparent', color: table ? '#16171b' : INK.muted, font: `500 10px/1 ${FONT}`, padding: '3px 6px', borderRadius: 4, cursor: 'pointer' }}>{table ? 'chart' : 'table'}</button>
      </div>
      {legend && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 2 }}>
          {series.map((s) => <span key={s.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: INK.secondary, fontSize: 11 }}><i style={{ width: 12, height: 0, borderTop: `2px ${s.dashed ? 'dashed' : 'solid'} ${s.color}` }} />{s.name}</span>)}
        </div>
      )}
      {table ? (
        <DataTable series={series} xLabel={xLabel} format={format} unit={unit} />
      ) : (
        <div style={{ position: 'relative' }}>
          <svg role="img" aria-label={`${title}, ${unit}`} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block', overflow: 'visible', fontFamily: FONT }} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
            {bands?.map((b) => { const y1 = y(Math.min(hi, b.to)), y0 = y(Math.max(lo, b.from)); return y0 > y1 ? <rect key={b.name} x={PAD_L} y={y1} width={iw} height={y0 - y1} fill={STATUS[b.status]} opacity={0.09} /> : null; })}
            {splitAt !== undefined && splitAt < n && <rect x={x(splitAt)} y={PAD_T} width={x(n - 1) - x(splitAt)} height={ih} fill="url(#fc)" opacity={0.6} />}
            <defs><pattern id="fc" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.05)" strokeWidth="2" /></pattern></defs>
            {ticks.map((tv, k) => <g key={k}><line x1={PAD_L} x2={PAD_L + iw} y1={y(tv)} y2={y(tv)} stroke={k === 0 ? INK.axis : INK.grid} strokeWidth={1} /><text x={PAD_L - 6} y={y(tv) + 3} textAnchor="end" fontSize={9} fill={INK.muted} style={NUM}>{format(tv)}</text></g>)}
            {xt.map((i) => <text key={i} x={x(i)} y={H - 4} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize={9} fill={INK.muted} style={NUM}>{xLabel(i)}</text>)}
            {refLines?.map((r) => <g key={r.label}><line x1={PAD_L} x2={PAD_L + iw} y1={y(r.y)} y2={y(r.y)} stroke={r.color ?? INK.secondary} strokeWidth={1} strokeDasharray="3 3" opacity={0.8} /><text x={PAD_L + 4} y={y(r.y) - 3} fontSize={9} fill={INK.secondary}>{r.label}</text></g>)}
            {splitAt !== undefined && splitAt < n && <g><line x1={x(splitAt)} x2={x(splitAt)} y1={PAD_T} y2={PAD_T + ih} stroke={INK.axis} strokeWidth={1} /><text x={x(splitAt)} y={PAD_T - 1} textAnchor="middle" fontSize={9} fill={INK.muted}>today</text></g>}
            {series.map((s) => <path key={s.name} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '4 4' : undefined} />)}
            {series.length <= 4 && series.filter((s) => !s.dashed).map((s) => { const li = lastIdx(s); if (li < 0) return null; const v = s.values[li] as number; return <g key={s.name}><circle cx={x(li)} cy={y(v)} r={3} fill={s.color} stroke="#16171b" strokeWidth={2} /><text x={x(li) + 6} y={y(v) + 3} fontSize={10} fill={INK.primary} style={NUM}>{format(v)}</text></g>; })}
            {hover !== null && <g><line x1={x(hover)} x2={x(hover)} y1={PAD_T} y2={PAD_T + ih} stroke={INK.secondary} strokeWidth={1} />{series.map((s) => { const v = s.values[hover]; return v === null || v === undefined ? null : <circle key={s.name} cx={x(hover)} cy={y(v)} r={4} fill={s.color} stroke="#16171b" strokeWidth={2} />; })}</g>}
          </svg>
          {hover !== null && (
            <div style={{ position: 'absolute', top: 0, left: hover > n / 2 ? undefined : `${(x(hover) / W) * 100 + 2}%`, right: hover > n / 2 ? `${100 - (x(hover) / W) * 100 + 2}%` : undefined, background: 'rgba(12,13,16,0.94)', border: `1px solid ${INK.border}`, borderRadius: 6, padding: '6px 8px', pointerEvents: 'none', fontSize: 11, color: INK.primary, whiteSpace: 'nowrap', zIndex: 2 }}>
              <div style={{ color: INK.muted, marginBottom: 2 }}>{xLabel(hover)}</div>
              {series.map((s) => { const v = s.values[hover]; return <div key={s.name} style={{ display: 'flex', gap: 6, alignItems: 'center' }}><i style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} /><span style={{ color: INK.secondary }}>{s.name}</span><b style={{ marginLeft: 'auto', paddingLeft: 8, ...NUM }}>{v === null || v === undefined ? '—' : `${format(v)} ${unit}`}</b></div>; })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DataTable({ series, xLabel, format, unit }: { series: Series[]; xLabel: (i: number) => string; format: (v: number) => string; unit: string }) {
  const n = Math.max(...series.map((s) => s.values.length));
  const step = Math.max(1, Math.ceil(n / 12));
  const rows: number[] = []; for (let i = n - 1; i >= 0; i -= step) rows.push(i);
  return (
    <div style={{ maxHeight: 150, overflow: 'auto', border: `1px solid ${INK.border}`, borderRadius: 6 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, color: INK.secondary }}>
        <thead><tr><th style={{ textAlign: 'left', padding: '4px 6px', color: INK.muted, fontWeight: 500 }}>t</th>{series.map((s) => <th key={s.name} style={{ textAlign: 'right', padding: '4px 6px', color: INK.muted, fontWeight: 500 }}>{s.name} ({unit})</th>)}</tr></thead>
        <tbody>{rows.map((i) => <tr key={i} style={{ borderTop: `1px solid ${INK.grid}` }}><td style={{ padding: '3px 6px' }}>{xLabel(i)}</td>{series.map((s) => { const v = s.values[i]; return <td key={s.name} style={{ textAlign: 'right', padding: '3px 6px', color: INK.primary, ...NUM }}>{v === null || v === undefined ? '—' : format(v)}</td>; })}</tr>)}</tbody>
      </table>
    </div>
  );
}

interface GaugeProps { label: string; unit: string; value: number; min: number; max: number; zones?: { to: number; status: Status }[]; marker?: number; markerLabel?: string; format?: (v: number) => string }

/** 240° arc gauge: recessive track, status zones as thin arcs under it, the value as a 4 px arc + hero number. */
export function Gauge({ label, unit, value, min, max, zones, marker, markerLabel, format = (v) => v.toFixed(1) }: GaugeProps) {
  const R = 46, cx = 60, cy = 58, a0 = 210, a1 = -30;
  const ang = (v: number) => a0 + ((Math.min(max, Math.max(min, v)) - min) / (max - min || 1)) * (a1 - a0);
  const pt = (deg: number, r = R) => { const t = (deg * Math.PI) / 180; return [cx + r * Math.cos(t), cy - r * Math.sin(t)] as const; };
  const arc = (from: number, to: number, r = R) => { const [x0, y0] = pt(ang(from), r), [x1, y1] = pt(ang(to), r); const large = Math.abs(ang(to) - ang(from)) > 180 ? 1 : 0; return `M${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)}`; };
  const cur = zones?.find((z) => value < z.to)?.status ?? zones?.[zones.length - 1]?.status ?? 'good';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0 }}>
      <svg role="img" aria-label={`${label} ${format(value)} ${unit}`} viewBox="0 0 120 92" width={150} height={115} style={{ display: 'block', fontFamily: FONT, overflow: 'visible' }}>
        <path d={arc(min, max)} fill="none" stroke={INK.grid} strokeWidth={6} strokeLinecap="round" />
        {zones?.map((z, i) => { const from = i === 0 ? min : zones[i - 1].to; return <path key={i} d={arc(from, Math.min(max, z.to), R + 7)} fill="none" stroke={STATUS[z.status]} strokeWidth={2} opacity={0.55} />; })}
        {value > min && <path d={arc(min, value)} fill="none" stroke={cur === 'good' ? SERIES.blue : STATUS[cur]} strokeWidth={6} strokeLinecap="round" />}
        {marker !== undefined && (() => { const [mx0, my0] = pt(ang(marker), R - 8), [mx1, my1] = pt(ang(marker), R + 3); return <line x1={mx0} y1={my0} x2={mx1} y2={my1} stroke={INK.primary} strokeWidth={2} />; })()}
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={22} fontWeight={600} fill={INK.primary} style={NUM}>{format(value)}</text>
        <text x={cx} y={cy + 17} textAnchor="middle" fontSize={9} fill={INK.muted}>{unit}</text>
        <text x={pt(a0, R - 14)[0] + 4} y={pt(a0, R - 14)[1] + 3} textAnchor="start" fontSize={8} fill={INK.muted} style={NUM}>{min}</text>
        <text x={pt(a1, R - 14)[0] - 4} y={pt(a1, R - 14)[1] + 3} textAnchor="end" fontSize={8} fill={INK.muted} style={NUM}>{max}</text>
      </svg>
      <div style={{ color: INK.secondary, fontSize: 11, textAlign: 'center', marginTop: 2 }}>{label}{marker !== undefined && markerLabel && <span style={{ color: INK.muted }}> · {markerLabel} {format(marker)}</span>}</div>
    </div>
  );
}

export function Stat({ label, value, unit, sub, status }: { label: string; value: string; unit?: string; sub?: string; status?: Status }) {
  return (
    <div style={{ background: INK.card, border: `1px solid ${INK.border}`, borderRadius: 6, padding: '7px 9px', minWidth: 0 }}>
      <div style={{ color: INK.muted, fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
        {status && <span aria-label={STATUS_LABEL[status]} title={STATUS_LABEL[status]} style={{ color: STATUS[status], fontSize: 10 }}>{STATUS_ICON[status]}</span>}
        <span style={{ color: INK.primary, fontSize: 17, fontWeight: 600, ...NUM }}>{value}</span>
        {unit && <span style={{ color: INK.muted, fontSize: 10 }}>{unit}</span>}
      </div>
      {sub && <div style={{ color: INK.secondary, fontSize: 10, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  );
}

export function HealthBar({ label, value }: { label: string; value: number }) {
  const st: Status = value >= 75 ? 'good' : value >= 50 ? 'warning' : value >= 30 ? 'serious' : 'critical';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr 34px', alignItems: 'center', gap: 8, fontSize: 11 }}>
      <span style={{ color: INK.secondary }}>{label}</span>
      <div style={{ height: 6, background: INK.grid, borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${value}%`, height: '100%', background: STATUS[st], borderRadius: 3 }} /></div>
      <span style={{ color: INK.primary, textAlign: 'right', ...NUM }}>{value}</span>
    </div>
  );
}

export function StatusChip({ status, text }: { status: Status; text: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 999, border: `1px solid ${STATUS[status]}55`, background: `${STATUS[status]}1f`, color: INK.primary, fontSize: 11, whiteSpace: 'nowrap' }}><span style={{ color: STATUS[status] }}>{STATUS_ICON[status]}</span>{text}</span>;
}

export function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section style={{ paddingTop: 12, marginTop: 12, borderTop: `1px solid ${INK.border}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <h3 style={{ margin: 0, color: INK.primary, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{title}</h3>
        {sub && <span style={{ color: INK.muted, fontSize: 11 }}>{sub}</span>}
      </div>
      {children}
    </section>
  );
}
