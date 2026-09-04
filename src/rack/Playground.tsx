// Demo harness for ServerRackTwin: view toggle, cover/airflow checkboxes, load-temp randomizer, and the
// exploded-view slider with a live parts-count legend.
import { useState } from 'react';
import ServerRackTwin from '../ServerRackTwin';
import type { RackView } from './types';

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
        <span style={{ marginLeft: 'auto', opacity: 0.7 }}>view: {view}</span>
      </div>
      <div style={{ position: 'relative', height: '100%' }}>
        <ServerRackTwin view={view} onViewChange={setView} showCovers={covers} showAirflow={airflow} temps={temps} explode={explode} onItems={setItems} />
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
