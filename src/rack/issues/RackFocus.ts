// @ts-nocheck
/* eslint-disable */
// Rack selection + alarm visuals for the data hall, drawn ON the racks themselves — nothing floats over or rings
// around a rack. Every open issue becomes a dark notification card that exactly fills the affected device's front
// face (severity-coloured border + left accent bar, with the dot · U number · title · incident id centred inside),
// and each rack with open issues gets a small status beacon on its roof edge (worst severity) that reads from
// across the hall. Selecting a rack draws a thin blue hairline just inside its front-door frame and brightens its
// cards. Also: the raycast picker mapping a click on any rack (replica or interactive) back to its rack id, and
// the "front three-quarter" camera pose for flying to a rack wherever it stands.
import { RACKS, RACK_BY_ID, SEVERITY_COLOR, SEVERITY_RANK, worstSeverityByRack } from './issues';

const SELECT_COLOR = '#5ab0ff';
// Rack geometry (mirrors RackContext / RackFrame): 1U pitch, bottom of U1, rack depth, front-door plane.
const U = 0.04445, Y0 = 0.13, D = 1.07, W = 0.6;
const TOP = Y0 + 42 * U;
const DOOR_Z = D / 2 + 0.012 + 0.01;          // outer face of the closed front door (rack-local)
const DOOR_CY = (TOP + 0.13) / 2, DOOR_H = TOP - 0.13, DOOR_W = W - 0.02;
const OPEN_W = DOOR_W - 0.10, OPEN_H = DOOR_H - 0.10; // clear opening inside the 50 mm door frame
const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

/**
 * Camera position + orbit target that frames rack `info` from its front three-quarter, whatever its yaw. The
 * target is nudged toward the camera's right so the rack sits left of the issues panel on the right edge.
 */
export function rackFocusPose(info) {
  // Racks face +z at rotY = 0; rotating about y turns that forward vector to (sin, 0, cos).
  const fx = Math.sin(info.rotY), fz = Math.cos(info.rotY);
  const rx = Math.cos(info.rotY), rz = -Math.sin(info.rotY); // rack's right-hand side
  const ox = fx * 3.4 + rx * 1.7, oz = fz * 3.4 + rz * 1.7;  // camera offset from the rack, in plan
  const pos = [info.x + ox, 2.15, info.z + oz];
  // Camera-right in plan is perpendicular to the view direction (-ox, -oz): (oz, -ox) normalised. Moving the orbit
  // target toward camera-RIGHT shifts the scene left on screen, so the rack clears the issues panel on the right.
  const len = Math.hypot(ox, oz), crx = oz / len, crz = -ox / len;
  const tgt = [info.x + fx * 0.1 + crx * 0.5, 1.15, info.z + fz * 0.1 + crz * 0.5];
  return { pos, tgt };
}

/** Device height in U, read from the issue's device string ("(3U storage)", "(2U SFF)"); anything else is 1U. */
const deviceUnits = (issue) => { const m = /(\d)U\b/.exec(issue.device || ''); return m ? Number(m[1]) : 1; };

