// ServerRackTwin.tsx — React + TypeScript component (three.js 0.184) for the interactive 42U rack digital twin.
// Usage: <ServerRackTwin temps={[...]} view="visual" />  |  npm i three @types/three
// The procedural rack model, environment, airflow sim and thermal shader live under ./rack — see that folder
// for the component-by-component breakdown (servers, blanks, switches, patch panels, cable managers, PDUs, NUC).
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildRack } from './rack/buildRack';
import { buildEnvironment, ROOM_BOUNDS } from './rack/environment/Environment';
import { buildOverheadCabling } from './rack/environment/OverheadCabling';
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
import { DEMO_ISSUES, FAULT_CABLE_ISSUE_ID, LIVE_RACK_ID, RACKS, RACK_BY_ID, leakZoneForIssue } from './rack/issues/issues';
import { buildRackFocus, pickHit, rackFocusPose } from './rack/issues/RackFocus';
import { IssueDetail } from './rack/issues/IssueDetail';
import { placeDetail, type DetailPlace } from './rack/issues/detailPlacement';
import { createReseatAnimation } from './rack/cabling/reseatAnimation';
import { buildRemediationScene } from './rack/issues/RemediationScene';
import { buildTechnician } from './rack/people/Technician';
import { buildPath, buildPathWest, nearestPatrolIndex, PATROL, standPoint, TECH_SPAWN, WORK_STAND_M, workPoseFor } from './rack/people/paths';
import { buildStops, createDriveController, NOC_STOP } from './rack/people/corridors';
import { NocConsole, type NocData } from './rack/environment/NocConsole';
import { buildPowerPlant } from './rack/environment/PowerPlant';
import { buildLifeSafety } from './rack/environment/LifeSafety';
import { buildLeakDetection } from './rack/environment/LeakDetection';
import { createPowerEvent, type PowerPhase } from './rack/power/PowerEvent';
import { buildNocWall } from './rack/environment/NocWall';
import { createAmbience, type Ambience } from './rack/audio/Ambience';
import { ledIntensity } from './rack/ledPatterns';
import { applySilhouetteShadows, disableShadows, configureKeyShadow } from './rack/shadowPolicy';
import { mergeItemStatics } from './rack/mergeStatics';
import { REMEDIATION_IDLE, DEFAULT_SCENE_LAYERS, SCENE_LAYER_DEFS, type Slot, type RackView, type ServerRackTwinProps, type RemediationState, type SceneLayers } from './rack/types';

export type { Slot, RackView, ServerRackTwinProps, RackIssue, RackInfo, IssueCategory, IssueSeverity, Remediation, RemediationAction, FruKind, RemediationPhase, RemediationState, SceneLayer, SceneLayers } from './rack/types';
export { REMEDIATION_IDLE, DEFAULT_SCENE_LAYERS, SCENE_LAYER_DEFS } from './rack/types';
export { DEMO_ISSUES, RACKS, LIVE_RACK_ID, FAULT_CABLE_ISSUE_ID } from './rack/issues/issues';
export { requestRemediation } from './rack/issues/remediationApi';
export { Playground } from './rack/Playground';

