// ServerRackTwin.tsx — React + TypeScript component (three.js 0.184) for the interactive 42U rack digital twin.
// Usage: <ServerRackTwin temps={[...]} view="visual" />  |  npm i three @types/three
// The procedural rack model, environment, airflow sim and thermal shader live under ./rack — see that folder
// for the component-by-component breakdown (servers, blanks, switches, patch panels, cable managers, PDUs, NUC).
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildRack } from './rack/buildRack';
import { buildEnvironment, ROOM_BOUNDS } from './rack/environment/Environment';
import { buildRackReplicas, LIVE_RACK_PLACEMENT } from './rack/environment/RackRow';
import { buildRackAirflowReplicas } from './rack/environment/RackAirflow';
import { buildEnvMap } from './rack/environment/EnvironmentMap';
import { buildCoolingFloor } from './rack/environment/CoolingFloor';
import { buildHeatSim } from './rack/thermal/HeatSim';
import { buildThermalView } from './rack/thermal/ThermalView';
import { buildCoolingVapor } from './rack/thermal/CoolingVapor';
import { buildLiquidLoop } from './rack/liquid/LiquidLoop';
import { createLiquidLoopSim, type LoopState } from './rack/liquid/LiquidLoopSim';
import { LiquidHud } from './rack/liquid/LiquidHud';
import { IssuePanel } from './rack/issues/IssuePanel';
import { DEMO_ISSUES, LIVE_RACK_ID, RACK_BY_ID } from './rack/issues/issues';
import { buildRackFocus, pickRackId, rackFocusPose } from './rack/issues/RackFocus';
import { createReseatAnimation } from './rack/cabling/reseatAnimation';
import { applySilhouetteShadows, disableShadows, configureKeyShadow } from './rack/shadowPolicy';
import type { Slot, RackView, ServerRackTwinProps, SwitchFixPhase } from './rack/types';

export type { Slot, RackView, ServerRackTwinProps, RackIssue, RackInfo, IssueCategory, IssueSeverity, SwitchFixPhase } from './rack/types';
export { DEMO_ISSUES, RACKS, LIVE_RACK_ID, FAULT_CABLE_ISSUE_ID } from './rack/issues/issues';
export { requestRemediation } from './rack/issues/remediationApi';
export { Playground } from './rack/Playground';