export function buildRackFocus(THREE, rackBox, issues) {
  const g = new THREE.Group(); g.name = 'rack_focus';
  const ROOF_Y = rackBox.max.y;

  /* ---------------- textures ---------------- */
  // Plate scale: the plate is PW metres wide and PX_PER_M pixels per metre, so a device of hU rack units gets a
  // texture exactly its own height. The label row (LABEL_PX) is anchored along the bottom edge; a 1U device is
  // barely taller than the label, so its plate is just the label row.
  const PW = 0.46, PX_W = 736, PX_PER_M = PX_W / PW, LABEL_PX = 80;
  const plateHeightM = (hU) => Math.max(LABEL_PX / PX_PER_M, hU * U - 0.004);
  /** Plate drawn over the faulted device: a dark notification card the full size of the device (severity
   * border + left accent bar), with the dot · U · title · incident id centred inside it. */
  const makePlateTexture = (issue, hU) => {
    const color = SEVERITY_COLOR[issue.severity];
    const H = Math.round(plateHeightM(hU) * PX_PER_M);
    const c = document.createElement('canvas'); c.width = PX_W; c.height = H; const x = c.getContext('2d');
    const R = 14;
    x.beginPath(); x.roundRect(1.5, 1.5, PX_W - 3, H - 3, R);
    x.fillStyle = 'rgba(9,10,13,0.88)'; x.fill();
    x.strokeStyle = color + 'd0'; x.lineWidth = 2.5; x.stroke();
    x.save(); x.clip();
    // severity accent bar down the left edge, full height
    x.fillStyle = color; x.fillRect(0, 0, 14, H);
    x.restore();
    const cy = H / 2;
    x.save(); x.shadowColor = color; x.shadowBlur = 18; x.fillStyle = color; x.beginPath(); x.arc(42, cy, 11, 0, Math.PI * 2); x.fill(); x.restore();
    x.textBaseline = 'middle';
    x.fillStyle = '#f4f6fa'; x.font = `700 32px ${FONT}`; x.textAlign = 'left'; x.fillText(`U${issue.u}`, 68, cy + 1);
    const uW = x.measureText(`U${issue.u}`).width;
    x.fillStyle = 'rgba(255,255,255,0.22)'; x.fillRect(68 + uW + 16, cy - 20, 2, 40);
    x.fillStyle = 'rgba(186,192,202,0.95)'; x.font = `600 26px ${FONT}`; x.textAlign = 'right'; x.fillText(issue.id, 706, cy + 1);
    const idW = x.measureText(issue.id).width;
    const tx = 68 + uW + 34, maxW = 706 - idW - 24 - tx;
    let title = issue.title.replace(/\s+—\s+/g, ' · ');
    x.fillStyle = '#e6e9ee'; x.font = `500 28px ${FONT}`; x.textAlign = 'left';
    while (title.length > 4 && x.measureText(title).width > maxW) title = title.slice(0, -2).trimEnd() + '…';
    x.fillText(title, tx, cy + 1);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; return tex;
  };
  /** Soft radial light spill (additive) — one per severity colour, shared. */
  const haloTex = {};
  const haloTexture = (color) => {
    if (haloTex[color]) return haloTex[color];
    const c = document.createElement('canvas'); c.width = 256; c.height = 96; const x = c.getContext('2d');
    const grd = x.createRadialGradient(128, 48, 4, 128, 48, 120);
    grd.addColorStop(0, color); grd.addColorStop(0.45, color + '66'); grd.addColorStop(1, color + '00');
    x.save(); x.scale(1, 96 / 256); x.fillStyle = grd; x.fillRect(0, 0, 256, 256); x.restore();
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; haloTex[color] = tex; return tex;
  };
  const haloMaterial = (color, opacity) => new THREE.MeshBasicMaterial({ map: haloTexture(color), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
  const skip = (m) => { m.userData.thermalSkip = true; m.castShadow = false; m.receiveShadow = false; return m; };

  /* ---------------- per-rack groups ---------------- */
  const rackGroups = new Map(); // rackId -> THREE.Group posed at the rack's placement
  const rackGroup = (info) => {
    let grp = rackGroups.get(info.id);
    if (!grp) { grp = new THREE.Group(); grp.name = `rack_alarms_${info.id}`; grp.position.set(info.x, 0, info.z); grp.rotation.y = info.rotY; g.add(grp); rackGroups.set(info.id, grp); }
    return grp;
  };

  // Selection hairline: four thin luminous strips just inside the door frame, re-parented to the picked rack.
  const outline = new THREE.Group(); outline.name = 'rack_select_outline'; outline.visible = false;
  const outlineMat = new THREE.MeshBasicMaterial({ color: SELECT_COLOR, transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false, fog: false });
  const LW = 0.005;
  for (const [w, h, x, y] of [[OPEN_W, LW, 0, OPEN_H / 2], [OPEN_W, LW, 0, -OPEN_H / 2], [LW, OPEN_H, OPEN_W / 2, 0], [LW, OPEN_H, -OPEN_W / 2, 0]]) {
    const m = skip(new THREE.Mesh(new THREE.PlaneGeometry(w, h), outlineMat)); m.position.set(x, DOOR_CY + y, DOOR_Z + 0.004); m.renderOrder = 12; outline.add(m);
  }
  const outlineGlowMat = new THREE.MeshBasicMaterial({ color: SELECT_COLOR, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
  for (const [w, h, x, y] of [[OPEN_W, 0.03, 0, OPEN_H / 2], [OPEN_W, 0.03, 0, -OPEN_H / 2], [0.03, OPEN_H, OPEN_W / 2, 0], [0.03, OPEN_H, -OPEN_W / 2, 0]]) {
    const m = skip(new THREE.Mesh(new THREE.PlaneGeometry(w, h), outlineGlowMat)); m.position.set(x, DOOR_CY + y, DOOR_Z + 0.003); m.renderOrder = 11; outline.add(m);
  }
  g.add(outline);

  let list = issues, selectedId = null;
  const plates = [];   // { mesh, rackId, severity }
  const beacons = [];  // { mesh, halo, rackId, severity }
  const pickable = []; // plates + beacons (any hit resolves to a rack id)

  const rebuild = () => {
    for (const p of plates) { p.mesh.material.map?.dispose(); p.mesh.material.dispose(); p.mesh.geometry.dispose(); p.mesh.parent?.remove(p.mesh); }
    for (const b of beacons) { b.mesh.material.dispose(); b.mesh.geometry.dispose(); b.mesh.parent?.remove(b.mesh); b.halo.material.dispose(); b.halo.geometry.dispose(); b.halo.parent?.remove(b.halo); }
    plates.length = 0; beacons.length = 0; pickable.length = 0;

    // Plates: one per issue, on the door at the device's centre height. Several issues on one device stack upward.
    const taken = new Map(); // rackId -> [yCentre] already used
    const sorted = [...list].sort((a, b) => a.rackId.localeCompare(b.rackId) || a.u - b.u || SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
    for (const issue of sorted) {
      const info = RACK_BY_ID[issue.rackId]; if (!info) continue;
      const grp = rackGroup(info);
      const hU = deviceUnits(issue);
      const PH = plateHeightM(hU);
      // Plate centred on the device; several issues on one device stack upward by the plate height.
      let yc = Y0 + (issue.u - 1) * U + Math.max(hU * U, PH) / 2;
      const used = taken.get(issue.rackId) || []; while (used.some(([y, h]) => Math.abs(y - yc) < (h + PH) / 2)) yc += PH + 0.006; used.push([yc, PH]); taken.set(issue.rackId, used);
      yc = Math.min(Math.max(yc, DOOR_CY - OPEN_H / 2 + PH / 2), DOOR_CY + OPEN_H / 2 - PH / 2);
      const plate = skip(new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: makePlateTexture(issue, hU), transparent: true, toneMapped: false, depthWrite: false, fog: false })));
      plate.name = `rack_alarm_plate_${issue.id}`; plate.position.set(0, yc, DOOR_Z + 0.006); plate.renderOrder = 14; plate.userData.rackId = issue.rackId; plate.userData.issueId = issue.id;
      grp.add(plate);
      plates.push({ mesh: plate, rackId: issue.rackId, severity: issue.severity }); pickable.push(plate);
    }
    // Beacons: a small status light on the roof's front edge, colour = worst open severity.
    const worst = worstSeverityByRack(list);
    for (const info of RACKS) {
      const w = worst[info.id]; if (!w) continue;
      const grp = rackGroup(info); const color = SEVERITY_COLOR[w.severity];
      const beacon = skip(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.012, 0.026), new THREE.MeshStandardMaterial({ color: 0x0c0d10, emissive: new THREE.Color(color), emissiveIntensity: 1.6, roughness: 0.35, metalness: 0.2, fog: false })));
      beacon.name = `rack_beacon_${info.id}`; beacon.position.set(0, ROOF_Y + 0.006, D / 2 - 0.06); beacon.userData.rackId = info.id;
      const halo = skip(new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.13), haloMaterial(color, 0.42)));
      halo.name = `rack_beacon_halo_${info.id}`; halo.position.set(0, ROOF_Y + 0.006, D / 2 - 0.06); halo.rotation.x = -Math.PI / 2; halo.renderOrder = 13;
      grp.add(halo); grp.add(beacon);
      beacons.push({ mesh: beacon, halo, rackId: info.id, severity: w.severity }); pickable.push(beacon);
    }
    applySelection();
  };

  const applySelection = () => {
    const info = selectedId ? RACK_BY_ID[selectedId] : null;
    if (info) { const grp = rackGroup(info); if (outline.parent !== grp) grp.add(outline); outline.visible = true; }
    else outline.visible = false;
  };
  rebuild();

  const setIssues = (next) => { list = next; rebuild(); };
  const select = (id) => { if (id === selectedId) return; selectedId = id; applySelection(); };

  // Breathing light: critical alarms breathe slowly and deeply, majors gently, minors hold steady. The selected
  // rack's spill runs brighter so the eye lands on it after the camera arrives.
  const pulse = (severity, t, phase) => severity === 'critical' ? 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2.6 + phase))
    : severity === 'major' ? 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(t * 1.5 + phase)) : 0.85;
  const tick = (t) => {
    plates.forEach((p, i) => { const base = selectedId == null || p.rackId === selectedId ? 1 : 0.78; p.mesh.material.opacity = base * pulse(p.severity, t, i * 0.9); });
    beacons.forEach((b, i) => { const k = pulse(b.severity, t, i * 1.3); b.mesh.material.emissiveIntensity = 0.9 + 1.4 * k; b.halo.material.opacity = 0.34 * k; });
    if (outline.visible) { const k = 0.5 + 0.5 * Math.sin(t * 2.2); outlineMat.opacity = 0.72 + 0.28 * k; outlineGlowMat.opacity = 0.10 + 0.10 * k; }
  };

  /** Objects a click should test first — the plates and beacons sit proud of the rack surfaces. */
  const pickables = () => pickable;

  g.userData = { select, setIssues, tick, pickables, get selectedId() { return selectedId; } };
  return g;
}