/* ------------------------------------------------------------------ component ------------------------------------------------------------------ */
export default function ServerRackTwin({ temps, view, onViewChange, showCovers = true, showAirflow = true, explode = 0, onItems, issues = DEMO_ISSUES, selectedRack, onSelectRack, remediation = REMEDIATION_IDLE, onRemediate, onRemediationDone, remediationNote = null, powerEvent = 0, onPowerPhase, layers, onLayersChange, background = '#16171b', className, style }: ServerRackTwinProps) {
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
  // Where the open issue's modal sits: beside the alarm card it was opened from (container px, see placeDetail), or
  // null for the right-edge fallback. The render loop keeps it tracking the card as the camera moves (detailRef).
  const [openPlace, setOpenPlace] = useState<DetailPlace | null>(null);
  const openIssueRef = useRef<string | null>(null); openIssueRef.current = openIssueId;
  const detailRef = useRef<HTMLElement | null>(null);
  const sel = selectedRack !== undefined ? selectedRack : internalSel;
  const selectRack = (id: string | null) => { setInternalSel(id); onSelectRack?.(id); };
  const pickRef = useRef(selectRack); pickRef.current = selectRack;
  const issuesRef = useRef(issues); issuesRef.current = issues;
  const remDoneRef = useRef(onRemediationDone); remDoneRef.current = onRemediationDone;
  // Snapshot of the issue whose modal is open: it survives being cleared from the list while its remediation sits in
  // 'done', so the closing note stays readable for a moment after the alarm card leaves the rack.
  const [openSnapshot, setOpenSnapshot] = useState<typeof issues[number] | null>(null);
  const [powerPhase, setPowerPhase] = useState<PowerPhase>('utility');
  const powerPhaseRef = useRef(onPowerPhase); powerPhaseRef.current = onPowerPhase;
  // Sound bed on/off, remembered per browser. Off by default: autoplay policy and nobody expects a page to hum.
  const [audioOn, setAudioOn] = useState<boolean>(() => { try { return localStorage.getItem('rackTwin.audio') === '1'; } catch { return false; } });
  const audioOnRef = useRef(audioOn); audioOnRef.current = audioOn;
  const ambienceRef = useRef<Ambience | null>(null);
  // Scene items: which of the hall's optional fit-out is shown. Uncontrolled state is remembered per browser; a
  // `layers` prop overrides individual items.
  const [internalLayers, setInternalLayers] = useState<SceneLayers>(() => { try { return { ...DEFAULT_SCENE_LAYERS, ...(JSON.parse(localStorage.getItem('rackTwin.layers') ?? 'null') ?? {}) }; } catch { return DEFAULT_SCENE_LAYERS; } });
  const sceneLayers: SceneLayers = { ...internalLayers, ...(layers ?? {}) };
  const layersKey = JSON.stringify(sceneLayers);
  const setLayer = (id: keyof SceneLayers, on: boolean) => {
    const next = { ...sceneLayers, [id]: on };
    setInternalLayers(next); onLayersChange?.(next);
    try { localStorage.setItem('rackTwin.layers', JSON.stringify(next)); } catch { /* private mode */ }
  };
  const [layersOpen, setLayersOpen] = useState(false);
  // Keyboard drive of the technician (arrows / WASD): null = not driving; otherwise the parked rack and any queued turn.
  const [driveUi, setDriveUi] = useState<{ stop: string | null; queued: 'left' | 'right' | null } | null>(null);
  // Technician mode: 'auto' = does the rounds / dispatched by remediations; 'manual' = waits for the arrow keys. The
  // toolbar switch and the first arrow press both set it; the scene mirrors it back through setTechModeState.
  const [techMode, setTechModeState] = useState<'auto' | 'manual'>('auto');
  // NOC desk: null = not at the desk; otherwise whether the technician has reached it yet, plus the live console numbers.
  const [nocUi, setNocUi] = useState<{ atDesk: boolean } | null>(null);
  const [nocData, setNocData] = useState<NocData | null>(null);
  const setTechMode = (m: 'auto' | 'manual') => { setTechModeState(m); apiRef.current?.setTechMode(m); };
  const layersPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!layersOpen) return;
    const onDown = (e: PointerEvent) => { if (!layersPanelRef.current?.contains(e.target as Node)) setLayersOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLayersOpen(false); };
    window.addEventListener('pointerdown', onDown); window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey); };
  }, [layersOpen]);
  useEffect(() => { ambienceRef.current?.mute(!audioOn); try { localStorage.setItem('rackTwin.audio', audioOn ? '1' : '0'); } catch { /* private mode */ } }, [audioOn]);

  useEffect(() => {
    const host = hostRef.current; if (!host) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    // Adaptive resolution: start at the device ratio (capped) and let the frame-time governor in the render loop step
    // it down toward 1.0 on a struggling GPU, back up once the frames come easily again (see `dpr` below).
    const dprCap = Math.min(window.devicePixelRatio || 1, 1.5); let dpr = dprCap;
    renderer.setPixelRatio(dpr);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    // The shadow pass is re-rendered on demand rather than every frame: every frame while something that casts is
    // moving (technician walking, a door swinging, the exploded view separating), otherwise every 2nd/3rd frame.
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 500);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.1;
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
    // With the replicas baked from the fully detailed rack, collapse the interactive rack's small decorative parts into
    // one mesh per material per item (mergeStatics.ts) — roughly halves its draw calls with no visible change.
    const mergeStats = mergeItemStatics(THREE, rack);
    const env = buildEnvironment(THREE); scene.add(env);
    // The technician waits out of sight behind the staff door until a remediation dispatches them.
    const tech = buildTechnician(THREE); tech.userData.reset(TECH_SPAWN.x, TECH_SPAWN.z); applySilhouetteShadows(tech); scene.add(tech);
    // Overhead cable-tray / wire-framing grid hung off the roof above both rows (static, merged per material).
    const overhead = buildOverheadCabling(THREE); disableShadows(overhead); scene.add(overhead);
    // Electrical plant: busway + drop cords over every rack, end-of-row PDUs, UPS bank — and the
    // scripted utility-loss event that plays through them (lighting, LCDs, LEDs, beacon).
    const power = buildPowerPlant(THREE); scene.add(power);
    // VESDA smoke detection, and the leak-detection rope under both rows' coolant headers.
    const life = buildLifeSafety(THREE); scene.add(life);
    const leak = buildLeakDetection(THREE); scene.add(leak);
    const noc = buildNocWall(THREE); scene.add(noc);
    // Sound bed (muted until the speaker toggle is on; the AudioContext itself is created on the first pointer-down).
    const ambience = createAmbience(!audioOnRef.current); ambienceRef.current = ambience;
    const NOISE_A = new THREE.Vector3(0, 1, 0), NOISE_B = new THREE.Vector3(0, 1, -2.27), NOISE_X = new THREE.Vector3(LIVE_RACK_PLACEMENT.x, 1, LIVE_RACK_PLACEMENT.z);
    let nocFrame = 0, nocDrawnAt = -10;
    const applyLeakZones = (list: { remediation?: { action: string }; rackId: string }[]) => {
      const wet = new Set<number>(); for (const i of list) { const z = leakZoneForIssue(i as any); if (z) wet.add(z); }
      leak.userData.setZoneWet(1, wet.has(1)); leak.userData.setZoneWet(2, wet.has(2));
    };
    applyLeakZones(issuesRef.current);
    const powerEvt = createPowerEvent({ onPhase: (p) => { setPowerPhase(p); powerPhaseRef.current?.(p); if (p === 'utility_lost') ambience.chirp('alarm'); if (p === 'generator' || p === 'utility_restored') ambience.chirp('transfer'); } });
    const BASE_LIGHT = { hemi: hemi.intensity, key: key.intensity, fill: fill.intensity, front: front.intensity, lamp: env.userData.lamps.material.emissiveIntensity };
    const applyPower = () => {
      const { lightLevel: k, emergency, source, upsMode, upsPct, upsMin, genRunning } = powerEvt.info;
      const kk = 0.12 + 0.88 * k; // never fully black: emergency lighting + LED glow keep the hall legible
      hemi.intensity = BASE_LIGHT.hemi * kk; key.intensity = BASE_LIGHT.key * kk; fill.intensity = BASE_LIGHT.fill * kk; front.intensity = BASE_LIGHT.front * kk;
      env.userData.lamps.material.emissiveIntensity = BASE_LIGHT.lamp * k;
      env.userData.emergency.emissiveIntensity = 2.6 * emergency;
      power.userData.setState({ source, upsMode, upsPct, upsMin, genRunning });
    };
    // On-rack alarm plates/beacons + door-hairline selection for the issues panel; rack picking maps clicks back to rack ids.
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
    // On-rack remediation acts (FRU proxy swaps, console strips, the hi-fi cable reseat) for whichever issue is being fixed.
    const remScene = buildRemediationScene(THREE, focus, { reseat }); scene.add(remScene);
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

    // Front door: open by default (and re-forced open whenever this rack is selected/focused — see
    // selectRackInScene) so its cabling and hardware are always visible, matching the data-center rows' racks
    // (baked open — see RackRow.ts). Still click-toggleable for anyone who wants the closed look. Combines with
    // the exploded-view slider via `updateDoorTargets` — either one can hold the door open.
    let explodeVal = 0, doorOpen = true, liquidMode = false;
    const updateDoorTargets = () => {
      if (!doors) return;
      const frontAmt = Math.max(explodeVal, doorOpen ? 1 : 0);
      doors.hingeTargetY = doors.hingeClosedY + frontAmt * 4.27; // swings anticlockwise (viewed from above) away from the rack
      doors.rdTargetZ = doors.rdClosedZ - Math.max(explodeVal, liquidMode ? 1 : 0) * 0.5; // rear door also slides off in liquid mode to expose the manifolds
    };
    updateDoorTargets();
    if (doors) doors.hinge.rotation.y = doors.hingeTargetY; // start open immediately, no swing-in animation on load
    // Camera fly-to (rack focus, and liquid mode's rear three-quarter view where the manifolds and CDU read). The
    // camera travels a quadratic arc whose apex sits above the rack tops, so a move between racks lifts over the
    // rows instead of cutting straight through them, and both position and orbit target ease in/out over a fixed
    // duration. Any orbit drag cancels it.
    const ARC_CLEAR_Y = 4.1; // rack tops are ~2.1 m, coolant headers ~2.5 m, and the overhead cable-tray frame tops out at ~3.7 m
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
      const dur = THREE.MathUtils.clamp(0.7 + dist * 0.14, 0.8, 1.8);
      fly = { p0, p1, p2, t0, t1, start: performance.now() / 1000, dur };
    };
    const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
    const bez = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, u: number, out: THREE.Vector3) => {
      const w0 = (1 - u) * (1 - u), w1 = 2 * (1 - u) * u, w2 = u * u;
      return out.set(a.x * w0 + b.x * w1 + c.x * w2, a.y * w0 + b.y * w1 + c.y * w2, a.z * w0 + b.z * w1 + c.z * w2);
    };
    // Keyboard drive (people/corridors.ts): the arrows / WASD take the technician off the rounds and walk them along
    // the corridor network, with a chase camera behind them until the mouse takes the camera over. Wired up in the
    // technician block below; ticked in the render loop.
    let driving = false, driverWants = false, followPaused = false, lastKeyMs = 0, entered = false;
    // Esc released the parked inspection: the chase camera may run again even though the driver is still at the stop.
    let stopReleased = false;
    // Camera pose before a focus fly-in (rack select / NOC desk), so Esc can fly back out to it.
    let preFocus: { pos: [number, number, number]; tgt: [number, number, number] } | null = null;
    const rememberPreFocus = () => { if (!preFocus) preFocus = { pos: camera.position.toArray() as [number, number, number], tgt: controls.target.toArray() as [number, number, number] }; };
    // Chase camera: behind and a little over the right shoulder, looking a couple of metres down the aisle ahead at
    // chest height. Position eases slower than the look target so turns swing the view smoothly without lag on the
    // figure itself.
    const FOLLOW = { back: 3.2, up: 1.75, side: 0.5, ahead: 2.0, aheadY: 1.1, posRate: 3.2, tgtRate: 5 };
    const driver: any = createDriveController(buildStops(RACKS)); // plain-JS module: its state shape is documented in corridors.ts
    const camWant = new THREE.Vector3(), tgtWant = new THREE.Vector3();
    const followCamera = (dt: number) => {
      const yaw = tech.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw); // forward, character's right
      camWant.set(tech.position.x - fx * FOLLOW.back + rx * FOLLOW.side, FOLLOW.up, tech.position.z - fz * FOLLOW.back + rz * FOLLOW.side);
      tgtWant.set(tech.position.x + fx * FOLLOW.ahead, FOLLOW.aheadY, tech.position.z + fz * FOLLOW.ahead);
      clampToRoom(camWant); clampToRoom(tgtWant, 0.35);
      camera.position.lerp(camWant, 1 - Math.exp(-FOLLOW.posRate * dt)); controls.target.lerp(tgtWant, 1 - Math.exp(-FOLLOW.tgtRate * dt));
    };
    // Inspect shot: over the technician's right shoulder toward the rack face, so the raised hand, the device stack
    // and the alarm card all read; the figure sits on the left third of the frame.
    const inspectShot = (info: { x: number; z: number; rotY: number }, stop: { x: number; z: number; yaw: number }) => {
      const fx = Math.sin(stop.yaw), fz = Math.cos(stop.yaw), rx = -Math.cos(stop.yaw), rz = Math.sin(stop.yaw);
      const rfx = Math.sin(info.rotY), rfz = Math.cos(info.rotY); // rack forward (toward the aisle)
      return {
        pos: [stop.x - fx * 1.45 + rx * 1.05, 1.85, stop.z - fz * 1.45 + rz * 1.05] as [number, number, number],
        tgt: [info.x + rfx * 0.55 - rx * 0.1, 1.2, info.z + rfz * 0.55 - rz * 0.1] as [number, number, number],
      };
    };
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const setNdcFromEvent = (e: PointerEvent) => { const r = renderer.domElement.getBoundingClientRect(); pointerNdc.x = ((e.clientX - r.left) / r.width) * 2 - 1; pointerNdc.y = -((e.clientY - r.top) / r.height) * 2 + 1; };
    // The NOC desk and video wall are one click target: send the technician to the console. Both this and the front
    // door report the distance to their nearest hit (Infinity for a miss) so a click resolves to whichever target is
    // actually in front — a rack's alarm card must win over the NOC wall far behind it.
    const distNoc = (e: PointerEvent) => { if (!noc.visible) return Infinity; setNdcFromEvent(e); raycaster.setFromCamera(pointerNdc, camera); const h = raycaster.intersectObject(noc, true); return h.length ? h[0].distance : Infinity; };
    const distFrontDoor = (e: PointerEvent) => { if (!doors) return Infinity; setNdcFromEvent(e); raycaster.setFromCamera(pointerNdc, camera); const h = raycaster.intersectObject(doors.hinge, true); return h.length ? h[0].distance : Infinity; };
    // Which rack (if any), and which issue card specifically, is under the pointer — any of the ten replicas, the
    // interactive rack, or an alarm plate/beacon.
    // World-space bounds per pickable rack so a hover/click only descends into the racks whose box the ray actually
    // crosses (the interactive rack alone is thousands of meshes). Built on first use, once everything is placed; the
    // live rack's box is padded for its swinging door and skipped altogether while the exploded view is open.
    const pickBoxes = new Map<THREE.Object3D, THREE.Box3>();
    const pickBoxFor = (o: THREE.Object3D) => {
      if (o === rack && explodeVal > 0.02) return null;
      let b = pickBoxes.get(o);
      if (!b) { b = new THREE.Box3().setFromObject(o).expandByScalar(o === rack ? 0.75 : 0.05); pickBoxes.set(o, b); }
      return b;
    };
    const hitUnderPointer = (e: PointerEvent) => { setNdcFromEvent(e); raycaster.setFromCamera(pointerNdc, camera); return pickHit(raycaster, focus, replicas, rack, LIVE_RACK_ID, pickBoxFor) as { rackId: string | null; issueId: string | null; distance: number }; };
    // Select a rack: outline it and (optionally) fly the camera to its front three-quarter.
    const selectRackInScene = (id: string | null, flyCamera: boolean) => {
      focus.userData.select(id);
      const info = id ? RACK_BY_ID[id] : null;
      // Focusing the interactive rack always reopens its door, so whatever drew the eye there (an alarm card,
      // a plain click) is never hidden behind it.
      if (id === LIVE_RACK_ID && !doorOpen) { doorOpen = true; updateDoorTargets(); }
      if (!id) preFocus = null;
      if (info && flyCamera) { rememberPreFocus(); const p = rackFocusPose(info); flyTo(p.pos as [number, number, number], p.tgt as [number, number, number]); }
    };
    // Issue modal anchoring: container-pixel position of an issue's alarm card (null when hidden or behind the camera),
    // and the modal placement beside it. The click handler seeds it; the render loop keeps the open modal tracking.
    const _anchor = new THREE.Vector3();
    const issueAnchorPx = (issueId: string) => {
      const plate = focus.visible ? (focus.userData.plateFor(issueId) as THREE.Object3D | null) : null; if (!plate) return null;
      plate.getWorldPosition(_anchor).project(camera);
      if (_anchor.z > 1) return null;
      const w = host.clientWidth || 1, h = host.clientHeight || 1;
      return { x: ((_anchor.x + 1) / 2) * w, y: ((1 - _anchor.y) / 2) * h, w, h };
    };
    const placeFor = (issueId: string, modalH?: number): DetailPlace | null => { const a = issueAnchorPx(issueId); return a ? placeDetail(a.x, a.y, a.w, a.h, modalH) : null; };
    const openIssueAt = (issueId: string) => { setOpenIssueId(issueId); setOpenSnapshot(issuesRef.current.find((i) => i.id === issueId) ?? null); setOpenPlace(placeFor(issueId)); };
    let downX = 0, downY = 0, downT = 0;
    const onPointerDown = (e: PointerEvent) => { downX = e.clientX; downY = e.clientY; downT = performance.now(); fly = null; followPaused = true; ambience.unlock(); };
    const onWheel = () => { followPaused = true; };
    const onPointerUp = (e: PointerEvent) => {
      const dragged = Math.hypot(e.clientX - downX, e.clientY - downY) > 6 || performance.now() - downT > 1200; // generous hold window: on a slow frame the up-event can land a frame or two late
      if (dragged) return; // an orbit drag, not a click
      const hit = hitUnderPointer(e), dDoor = distFrontDoor(e), dNoc = distNoc(e);
      if (dDoor < hit.distance && dDoor <= dNoc) { doorOpen = !doorOpen; updateDoorTargets(); return; }
      if (dNoc < hit.distance) { goToNoc(); return; }
      if (hit.rackId) pickRef.current(hit.rackId); // React owns the selection; it flows back down through api.selectRack
      // Clicking an alarm card opens its detail modal; clicking empty space (no rack under the pointer at all)
      // dismisses whatever's open. Clicking a rack elsewhere leaves an open modal as-is.
      if (hit.issueId) openIssueAt(hit.issueId);
      else if (!hit.rackId) setOpenIssueId(null);
    };
    let lastHoverMs = 0;
    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverMs < 80) return;
      lastHoverMs = now;
      renderer.domElement.style.cursor = distFrontDoor(e) < Infinity || distNoc(e) < Infinity || hitUnderPointer(e).rackId ? 'pointer' : '';
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: true });

    let raf = 0; const t0 = performance.now(); let lastT = 0; let liquidFrame = 0, frame = 0;
    // Frame-time governor for the adaptive pixel ratio: a smoothed frame time that sits above ~25 ms for a second
    // steps the resolution down a notch; one that sits comfortably under the vsync period for a few seconds steps it
    // back up. Hysteresis between the two bands keeps it from hunting.
    let ftAvg = 1 / 60, slowFor = 0, fastFor = 0;
    const DPR_STEP = 0.25, DPR_MIN = 1.0;
    const setDpr = (v: number) => { dpr = v; renderer.setPixelRatio(dpr); fit(); slowFor = 0; fastFor = 0; };
    const loop = () => {
      const t = (performance.now() - t0) / 1000; const dt = Math.min(0.25, t - lastT); lastT = t; frame++;
      if (dt < 0.1) { // ignore tab-hidden gaps
        ftAvg += (dt - ftAvg) * 0.1;
        if (ftAvg > 1 / 40) { slowFor += dt; fastFor = 0; } else if (ftAvg < 1 / 57) { fastFor += dt; slowFor = 0; } else { slowFor = 0; fastFor = 0; }
        if (slowFor > 1 && dpr > DPR_MIN + 1e-3) setDpr(Math.max(DPR_MIN, dpr - DPR_STEP));
        else if (fastFor > 4 && dpr < dprCap - 1e-3) setDpr(Math.min(dprCap, dpr + DPR_STEP));
      }
      heat.userData.tick(t, renderer.getPixelRatio()); vapor.userData.tick(t, renderer.getPixelRatio()); airflowReplicas.userData.tick(t, renderer.getPixelRatio()); thermal.tick(t);
      if (liquidMode) {
        const loopState = loopSim.step(dt); liquid.userData.setTelemetry(loopState.latest);
        // Update coolant particles every other frame — still smooth enough when liquid view is active.
        if ((++liquidFrame & 1) === 0) liquid.userData.tick(t, renderer.getPixelRatio());
      }
      focus.userData.tick(t);
      if (!thermal.active) { const mode = powerEvt.info.ledMode; leds.forEach((m) => { m.emissiveIntensity = ledIntensity(m.userData.pattern ?? 'activity', t, m.userData.seed ?? 0, mode); }); }
      // NOC wall + ambience mix at ~1 Hz / every few frames — both cheap, neither needs per-frame precision.
      if (t - nocDrawnAt > 1) {
        nocDrawnAt = t; noc.userData.draw({ loop: loopSim.state(), issues: issuesRef.current, power: powerEvt.info });
        if (atNoc) { const s = loopSim.state().latest; const itKw = s ? s.heatKw + 8 : 92, coolKw = s ? s.cduKw + itKw * 0.09 : 18, lossKw = itKw * 0.045 + 6; nocHist.push(itKw); if (nocHist.length > 90) nocHist.shift();
          setNocData({ pue: (itKw + coolKw + lossKw) / itKw, itKw, coolKw, lossKw, supplyC: s ? s.supplyC : null, dT: s ? s.dT : null, flowLpm: s ? s.flowLpm : null, source: powerEvt.info.source, upsPct: powerEvt.info.upsPct, upsMode: powerEvt.info.upsMode, history: [...nocHist] }); }
      }
      if ((++nocFrame % 6) === 0) { const d = Math.min(camera.position.distanceTo(NOISE_A), camera.position.distanceTo(NOISE_B), camera.position.distanceTo(NOISE_X)); ambience.tick(1 - THREE.MathUtils.clamp((d - 1.5) / 7, 0, 1), powerEvt.info.genRunning ? 1 : 0); }
      // Disconnected patch cable: sharp red 'beep' (fast rise, quick decay) rather than a soft sine, so it reads as an alarm.
      if (reseat) { reseat.tick(t); if (reseat.pulsing) { const k = Math.pow(0.5 + 0.5 * Math.sin(t * 4.2), 3); faultCable.material.emissiveIntensity = 0.6 + 2.6 * k; } }
      remScene.userData.tick(t);
      if (driving) {
        const f = driver.tick(dt);
        tech.userData.drive(f);
        if (f.event === 'stop' && f.stop) {
          stopReleased = false;
          if (f.stop.id === NOC_STOP.id) standAtNoc();
          else {
            // Parked in front of a rack: turn to it and inspect; the camera hands off to the rack's focus shot.
            const info = RACK_BY_ID[f.stop.id];
            tech.userData.inspect({ x: info.x, z: info.z, yaw: f.stop.yaw });
            if (!followPaused) { const pz = inspectShot(info, f.stop); flyTo(pz.pos, pz.tgt); }
          }
          setDriveUi({ stop: f.stop.id, queued: driver.state.pending });
        } else if (f.event === 'leave') { tech.userData.inspect(null); if (atNoc) leaveNoc(false); setDriveUi({ stop: null, queued: driver.state.pending }); }
        if (f.anyKey || f.moving) lastKeyMs = performance.now();
      }
      tech.userData.tick(t, dt); env.userData.tick(t);
      if (powerEvt.active) { powerEvt.tick(t); applyPower(); } power.userData.tick(t); leak.userData.tick(t);
      const kExplode = 1 - Math.exp(-10 * dt); let explodeMoving = false;
      explodeItems.forEach((it) => { if (it.group.position.distanceToSquared(it.target) > 1e-8) { explodeMoving = true; it.group.position.lerp(it.target, kExplode); } });
      if (fly) {
        const u = Math.min(1, (performance.now() / 1000 - fly.start) / fly.dur), e = easeInOut(u);
        bez(fly.p0, fly.p1, fly.p2, e, camera.position);
        controls.target.lerpVectors(fly.t0, fly.t1, e);
        if (u >= 1) fly = null;
      }
      let doorMoving = false;
      if (doors) {
        const kDoor = 1 - Math.exp(-4.5 * dt);
        if (doors.hingeTargetY !== undefined) { const d = doors.hingeTargetY - doors.hinge.rotation.y; if (Math.abs(d) > 1e-3) { doorMoving = true; doors.hinge.rotation.y += d * kDoor; } }
        if (doors.rdTargetZ !== undefined) { const d = doors.rdTargetZ - doors.rd.position.z; if (Math.abs(d) > 1e-4) { doorMoving = true; doors.rd.position.z += d * kDoor; } }
      }
      if (driving && !fly && !followPaused && (!driver.state.atStop || stopReleased)) followCamera(dt);
      controls.update();
      clampToRoom(camera.position); clampToRoom(controls.target, 0.35);
      // Keep the open issue modal beside its alarm card while the camera moves (direct style writes: no React churn).
      { const oid = openIssueRef.current, el = detailRef.current; if (oid && el && el.dataset.anchored === '1') { camera.updateMatrixWorld(); const pl = placeFor(oid, el.offsetHeight || undefined); if (pl) { el.style.left = `${pl.left}px`; el.style.top = `${pl.top}px`; } } }
      // Shadow pass: every frame while a caster is on the move, else every 2nd frame while the technician is working
      // at a rack (arms moving), else every 3rd frame (idle breathing only).
      const casterMoving = tech.userData.walking || doorMoving || explodeMoving || env.userData.doorMoving;
      renderer.shadowMap.needsUpdate = casterMoving || (frame % (tech.userData.pose !== 'idle' ? 2 : 3) === 0);
      renderer.render(scene, camera); raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // Technician dispatch for the active remediation: badge in, walk the corridors to the rack, work at the device's
    // height while the act plays, then walk back out. The act itself waits for the technician to arrive.
    const sceneTime = () => (performance.now() - t0) / 1000;
    let techJob: { issueId: string; arrived: boolean; pendingAct: (() => void) | null; path: { x: number; z: number }[] } | null = null;
    // Between jobs the technician does rounds (paths.PATROL): walks the aisles, stops to look over a rack now and
    // then. A dispatch interrupts the rounds wherever they are; when the job is done they pick the rounds back up
    // from the nearest patrol point.
    let patrolToken = 0;
    const techPos = () => ({ x: tech.position.x, z: tech.position.z });
    const patrolFrom = (i: number) => {
      const token = ++patrolToken;
      const step = (idx: number) => {
        if (patrolToken !== token || techJob) return;
        const pt = PATROL[idx % PATROL.length];
        tech.userData.walkTo([techPos(), { x: pt.x, z: pt.z }]).then(() => {
          if (patrolToken !== token || techJob) return;
          if (pt.look !== undefined) { tech.userData.face(pt.look); tech.userData.setPose('idle'); window.setTimeout(() => step(idx + 1), (pt.pauseS ?? 3) * 1000); }
          else step(idx + 1);
        });
      };
      step(i);
    };
    // Badge in through the staff door, then start the rounds.
    env.userData.setDoorOpen(true); env.userData.badgeRead(sceneTime(), 1.5);
    tech.userData.walkTo([TECH_SPAWN, PATROL[0]]).then(() => { env.userData.setDoorOpen(false); entered = true; if (!techJob && !driving) { if (driverWants) beginDrive(); else patrolFrom(1); } });
    const dispatchTech = (issue: { id: string; rackId: string; u: number }) => {
      const info = RACK_BY_ID[issue.rackId]; if (!info) return;
      const wasDriving = driving; if (wasDriving) endDrive(false); driverWants = wasDriving; // the job takes over; control comes back afterwards
      if (atNoc) leaveNoc(false); nocWalkToken++;
      patrolToken++; // stop the rounds
      // Stand far enough back for the pose the job needs, so neither the kneeling head nor the working hand pushes through the rack front.
      const st = WORK_STAND_M[workPoseFor(issue.u)];
      const path = buildPath(techPos(), info, st.dist, st.side), stand = standPoint(info, st.dist, st.side);
      techJob = { issueId: issue.id, arrived: false, pendingAct: null, path };
      const job = techJob;
      ambience.chirp('badge');
      tech.userData.setPose('idle');
      // Head turns to the rack on the way in; the right hand rises toward it over the last stretch (Technician.ts).
      tech.userData.lookAt({ x: info.x, z: info.z });
      tech.userData.walkTo(path, { reach: true }).then(() => {
        if (techJob !== job) return;
        tech.userData.face(stand.yaw);
        job.arrived = true; const act = job.pendingAct; job.pendingAct = null; act?.();
      });
    };
    /**
     * Work on the device at `u`: kneel for the bottom third of the rack (authored kneeling fix), otherwise stand and put
     * the right hand on the unit — `target` is the world point of the FRU face (drawn out toward the technician) or the
     * exact port for the cable reseat — with the eyes following the hand.
     */
    const techWorkAt = (u: number, target: THREE.Vector3 | null) => {
      const pose = workPoseFor(u);
      tech.userData.setPose(pose);
      tech.userData.workAt(pose === 'reach' && target ? target : null);
    };
    /** World point on a rack's front face at the middle of the device occupying `u`..`u+hU-1`, `out` metres proud of the bezels. */
    const deviceFacePoint = (info: { x: number; z: number; rotY: number }, u: number, hU: number, out: number) => {
      const y = 0.13 + (u - 1) * 0.04445 + (hU * 0.04445) / 2, fwd = 0.535 - 0.03 + out;
      return new THREE.Vector3(info.x + Math.sin(info.rotY) * fwd, y, info.z + Math.cos(info.rotY) * fwd);
    };
    const resumePatrol = () => { const p = techPos(); techJob = null; tech.userData.lookAt(null); if (driverWants && tech.visible) { driverWants = false; beginDrive(); } else patrolFrom(nearestPatrolIndex(p)); };
    const techLeave = () => {
      const job = techJob; if (!job) return;
      const wasKneeling = tech.userData.pose === 'kneel';
      tech.userData.workAt(null); tech.userData.setPose('idle'); tech.userData.lookAt(null);
      // Stand up / lower the hand first, then step back from the rack to the corridor point they came in on and pick
      // the rounds (or the keyboard) back up from there.
      window.setTimeout(() => {
        if (techJob !== job) return;
        const back = job.path.length >= 2 ? [techPos(), job.path[job.path.length - 2]] : [techPos()];
        tech.userData.walkTo(back).then(() => { if (techJob === job) resumePatrol(); });
      }, wasKneeling ? 1100 : 600);
    };
    const techReset = () => { if (techJob) { tech.userData.workAt(null); tech.userData.setPose('idle'); resumePatrol(); } };

    // NOC desk (no chair — a standing console). Clicking the desk / video wall sends the technician there (from the
    // rounds or from the keyboard); letting go of the keys at the NOC stop does the same. They stand at the desk,
    // hand to the keyboard, eyes on the wall; the camera takes the operator's point of view and the live NOC console
    // panel becomes active. Any arrow key, Esc, "Leave desk" or the Auto switch hands them back to whichever mode
    // was active.
    let atNoc = false; const nocHist: number[] = [];
    const KEYBOARD_POINT = new THREE.Vector3(NOC_STOP.x - 0.55, 0.78, NOC_STOP.z + 0.06); // desk near edge, a standing lean from the stop
    const WALL_POINT = new THREE.Vector3(NOC_STOP.x - 1.85, 2.2, NOC_STOP.z);            // eyes on the video wall
    const standAtNoc = () => {
      if (atNoc) return;
      atNoc = true;
      tech.userData.inspect(null); tech.userData.face(NOC_STOP.yaw); tech.userData.setPose('reach'); tech.userData.workAt(KEYBOARD_POINT, WALL_POINT); tech.userData.lookAt(null);
      // Operator's point of view: just behind the head, looking at the video wall.
      rememberPreFocus();
      flyTo([NOC_STOP.x + 0.8, 2.0, NOC_STOP.z + 0.3], [NOC_STOP.x - 1.85, 2.15, NOC_STOP.z]);
      followPaused = true;
      setNocUi({ atDesk: true });
    };
    const leaveNoc = (resume: boolean) => {
      if (!atNoc) return;
      atNoc = false; setNocUi(null); preFocus = null;
      tech.userData.workAt(null); tech.userData.setPose('idle');
      if (driving) { driver.begin({ x: NOC_STOP.x, z: NOC_STOP.z }, Math.PI / 2); followPaused = false; }
      else if (resume) { window.setTimeout(() => { if (!atNoc && !techJob && !driving) { if (driverWants) beginDrive(); else patrolFrom(nearestPatrolIndex(techPos())); } }, 700); }
    };
    const goToNoc = () => {
      if (atNoc || techJob || !entered || !tech.visible) return;
      const wasDriving = driving; if (wasDriving) endDrive(false); driverWants = wasDriving;
      patrolToken++;
      const token = ++nocWalkToken;
      tech.userData.setPose('idle');
      tech.userData.walkTo(buildPathWest(techPos(), { x: NOC_STOP.x, z: NOC_STOP.z })).then(() => { if (nocWalkToken !== token || techJob) return; standAtNoc(); });
      setNocUi({ atDesk: false });
    };
    /**
     * Esc — out of focus: closes the open incident modal, releases the outlined rack (camera flies back to where it
     * was before the fly-in), steps the technician off a parked inspection or the NOC desk, and in Manual hands
     * the camera back to the chase view behind them.
     */
    const releaseFocus = () => {
      setOpenIssueId(null);
      const back = preFocus; preFocus = null;
      if (atNoc) leaveNoc(true);
      if (driving) { tech.userData.inspect(null); stopReleased = true; fly = null; followPaused = false; setDriveUi({ stop: null, queued: driver.state.pending }); }
      else if (back) flyTo(back.pos, back.tgt);
      if (focus.userData.selectedId) { selectRackInScene(null, false); pickRef.current(null); } // clear the outline now; React's selection follows
    };
    let nocWalkToken = 0;

    // Manual mode (keyboard drive): the toolbar switch or the first arrow / WASD press takes the technician off the
    // rounds; they then walk the corridor network under the user's keys (Up/Down walk forward/back, Left/Right queue
    // a turn for the next junction) and, when let go within half a metre of a rack's stand point, step onto it and
    // inspect the rack. They wait there until the next key or until Auto is chosen again; a remediation dispatch
    // always takes over and hands back to whichever mode was active.
    const beginDrive = () => {
      if (driving) return;
      nocWalkToken++;
      driving = true; driverWants = true; lastKeyMs = performance.now(); followPaused = false; stopReleased = false; setTechModeState('manual');
      patrolToken++; // stop the rounds (their setTimeout chain checks the token)
      tech.userData.stop(); tech.userData.lookAt(null);
      driver.begin(techPos(), tech.rotation.y);
      setDriveUi({ stop: null, queued: null });
    };
    const endDrive = (resumeRounds: boolean) => {
      if (!driving) return;
      driving = false; driverWants = false; driver.releaseAll();
      tech.userData.inspect(null); tech.userData.drive(null);
      setDriveUi(null);
      if (resumeRounds) { setTechModeState('auto'); if (!techJob) patrolFrom(nearestPatrolIndex(techPos())); }
    };
    /** Toolbar / API: 'manual' hands the technician to the keyboard (now, or as soon as they are free); 'auto' resumes the rounds. */
    const setTechModeInScene = (m: 'auto' | 'manual') => {
      if (m === 'manual') { if (!entered || techJob) { driverWants = true; setTechModeState('manual'); } else beginDrive(); }
      else { driverWants = false; nocWalkToken++; if (atNoc) leaveNoc(false); if (driving) endDrive(true); else { setTechModeState('auto'); if (entered && !techJob) { patrolToken++; patrolFrom(nearestPatrolIndex(techPos())); } } }
    };
    const KEYMAP: Record<string, 'up' | 'down' | 'left' | 'right'> = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
    const keyOf = (e: KeyboardEvent) => KEYMAP[e.code] ?? KEYMAP[e.key] ?? null;
    const typingTarget = (e: KeyboardEvent) => { const el = e.target as HTMLElement | null; return !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable); };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !typingTarget(e)) { releaseFocus(); return; }
      const k = keyOf(e); if (!k || typingTarget(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!tech.visible || !entered || techJob) return; // hidden layer, still badging in, or a dispatch owns them
      e.preventDefault(); if (e.repeat) return;         // held state is tracked; OS auto-repeat adds nothing
      nocWalkToken++;                                    // a key while walking to the desk cancels that errand
      if (atNoc && !driving) { leaveNoc(false); }        // at the desk from the rounds: step off and take the keys
      beginDrive(); lastKeyMs = performance.now(); followPaused = false;
      if (atNoc) leaveNoc(false);
      driver.press(k);
      if (k === 'left' || k === 'right') setDriveUi({ stop: driver.state.atStop?.id ?? null, queued: driver.state.pending });
    };
    const onKeyUp = (e: KeyboardEvent) => { const k = keyOf(e); if (k && driving) driver.release(k); }; // never filtered: a key-up must always land
    const onBlur = () => driver.releaseAll();
    window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); window.addEventListener('blur', onBlur);

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
      setCamera(pos: [number, number, number], tgt: [number, number, number]) { fly = null; camera.position.set(...pos); controls.target.set(...tgt); clampToRoom(camera.position); clampToRoom(controls.target, 0.35); controls.update(); camera.updateMatrixWorld(true); /* picking right after a jump must not see the old view */ },
      flyTo,
      setExplode(t: number) {
        explodeItems.forEach((it) => it.target.set(it.ex * t, it.ey * t, it.ez * t));
        liquid.userData.setExploded(t);
        (rack.userData.cableLikeObjects as THREE.Object3D[]).forEach((o) => { o.visible = t < 0.04; });
        const labelAlpha = Math.min(1, Math.max(0, (t - 0.25) / 0.35)); // names appear once the stack has opened up
        if (t > 0.01 || labels) ensureLabels().forEach((sp) => { sp.visible = labelAlpha > 0; (sp.material as THREE.SpriteMaterial).opacity = labelAlpha; }); // once created, labels must also be hidden on a jump straight back to 0
        explodeVal = t; updateDoorTargets();
      },
      setDoorOpen(on: boolean) { doorOpen = on; updateDoorTargets(); },
      /**
       * Drive the active remediation. 'requested': select the rack and fly to a shot of its front (the fault cable
       * keeps its close-up of the switch port, with the door opened and the camera on the rack's right so the swing
       * never crosses the lens). 'confirmed': act out the fix on the rack and report completion. 'idle'/'done': clear.
       */
      setRemediation(r: RemediationState) {
        const issue = r.issueId ? issuesRef.current.find((i) => i.id === r.issueId) ?? null : null;
        if (!issue || r.phase === 'idle') { remScene.userData.set(null, 'idle'); if (techJob && (!issue || techJob.issueId !== issue.id || r.phase === 'idle')) techReset(); return; }
        if (r.phase === 'done') { remScene.userData.set(null, 'idle'); return; } // technician is already walking out
        const info = RACK_BY_ID[issue.rackId]; if (!info) return;
        const isFaultCable = issue.id === FAULT_CABLE_ISSUE_ID && !!faultCable && !!reseat;
        if (r.phase === 'requested') {
          pickRef.current(issue.rackId);
          if (isFaultCable) {
            doorOpen = true; updateDoorTargets();
            const tgt = rack.localToWorld(new THREE.Vector3(faultCable.port.x, faultCable.port.y, faultCable.port.z));
            const fwd = new THREE.Vector3(0, 0, 1).transformDirection(rack.matrixWorld), right = new THREE.Vector3(1, 0, 0).transformDirection(rack.matrixWorld);
            const pos = tgt.clone().addScaledVector(fwd, 0.62).addScaledVector(right, 0.22); pos.y += 0.07;
            flyTo(pos.toArray() as [number, number, number], tgt.toArray() as [number, number, number]);
          } else {
            // Rack front from a step back and to the right: the device at the issue's U, the alarm card and the
            // technician's stand point all in frame.
            const fx = Math.sin(info.rotY), fz = Math.cos(info.rotY), rx = Math.cos(info.rotY), rz = -Math.sin(info.rotY);
            const uY = THREE.MathUtils.clamp(0.13 + (issue.u - 1) * 0.04445, 0.5, 1.7);
            flyTo([info.x + fx * 2.5 + rx * 1.7, 1.95, info.z + fz * 2.5 + rz * 1.7], [info.x + fx * 0.4 - rx * 0.1, uY * 0.55 + 0.5, info.z + fz * 0.4 - rz * 0.1]);
          }
          remScene.userData.set(issue, 'requested');
          if (!techJob || techJob.issueId !== issue.id) dispatchTech(issue);
        }
        if (r.phase === 'confirmed') {
          if (isFaultCable) { doorOpen = true; updateDoorTargets(); }
          if (!techJob || techJob.issueId !== issue.id) dispatchTech(issue);
          const act = () => {
            const hU = focus.userData.deviceUnits(issue) as number;
            const target = isFaultCable
              ? rack.localToWorld(new THREE.Vector3(faultCable.port.x, faultCable.port.y, faultCable.port.z))
              : deviceFacePoint(info, issue.u, hU, issue.remediation?.fru === 'none' ? 0.02 : 0.12);
            // A short beat facing the rack before the hands go in reads as sizing the job up rather than lunging at it.
            window.setTimeout(() => { if (techJob?.issueId === issue.id) techWorkAt(issue.u, target); }, 350);
            remScene.userData.set(issue, 'confirmed', {
              onClick: () => ambience.chirp('click'),
              onDone: (id: string) => {
                // Fitting the blanking panels clears the recirculation: that server's inlet load falls back.
                if (issue.remediation?.action === 'fit_blanking_panel') {
                  const slots: Slot[] = rack.userData.slots, cur: number[] = [...(thermal.temps as number[])];
                  const idx = slots.findIndex((s) => Math.abs(s.y - s.h / 2 - (0.13 + (issue.u - 1) * 0.04445)) < 0.01);
                  if (idx >= 0) { cur[idx] = Math.min(cur[idx], 0.35); apiRef.current.setTemps(cur); }
                }
                techLeave();
                remDoneRef.current?.(id);
              },
            });
          };
          if (techJob!.arrived) act(); else techJob!.pendingAct = act;
        }
      },
      /** Show/hide the hall's optional fit-out (see SCENE_LAYER_DEFS). */
      setLayers(l: SceneLayers) {
        if (!l.technician && driving) endDrive(false);
        tech.visible = l.technician; focus.visible = l.alarmCards; overhead.visible = l.overheadCabling; noc.visible = l.nocWall; leak.visible = l.leakDetection;
        env.userData.door.visible = l.staffDoor;
        power.userData.setVisible('busway', l.busway); power.userData.setVisible('pdu', l.floorPdus); power.userData.setVisible('ups', l.ups);
        life.userData.setVisible('vesda', l.vesda);
      },
      /** Run the scripted utility-loss event (no-op while one is already playing). */
      triggerPowerEvent() { const ok = powerEvt.trigger(sceneTime()); if (ok) applyPower(); return ok; },
      powerInfo() { return powerEvt.info; },
      /** Technician position/pose for tooling and screenshot scripts. */
      techPose(p: 'idle' | 'walk' | 'kneel' | 'reach') { tech.userData.setPose(p); },
      techState() { return { visible: tech.visible, pos: tech.position.toArray(), yaw: tech.rotation.y, pose: tech.userData.pose, walking: tech.userData.walking, driving, inspecting: tech.userData.inspecting, job: techJob ? { issueId: techJob.issueId, arrived: techJob.arrived } : null }; },
      /** Keyboard-drive hooks for tooling: forward -1|0|1 (held walk keys), turn -1 left | 1 right (queued). */
      techDrive(forward: -1 | 0 | 1, turn: -1 | 0 | 1 = 0) { if (!tech.visible || techJob || !entered) return false; beginDrive(); lastKeyMs = performance.now(); driver.setAxes(forward, turn); return true; },
      techDriving() { const st = driver.state; return { driving, entered, facing: st.facing, pending: st.pending, atStop: st.atStop?.id ?? null, speed: st.speed, settling: st.settling, inspecting: tech.userData.inspecting, followPaused, idleS: Math.round((performance.now() - lastKeyMs) / 100) / 10 }; },
      techStopDrive(resumeRounds = true) { endDrive(resumeRounds); },
      setTechMode(m: 'auto' | 'manual') { setTechModeInScene(m); },
      /** NOC desk hooks: send the technician to the console / stand them up; state for tooling. */
      goToNoc() { goToNoc(); return atNoc || nocWalkToken > 0; },
      leaveNoc() { leaveNoc(true); },
      nocState() { return { atDesk: atNoc, pose: tech.userData.pose }; },
      /** Esc equivalent for tooling: drop the modal / rack focus / parked inspection / NOC desk. */
      releaseFocus() { releaseFocus(); },
      /** Modal placement beside an issue's alarm card right now (null if the card is hidden or off-screen). */
      issuePlace(id: string) { return placeFor(id); },
      /** Container-pixel centre of an issue's alarm card (tooling: where to click to open it). */
      issueAnchor(id: string) { camera.updateMatrixWorld(); return issueAnchorPx(id); },
      techMode() { return driving || driverWants ? 'manual' : 'auto'; },
      /** Outline rack `id` (null clears) and, when `flyCamera`, fly to its front three-quarter. */
      selectRack(id: string | null, flyCamera = true) { selectRackInScene(id, flyCamera); },
      /** Replace the open-issue list — rebuilds the alarm plates and roof beacons on the racks. */
      setIssues(list: any[]) { focus.userData.setIssues(list); applyLeakZones(list); },
      selectedRack() { return focus.userData.selectedId as string | null; },
      cameraPos() { return camera.position.toArray(); },
      /** Render statistics for tooling: draw calls / triangles of the last frame, current pixel ratio, smoothed frame time. */
      stats() { const r = renderer.info.render; return { calls: r.calls, triangles: r.triangles, dpr, frameMs: Math.round(ftAvg * 10000) / 10, rackMeshes: mergeStats }; },
      /** Visible mesh count per top-level scene group (dev tooling: where the draw calls come from). */
      meshCensus() {
        const out: Record<string, any> = {}; const rackKinds: Record<string, number> = {};
        for (const c of scene.children) {
          let n = 0; c.traverse((o: any) => { if ((o.isMesh || o.isSprite || o.isPoints || o.isLine) && o.visible) { n++; if (c === rack) { const k = (o.name || '?').replace(/[_-]?\d+.*$/, ''); rackKinds[k] = (rackKinds[k] ?? 0) + 1; } } });
          out[c.name || c.type] = n;
        }
        out.rackKinds = Object.fromEntries(Object.entries(rackKinds).sort((a, b) => b[1] - a[1]).slice(0, 40));
        return out;
      },
      airflow: showAirflow, mode: 'visual' as RackView,
      slots: rack.userData.slots as Slot[], temps: thermal.temps as number[],
      items: explodeItems.map((it) => ({ kind: it.kind, label: it.label })),
    };
    onItems?.(apiRef.current.items);
    if (import.meta.env.DEV || /[?&]debug\b/.test(window.location.search)) (window as any).__rackTwin = apiRef.current; // dev / ?debug hook for tooling and screenshot scripts
    if (explode) apiRef.current.setExplode(explode);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur);
      ambience.dispose(); ambienceRef.current = null;
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
  useEffect(() => { apiRef.current?.setRemediation(remediation); }, [remediation]);
  useEffect(() => { if (powerEvent > 0) apiRef.current?.triggerPowerEvent(); }, [powerEvent]);
  useEffect(() => { apiRef.current?.setLayers(sceneLayers); }, [layersKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { apiRef.current?.setIssues(issues); }, [issues]);
  // Once a remediation clears the open issue from the list, keep its modal up (with the closing note) while the flow
  // sits in 'done'; close it when the flow returns to idle or the issue vanished for any other reason.
  const openIsDone = remediation.phase === 'done' && remediation.issueId === openIssueId;
  useEffect(() => { if (openIssueId && !issues.some((i) => i.id === openIssueId) && !openIsDone) setOpenIssueId(null); }, [issues, openIssueId, openIsDone]);

  const thermalOn = v === 'thermal', liquidOn = v === 'liquid';
  const openIssue = issues.find((i) => i.id === openIssueId) ?? (openIsDone && openSnapshot?.id === openIssueId ? openSnapshot : null);
  const openIssueRack = openIssue ? RACK_BY_ID[openIssue.rackId] ?? null : null;
  const VIEW_LABEL: Record<RackView, string> = { visual: 'Visual', thermal: 'Thermal camera', liquid: 'Liquid cooling' };
  const POWER_LABEL: Record<PowerPhase, string> = { utility: 'Utility', utility_lost: 'UTILITY LOST · transferring to UPS', on_battery: 'ON BATTERY · UPS carrying load', generator: 'STANDBY FEED carrying load · UPS recharging', utility_restored: 'Utility restored · retransfer complete' };
  const hottest = (() => { const a = apiRef.current; if (!a) return null; const t: number[] = temps ?? a.temps; const i = t.indexOf(Math.max(...t)); const s = a.slots[i]; if (!s) return null; const u = Math.round((s.y - s.h / 2 - 0.13) / 0.04445) + 1; return `HOTTEST U${u} · ${Math.round(s.h / 0.04445)}U · ${(19.5 + Math.min(1, t[i]) * 28.5).toFixed(1)} °C`; })();

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%', background: thermalOn ? '#000' : liquidOn ? '#0f1318' : background, overflow: 'hidden', fontFamily: '"Helvetica Neue", Helvetica, sans-serif', ...style }}>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
      <div role="tablist" style={{ position: 'absolute', top: 18, left: 20, display: 'flex', gap: 2, background: 'rgba(12,13,16,0.72)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, padding: 3, backdropFilter: 'blur(8px)' }}>
        {(['visual', 'thermal', 'liquid'] as RackView[]).map((k) => (
          <button key={k} onClick={() => setView(k)} aria-pressed={v === k} style={{ appearance: 'none', border: 0, background: v === k ? '#eef0f4' : 'transparent', color: v === k ? '#16171b' : '#aeb3bc', font: '500 12px/1 inherit', letterSpacing: '0.04em', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}>{VIEW_LABEL[k]}</button>
        ))}
        <span style={{ width: 1, background: 'rgba(255,255,255,0.12)', margin: '4px 3px' }} />
        <button onClick={() => setLayersOpen((o) => !o)} aria-expanded={layersOpen} aria-controls="scene-items-panel" title="Choose which parts of the hall are shown" style={{ appearance: 'none', border: 0, background: layersOpen ? 'rgba(255,255,255,0.10)' : 'transparent', color: '#aeb3bc', font: '500 12px/1 inherit', letterSpacing: '0.04em', padding: '8px 10px', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>Scene items {layersOpen ? '▴' : '▾'}</button>
        <button onClick={() => setAudioOn((a) => !a)} aria-pressed={audioOn} title={audioOn ? 'Mute hall ambience' : 'Hall ambience: fan hum, alarms, badge reader'} style={{ appearance: 'none', border: 0, background: audioOn ? 'rgba(255,255,255,0.10)' : 'transparent', color: audioOn ? '#eef0f4' : '#aeb3bc', font: '500 12px/1 inherit', padding: '8px 10px', borderRadius: 6, cursor: 'pointer' }}>{audioOn ? '🔊' : '🔇'}</button>
        <span style={{ width: 1, background: 'rgba(255,255,255,0.12)', margin: '4px 3px' }} />
        <span title="Technician mode" style={{ color: '#7c8290', font: '500 11px/1 inherit', letterSpacing: '0.04em', padding: '0 4px 0 6px', alignSelf: 'center', textTransform: 'uppercase' }}>Technician</span>
        {(['auto', 'manual'] as const).map((m) => (
          <button key={m} onClick={() => setTechMode(m)} aria-pressed={techMode === m} title={m === 'auto' ? 'Technician does rounds of the hall and answers remediation dispatches' : 'Drive the technician with the arrow keys / WASD; stop in front of a rack to inspect it'} style={{ appearance: 'none', border: 0, background: techMode === m ? '#eef0f4' : 'transparent', color: techMode === m ? '#16171b' : '#aeb3bc', font: '500 12px/1 inherit', letterSpacing: '0.04em', padding: '8px 10px', borderRadius: 6, cursor: 'pointer' }}>{m === 'auto' ? '🚶 Auto' : '⌨ Manual'}</button>
        ))}
      </div>
      {layersOpen && (
        <div ref={layersPanelRef} id="scene-items-panel" role="group" aria-label="Scene items" style={{ position: 'absolute', top: 60, left: 20, width: 300, maxHeight: 'calc(100% - 140px)', overflowY: 'auto', background: 'rgba(12,13,16,0.86)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10, padding: '10px 12px 12px', backdropFilter: 'blur(10px)', color: '#eef0f4', fontSize: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.45)', scrollbarWidth: 'thin' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
            <b style={{ fontSize: 12.5 }}>Scene items</b>
            <span style={{ display: 'flex', gap: 10, fontSize: 11 }}>
              <button onClick={() => SCENE_LAYER_DEFS.forEach((d) => setLayer(d.id, true))} style={{ appearance: 'none', border: 0, background: 'transparent', color: '#8cc7ff', cursor: 'pointer', padding: 0 }}>all</button>
              <button onClick={() => SCENE_LAYER_DEFS.forEach((d) => setLayer(d.id, false))} style={{ appearance: 'none', border: 0, background: 'transparent', color: '#8cc7ff', cursor: 'pointer', padding: 0 }}>none</button>
              <button onClick={() => { setInternalLayers(DEFAULT_SCENE_LAYERS); onLayersChange?.(DEFAULT_SCENE_LAYERS); try { localStorage.removeItem('rackTwin.layers'); } catch { /* ignore */ } }} style={{ appearance: 'none', border: 0, background: 'transparent', color: '#8cc7ff', cursor: 'pointer', padding: 0 }}>defaults</button>
            </span>
          </div>
          {Array.from(new Set(SCENE_LAYER_DEFS.map((d) => d.group))).map((grp) => (
            <div key={grp} style={{ marginTop: 8 }}>
              <div style={{ color: '#7c8290', fontSize: 10.5, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>{grp}</div>
              {SCENE_LAYER_DEFS.filter((d) => d.group === grp).map((d) => (
                <label key={d.id} title={d.hint} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', cursor: 'pointer', opacity: layers && d.id in layers ? 0.6 : 1 }}>
                  <input type="checkbox" checked={sceneLayers[d.id]} disabled={!!layers && d.id in layers} onChange={(e) => setLayer(d.id, e.target.checked)} style={{ accentColor: '#5ab0ff' }} />
                  <span style={{ flex: 1 }}>{d.label}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
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
      {nocUi && !openIssue && <NocConsole data={nocData} issues={issues} atDesk={nocUi.atDesk} onOpenIssue={(id) => { setOpenIssueId(id); setOpenSnapshot(issues.find((i) => i.id === id) ?? null); setOpenPlace(apiRef.current?.issuePlace(id) ?? null); }} onLeave={() => apiRef.current?.leaveNoc()} />}
      <IssueDetail ref={detailRef} issue={openIssue} rack={openIssueRack} place={openPlace} onClose={() => setOpenIssueId(null)} remediation={remediation} remediationNote={remediationNote} onRemediate={onRemediate} />
      <div style={{ position: 'absolute', left: 20, bottom: 18, color: '#c9ccd3', fontSize: 12, letterSpacing: '0.04em', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {powerPhase !== 'utility' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', padding: '5px 10px', borderRadius: 6, background: powerPhase === 'utility_restored' ? 'rgba(12,163,12,0.14)' : 'rgba(255,160,32,0.14)', border: `1px solid ${powerPhase === 'utility_restored' ? 'rgba(12,163,12,0.5)' : 'rgba(255,160,32,0.5)'}`, color: '#eef0f4', fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: powerPhase === 'utility_restored' ? '#0ca30c' : '#ffa020', boxShadow: '0 0 8px currentColor' }} />
            {POWER_LABEL[powerPhase]}
          </span>
        )}
        {driveUi && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', padding: '5px 10px', borderRadius: 6, background: 'rgba(90,176,255,0.14)', border: '1px solid rgba(90,176,255,0.5)', color: '#eef0f4', fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#5ab0ff', boxShadow: '0 0 8px currentColor' }} />
            {driveUi.stop === 'NOC' ? 'At the NOC desk · any arrow or Esc to leave it' : driveUi.stop ? `Inspecting Rack ${driveUi.stop} · Esc to step back · any arrow to walk on` : `Manual · ↑ walk · ↓ turn round · ←→ turn${driveUi.queued ? ` · ${driveUi.queued === 'left' ? '↰' : '↱'} at the next junction` : ' · let go in front of a rack to inspect it'}`}
          </span>
        )}
        <b style={{ fontSize: 14, color: '#eef0f4' }}>{liquidOn ? '42U rack · direct-to-chip liquid cooled' : '42U enterprise rack'}</b>
        <span>Drag to orbit · wheel to zoom · right-drag to pan · click any rack to focus it · click the front door to open or close it · click the NOC desk to put the technician on the console · Esc to leave whatever is focused · Technician ⌨ Manual (or any arrow key) to walk them yourself, 🚶 Auto for the rounds · Scene items ▾ to show/hide parts of the hall{liquidOn && ' · orbit to the rear for the manifolds and CDU'}</span>
      </div>
    </div>
  );
}
