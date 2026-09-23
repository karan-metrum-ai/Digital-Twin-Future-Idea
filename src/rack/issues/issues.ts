// Rack registry + dummy operational issues for the data-hall digital twin. Every rack in the hall has a stable id
// (the ten baked replicas in rows A/B plus the interactive rack), and each issue is pinned to a rack and a U slot.
// The issues are static demo data — the panel treats them as the current open-alarm list from monitoring.
import { LIVE_RACK_PLACEMENT, rackPlacement, ROW_XS } from '../environment/RackRow';

export type IssueCategory = 'storage' | 'compute' | 'network' | 'facility';
export type IssueSeverity = 'critical' | 'major' | 'minor';

export interface RackInfo {
  /** Stable id, e.g. "A-03". Also the name used in the panel. */
  id: string;
  /** Row letter ('A' | 'B'), or 'X' for the free-standing interactive rack. */
  row: 'A' | 'B' | 'X';
  index: number;
  label: string;
  /** World placement of the rack's floor-centre and its yaw. */
  x: number;
  z: number;
  rotY: number;
  /** Whether this is the fully interactive rack (doors, exploded view, thermal camera). */
  live: boolean;
}

/** Operator-triggerable fix for an issue (drives the slide-to-confirm control and the scene's technician/FRU animation). */
export type RemediationAction =
  | 'reseat_patch_cable' | 'replace_drive' | 'reseat_gpu' | 'replace_optic' | 'replace_nvme' | 'fit_blanking_panel'
  | 'replace_psu' | 'replace_fan' | 'replace_dimm' | 'restart_kubelet' | 'reseat_patch_panel_cable' | 'tighten_manifold_qd';
/** Field-replaceable-unit proxy the scene animates on the rack front; 'none' = software-only (console strip). */
export type FruKind = 'drive' | 'gpu_sled' | 'sfp' | 'nvme' | 'blank' | 'psu' | 'fan' | 'dimm_tray' | 'cable' | 'qd_coupling' | 'none';

export interface Remediation {
  action: RemediationAction;
  /** Short imperative label shown on the slider ("Hot-swap failed drives"). */
  label: string;
  fru: FruKind;
  /** Hands-on time the scene animation takes, seconds. */
  durationS: number;
  /** Closing note once the fix lands ("Link restored"). */
  doneMessage: string;
  port?: number;
}

export interface RackIssue {
  id: string;
  rackId: string;
  /** Bottom U of the affected device. */
  u: number;
  device: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  summary: string;
  /** Minutes since the alarm first raised. */
  ageMin: number;
  /** Log excerpt shown when the issue is opened. */
  logs: string[];
  remediation?: Remediation;
}

export const LIVE_RACK_ID = 'X-01';
/** The open issue that the fault patch cable on the interactive rack represents (cleared by the reseat flow). */
export const FAULT_CABLE_ISSUE_ID = 'INC-4802';

const pad = (i: number) => String(i + 1).padStart(2, '0');

export const RACKS: RackInfo[] = [
  ...(['A', 'B'] as const).flatMap((row) => ROW_XS.map((_, i) => {
    const p = rackPlacement(row, i);
    return { id: `${row}-${pad(i)}`, row, index: i, label: `Rack ${row}-${pad(i)}`, x: p.x, z: p.z, rotY: p.rotY, live: false } as RackInfo;
  })),
  { id: LIVE_RACK_ID, row: 'X', index: 0, label: 'Rack X-01 · interactive', x: LIVE_RACK_PLACEMENT.x, z: LIVE_RACK_PLACEMENT.z, rotY: LIVE_RACK_PLACEMENT.rotY, live: true },
];

export const RACK_BY_ID: Record<string, RackInfo> = Object.fromEntries(RACKS.map((r) => [r.id, r]));