/**
 * Resolve what's under a raycaster (already set from the pointer): the rack id, plus the issue id when the hit
 * was an alarm card specifically (not a beacon or bare rack surface). Tests the alarm plates/beacons, the baked
 * replica groups (named `rack_replica_<row><index>`) and the interactive rack.
 */
export function pickHit(raycaster, focus, replicas, liveRack, liveRackId) {
  const hitsMarker = raycaster.intersectObjects(focus.userData.pickables(), false);
  if (hitsMarker.length) {
    const o = hitsMarker[0].object;
    return { rackId: o.userData.rackId ?? null, issueId: o.userData.issueId ?? null };
  }
  const targets = [...replicas.children, liveRack];
  const hits = raycaster.intersectObjects(targets, true);
  if (!hits.length) return { rackId: null, issueId: null };
  let o = hits[0].object;
  while (o && !targets.includes(o)) o = o.parent;
  if (!o) return { rackId: null, issueId: null };
  if (o === liveRack) return { rackId: liveRackId, issueId: null };
  const m = /^rack_replica_([AB])(\d+)$/.exec(o.name);
  if (!m) return { rackId: null, issueId: null };
  const info = RACKS.find((r) => r.row === m[1] && r.index === Number(m[2]));
  return { rackId: info ? info.id : null, issueId: null };
}
