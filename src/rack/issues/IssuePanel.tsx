// Open-issues panel: the hall-wide alarm list (storage / compute / network) shown beside the 3D scene so an operator
// can triage without hunting through racks. Clicking an issue selects its rack in the scene (the camera flies
// there and the rack gets an outline) and expands the log excerpt; the selected rack's issues are pinned to the top.
import React, { useEffect, useRef, useState } from 'react';
import { INK } from '../liquid/charts';
import { CATEGORY_LABEL, type IssueCategory, RACK_BY_ID, type RackIssue, SEVERITY_COLOR, SEVERITY_LABEL, SEVERITY_RANK } from './issues';

const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const MONO = '"SF Mono", Menlo, Consolas, monospace';
const CATEGORY_ICON: Record<IssueCategory, string> = { storage: '▤', compute: '▣', network: '⇄' };

export interface IssuePanelProps {
  issues: RackIssue[];
  selectedRackId: string | null;
  /** The issue whose logs are open (if any). */
  openIssueId: string | null;
  onSelectRack: (id: string | null) => void;
  onOpenIssue: (id: string | null) => void;
}

const age = (m: number) => (m < 60 ? `${m} min` : m < 24 * 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 1440)} d`);

export function IssuePanel({ issues, selectedRackId, openIssueId, onSelectRack, onOpenIssue }: IssuePanelProps) {
  const [filter, setFilter] = useState<IssueCategory | 'all'>('all');
  const [collapsed, setCollapsed] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  const counts = issues.reduce<Record<string, number>>((a, i) => { a[i.category] = (a[i.category] || 0) + 1; return a; }, {});
  const critical = issues.filter((i) => i.severity === 'critical').length;
  const visible = issues
    .filter((i) => filter === 'all' || i.category === filter)
    .sort((a, b) => {
      // Selected rack's issues float to the top, then severity, then most recent.
      const sa = a.rackId === selectedRackId ? 0 : 1, sb = b.rackId === selectedRackId ? 0 : 1;
      return sa - sb || SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.ageMin - b.ageMin;
    });
  const selectedCount = selectedRackId ? issues.filter((i) => i.rackId === selectedRackId).length : 0;

  // Keep the first issue of a freshly selected rack in view (rack picked in the 3D scene, list re-sorted).
  useEffect(() => { if (selectedRackId) listRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }, [selectedRackId]);

  const panel: React.CSSProperties = { position: 'absolute', top: 64, right: 20, bottom: 78, width: collapsed ? 'auto' : 344, display: 'flex', flexDirection: 'column', background: INK.surface, border: `1px solid ${INK.border}`, borderRadius: 10, backdropFilter: 'blur(10px)', color: INK.primary, fontFamily: FONT, fontSize: 12, overflow: 'hidden', maxHeight: collapsed ? 40 : undefined };
  const chip = (active: boolean, color?: string): React.CSSProperties => ({ appearance: 'none', border: `1px solid ${active ? (color ?? '#eef0f4') + '88' : INK.border}`, background: active ? (color ? color + '22' : 'rgba(255,255,255,0.10)') : 'transparent', color: active ? INK.primary : INK.secondary, borderRadius: 999, padding: '3px 9px', font: `500 11px/1 ${FONT}`, cursor: 'pointer', whiteSpace: 'nowrap' });

  return (
    <aside style={panel} aria-label="Open issues">
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px 8px', borderBottom: collapsed ? 0 : `1px solid ${INK.border}` }}>
        <button onClick={() => setCollapsed((c) => !c)} title={collapsed ? 'Expand issues panel' : 'Collapse issues panel'} style={{ appearance: 'none', border: 0, background: 'transparent', color: INK.secondary, cursor: 'pointer', padding: 0, font: `14px/1 ${FONT}` }}>{collapsed ? '▸' : '▾'}</button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em' }}>OPEN ISSUES · {issues.length}</div>
          {!collapsed && <div style={{ color: INK.muted, fontSize: 11, marginTop: 2 }}>Hall 1 · rows A/B + X-01 · live from monitoring</div>}
        </div>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 999, border: `1px solid ${SEVERITY_COLOR.critical}66`, background: `${SEVERITY_COLOR.critical}1f`, fontSize: 11, whiteSpace: 'nowrap' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: SEVERITY_COLOR.critical, display: 'inline-block' }} />{critical} critical
        </span>
      </header>
      {!collapsed && (
        <>
          <div style={{ display: 'flex', gap: 6, padding: '8px 12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => setFilter('all')} style={chip(filter === 'all')}>All · {issues.length}</button>
            {(Object.keys(CATEGORY_LABEL) as IssueCategory[]).map((c) => (
              <button key={c} onClick={() => setFilter(c)} style={chip(filter === c)}>{CATEGORY_ICON[c]} {CATEGORY_LABEL[c]} · {counts[c] || 0}</button>
            ))}
          </div>
          {selectedRackId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 12px 8px', padding: '6px 10px', borderRadius: 6, background: 'rgba(90,176,255,0.10)', border: '1px solid rgba(90,176,255,0.45)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#5ab0ff', boxShadow: '0 0 8px #5ab0ff' }} />
              <span style={{ fontWeight: 600 }}>{RACK_BY_ID[selectedRackId]?.label ?? selectedRackId}</span>
              <span style={{ color: INK.secondary }}>{selectedCount === 0 ? 'no open issues' : `${selectedCount} open issue${selectedCount === 1 ? '' : 's'}`}</span>
              <button onClick={() => { onSelectRack(null); onOpenIssue(null); }} style={{ ...chip(false), marginLeft: 'auto' }}>Clear</button>
            </div>
          )}
          <ul ref={listRef} style={{ listStyle: 'none', margin: 0, padding: '0 8px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, scrollbarWidth: 'thin' }}>
            {visible.length === 0 && <li style={{ color: INK.muted, padding: '12px 6px' }}>No open {filter === 'all' ? '' : CATEGORY_LABEL[filter].toLowerCase() + ' '}issues.</li>}
            {visible.map((i) => {
              const rack = RACK_BY_ID[i.rackId];
              const onRack = i.rackId === selectedRackId, open = i.id === openIssueId;
              const color = SEVERITY_COLOR[i.severity];
              return (
                <li key={i.id} style={{ flexShrink: 0, borderRadius: 8, border: `1px solid ${onRack ? 'rgba(90,176,255,0.55)' : INK.border}`, background: onRack ? 'rgba(90,176,255,0.07)' : INK.card, overflow: 'hidden' }}>
                  <button
                    onClick={() => { onSelectRack(i.rackId); onOpenIssue(open ? null : i.id); }}
                    aria-expanded={open}
                    style={{ appearance: 'none', border: 0, background: 'transparent', color: INK.primary, width: '100%', textAlign: 'left', padding: '9px 10px', cursor: 'pointer', display: 'grid', gridTemplateColumns: '10px 1fr auto', gap: 10, alignItems: 'start', font: `12px/1.35 ${FONT}` }}
                  >
                    <span title={SEVERITY_LABEL[i.severity]} style={{ width: 10, height: 10, borderRadius: '50%', background: color, marginTop: 3, boxShadow: i.severity === 'critical' ? `0 0 8px ${color}` : 'none' }} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'flex', gap: 6, alignItems: 'baseline', color: INK.secondary, fontSize: 10.5, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <b style={{ color: onRack ? '#8cc7ff' : INK.primary, fontWeight: 600 }}>{rack?.id ?? i.rackId}</b> · U{i.u} · {CATEGORY_ICON[i.category]} {CATEGORY_LABEL[i.category]} · {SEVERITY_LABEL[i.severity]}
                      </span>
                      <span style={{ display: 'block', fontWeight: 600, marginTop: 2 }}>{i.title}</span>
                      <span style={{ display: 'block', color: INK.secondary, fontSize: 11, marginTop: 2 }}>{i.summary}</span>
                    </span>
                    <span style={{ color: INK.muted, fontSize: 10.5, whiteSpace: 'nowrap', textAlign: 'right' }}>{i.id}<br />{age(i.ageMin)}</span>
                  </button>
                  {open && (
                    <div style={{ borderTop: `1px solid ${INK.border}`, padding: '8px 10px 10px', background: 'rgba(0,0,0,0.35)' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                        <span style={{ color: INK.muted, fontSize: 10.5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Logs · {i.device}</span>
                        <span style={{ marginLeft: 'auto', color: '#8cc7ff', fontSize: 10.5 }}>rack {i.rackId} selected in scene</span>
                      </div>
                      <pre style={{ margin: 0, font: `10.5px/1.5 ${MONO}`, color: '#d5d9e0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {i.logs.map((l, k) => <div key={k} style={{ color: /CRIT|ERR|FAIL|-2-|-3-/.test(l) ? '#ff9b9b' : /WARN|-4-/.test(l) ? '#ffd48a' : undefined }}>{l}</div>)}
                      </pre>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </aside>
  );
}
