// @ts-nocheck
/* eslint-disable */
// Orchestrates the on-rack part of a remediation. Given an issue and its phase it picks the right act: the
// high-fidelity RJ45 reseat for the interactive rack's fault cable (cabling/reseatAnimation.ts), a console strip for
// software-only fixes, or a proxy FRU swap for everything else (fruSwapAnimation.ts) — parented to the same per-rack
// group the alarm cards hang off, so it lands on the right rack whether that's a baked replica or the live rack.
// Idempotent per (issueId, phase): React effects may re-run, the animation must not restart.
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.
import { FAULT_CABLE_ISSUE_ID, RACK_BY_ID } from './issues';
import { createConsoleAnimation, createFruSwapAnimation } from './fruSwapAnimation';

const D = 1.07, DOOR_Z = D / 2 + 0.012 + 0.01;

export function buildRemediationScene(THREE, focus, { reseat }) {
  const g = new THREE.Group(); g.name = 'remediation_scene';
  let current = null; // { issueId, phase, anim, pendingStart, delay, hooks }

  const clear = () => {
    if (!current) return;
    focus.userData.setPlateBusy(current.issueId, false);
    if (current.anim?.userData?.dispose) current.anim.userData.dispose();
    current = null;
  };

  /** Move to `phase` for `issue`. `hooks.onDone` fires when the act finishes; `hooks.onClick` on the FRU's click stage. */
  const set = (issue, phase, hooks = {}) => {
    if (!issue || phase === 'idle' || phase === 'done') { clear(); return; }
    if (current && current.issueId === issue.id && current.phase === phase) return;
    if (current && current.issueId !== issue.id) clear();
    if (phase !== 'confirmed') { current = { issueId: issue.id, phase, anim: null, hooks }; return; }
    const info = RACK_BY_ID[issue.rackId]; const rem = issue.remediation;
    if (!info || !rem) { current = { issueId: issue.id, phase, anim: null, hooks }; return; }
    focus.userData.setPlateBusy(issue.id, true);
    let anim = null, delay = 0.2;
    if (issue.id === FAULT_CABLE_ISSUE_ID && reseat) {
      anim = { userData: { start: (t, cb) => reseat.start(t, cb), tick: () => {}, dispose: () => {} } }; delay = 0.9; // let the door finish opening first
    } else if (rem.fru === 'none') {
      const plate = focus.userData.plateFor(issue.id);
      const hU = focus.userData.deviceUnits(issue), ph = focus.userData.plateHeightM(hU);
      const y = plate ? plate.position.y - ph / 2 + 0.014 : 0.13 + (issue.u - 1) * 0.04445 + 0.014;
      anim = createConsoleAnimation(THREE, { y, z: DOOR_Z + 0.009, duration: rem.durationS });
      focus.userData.rackGroup(info).add(anim);
    } else {
      anim = createFruSwapAnimation(THREE, { fru: rem.fru, u: issue.u, hU: focus.userData.deviceUnits(issue), duration: rem.durationS });
      focus.userData.rackGroup(info).add(anim);
    }
    current = { issueId: issue.id, phase, anim, pendingStart: true, delay, hooks };
  };

  const tick = (t) => {
    if (!current || !current.anim) return;
    if (current.pendingStart) {
      current.pendingStart = false;
      const { hooks, issueId } = current;
      current.anim.userData.start(t + current.delay, () => { if (current && current.issueId === issueId) { focus.userData.setPlateBusy(issueId, false); } hooks.onDone?.(issueId); }, () => hooks.onClick?.(issueId));
    }
    current.anim.userData.tick(t);
  };

  g.userData = { set, tick, clear, active: () => !!current && current.phase === 'confirmed' };
  return g;
}
