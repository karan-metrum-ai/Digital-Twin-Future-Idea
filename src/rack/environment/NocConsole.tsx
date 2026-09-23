// NOC console: the operator's live panel, shown while the technician is at the NOC desk (a standing console — there is
// no chair). The same numbers the video wall paints (PUE, IT load, coolant supply / ΔT, power source, open alarms) as
// a real, clickable React panel — the incident rows open the issue modal, the sparkline is live, and "Leave desk"
// hands the technician back to their rounds or to the keyboard. Numbers are pushed at ~1 Hz from the scene (see
// ServerRackTwin setNocData).
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.
import { useEffect, useRef, type CSSProperties } from 'react';
import type { RackIssue } from './../issues/issues';

export interface NocData {
  pue: number; itKw: number; coolKw: number; lossKw: number;
  supplyC: number | null; dT: number | null; flowLpm: number | null;
  source: string; upsPct: number; upsMode: string;
  history: number[];
}
export interface NocConsoleProps {
  data: NocData | null;
  issues: RackIssue[];
  onOpenIssue: (id: string) => void;
  onLeave: () => void;
  /** Whether the desk is reached yet: the panel fades in once the technician is standing at it. */
  atDesk: boolean;
}

const SEV_COLOR: Record<string, string> = { critical: '#d03b3b', major: '#ec835a', minor: '#fab219' };
const SEV_RANK: Record<string, number> = { critical: 0, major: 1, minor: 2 };

export function NocConsole({ data, issues, onOpenIssue, onLeave, atDesk }: NocConsoleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvasRef.current; if (!c || !data) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const w = c.width, h = c.height, hist = data.history.length ? data.history : [data.itKw];
    ctx.clearRect(0, 0, w, h);
    const lo = Math.min(...hist) - 4, hi = Math.max(...hist) + 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) { const y = 8 + k * ((h - 16) / 3); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.beginPath(); hist.forEach((v, i) => { const x = (i / Math.max(1, hist.length - 1)) * w, y = h - 8 - ((v - lo) / (hi - lo)) * (h - 16); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.strokeStyle = '#5ab0ff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#8b97ad'; ctx.font = '500 10px "Helvetica Neue", Helvetica, Arial, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(`${hi.toFixed(0)} kW`, w - 4, 12); ctx.fillText(`${lo.toFixed(0)} kW`, w - 4, h - 4);
  }, [data]);

  const sorted = [...issues].sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);
  const counts = { critical: 0, major: 0, minor: 0 } as Record<string, number>; for (const i of issues) counts[i.severity] = (counts[i.severity] ?? 0) + 1;
  const src = data?.source ?? 'utility';
  const srcColor = src === 'utility' ? '#2ee36a' : src === 'generator' ? '#ffa020' : '#ff6a5a';
  const panel: CSSProperties = { position: 'absolute', right: 20, top: 64, bottom: 78, width: 372, display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', borderRadius: 12, background: 'rgba(8,11,18,0.88)', border: '1px solid rgba(127,179,255,0.35)', color: '#eef3ff', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', opacity: atDesk ? 1 : 0.35, transition: 'opacity 0.5s', pointerEvents: atDesk ? 'auto' : 'none', overflow: 'hidden' };
  const tile: CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, padding: '8px 10px', minWidth: 0 };
  const label: CSSProperties = { color: '#8b97ad', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 };
  const big: CSSProperties = { fontSize: 22, fontWeight: 700, lineHeight: 1.15, marginTop: 2 };
  const fmt = (v: number | null | undefined, d = 1) => (v == null ? '—' : v.toFixed(d));
  return (
    <aside style={panel} role="region" aria-label="NOC console">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: '#7fb3ff', fontWeight: 700, fontSize: 13, letterSpacing: '0.04em' }}>HALL 1 · NOC CONSOLE</div>
          <div style={{ color: '#8b97ad', fontSize: 11, marginTop: 2 }}>{atDesk ? 'Operator at the desk · live feed' : 'Technician walking to the desk…'}</div>
        </div>
        <button onClick={onLeave} title="Leave the desk (Esc)" style={{ appearance: 'none', border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', color: '#eef3ff', borderRadius: 6, padding: '6px 10px', font: '600 11px/1 inherit', cursor: 'pointer' }}>Leave desk</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={tile}><div style={label}>PUE (live)</div><div style={{ ...big, color: data && data.pue < 1.35 ? '#2ee36a' : '#ffcf6a' }}>{fmt(data?.pue, 2)}</div><div style={{ color: '#aeb3bc', fontSize: 10 }}>IT {fmt(data?.itKw, 0)} · cool {fmt(data?.coolKw, 0)} · loss {fmt(data?.lossKw, 0)} kW</div></div>
        <div style={tile}><div style={label}>IT load</div><div style={big}>{fmt(data?.itKw)} <span style={{ fontSize: 12, color: '#8b97ad' }}>kW</span></div><div style={{ color: '#aeb3bc', fontSize: 10 }}>{data ? Math.round((data.itKw / 240) * 100) : '—'} % of 240 kW design</div></div>
        <div style={tile}><div style={label}>Coolant supply</div><div style={big}>{fmt(data?.supplyC)} <span style={{ fontSize: 12, color: '#8b97ad' }}>°C</span></div><div style={{ color: '#aeb3bc', fontSize: 10 }}>{data?.dT != null ? `ΔT ${fmt(data.dT)} K · ${fmt(data.flowLpm, 0)} L/min` : 'loop standby'}</div></div>
        <div style={tile}><div style={label}>Power</div><div style={{ ...big, display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: srcColor, boxShadow: `0 0 8px ${srcColor}` }} />{src === 'none' ? 'TRANSFER' : src.toUpperCase()}</div><div style={{ color: '#aeb3bc', fontSize: 10 }}>UPS {fmt(data?.upsPct, 0)} % · {data?.upsMode ?? '—'}</div></div>
      </div>
      <div style={{ ...tile, padding: '8px 10px 6px' }}>
        <div style={label}>IT load · last 90 s</div>
        <canvas ref={canvasRef} width={330} height={64} style={{ width: '100%', height: 64, display: 'block', marginTop: 4 }} />
      </div>
      <div style={{ ...tile, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={label}>Active incidents · {issues.length}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['critical', 'major', 'minor'] as const).map((s) => <span key={s} style={{ background: SEV_COLOR[s], color: '#0b0d11', borderRadius: 5, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{counts[s]} {s.slice(0, 4).toUpperCase()}</span>)}
          </div>
        </div>
        <div style={{ overflowY: 'auto', marginTop: 6, scrollbarWidth: 'thin' }}>
          {sorted.length === 0 && <div style={{ color: '#2ee36a', fontWeight: 600, padding: '8px 0' }}>No open incidents</div>}
          {sorted.map((i) => (
            <button key={i.id} onClick={() => onOpenIssue(i.id)} title="Open the incident" style={{ display: 'grid', gridTemplateColumns: '8px 64px 1fr', gap: 8, alignItems: 'center', width: '100%', textAlign: 'left', appearance: 'none', border: 0, borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: '#eef3ff', padding: '6px 2px', cursor: 'pointer', font: 'inherit' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: SEV_COLOR[i.severity] }} />
              <span style={{ fontWeight: 600 }}>{i.rackId} U{i.u}</span>
              <span style={{ color: '#aeb3bc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.title.replace(/\s+—\s+/g, ' · ')}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={{ color: '#7c8290', fontSize: 10.5 }}>Click an incident to open it · Esc, any arrow key or Leave desk to step away</div>
    </aside>
  );
}