/* ------------------------------------------------------------------ component ------------------------------------------------------------------ */
export default function ServerRackTwin({ temps, view, onViewChange, showCovers = true, showAirflow = true, explode = 0, onItems, issues = DEMO_ISSUES, showIssues = true, selectedRack, onSelectRack, switchFix = 'idle', onSwitchFixDone, background = '#16171b', className, style }: ServerRackTwinProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [internalView, setInternalView] = useState<RackView>('visual');
  const [liquidState, setLiquidState] = useState<LoopState | null>(null);
  const v = view ?? internalView;
  const setView = (nv: RackView) => { setInternalView(nv); onViewChange?.(nv); };
  // Rack selection: controlled via `selectedRack` when provided, otherwise internal. Picks made inside the 3D
  // scene come back through `pickRef` so the render-loop closure never has to see React state.
  const [internalSel, setInternalSel] = useState<string | null>(null);
  const [openIssueId, setOpenIssueId] = useState<string | null>(null);
  const sel = selectedRack !== undefined ? selectedRack : internalSel;
  const selectRack = (id: string | null) => {
    setInternalSel(id); onSelectRack?.(id);
    // An open log excerpt only makes sense while its own rack is the selected one.
    setOpenIssueId((open) => (open && id && issues.find((i) => i.id === open)?.rackId === id ? open : null));
  };
  const pickRef = useRef(selectRack); pickRef.current = selectRack;
  const issuesRef = useRef(issues); issuesRef.current = issues;
  const fixDoneRef = useRef(onSwitchFixDone); fixDoneRef.current = onSwitchFixDone;

  useEffect(() => {
    const host = hostRef.current; if (!host) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 500);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.minDistance = 0.45; controls.maxDistance = 15;
    controls.minPolarAngle = 0.08; controls.maxPolarAngle = Math.PI / 2 - 0.04; // keep the lens above the floor
    // Keep the orbit target inside the room so pan + zoom cannot walk the camera through a wall.
    const clampToRoom = (v: THREE.Vector3, pad = 0.2) => {
      v.x = THREE.MathUtils.clamp(v.x, ROOM_BOUNDS.minX + pad, ROOM_BOUNDS.maxX - pad);
      v.y = THREE.MathUtils.clamp(v.y, ROOM_BOUNDS.minY, ROOM_BOUNDS.maxY - pad);
      v.z = THREE.MathUtils.clamp(v.z, ROOM_BOUNDS.minZ + pad, ROOM_BOUNDS.maxZ - pad);
      return v;
    };
    const hemi = new THREE.HemisphereLight(0xdfe6f2, 0x2a2d34, 0.55); scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(3.5, 5, 4); configureKeyShadow(key, ROOM_BOUNDS); scene.add(key);
    const fill = new THREE.DirectionalLight(0xcfd9ff, 0.5); fill.position.set(-4, 3, -2); scene.add(fill);
    const front = new THREE.DirectionalLight(0xe6ecff, 1.2); front.position.set(-1.5, 2.5, 5); scene.add(front);
    scene.environment = buildEnvMap(THREE, renderer);
    scene.fog = new THREE.FogExp2(0x1a1c20, 0.035);
    const rack = buildRack(THREE); applySilhouetteShadows(rack); scene.add(rack);
    // Two full rows of ten baked replicas of this rack (five facing front, five behind turned 180° so the rows
    // stand back-to-back). Baked while the interactive rack is still sitting at the origin (identity transform)
    // so the replica geometry lines up — it's picked up and moved to LIVE_RACK_PLACEMENT afterwards, and a
    // replica now fills the centre slot it used to occupy, same as every other slot in the row.
    const replicas = buildRackReplicas(THREE, rack); disableShadows(replicas); scene.add(replicas);
    // Rack footprint (still at the origin) — the selection outline is sized from it and re-posed onto whichever rack is picked.
    const rackBox = new THREE.Box3().setFromObject(rack);
    scene.add(buildEnvironment(THREE));
    // Selection outline + per-rack alarm badges for the issues panel; rack picking maps clicks back to rack ids.
    const focus = buildRackFocus(THREE, rackBox, issuesRef.current); scene.add(focus);
    // Heat simulation + cold-air vapour for the ten racks in the rows — same intake/exhaust particle sim and
    // floor grille as the interactive rack, instanced at each rack's placement (including the now-dummy centre slot).
    const airflowReplicas = buildRackAirflowReplicas(THREE, rack.userData.slots as Slot[]); scene.add(airflowReplicas);
    // Pick the interactive rack up out of the row and place it elsewhere in the hall.
    rack.position.set(LIVE_RACK_PLACEMENT.x, 0, LIVE_RACK_PLACEMENT.z); rack.rotation.y = LIVE_RACK_PLACEMENT.rotY;
    // Its own cooling floor grille, intake/exhaust particle sim and cold-air vapour move with it.
    const liveEnv = new THREE.Group(); liveEnv.name = 'live_rack_env';
    liveEnv.position.set(LIVE_RACK_PLACEMENT.x, 0, LIVE_RACK_PLACEMENT.z); liveEnv.rotation.y = LIVE_RACK_PLACEMENT.rotY;
    scene.add(liveEnv);
    liveEnv.add(buildCoolingFloor(THREE));
    const heat = buildHeatSim(THREE, rack.userData.slots as Slot[]); liveEnv.add(heat);
    const vapor = buildCoolingVapor(THREE); liveEnv.add(vapor);
    const thermal = buildThermalView(THREE, scene, rack, rack.userData.slots as Slot[], LIVE_RACK_PLACEMENT.x, LIVE_RACK_PLACEMENT.z, LIVE_RACK_PLACEMENT.rotY);
    // Liquid-cooling mode: overhead supply/return headers along both rows, an end-of-row CDU per row, and rack
    // manifolds + per-server hoses with live coolant flow on EVERY rack (not just this one), driven by the
    // hydraulic loop simulation (which shares the per-slot load temps with the thermal camera). The interactive
    // rack's own fixtures are placed at LIVE_RACK_PLACEMENT too, wherever it's actually standing.
    const liquid = buildLiquidLoop(THREE, rack.userData.slots as Slot[], undefined, LIVE_RACK_PLACEMENT.x, LIVE_RACK_PLACEMENT.z, LIVE_RACK_PLACEMENT.rotY);
    disableShadows(liquid); applySilhouetteShadows(liquid); scene.add(liquid);
    const loopSim = createLiquidLoopSim(rack.userData.slots as Slot[], thermal.temps as number[]);
    liquid.userData.setTelemetry(loopSim.state().latest);
    const covers: THREE.Object3D[] = []; rack.traverse((o: any) => { if (/^bezel_/.test(o.name)) covers.push(o); });
    // Front three-quarter of the interactive rack, wherever it's actually standing now (same relative framing
    // as the old "front three-quarter of row A" view, rotated to match the rack's new orientation).
    camera.position.set(LIVE_RACK_PLACEMENT.x + 2.8, 1.9, LIVE_RACK_PLACEMENT.z - 2.9);
    controls.target.set(LIVE_RACK_PLACEMENT.x - 0.2, 1.0, LIVE_RACK_PLACEMENT.z);
    controls.update();
    const fit = () => { const w = host.clientWidth || 1, h = host.clientHeight || 1; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    fit(); const ro = new ResizeObserver(fit); ro.observe(host);
    const leds: THREE.MeshStandardMaterial[] = rack.userData.animatedLeds;
    const faultCable: any = rack.userData.faultCable;
    const reseat = faultCable ? createReseatAnimation(THREE, faultCable) : null;
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

    // Labels are created lazily the first time explode > 0 so idle sessions skip 512px canvases.
    let labels: THREE.Sprite[] | null = null;
    const ensureLabels = () => {
      if (labels) return labels;
      labels = explodeItems.map((it) => {
        const sp = makeLabel(`${KIND_NAME[it.kind] ?? it.kind} · ${it.label}`);
        const b = it.bbox, cz = (b.min.z + b.max.z) / 2;
        if (it.kind === 'pdu') sp.position.set((b.min.x + b.max.x) / 2, b.max.y + 0.06, cz);
        else sp.position.set(b.max.x + 0.26, (b.min.y + b.max.y) / 2, b.max.z + 0.02);
        it.group.add(sp); return sp;
      });
      return labels;
    };

    // Front door: closed by default, click to swing it open (click again to close). Combines with the
    // exploded-view slider via `updateDoorTargets` — either one can hold the door open.
    let explodeVal = 0, doorOpen = false, liquidMode = false;
    const updateDoorTargets = () => {
      if (!doors) return;
      const frontAmt = Math.max(explodeVal, doorOpen ? 1 : 0);
      doors.hingeTargetY = doors.hingeClosedY + frontAmt * 4.27; // swings anticlockwise (viewed from above) away from the rack
      doors.rdTargetZ = doors.rdClosedZ - Math.max(explodeVal, liquidMode ? 1 : 0) * 0.5; // rear door also slides off in liquid mode to expose the manifolds
    };
    // Camera fly-to (rack focus, and liquid mode's rear three-quarter view where the manifolds and CDU read). The
    // camera travels a quadratic arc whose apex sits above the rack tops, so a move between racks lifts over the
    // rows instead of cutting straight through them, and both position and orbit target ease in/out over a fixed
    // duration. Any orbit drag cancels it.
    const ARC_CLEAR_Y = 3.4; // rack tops are ~2.1 m; overhead coolant headers sit below this too
    let fly: { p0: THREE.Vector3; p1: THREE.Vector3; p2: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3; start: number; dur: number } | null = null;
    const flyTo = (pos: [number, number, number], tgt: [number, number, number]) => {
      const p0 = camera.position.clone(), p2 = clampToRoom(new THREE.Vector3(...pos));
      const t0 = controls.target.clone(), t1 = clampToRoom(new THREE.Vector3(...tgt), 0.35);
      const dist = p0.distanceTo(p2);
      // Arc control point: midway in plan, lifted so the curve's apex clears the rack tops. A short hop (same rack,
      // small nudge) stays low; a cross-hall move rises proportionally, capped below the ceiling by clampToRoom.
      const hop = dist < 1.5; // small nudge around the same rack: no need to climb
      const apexY = hop ? Math.max(p0.y, p2.y) + 0.15 : Math.max(p0.y, p2.y, ARC_CLEAR_Y) + Math.min(1.0, dist * 0.08);
      const p1 = clampToRoom(new THREE.Vector3((p0.x + p2.x) / 2, 2 * apexY - (p0.y + p2.y) / 2, (p0.z + p2.z) / 2)); // Bezier midpoint == apexY
      const dur = THREE.MathUtils.clamp(0.9 + dist * 0.18, 1.0, 2.4);
      fly = { p0, p1, p2, t0, t1, start: performance.now() / 1000, dur };
    };
    const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
    const bez = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, u: number, out: THREE.Vector3) => {
      const w0 = (1 - u) * (1 - u), w1 = 2 * (1 - u) * u, w2 = u * u;
      return out.set(a.x * w0 + b.x * w1 + c.x * w2, a.y * w0 + b.y * w1 + c.y * w2, a.z * w0 + b.z * w1 + c.z * w2);
    };
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const setNdcFromEvent = (e: PointerEvent) => { const r = renderer.domElement.getBoundingClientRect(); pointerNdc.x = ((e.clientX - r.left) / r.width) * 2 - 1; pointerNdc.y = -((e.clientY - r.top) / r.height) * 2 + 1; };
    const hitsFrontDoor = (e: PointerEvent) => { if (!doors) return false; setNdcFromEvent(e); raycaster.setFromCamera(pointerNdc, camera); return raycaster.intersectObject(doors.hinge, true).length > 0; };
    // Which rack (if any) is under the pointer — any of the ten replicas, the interactive rack, or an alarm badge.
    const rackUnderPointer = (e: PointerEvent) => { setNdcFromEvent(e); raycaster.setFromCamera(pointerNdc, camera); return pickRackId(raycaster, focus, replicas, rack, LIVE_RACK_ID) as string | null; };
    // Select a rack: outline it and (optionally) fly the camera to its front three-quarter.
    const selectRackInScene = (id: string | null, flyCamera: boolean) => {
      focus.userData.select(id);
      const info = id ? RACK_BY_ID[id] : null;
      if (info && flyCamera) { const p = rackFocusPose(info); flyTo(p.pos as [number, number, number], p.tgt as [number, number, number]); }
    };
    let downX = 0, downY = 0, downT = 0;
    const onPointerDown = (e: PointerEvent) => { downX = e.clientX; downY = e.clientY; downT = performance.now(); fly = null; };
    const onPointerUp = (e: PointerEvent) => {
      const dragged = Math.hypot(e.clientX - downX, e.clientY - downY) > 6 || performance.now() - downT > 600;
      if (dragged) return; // an orbit drag, not a click
      if (hitsFrontDoor(e)) { doorOpen = !doorOpen; updateDoorTargets(); return; }
      const id = rackUnderPointer(e);
      if (id) pickRef.current(id); // React owns the selection; it flows back down through api.selectRack
    };
    let lastHoverMs = 0;
    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverMs < 80) return;
      lastHoverMs = now;
      renderer.domElement.style.cursor = hitsFrontDoor(e) || rackUnderPointer(e) ? 'pointer' : '';
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    let raf = 0; const t0 = performance.now(); let lastT = 0; let liquidFrame = 0;
    const loop = () => {
      const t = (performance.now() - t0) / 1000; const dt = Math.min(0.25, t - lastT); lastT = t;
      heat.userData.tick(t, renderer.getPixelRatio()); vapor.userData.tick(t, renderer.getPixelRatio()); airflowReplicas.userData.tick(t, renderer.getPixelRatio()); thermal.tick(t);
      if (liquidMode) {
        const loopState = loopSim.step(dt); liquid.userData.setTelemetry(loopState.latest);
        // Update coolant particles every other frame — still smooth enough when liquid view is active.
        if ((++liquidFrame & 1) === 0) liquid.userData.tick(t, renderer.getPixelRatio());
      }
      focus.userData.tick(t);
      if (!thermal.active) leds.forEach((m, i) => { const b = Math.sin(t * 11 + i * 1.17) + Math.sin(t * 5.3 + i * 2.5); m.emissiveIntensity = b > 0.7 ? 3.2 : 1.2; });
      // Disconnected patch cable: sharp red 'beep' (fast rise, quick decay) rather than a soft sine, so it reads as an alarm.
      if (reseat) { reseat.tick(t); if (reseat.pulsing) { const k = Math.pow(0.5 + 0.5 * Math.sin(t * 4.2), 3); faultCable.material.emissiveIntensity = 0.6 + 2.6 * k; } }
      explodeItems.forEach((it) => it.group.position.lerp(it.target, 0.14));
      if (fly) {
        const u = Math.min(1, (performance.now() / 1000 - fly.start) / fly.dur), e = easeInOut(u);
        bez(fly.p0, fly.p1, fly.p2, e, camera.position);
        controls.target.lerpVectors(fly.t0, fly.t1, e);
        if (u >= 1) fly = null;
      }
      if (doors) {
        if (doors.hingeTargetY !== undefined) doors.hinge.rotation.y += (doors.hingeTargetY - doors.hinge.rotation.y) * 0.045;
        if (doors.rdTargetZ !== undefined) doors.rd.position.z += (doors.rdTargetZ - doors.rd.position.z) * 0.045;
      }
      controls.update();
      clampToRoom(camera.position); clampToRoom(controls.target, 0.35);
      renderer.render(scene, camera); raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    apiRef.current = {
      // One entry point for the three views. Air-side effects (intake streaks, exhaust plumes, floor vapour) only
      // make sense in the visual/air-cooled view; the liquid view swaps them for the coolant loop.
      setMode(mode: RackView) {
        apiRef.current.mode = mode;
        const air = mode === 'visual' && apiRef.current.airflow;
        heat.visible = air; vapor.visible = air; airflowReplicas.userData.setAirVisible(air); liquid.visible = mode === 'liquid';
        renderer.toneMapping = mode === 'thermal' ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
        thermal.set(mode === 'thermal');
        const wasLiquid = liquidMode; liquidMode = mode === 'liquid'; updateDoorTargets();
        if (doors) doors.rd.visible = !liquidMode; // rear door removed for service in the liquid view (as in the reference rigs)
        if (liquidMode && !wasLiquid) flyTo([4.4, 2.9, -1.9], [0.2, 1.3, -1.0]); // looking down the hot aisle from the CDU end: both rows' headers, our rack's manifolds
      },
      setCovers(on: boolean) { covers.forEach((m) => (m.visible = on)); },
      setAirflow(on: boolean) { apiRef.current.airflow = on; const air = apiRef.current.mode === 'visual' && on; heat.visible = air; vapor.visible = air; airflowReplicas.userData.setAirVisible(air); },
      setTemps(a: number[]) { thermal.setTemps(a); loopSim.setLoad(a); },
      loopState() { return loopSim.state(); },
      /** Jump the camera (no animation) — used by tooling/screenshots; `flyTo` is the animated version. */
      setCamera(pos: [number, number, number], tgt: [number, number, number]) { fly = null; camera.position.set(...pos); controls.target.set(...tgt); clampToRoom(camera.position); clampToRoom(controls.target, 0.35); controls.update(); },
      flyTo,
      setExplode(t: number) {
        explodeItems.forEach((it) => it.target.set(it.ex * t, it.ey * t, it.ez * t));
        liquid.userData.setExploded(t);
        (rack.userData.cableLikeObjects as THREE.Object3D[]).forEach((o) => { o.visible = t < 0.04; });
        const labelAlpha = Math.min(1, Math.max(0, (t - 0.25) / 0.35)); // names appear once the stack has opened up
        if (t > 0.01) ensureLabels().forEach((sp) => { sp.visible = labelAlpha > 0; (sp.material as THREE.SpriteMaterial).opacity = labelAlpha; });
        explodeVal = t; updateDoorTargets();
      },
      setDoorOpen(on: boolean) { doorOpen = on; updateDoorTargets(); },
      /**
       * Remediation of the unseated patch cable. 'requested': open the door and fly to a close view of the switch
       * port (camera stays on the rack's right so the swinging door never crosses the lens). 'confirmed': play the
       * staged reseat and report completion. 'done': seated immediately (e.g. mounted after the fix). 'idle': fault live.
       */
      setSwitchFix(phase: SwitchFixPhase) {
        if (!faultCable || !reseat) return;
        if (phase === 'idle') { reseat.reset(); return; }
        if (phase === 'done') { reseat.seatNow(); return; }
        if (phase === 'requested' || phase === 'confirmed') {
          doorOpen = true; updateDoorTargets(); pickRef.current(LIVE_RACK_ID);
          const tgt = rack.localToWorld(new THREE.Vector3(faultCable.port.x, faultCable.port.y, faultCable.port.z));
          const fwd = new THREE.Vector3(0, 0, 1).transformDirection(rack.matrixWorld), right = new THREE.Vector3(1, 0, 0).transformDirection(rack.matrixWorld);
          const pos = tgt.clone().addScaledVector(fwd, 0.62).addScaledVector(right, 0.22); pos.y += 0.07;
          flyTo(pos.toArray() as [number, number, number], tgt.toArray() as [number, number, number]);
        }
        if (phase === 'confirmed') reseat.start((performance.now() - t0) / 1000 + 0.9, () => fixDoneRef.current?.()); // let the door finish opening first
      },
      switchFixState() { return reseat ? reseat.state : 'none'; },
      /** Outline rack `id` (null clears) and, when `flyCamera`, fly to its front three-quarter. */
      selectRack(id: string | null, flyCamera = true) { selectRackInScene(id, flyCamera); },
      /** Replace the open-issue list — rebuilds the alarm badges floating over the racks. */
      setIssues(list: any[]) { focus.userData.setIssues(list); },
      selectedRack() { return focus.userData.selectedId as string | null; },
      cameraPos() { return camera.position.toArray(); },
      airflow: showAirflow, mode: 'visual' as RackView,
      slots: rack.userData.slots as Slot[], temps: thermal.temps as number[],
      items: explodeItems.map((it) => ({ kind: it.kind, label: it.label })),
    };
    onItems?.(apiRef.current.items);
    if (import.meta.env.DEV) (window as any).__rackTwin = apiRef.current; // dev-only hook for tooling / screenshot scripts
    if (explode) apiRef.current.setExplode(explode);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.dispose(); host.removeChild(renderer.domElement); apiRef.current = null;
    };
  }, []);

  useEffect(() => { apiRef.current?.setMode(v); }, [v]);
  // The loop sim runs inside the render loop at 1 Hz; while the liquid view is up, mirror its state into React at
  // the same cadence so the HUD charts advance without re-rendering on every animation frame.
  useEffect(() => {
    if (v !== 'liquid') return;
    const pull = () => { const a = apiRef.current; if (a) setLiquidState(a.loopState()); };
    pull(); const id = window.setInterval(pull, 1000);
    return () => window.clearInterval(id);
  }, [v]);
  useEffect(() => { apiRef.current?.setCovers(showCovers); }, [showCovers]);
  useEffect(() => { apiRef.current?.setExplode(explode); }, [explode]);
  useEffect(() => { apiRef.current?.setAirflow(showAirflow); }, [showAirflow]);
  useEffect(() => { if (temps) apiRef.current?.setTemps(temps); }, [temps]);
  useEffect(() => { apiRef.current?.selectRack(sel, true); }, [sel]);
  useEffect(() => { apiRef.current?.setSwitchFix(switchFix); }, [switchFix]);
  useEffect(() => { apiRef.current?.setIssues(issues); }, [issues]);

  const thermalOn = v === 'thermal', liquidOn = v === 'liquid';
  const VIEW_LABEL: Record<RackView, string> = { visual: 'Visual', thermal: 'Thermal camera', liquid: 'Liquid cooling' };
  const hottest = (() => { const a = apiRef.current; if (!a) return null; const t: number[] = temps ?? a.temps; const i = t.indexOf(Math.max(...t)); const s = a.slots[i]; if (!s) return null; const u = Math.round((s.y - s.h / 2 - 0.13) / 0.04445) + 1; return `HOTTEST U${u} · ${Math.round(s.h / 0.04445)}U · ${(19.5 + Math.min(1, t[i]) * 28.5).toFixed(1)} °C`; })();

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%', background: thermalOn ? '#000' : liquidOn ? '#0f1318' : background, overflow: 'hidden', fontFamily: '"Helvetica Neue", Helvetica, sans-serif', ...style }}>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
      <div role="tablist" style={{ position: 'absolute', top: 18, left: 20, display: 'flex', gap: 2, background: 'rgba(12,13,16,0.72)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, padding: 3, backdropFilter: 'blur(8px)' }}>
        {(['visual', 'thermal', 'liquid'] as RackView[]).map((k) => (
          <button key={k} onClick={() => setView(k)} aria-pressed={v === k} style={{ appearance: 'none', border: 0, background: v === k ? '#eef0f4' : 'transparent', color: v === k ? '#16171b' : '#aeb3bc', font: '500 12px/1 inherit', letterSpacing: '0.04em', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}>{VIEW_LABEL[k]}</button>
        ))}
      </div>
      {thermalOn && (
        <>
          <div style={{ position: 'absolute', right: 20, top: 18, display: 'flex', flexDirection: 'column', gap: 8, color: '#eef0f4', font: '12px/1.3 "SF Mono", Menlo, monospace', letterSpacing: '0.04em', textShadow: '0 1px 2px #000' }}>
            <div>FLIR-SIM · RAINBOW · ε 0.95</div>
            <div style={{ display: 'grid', gridTemplateColumns: '14px auto', gap: 10 }}>
              <div style={{ width: 14, height: 220, border: '1px solid rgba(255,255,255,0.5)', background: 'linear-gradient(to top, #000005, #0d008c, #008cf2, #00bf40, #d9eb00, #ff7300, #e60d0d, #fff2d9)' }} />
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
      {liquidOn && <LiquidHud state={liquidState} />}
      {showIssues && <IssuePanel issues={issues} selectedRackId={sel} openIssueId={openIssueId} onSelectRack={selectRack} onOpenIssue={setOpenIssueId} />}
      <div style={{ position: 'absolute', left: 20, bottom: 18, color: '#c9ccd3', fontSize: 12, letterSpacing: '0.04em', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <b style={{ fontSize: 14, color: '#eef0f4' }}>{liquidOn ? '42U rack · direct-to-chip liquid cooled' : '42U enterprise rack'}</b>
        <span>Drag to orbit · wheel to zoom · right-drag to pan · click any rack to focus it · click the front door to open it{liquidOn && ' · orbit to the rear for the manifolds and CDU'}</span>
      </div>
    </div>
  );
}
