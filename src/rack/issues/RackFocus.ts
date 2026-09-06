// @ts-nocheck
/* eslint-disable */
// Rack selection helpers for the data hall: a floating alarm badge over every rack that has open issues (colour =
// worst severity, number = open count), a selection marker that lives in the same badge (the picked rack's badge
// redraws with a blue "selected" frame; a rack with no issues gets a plain blue pin) so nothing is drawn on or
// around the rack itself, a raycast picker that maps a click on any rack (baked replica or the interactive one)
// back to its rack id, and a "front three-quarter" camera pose for flying to a rack wherever it stands.
import { RACKS, RACK_BY_ID, SEVERITY_COLOR, worstSeverityByRack } from './issues';

const SELECT_COLOR = '#5ab0ff';

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

export function buildRackFocus(THREE, rackBox, issues) {
  const g = new THREE.Group(); g.name = 'rack_focus';
  const badges = new THREE.Group(); badges.name = 'rack_issue_badges'; g.add(badges);
  const BADGE_Y = rackBox.max.y + 0.32;
  const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

  /** Alarm badge: severity dot + open count + rack id in a dark pill with a pointer; blue frame when selected. */
  const makeBadgeTexture = (count, color, label, selected) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = 'rgba(12,13,16,0.92)'; x.beginPath(); x.roundRect(6, 6, 244, 84, 20); x.fill();
    x.strokeStyle = selected ? SELECT_COLOR : color; x.lineWidth = selected ? 7 : 5; x.stroke();
    x.fillStyle = color; x.beginPath(); x.arc(46, 48, 17, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#eef0f4'; x.font = `700 46px ${FONT}`; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(String(count), 78, 50);
    x.fillStyle = selected ? '#cfe6ff' : '#aeb3bc'; x.font = `600 26px ${FONT}`; x.fillText(label, 118, 50);
    x.fillStyle = selected ? SELECT_COLOR : color; x.beginPath(); x.moveTo(112, 92); x.lineTo(144, 92); x.lineTo(128, 118); x.closePath(); x.fill();
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex;
  };
  /** Plain selection pin for a rack with no open issues: blue-framed pill with the rack id. */
  const makePinTexture = (label) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = 'rgba(12,13,16,0.92)'; x.beginPath(); x.roundRect(40, 6, 176, 84, 20); x.fill();
    x.strokeStyle = SELECT_COLOR; x.lineWidth = 7; x.stroke();
    x.fillStyle = '#cfe6ff'; x.font = `600 34px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, 128, 50);
    x.fillStyle = SELECT_COLOR; x.beginPath(); x.moveTo(112, 92); x.lineTo(144, 92); x.lineTo(128, 118); x.closePath(); x.fill();
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex;
  };
  const makeSprite = (tex, rackId, name) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.name = name; sp.userData.rackId = rackId; sp.userData.thermalSkip = true; sp.renderOrder = 20;
    return sp;
  };
  const disposeSprite = (sp) => { sp.material.map?.dispose(); sp.material.dispose(); sp.parent?.remove(sp); };

  let list = issues, selectedId = null;
  const badgeById = new Map();
  let pin = null;

  const rebuild = () => {
    badgeById.forEach(disposeSprite); badgeById.clear();
    if (pin) { disposeSprite(pin); pin = null; }
    const worst = worstSeverityByRack(list);
    for (const info of RACKS) {
      const w = worst[info.id]; if (!w) continue;
      const selected = info.id === selectedId;
      const sp = makeSprite(makeBadgeTexture(w.count, SEVERITY_COLOR[w.severity], info.id, selected), info.id, `rack_badge_${info.id}`);
      sp.scale.set(selected ? 0.56 : 0.46, selected ? 0.28 : 0.23, 1); sp.position.set(info.x, BADGE_Y, info.z);
      badges.add(sp); badgeById.set(info.id, sp);
    }
    const info = selectedId ? RACK_BY_ID[selectedId] : null;
    if (info && !worst[info.id]) {
      pin = makeSprite(makePinTexture(info.id), info.id, `rack_pin_${info.id}`);
      pin.scale.set(0.56, 0.28, 1); pin.position.set(info.x, BADGE_Y, info.z); badges.add(pin);
    }
  };
  rebuild();

  const setIssues = (next) => { list = next; rebuild(); };
  const select = (id) => { if (id === selectedId) return; selectedId = id; rebuild(); };

  // A gentle bob on the selected rack's marker so the eye finds it from across the hall.
  const tick = (t) => {
    const bob = 0.035 * Math.sin(t * 3.4);
    badgeById.forEach((sp, rid) => { sp.position.y = BADGE_Y + (rid === selectedId ? bob : 0); });
    if (pin) pin.position.y = BADGE_Y + bob;
  };

  /** Objects a click should test first — the badges float above the racks. */
  const pickables = () => badges.children;

  g.userData = { select, setIssues, tick, pickables, get selectedId() { return selectedId; } };
  return g;
}

/**
 * Resolve the rack id under a raycaster (already set from the pointer). Tests the badges, the baked replica groups
 * (named `rack_replica_<row><index>`) and the interactive rack.
 */
export function pickRackId(raycaster, focus, replicas, liveRack, liveRackId) {
  const hitsBadge = raycaster.intersectObjects(focus.userData.pickables(), false);
  if (hitsBadge.length) return hitsBadge[0].object.userData.rackId ?? null;
  const targets = [...replicas.children, liveRack];
  const hits = raycaster.intersectObjects(targets, true);
  if (!hits.length) return null;
  let o = hits[0].object;
  while (o && !targets.includes(o)) o = o.parent;
  if (!o) return null;
  if (o === liveRack) return liveRackId;
  const m = /^rack_replica_([AB])(\d+)$/.exec(o.name);
  if (!m) return null;
  const info = RACKS.find((r) => r.row === m[1] && r.index === Number(m[2]));
  return info ? info.id : null;
}
