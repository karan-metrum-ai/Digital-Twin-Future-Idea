// Slide-to-confirm control for an issue's remediation, shown inside the issue detail modal. Dragging the knob past
// 96 % commits (an accidental half-drag eases back to the start); Enter/End commits from the keyboard. While a
// remediation is in flight the slider is replaced by a phase line, and the API's closing note once it lands.
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.
import { useEffect, useRef, useState } from 'react';
import { INK } from '../liquid/charts';
import type { Remediation } from './issues';
import type { RemediationPhase } from '../types';

export interface RemediationSliderProps {
  descriptor: Remediation;
  /** Phase of THIS issue's remediation ('idle' when nothing is active for it). */
  phase: RemediationPhase;
  /** Another issue's remediation is running — this slider is shown but disabled. */
  busyElsewhere: boolean;
  note: string | null;
  onCommit: () => void;
}

const GREEN = '#0ca30c', RED = '#d8241c';

export function RemediationSlider({ descriptor, phase, busyElsewhere, note, onCommit }: RemediationSliderProps) {
  const [slide, setSlide] = useState(0);
  const snapBack = useRef<number | null>(null);
  useEffect(() => () => { if (snapBack.current) cancelAnimationFrame(snapBack.current); }, []);
  useEffect(() => { if (phase === 'idle') setSlide(0); }, [phase, descriptor.action]);

  const release = () => {
    if (phase !== 'idle' || busyElsewhere) return;
    if (slide < 96) {
      if (snapBack.current) cancelAnimationFrame(snapBack.current);
      const step = () => setSlide((v) => { const nv = v * 0.72; if (nv < 1) return 0; snapBack.current = requestAnimationFrame(step); return nv; });
      snapBack.current = requestAnimationFrame(step);
      return;
    }
    setSlide(100); onCommit();
  };

  const phaseLine = phase === 'requested' ? '⟳ waiting for remediation API…'
    : phase === 'confirmed' ? 'technician on site — working…'
    : phase === 'done' ? `✓ ${descriptor.doneMessage}` : null;

  return (
    <div style={{ padding: '10px 14px 12px', borderBottom: `1px solid ${INK.border}` }}>
      <div style={{ color: INK.muted, fontSize: 10.5, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>Remediation</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: phase === 'done' ? GREEN : RED, boxShadow: phase === 'idle' ? `0 0 8px ${RED}` : 'none' }} />
        <span style={{ fontWeight: 600, color: INK.primary, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{descriptor.label}</span>
      </div>
      {phase === 'idle' ? (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, opacity: busyElsewhere ? 0.45 : 1 }} aria-label={`Slide to ${descriptor.label.toLowerCase()}`} title={busyElsewhere ? 'Another remediation is in progress' : undefined}>
          <span style={{ color: INK.secondary, whiteSpace: 'nowrap' }}>slide to dispatch →</span>
          <input
            type="range" min={0} max={100} value={Math.round(slide)} disabled={busyElsewhere}
            onChange={(e) => setSlide(Number(e.target.value))} onPointerUp={release}
            onKeyUp={(e) => { if (e.key === 'Enter' || e.key === 'End') { setSlide(100); onCommit(); } }}
            style={{ flex: 1, accentColor: slide >= 96 ? GREEN : RED, cursor: busyElsewhere ? 'not-allowed' : 'pointer' }}
          />
        </label>
      ) : (
        <div style={{ marginTop: 8, color: phase === 'done' ? '#9fe6a0' : INK.secondary }}>{phaseLine}</div>
      )}
      {note && phase !== 'requested' && phase !== 'confirmed' && (
        <div style={{ marginTop: 6, color: INK.muted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={note}>{note}</div>
      )}
    </div>
  );
}