export const CATEGORY_LABEL: Record<IssueCategory, string> = { storage: 'Storage', compute: 'Compute', network: 'Network', facility: 'Facility' };
/** Leak-detection zone (1 = row A, 2 = row B) that a facility issue on `rackId` trips, or null. */
export function leakZoneForIssue(issue: RackIssue): number | null {
  if (issue.remediation?.action !== 'tighten_manifold_qd') return null;
  const info = RACK_BY_ID[issue.rackId]; return info?.row === 'A' ? 1 : info?.row === 'B' ? 2 : null;
}
export const SEVERITY_LABEL: Record<IssueSeverity, string> = { critical: 'Critical', major: 'Major', minor: 'Minor' };
export const SEVERITY_RANK: Record<IssueSeverity, number> = { critical: 0, major: 1, minor: 2 };
/** Severity colours, shared by the panel chips and the 3D badges (kept close to the HUD STATUS palette). */
export const SEVERITY_COLOR: Record<IssueSeverity, string> = { critical: '#d03b3b', major: '#ec835a', minor: '#fab219' };

const ts = (m: number) => { const d = new Date(Date.now() - m * 60_000); return d.toISOString().replace('T', ' ').slice(0, 19) + 'Z'; };

export const DEMO_ISSUES: RackIssue[] = [
  {
    id: 'INC-4821', rackId: 'A-02', u: 6, device: 'stor-a02-u06 (3U storage)', category: 'storage', severity: 'critical',
    title: 'RAID-6 array degraded — 2 drives failed', summary: 'Volume vol_ceph_03 running with no parity margin; a third failure loses data.', ageMin: 42,
    logs: [
      `${ts(42)} megaraid  CRIT  Enclosure 0 slot 07: drive state FAILED (SMART 0x05 reallocated sectors threshold)`,
      `${ts(41)} megaraid  CRIT  Enclosure 0 slot 11: drive state FAILED (media error count 214)`,
      `${ts(41)} megaraid  WARN  VD 3 (vol_ceph_03) state: DEGRADED — 0 of 2 parity drives remaining`,
      `${ts(40)} ceph-osd  WARN  osd.37 slow ops: 128 requests > 30 s (backfill throttled)`,
      `${ts(12)} monitor   INFO  Hot-spare pool empty; dispatch drive replacement to A-02 U06`,
    ],
    remediation: { action: 'replace_drive', label: 'Hot-swap failed drives (slots 7, 11)', fru: 'drive', durationS: 6, doneMessage: 'Drives replaced · VD 3 rebuilding (ETA 4 h 10 min)' },
  },
  {
    id: 'INC-4819', rackId: 'B-04', u: 20, device: 'gpu-b04-u20 (4U GPU node)', category: 'compute', severity: 'critical',
    title: 'GPU 3 Xid 79 — fell off the bus', summary: 'Training job hpc-7731 crashed; node isolated from the scheduler pending reseat.', ageMin: 18,
    logs: [
      `${ts(18)} kernel    ERR   NVRM: Xid (PCI:0000:c1:00): 79, pid=0, GPU has fallen off the bus.`,
      `${ts(18)} kernel    ERR   pcieport 0000:c0:03.1: AER: Uncorrected (Fatal) error received: id=c018`,
      `${ts(17)} nvidia-smi WARN  Unable to determine the device handle for GPU 0000:C1:00.0: Unknown Error`,
      `${ts(17)} slurmd    ERR   job 7731 step 0 failed: NCCL unhandled cuda error (device 3)`,
      `${ts(16)} slurmctld INFO  node gpu-b04-u20 set DRAIN reason="gpu xid 79"`,
    ],
    remediation: { action: 'reseat_gpu', label: 'Pull GPU sled, reseat GPU 3', fru: 'gpu_sled', durationS: 7, doneMessage: 'GPU 3 back on the bus · node returned to service' },
  },
  {
    id: 'INC-4816', rackId: 'A-05', u: 39, device: 'sw-a05-core-1 (48-port ToR)', category: 'network', severity: 'major',
    title: 'Uplink Ethernet1/49 flapping — CRC errors', summary: 'Spine uplink bounced 14 times in 10 min; LACP bundle running on one member.', ageMin: 9,
    logs: [
      `${ts(9)}  %LINK-3-UPDOWN     Interface Ethernet1/49, changed state to down`,
      `${ts(9)}  %LINK-3-UPDOWN     Interface Ethernet1/49, changed state to up`,
      `${ts(8)}  %ETHPORT-5-IF_ERR  Ethernet1/49: 3,182 input CRC errors in last 60 s`,
      `${ts(6)}  %LACP-5-BUNDLE     Ethernet1/49 removed from port-channel10 (partner timeout)`,
      `${ts(4)}  %OPTICS-4-WARN     Ethernet1/49 Rx power -14.9 dBm below low-warning threshold (-12.0 dBm)`,
    ],
    remediation: { action: 'replace_optic', label: 'Replace Ethernet1/49 optic', fru: 'sfp', durationS: 5, doneMessage: 'Optic replaced · Rx -3.1 dBm · rejoined port-channel10', port: 49 },
  },
  {
    id: 'INC-4812', rackId: 'B-01', u: 17, device: 'db-b01-u17 (2U SFF)', category: 'storage', severity: 'major',
    title: 'NVMe wear at 97% — predictive failure', summary: 'nvme1n1 (boot mirror) has exhausted its rated write endurance.', ageMin: 131,
    logs: [
      `${ts(131)} smartd   WARN  /dev/nvme1n1: Percentage Used 97% (rated endurance 1.2 PBW)`,
      `${ts(131)} smartd   WARN  /dev/nvme1n1: Available Spare 6% below threshold 10%`,
      `${ts(95)}  mdadm    INFO  md0: nvme1n1p2 pending re-sync (mismatch_cnt 128)`,
      `${ts(60)}  monitor  INFO  Ticket opened: replace nvme1n1 in B-01 U17 during next maintenance window`,
    ],
    remediation: { action: 'replace_nvme', label: 'Replace nvme1n1', fru: 'nvme', durationS: 6, doneMessage: 'nvme1n1 replaced · md0 resync started' },
  },
  {
    id: 'INC-4808', rackId: 'X-01', u: 26, device: 'app-x01-u26 (1U)', category: 'compute', severity: 'major',
    title: 'CPU thermal throttling — inlet 31 °C', summary: 'Package hitting PROCHOT; sustained clocks down 38% under load.', ageMin: 27,
    logs: [
      `${ts(27)} kernel    WARN  CPU0: Package temperature above threshold, cpu clock throttled (total events = 4128)`,
      `${ts(27)} ipmi      WARN  Sensor 'Inlet Temp' reading 31 C exceeds upper non-critical (27 C)`,
      `${ts(25)} ipmi      INFO  Fan1..Fan6 ramped to 100% (14,200 rpm)`,
      `${ts(20)} turbostat INFO  Avg_MHz 1,720 (nominal 2,800) — 38% sustained derate`,
      `${ts(10)} monitor   INFO  Check blanking panels / airflow for X-01; possible recirculation from hot aisle`,
    ],
    remediation: { action: 'fit_blanking_panel', label: 'Fit blanking panels, clear recirculation', fru: 'blank', durationS: 5, doneMessage: 'Inlet 24 °C · clocks back to nominal' },
  },
  {
    id: 'INC-4802', rackId: 'X-01', u: 39, device: 'sw-x01-core-48p (48-port ToR)', category: 'network', severity: 'major',
    title: 'Port 9 link down — patch cable unseated', summary: 'RJ45 backed out of Ethernet1/9 on the core switch; app-x01-u13 has lost its primary uplink. Reseat from the top bar.', ageMin: 14,
    logs: [
      `${ts(14)} %LINK-3-UPDOWN     Interface Ethernet1/9, changed state to down`,
      `${ts(14)} %ETHPORT-5-IF_DOWN_LINK_FAILURE  Ethernet1/9 is down (Link failure)`,
      `${ts(13)} lldpd      WARN  neighbor app-x01-u13 (eth0) aged out on Ethernet1/9`,
      `${ts(12)} monitor    INFO  Cable test: open pair 1-2 at 0.0 m — connector not seated at switch end`,
      `${ts(9)}  monitor    INFO  Remediation available: reseat patch cable (INC-4802)`,
    ],
    remediation: { action: 'reseat_patch_cable', label: 'Reseat patch cable on port 9', fru: 'cable', durationS: 2.2, doneMessage: 'Link restored · 10GbE full-duplex', port: 9 },
  },
  {
    id: 'INC-4805', rackId: 'A-03', u: 36, device: 'sw-a03-mgmt (24-port)', category: 'network', severity: 'minor',
    title: 'PSU-2 lost input power', summary: 'Switch running on a single PSU; PDU outlet 14 on the left vertical PDU reads 0 A.', ageMin: 210,
    logs: [
      `${ts(210)} %PLATFORM-2-PS_FAIL   Power supply 2 failed or shutdown (Serial number ABC12345)`,
      `${ts(210)} %PLATFORM-4-PS_REDUND Power supply redundancy lost`,
      `${ts(208)} pdu-a03-L INFO  Outlet 14 current 0.00 A (was 0.42 A)`,
    ],
    remediation: { action: 'replace_psu', label: 'Swap PSU-2', fru: 'psu', durationS: 6, doneMessage: 'PSU-2 online · redundancy restored' },
  },
  {
    id: 'INC-4801', rackId: 'B-03', u: 1, device: 'stor-b03-u01 (4U storage)', category: 'storage', severity: 'minor',
    title: 'Backplane fan 2 below RPM floor', summary: 'Fan 2 at 1,900 rpm against a 2,400 rpm floor; drive bay temps trending +4 °C.', ageMin: 322,
    logs: [
      `${ts(322)} ipmi     WARN  Sensor 'FAN2' reading 1900 RPM below lower non-critical (2400 RPM)`,
      `${ts(300)} smartd   INFO  /dev/sdk: temperature 41 C (was 37 C 1 h ago)`,
      `${ts(180)} smartd   INFO  /dev/sdl: temperature 42 C (was 38 C 1 h ago)`,
    ],
    remediation: { action: 'replace_fan', label: 'Replace backplane fan 2', fru: 'fan', durationS: 5, doneMessage: 'FAN2 6,100 rpm · bay temps falling' },
  },
  {
    id: 'INC-4797', rackId: 'A-01', u: 14, device: 'web-a01-u14 (1U)', category: 'compute', severity: 'minor',
    title: 'Correctable ECC errors — DIMM_B2', summary: '1,204 corrected errors in 24 h; above the page-retirement threshold.', ageMin: 480,
    logs: [
      `${ts(480)} EDAC MC0 INFO  1 CE memory read error on CPU_SrcID#0_MC#1_Chan#1_DIMM#0 (DIMM_B2)`,
      `${ts(240)} rasdaemon WARN  DIMM_B2 CE count 24h: 1204 (threshold 1000)`,
      `${ts(200)} monitor   INFO  Schedule DIMM_B2 replacement on A-01 U14`,
    ],
    remediation: { action: 'replace_dimm', label: 'Replace DIMM_B2', fru: 'dimm_tray', durationS: 7, doneMessage: 'DIMM_B2 replaced · memtest clean · CE count 0' },
  },
  {
    id: 'INC-4794', rackId: 'B-02', u: 9, device: 'k8s-b02-u09 (2U SFF)', category: 'compute', severity: 'major',
    title: 'Node NotReady — kubelet PLEG unhealthy', summary: '38 pods evicted; containerd hung on an overlayfs mount, node cordoned by the controller.', ageMin: 6,
    logs: [
      `${ts(6)} kubelet    ERR   PLEG is not healthy: pleg was last seen active 3m12s ago; threshold is 3m0s`,
      `${ts(6)} containerd WARN  failed to handle container TaskExit event: context deadline exceeded (id=8f2c…)`,
      `${ts(5)} kubelet    WARN  Node k8s-b02-u09 status is now: NodeNotReady`,
      `${ts(5)} kube-ctrl  INFO  Cordoned k8s-b02-u09; evicting 38 pods (grace 30 s)`,
      `${ts(3)} kernel     WARN  INFO: task containerd-shim:41823 blocked for more than 120 seconds (overlayfs)`,
    ],
    remediation: { action: 'restart_kubelet', label: 'Restart containerd + kubelet', fru: 'none', durationS: 4, doneMessage: 'Node Ready · uncordoned · 38 pods rescheduled' },
  },
  {
    id: 'INC-4790', rackId: 'B-05', u: 34, device: 'pp-b05-u34 (patch panel)', category: 'network', severity: 'minor',
    title: 'Port 17 link light dark — patch cable unplugged', summary: 'Server at U25 lost its OOB link; cable audit shows port 17 loose.', ageMin: 55,
    logs: [
      `${ts(55)} %LINK-3-UPDOWN  Interface GigabitEthernet0/17, changed state to down (mgmt VLAN 99)`,
      `${ts(54)} ipmi        WARN  BMC of app-b05-u25 unreachable (ping timeout x5)`,
    ],
    remediation: { action: 'reseat_patch_panel_cable', label: 'Reseat port 17 patch cable', fru: 'cable', durationS: 3, doneMessage: 'Gi0/17 up · BMC of app-b05-u25 reachable', port: 17 },
  },
  {
    id: 'INC-4825', rackId: 'A-04', u: 41, device: 'dlc-a04-manifold (supply drop QD)', category: 'facility', severity: 'major',
    title: 'Leak zone 1 wet — drip at A-04 supply drop', summary: 'Leak-detection rope reads wet at 14.2 m, under the A-04 header drop; CDU-01 make-up water ticked +0.3 L. Supply QD collar likely under-torqued after last service.', ageMin: 3,
    logs: [
      `${ts(3)} leak-ctrl-1 CRIT  Zone 1 WET at 14.2 m (cable 38.0 m) — SUPPLY HEADER · A-04 DROP`,
      `${ts(3)} cdu-01     WARN  Make-up water +0.3 L in 10 min (baseline 0.0 L)`,
      `${ts(2)} cdu-01     INFO  Secondary loop pressure 2.41 bar (was 2.43) — within band`,
      `${ts(2)} bms        INFO  Leak zone 1 alarm forwarded to DC ops; isolation valve A-04 ready`,
      `${ts(1)} monitor    INFO  Remediation available: re-torque supply QD collar at A-04 manifold`,
    ],
    remediation: { action: 'tighten_manifold_qd', label: 'Re-torque A-04 supply QD collar', fru: 'qd_coupling', durationS: 5, doneMessage: 'Collar torqued · zone 1 DRY · make-up water stable' },
  },
];

export function issuesForRack(issues: RackIssue[], rackId: string) {
  return issues.filter((i) => i.rackId === rackId).sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/** The worst open severity per rack plus the open count (drives the 3D badges). */
export function worstSeverityByRack(issues: RackIssue[]) {
  const out: Record<string, { severity: IssueSeverity; count: number }> = {};
  for (const i of issues) {
    const cur = out[i.rackId];
    if (!cur) out[i.rackId] = { severity: i.severity, count: 1 };
    else { cur.count++; if (SEVERITY_RANK[i.severity] < SEVERITY_RANK[cur.severity]) cur.severity = i.severity; }
  }
  return out;
}
