// Demo harness for ServerRackTwin: view toggle, cover/airflow checkboxes, load-temp randomizer, the exploded-view
// slider with a live parts-count legend, and the generic remediation flow (slide-to-confirm in the issue modal ->
// remediation API -> the scene dispatches a technician and acts out the fix -> issue clears).
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import ServerRackTwin, { DEMO_ISSUES, requestRemediation } from '../ServerRackTwin';
import { REMEDIATION_IDLE, type RackIssue, type RackView, type RemediationState } from './types';

const COMPONENT_KIND_LABEL: Record<string, string> = {
  server: 'Servers', blank: 'Blanking panels', switch: 'Network switches', patch: 'Patch panels',
  cablemgr: 'Cable managers', hpdu: 'Horizontal PDU', pdu: 'Vertical PDUs', nuc: 'NUC shelf (8× mini PC)',
};

export function Playground() {
  // `?view=visual|thermal|liquid` deep-links the initial view (handy for demos and screenshots).
  const [view, setView] = useState<RackView>(() => { const q = new URLSearchParams(window.location.search).get('view'); return q === 'thermal' || q === 'liquid' ? q : 'visual'; });
  const [covers, setCovers] = useState(true);
  const [airflow, setAirflow] = useState(true);
  const [temps, setTemps] = useState<number[] | undefined>(undefined);
  const [explode, setExplode] = useState(0);
  const [items, setItems] = useState<{ kind: string; label: string }[]>([]);
  const [issues, setIssues] = useState<RackIssue[]>(DEMO_ISSUES);
  const [remediation, setRemediation] = useState<RemediationState>(REMEDIATION_IDLE);
  const [note, setNote] = useState<string | null>(null);
  const idleTimer = useRef<number | null>(null);
  useEffect(() => () => { if (idleTimer.current) window.clearTimeout(idleTimer.current); }, []);

  const onRemediate = async (issue: RackIssue) => {
    const d = issue.remediation;
    if (!d || remediation.phase !== 'idle') return;
    setNote(null); setRemediation({ issueId: issue.id, phase: 'requested' });
    try {
      const res = await requestRemediation({ rackId: issue.rackId, issueId: issue.id, action: d.action, device: issue.device, fru: d.fru, port: d.port, resultMessage: d.doneMessage });
      if (!res.ok || (res.linkState && res.linkState !== 'up')) throw new Error(res.message);
      setNote(`${res.performedBy} · ticket ${res.ticket} · ${new Date(res.completedAt).toLocaleTimeString()}`);
      setRemediation({ issueId: issue.id, phase: 'confirmed' });
    } catch (e) {
      setNote(`Remediation failed: ${(e as Error).message}`); setRemediation(REMEDIATION_IDLE);
    }
  };
  const onRemediationDone = (issueId: string) => {
    setRemediation({ issueId, phase: 'done' });
    setIssues((list) => list.filter((i) => i.id !== issueId));
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setRemediation(REMEDIATION_IDLE), 4000);
  };

  const [powerEvent, setPowerEvent] = useState(0);
  const [powerBusy, setPowerBusy] = useState(false);
  const randomize = () => setTemps(Array.from({ length: 20 }, () => 0.3 + Math.random() * 0.7));
  const counts = items.reduce<Record<string, number>>((acc, it) => { acc[it.kind] = (acc[it.kind] || 0) + 1; return acc; }, {});
  const btn: CSSProperties = { background: '#1e2026', color: '#eef0f4', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' };
  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100vh', background: '#0f1013', color: '#c9ccd3', fontFamily: '"Helvetica Neue", Helvetica, sans-serif', fontSize: 12 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={covers} onChange={(e) => setCovers(e.target.checked)} /> Front covers</label>
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={airflow} onChange={(e) => setAirflow(e.target.checked)} /> Airflow &amp; heat</label>
        <button onClick={randomize} style={btn}>Randomize load temps</button>
        <button onClick={() => setTemps(undefined)} style={{ ...btn, background: 'transparent', color: '#aeb3bc' }}>Reset</button>
        <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginLeft: 8 }}>
          Explode view
          <input type="range" min={0} max={100} value={Math.round(explode * 100)} onChange={(e) => setExplode(Number(e.target.value) / 100)} style={{ width: 140 }} />
          <span style={{ opacity: 0.7, width: 32, display: 'inline-block' }}>{Math.round(explode * 100)}%</span>
        </label>
        <button onClick={() => setPowerEvent((n) => n + 1)} disabled={powerBusy} title="Drop the utility feed: UPS carries the hall, standby feed picks up, then retransfer" style={{ ...btn, marginLeft: 8, borderColor: 'rgba(255,160,32,0.45)', opacity: powerBusy ? 0.5 : 1, cursor: powerBusy ? 'default' : 'pointer' }}>⚡ Simulate utility loss</button>
        <span style={{ marginLeft: 16, opacity: 0.75 }}>
          {issues.length} open alarm{issues.length === 1 ? '' : 's'}
          {remediation.phase !== 'idle' && <> · <b style={{ color: '#eef0f4' }}>{remediation.issueId}</b> {remediation.phase === 'requested' ? '⟳ dispatching' : remediation.phase === 'confirmed' ? 'technician working' : '✓ closed'}</>}
        </span>
        <span style={{ marginLeft: 'auto', opacity: 0.7 }}>view: {view}</span>
      </div>
      <div style={{ position: 'relative', height: '100%' }}>
        <ServerRackTwin view={view} onViewChange={setView} showCovers={covers} showAirflow={airflow} temps={temps} explode={explode} onItems={setItems}
          issues={issues} remediation={remediation} onRemediate={onRemediate} onRemediationDone={onRemediationDone} remediationNote={note}
          powerEvent={powerEvent} onPowerPhase={(p) => setPowerBusy(p !== 'utility')} />
        {explode > 0.02 && (
          <div style={{ position: 'absolute', right: 20, bottom: 18, background: 'rgba(12,13,16,0.72)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, padding: '10px 14px', color: '#eef0f4', font: '12px/1.7 inherit', letterSpacing: '0.02em', backdropFilter: 'blur(8px)' }}>
            <b style={{ display: 'block', marginBottom: 4 }}>Components · {items.length}</b>
            {Object.entries(counts).map(([k, c]) => <div key={k}>{COMPONENT_KIND_LABEL[k] ?? k} × {c}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}
