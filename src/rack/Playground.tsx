// Demo harness for ServerRackTwin: view toggle, cover/airflow checkboxes, load-temp randomizer, and the
// exploded-view slider with a live parts-count legend.
import { useRef, useState } from 'react';
import ServerRackTwin, { DEMO_ISSUES, FAULT_CABLE_ISSUE_ID, LIVE_RACK_ID, requestRemediation } from '../ServerRackTwin';
import type { RackIssue, RackView, SwitchFixPhase } from './types';

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
  // Remediation flow for the unseated patch cable: slide-to-confirm -> API call -> scene plays the reseat -> issue clears.
  const [issues, setIssues] = useState<RackIssue[]>(DEMO_ISSUES);
  const [switchFix, setSwitchFix] = useState<SwitchFixPhase>('idle');
  const [slide, setSlide] = useState(0);
  const [fixNote, setFixNote] = useState<string | null>(null);
  const snapBack = useRef<number | null>(null);
  const commitSlide = async () => {
    if (switchFix !== 'idle') return;
    if (slide < 96) { // released early: ease the knob back to the start
      if (snapBack.current) cancelAnimationFrame(snapBack.current);
      const step = () => setSlide((v) => { const nv = v * 0.72; if (nv < 1) return 0; snapBack.current = requestAnimationFrame(step); return nv; });
      snapBack.current = requestAnimationFrame(step); return;
    }
    setSlide(100); setSwitchFix('requested'); setFixNote('Dispatching reseat…');
    try {
      const res = await requestRemediation({ rackId: LIVE_RACK_ID, issueId: FAULT_CABLE_ISSUE_ID, action: 'reseat_patch_cable', device: 'sw-x01-core-48p', port: 9 });
      if (!res.ok || res.linkState !== 'up') throw new Error(res.message);
      setFixNote(`${res.performedBy}: ${res.message}`); setSwitchFix('confirmed');
    } catch (e) { setFixNote(`Remediation failed: ${(e as Error).message}`); setSwitchFix('idle'); setSlide(0); }
  };
  const onFixDone = () => { setSwitchFix('done'); setIssues((list) => list.filter((i) => i.id !== FAULT_CABLE_ISSUE_ID)); setFixNote('Link restored · INC-4802 closed'); };
  const faultOpen = issues.some((i) => i.id === FAULT_CABLE_ISSUE_ID);
  const randomize = () => setTemps(Array.from({ length: 20 }, () => 0.3 + Math.random() * 0.7));
  const counts = items.reduce<Record<string, number>>((acc, it) => { acc[it.kind] = (acc[it.kind] || 0) + 1; return acc; }, {});
  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100vh', background: '#0f1013', color: '#c9ccd3', fontFamily: '"Helvetica Neue", Helvetica, sans-serif', fontSize: 12 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={covers} onChange={(e) => setCovers(e.target.checked)} /> Front covers</label>
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={airflow} onChange={(e) => setAirflow(e.target.checked)} /> Airflow &amp; heat</label>
        <button onClick={randomize} style={{ background: '#1e2026', color: '#eef0f4', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Randomize load temps</button>
        <button onClick={() => setTemps(undefined)} style={{ background: 'transparent', color: '#aeb3bc', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Reset</button>
        <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginLeft: 8 }}>
          Explode view
          <input type="range" min={0} max={100} value={Math.round(explode * 100)} onChange={(e) => setExplode(Number(e.target.value) / 100)} style={{ width: 140 }} />
          <span style={{ opacity: 0.7, width: 32, display: 'inline-block' }}>{Math.round(explode * 100)}%</span>
        </label>
        <div style={{ marginLeft: 16, display: 'inline-flex', alignItems: 'center', gap: 10, padding: '4px 10px 4px 12px', borderRadius: 8, border: `1px solid ${switchFix === 'done' ? 'rgba(12,163,12,0.55)' : 'rgba(216,36,28,0.55)'}`, background: switchFix === 'done' ? 'rgba(12,163,12,0.10)' : 'rgba(216,36,28,0.10)' }} title="INC-4802 · X-01 U39 · Ethernet1/9 patch cable unseated">
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: switchFix === 'done' ? '#0ca30c' : '#d8241c', boxShadow: switchFix === 'idle' ? '0 0 8px #d8241c' : 'none' }} />
          <span style={{ fontWeight: 600, color: '#eef0f4', whiteSpace: 'nowrap' }}>{switchFix === 'done' ? 'Switch port 9 · link up' : 'Switch port 9 · cable unseated'}</span>
          {switchFix === 'idle' && faultOpen && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }} aria-label="Slide to reseat the patch cable">
              <span style={{ opacity: 0.75 }}>slide to reseat →</span>
              <input type="range" min={0} max={100} value={Math.round(slide)} onChange={(e) => setSlide(Number(e.target.value))} onPointerUp={commitSlide} onKeyUp={(e) => { if (e.key === 'Enter' || e.key === 'End') { setSlide(100); void commitSlide(); } }} style={{ width: 150, accentColor: slide >= 96 ? '#0ca30c' : '#d8241c' }} />
            </label>
          )}
          {switchFix === 'requested' && <span style={{ opacity: 0.8 }}>⟳ waiting for remediation API…</span>}
          {switchFix === 'confirmed' && <span style={{ opacity: 0.8 }}>reseating connector…</span>}
          {fixNote && switchFix !== 'requested' && switchFix !== 'confirmed' && <span style={{ opacity: 0.7, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fixNote}</span>}
        </div>
        <span style={{ marginLeft: 'auto', opacity: 0.7 }}>view: {view}</span>
      </div>
      <div style={{ position: 'relative', height: '100%' }}>
        <ServerRackTwin view={view} onViewChange={setView} showCovers={covers} showAirflow={airflow} temps={temps} explode={explode} onItems={setItems} issues={issues} switchFix={switchFix} onSwitchFixDone={onFixDone} />
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
