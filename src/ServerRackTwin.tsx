// ServerRackTwin.tsx — React + TypeScript component (three.js 0.184) for the interactive 42U rack digital twin.
// Usage: <ServerRackTwin temps={[...]} view="visual" />  |  npm i three @types/three
// The procedural rack model, environment, airflow sim and thermal shader live under ./rack — see that folder
// for the component-by-component breakdown (servers, blanks, switches, patch panels, cable managers, PDUs, NUC).
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { buildRack } from './rack/buildRack';
import { buildEnvironment } from './rack/environment/Environment';
import { buildEnvMap } from './rack/environment/EnvironmentMap';
import { buildCoolingFloor } from './rack/environment/CoolingFloor';
import { buildHeatSim } from './rack/thermal/HeatSim';
import { buildThermalView } from './rack/thermal/ThermalView';
import { buildCoolingVapor } from './rack/thermal/CoolingVapor';
import type { Slot, RackView, ServerRackTwinProps } from './rack/types';

export type { Slot, RackView, ServerRackTwinProps } from './rack/types';
export { Playground } from './rack/Playground';

/* ------------------------------------------------------------------ component ------------------------------------------------------------------ */
export default function ServerRackTwin({ temps, view, onViewChange, showCovers = true, showAirflow = true, explode = 0, onItems, background = '#16171b', className, style }: ServerRackTwinProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [internalView, setInternalView] = useState<RackView>('visual');
  const v = view ?? internalView;
  const setView = (nv: RackView) => { setInternalView(nv); onViewChange?.(nv); };

  useEffect(() => {
    const host = hostRef.current; if (!host) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 500);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.08;
    const hemi = new THREE.HemisphereLight(0xdfe6f2, 0x2a2d34, 0.55); scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(3.5, 5, 4); key.castShadow = true; key.shadow.mapSize.set(4096, 4096); key.shadow.bias = -0.0001; key.shadow.normalBias = 0.002; scene.add(key);
    const fill = new THREE.DirectionalLight(0xcfd9ff, 0.5); fill.position.set(-4, 3, -2); scene.add(fill);
    const front = new THREE.DirectionalLight(0xe6ecff, 1.2); front.position.set(-1.5, 2.5, 5); scene.add(front);
    scene.environment = buildEnvMap(THREE, renderer);
    scene.fog = new THREE.FogExp2(0x16171b, 0.07);
    const rack = buildRack(THREE); rack.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(rack);
    scene.add(buildEnvironment(THREE));
    scene.add(buildCoolingFloor(THREE));
    const heat = buildHeatSim(THREE, rack.userData.slots as Slot[]); scene.add(heat);
    const vapor = buildCoolingVapor(THREE); scene.add(vapor);
    const thermal = buildThermalView(THREE, scene, rack, rack.userData.slots as Slot[]);
    const covers: THREE.Object3D[] = []; rack.traverse((o: any) => { if (/^bezel_/.test(o.name)) covers.push(o); });
    camera.position.set(2.2, 1.5, -1.9); controls.target.set(0, 1.1, -0.3); controls.update();
    const fit = () => { const w = host.clientWidth || 1, h = host.clientHeight || 1; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    fit(); const ro = new ResizeObserver(fit); ro.observe(host);
    const leds: THREE.MeshStandardMaterial[] = rack.userData.animatedLeds;
    const explodeItems: any[] = rack.userData.items; const doors: any = rack.userData.doors;

    // Name tags for the exploded view: one canvas-text sprite per item, parented to the item's group so it
    // travels with it; faded in by setExplode once the stack has separated enough to read.
    const KIND_NAME: Record<string, string> = { server: 'Server', blank: 'Blanking panel', switch: 'Switch', patch: 'Patch panel', cablemgr: 'Cable manager', hpdu: 'Horizontal PDU', pdu: 'Vertical PDU', nuc: 'NUC shelf' };
    const makeLabel = (text: string) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 80; const g2 = c.getContext('2d')!;
      g2.fillStyle = 'rgba(12,13,16,0.86)'; g2.beginPath(); g2.roundRect(2, 2, 508, 76, 14); g2.fill();
      g2.strokeStyle = 'rgba(255,255,255,0.22)'; g2.lineWidth = 2; g2.stroke();
      g2.fillStyle = '#eef0f4'; g2.font = '600 32px "Helvetica Neue", Helvetica, Arial, sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(text, 256, 42);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, opacity: 0 }));
      sp.scale.set(0.42, 0.066, 1); sp.renderOrder = 10; sp.visible = false; sp.userData.thermalSkip = true;
      return sp;
    };
    const labels: THREE.Sprite[] = explodeItems.map((it) => {
      const sp = makeLabel(`${KIND_NAME[it.kind] ?? it.kind} · ${it.label}`);
      const b = it.bbox, cz = (b.min.z + b.max.z) / 2;
      if (it.kind === 'pdu') sp.position.set((b.min.x + b.max.x) / 2, b.max.y + 0.06, cz); // above the vertical PDU
      else sp.position.set(b.max.x + 0.26, (b.min.y + b.max.y) / 2, b.max.z + 0.02); // off the item's right edge
      it.group.add(sp); return sp;
    });

    // Front door: closed by default, click to swing it open (click again to close). Combines with the
    // exploded-view slider via `updateDoorTargets` — either one can hold the door open.
    let explodeVal = 0, doorOpen = false;
    const updateDoorTargets = () => {
      if (!doors) return;
      const frontAmt = Math.max(explodeVal, doorOpen ? 1 : 0);
      doors.hingeTargetY = doors.hingeClosedY + frontAmt * 4.27; // swings anticlockwise (viewed from above) away from the rack
      doors.rdTargetZ = doors.rdClosedZ - explodeVal * 0.5;
    };
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const setNdcFromEvent = (e: PointerEvent) => { const r = renderer.domElement.getBoundingClientRect(); pointerNdc.x = ((e.clientX - r.left) / r.width) * 2 - 1; pointerNdc.y = -((e.clientY - r.top) / r.height) * 2 + 1; };
    const hitsFrontDoor = (e: PointerEvent) => { if (!doors) return false; setNdcFromEvent(e); raycaster.setFromCamera(pointerNdc, camera); return raycaster.intersectObject(doors.hinge, true).length > 0; };
    let downX = 0, downY = 0, downT = 0;
    const onPointerDown = (e: PointerEvent) => { downX = e.clientX; downY = e.clientY; downT = performance.now(); };
    const onPointerUp = (e: PointerEvent) => {
      const dragged = Math.hypot(e.clientX - downX, e.clientY - downY) > 6 || performance.now() - downT > 600;
      if (dragged) return; // an orbit drag, not a click
      if (hitsFrontDoor(e)) { doorOpen = !doorOpen; updateDoorTargets(); }
    };
    const onPointerMove = (e: PointerEvent) => { renderer.domElement.style.cursor = hitsFrontDoor(e) ? 'pointer' : ''; };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    let raf = 0; const t0 = performance.now();
    const loop = () => {
      const t = (performance.now() - t0) / 1000; heat.userData.tick(t, renderer.getPixelRatio()); vapor.userData.tick(t, renderer.getPixelRatio()); thermal.tick(t);
      if (!thermal.active) leds.forEach((m, i) => { const b = Math.sin(t * 11 + i * 1.17) + Math.sin(t * 5.3 + i * 2.5); m.emissiveIntensity = b > 0.7 ? 3.2 : 1.2; });
      explodeItems.forEach((it) => it.group.position.lerp(it.target, 0.14));
      if (doors) {
        if (doors.hingeTargetY !== undefined) doors.hinge.rotation.y += (doors.hingeTargetY - doors.hinge.rotation.y) * 0.045;
        if (doors.rdTargetZ !== undefined) doors.rd.position.z += (doors.rdTargetZ - doors.rd.position.z) * 0.045;
      }
      controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    apiRef.current = {
      setThermal(on: boolean) { if (on) { heat.visible = false; vapor.visible = false; renderer.toneMapping = THREE.NoToneMapping; } else { heat.visible = apiRef.current.airflow; vapor.visible = apiRef.current.airflow; renderer.toneMapping = THREE.ACESFilmicToneMapping; } thermal.set(on); },
      setCovers(on: boolean) { covers.forEach((m) => (m.visible = on)); },
      setAirflow(on: boolean) { apiRef.current.airflow = on; if (!thermal.active) { heat.visible = on; vapor.visible = on; } },
      setTemps(a: number[]) { thermal.setTemps(a); },
      setExplode(t: number) {
        explodeItems.forEach((it) => it.target.set(it.ex * t, it.ey * t, it.ez * t));
        (rack.userData.cableLikeObjects as THREE.Object3D[]).forEach((o) => { o.visible = t < 0.04; });
        const labelAlpha = Math.min(1, Math.max(0, (t - 0.25) / 0.35)); // names appear once the stack has opened up
        labels.forEach((sp) => { sp.visible = labelAlpha > 0; (sp.material as THREE.SpriteMaterial).opacity = labelAlpha; });
        explodeVal = t; updateDoorTargets();
      },
      setDoorOpen(on: boolean) { doorOpen = on; updateDoorTargets(); },
      airflow: showAirflow,
      async exportGLB() { const blob: Blob = await new Promise((res) => new GLTFExporter().parse(rack, (r) => res(new Blob([r as ArrayBuffer], { type: 'model/gltf-binary' })), () => {}, { binary: true })); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'server-rack-42u.glb'; a.click(); },
      slots: rack.userData.slots as Slot[], temps: thermal.temps as number[],
      items: explodeItems.map((it) => ({ kind: it.kind, label: it.label })),
    };
    onItems?.(apiRef.current.items);
    if (explode) apiRef.current.setExplode(explode);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.dispose(); host.removeChild(renderer.domElement); apiRef.current = null;
    };
  }, []);

  useEffect(() => { apiRef.current?.setThermal(v === 'thermal'); }, [v]);
  useEffect(() => { apiRef.current?.setCovers(showCovers); }, [showCovers]);
  useEffect(() => { apiRef.current?.setExplode(explode); }, [explode]);
  useEffect(() => { apiRef.current?.setAirflow(showAirflow); }, [showAirflow]);
  useEffect(() => { if (temps) apiRef.current?.setTemps(temps); }, [temps]);

  const thermalOn = v === 'thermal';
  const hottest = (() => { const a = apiRef.current; if (!a) return null; const t: number[] = temps ?? a.temps; const i = t.indexOf(Math.max(...t)); const s = a.slots[i]; if (!s) return null; const u = Math.round((s.y - s.h / 2 - 0.13) / 0.04445) + 1; return `HOTTEST U${u} · ${Math.round(s.h / 0.04445)}U · ${(19.5 + Math.min(1, t[i]) * 28.5).toFixed(1)} °C`; })();

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%', background: thermalOn ? '#000' : background, overflow: 'hidden', fontFamily: '"Helvetica Neue", Helvetica, sans-serif', ...style }}>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
      <div role="tablist" style={{ position: 'absolute', top: 18, left: 20, display: 'flex', gap: 2, background: 'rgba(12,13,16,0.72)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, padding: 3, backdropFilter: 'blur(8px)' }}>
        {(['visual', 'thermal'] as RackView[]).map((k) => (
          <button key={k} onClick={() => setView(k)} aria-pressed={v === k} style={{ appearance: 'none', border: 0, background: v === k ? '#eef0f4' : 'transparent', color: v === k ? '#16171b' : '#aeb3bc', font: '500 12px/1 inherit', letterSpacing: '0.04em', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}>{k === 'visual' ? 'Visual' : 'Thermal camera'}</button>
        ))}
        <button onClick={() => apiRef.current?.exportGLB()} style={{ appearance: 'none', border: 0, background: 'transparent', color: '#aeb3bc', font: '500 12px/1 inherit', letterSpacing: '0.04em', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}>Download GLB</button>
      </div>
      {thermalOn && (
        <>
          <div style={{ position: 'absolute', right: 20, top: 18, display: 'flex', flexDirection: 'column', gap: 8, color: '#eef0f4', font: '12px/1.3 "SF Mono", Menlo, monospace', letterSpacing: '0.04em', textShadow: '0 1px 2px #000' }}>
            <div>FLIR-SIM · IRONBOW · ε 0.95</div>
            <div style={{ display: 'grid', gridTemplateColumns: '14px auto', gap: 10 }}>
              <div style={{ width: 14, height: 220, border: '1px solid rgba(255,255,255,0.5)', background: 'linear-gradient(to top, #000, #210061, #9e009e, #eb471f, #ffbd00, #fffff0)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}><span>48.0 °C</span><span>38.5</span><span>29.0</span><span>19.5 °C</span></div>
            </div>
            {hottest && <div style={{ opacity: 0.8 }}>{hottest}</div>}
            <div style={{ opacity: 0.8 }}>ΔT inlet→exhaust 12.4 °C</div>
          </div>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {[['left', 'top'], ['right', 'top'], ['left', 'bottom'], ['right', 'bottom']].map(([x, y]) => (
              <div key={x + y} style={{ position: 'absolute', [x]: 60, [y]: 60, width: 36, height: 36, borderTop: y === 'top' ? '1px solid rgba(255,255,255,0.45)' : 0, borderBottom: y === 'bottom' ? '1px solid rgba(255,255,255,0.45)' : 0, borderLeft: x === 'left' ? '1px solid rgba(255,255,255,0.45)' : 0, borderRight: x === 'right' ? '1px solid rgba(255,255,255,0.45)' : 0 } as React.CSSProperties} />
            ))}
            <div style={{ position: 'absolute', left: '50%', top: '50%', width: 26, height: 1, background: 'rgba(255,255,255,0.55)', transform: 'translate(-50%,-50%)' }} />
            <div style={{ position: 'absolute', left: '50%', top: '50%', width: 1, height: 26, background: 'rgba(255,255,255,0.55)', transform: 'translate(-50%,-50%)' }} />
          </div>
        </>
      )}
      <div style={{ position: 'absolute', left: 20, bottom: 18, color: '#c9ccd3', fontSize: 12, letterSpacing: '0.04em', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <b style={{ fontSize: 14, color: '#eef0f4' }}>42U enterprise rack</b>
        <span>Drag to orbit · wheel to zoom · right-drag to pan · click the front door to open it</span>
      </div>
    </div>
  );
}
