// Issue detail modal: opens beside the on-rack alarm card that was clicked in the 3D scene (`place`, computed by the
// caller from the card's projected position with `placeDetail`, and re-written every frame so it stays pinned to the
// card while the camera moves); without a place it falls back to the viewport's right edge. It's the drill-down for
// whatever the door card can't fit — full title, device, age, summary and the raw log excerpt — without bringing back
// a persistent list panel. Dismissed by its close button, the Escape key, or clicking empty space in the scene (wired
// by the caller).
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.
import { useEffect, type CSSProperties, type Ref } from 'react';
import { INK } from '../liquid/charts';
import { CATEGORY_LABEL, type RackInfo, type RackIssue, SEVERITY_COLOR, SEVERITY_LABEL } from './issues';
import { RemediationSlider } from './RemediationSlider';
import { REMEDIATION_IDLE, type RemediationState } from '../types';
import { DETAIL_MAX_H, DETAIL_PAD, DETAIL_TOP_MIN, DETAIL_W, type DetailPlace } from './detailPlacement';

const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const MONO = '"SF Mono", Menlo, Consolas, monospace';
const CATEGORY_ICON: Record<string, string> = { storage: '▤', compute: '▣', network: '⇄', facility: '⌂' };

export interface IssueDetailProps {
  issue: RackIssue | null;
  rack: RackInfo | null;
  onClose: () => void;
  /** Anchored position beside the alarm card (see detailPlacement.ts); null/undefined = right-edge fallback. */
  place?: DetailPlace | null;
  /** The <aside>, so the caller can keep an anchored modal tracking its card between renders. */
  ref?: Ref<HTMLElement>;
  remediation?: RemediationState;
  remediationNote?: string | null;
  onRemediate?: (issue: RackIssue) => void;
}

const age = (m: number) => (m < 60 ? `${m} min ago` : m < 24 * 60 ? `${Math.floor(m / 60)} h ${m % 60} min ago` : `${Math.floor(m / 1440)} d ago`);

export function IssueDetail({ issue, rack, onClose, place = null, ref, remediation = REMEDIATION_IDLE, remediationNote = null, onRemediate }: IssueDetailProps) {
  useEffect(() => {
    if (!issue) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [issue, onClose]);

  if (!issue) return null;
  const color = SEVERITY_COLOR[issue.severity];
  // Anchored: a compact card beside the alarm plate (height capped, logs scroll). Fallback: the full-height right rail.
  const layout: CSSProperties = place
    ? { left: place.left, top: place.top, width: DETAIL_W, maxHeight: `min(${DETAIL_MAX_H}px, calc(100% - ${DETAIL_TOP_MIN + DETAIL_PAD}px))` }
    : { top: 64, right: 20, bottom: 78, width: DETAIL_W };

  return (
    <aside
      ref={ref}
      data-anchored={place ? '1' : '0'}
      aria-label={`${issue.id} details`}
      style={{
        position: 'absolute', ...layout, display: 'flex', flexDirection: 'column',
        background: INK.surface, border: `1px solid ${color}55`, borderRadius: 10, backdropFilter: 'blur(10px)',
        color: INK.primary, fontFamily: FONT, fontSize: 12, overflow: 'hidden',
        boxShadow: `0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.03)`,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 14px 12px', borderBottom: `1px solid ${INK.border}`, borderTop: `3px solid ${color}` }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, marginTop: 4, flexShrink: 0, boxShadow: issue.severity === 'critical' ? `0 0 8px ${color}` : 'none' }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', color: INK.secondary, fontSize: 10.5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            <b style={{ color: '#8cc7ff', fontWeight: 600 }}>{rack?.id ?? issue.rackId}</b> · U{issue.u} · {CATEGORY_ICON[issue.category]} {CATEGORY_LABEL[issue.category]} · {SEVERITY_LABEL[issue.severity]}
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4, lineHeight: 1.35 }}>{issue.title}</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ appearance: 'none', border: `1px solid ${INK.border}`, background: 'rgba(255,255,255,0.04)', color: INK.secondary, borderRadius: 6, width: 24, height: 24, flexShrink: 0, cursor: 'pointer', font: `13px/1 ${FONT}`, lineHeight: '22px', textAlign: 'center' }}
        >×</button>
      </header>

      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${INK.border}` }}>
        <div style={{ color: INK.secondary, lineHeight: 1.5 }}>{issue.summary}</div>
        <div style={{ display: 'flex', gap: 14, marginTop: 10, color: INK.muted, fontSize: 11, flexWrap: 'wrap' }}>
          <span><b style={{ color: INK.secondary }}>Device</b> · {issue.device}</span>
          <span><b style={{ color: INK.secondary }}>Opened</b> · {age(issue.ageMin)}</span>
          <span><b style={{ color: INK.secondary }}>Incident</b> · {issue.id}</span>
        </div>
      </div>

      {issue.remediation && onRemediate && (
        <RemediationSlider
          descriptor={issue.remediation}
          phase={remediation.issueId === issue.id ? remediation.phase : 'idle'}
          busyElsewhere={remediation.phase !== 'idle' && remediation.issueId !== issue.id}
          note={remediation.issueId === issue.id ? remediationNote : null}
          onCommit={() => onRemediate(issue)}
        />
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 14px 14px', scrollbarWidth: 'thin' }}>
        <div style={{ color: INK.muted, fontSize: 10.5, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>Logs</div>
        <pre style={{ margin: 0, font: `10.5px/1.6 ${MONO}`, color: '#d5d9e0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {issue.logs.map((l, k) => (
            <div key={k} style={{ color: /CRIT|ERR|FAIL|-2-|-3-/.test(l) ? '#ff9b9b' : /WARN|-4-/.test(l) ? '#ffd48a' : undefined, marginBottom: 4 }}>{l}</div>
          ))}
        </pre>
      </div>
    </aside>
  );
}
