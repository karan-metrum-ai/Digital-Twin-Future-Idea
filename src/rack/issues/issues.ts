// Rack registry + dummy operational issues for the data-hall digital twin. Every rack in the hall has a stable id
// (the ten baked replicas in rows A/B plus the interactive rack), and each issue is pinned to a rack and a U slot.
// The issues are static demo data — the panel treats them as the current open-alarm list from monitoring.
import { LIVE_RACK_PLACEMENT, rackPlacement, ROW_XS } from '../environment/RackRow';

export type IssueCategory = 'storage' | 'compute' | 'network';
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
}

export const LIVE_RACK_ID = 'X-01';

const pad = (i: number) => String(i + 1).padStart(2, '0');

export const RACKS: RackInfo[] = [
  ...(['A', 'B'] as const).flatMap((row) => ROW_XS.map((_, i) => {
    const p = rackPlacement(row, i);
    return { id: `${row}-${pad(i)}`, row, index: i, label: `Rack ${row}-${pad(i)}`, x: p.x, z: p.z, rotY: p.rotY, live: false } as RackInfo;
  })),
  { id: LIVE_RACK_ID, row: 'X', index: 0, label: 'Rack X-01 · interactive', x: LIVE_RACK_PLACEMENT.x, z: LIVE_RACK_PLACEMENT.z, rotY: LIVE_RACK_PLACEMENT.rotY, live: true },
];

export const RACK_BY_ID: Record<string, RackInfo> = Object.fromEntries(RACKS.map((r) => [r.id, r]));

export const CATEGORY_LABEL: Record<IssueCategory, string> = { storage: 'Storage', compute: 'Compute', network: 'Network' };
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
  },
  {
    id: 'INC-4805', rackId: 'A-03', u: 36, device: 'sw-a03-mgmt (24-port)', category: 'network', severity: 'minor',
    title: 'PSU-2 lost input power', summary: 'Switch running on a single PSU; PDU outlet 14 on the left vertical PDU reads 0 A.', ageMin: 210,
    logs: [
      `${ts(210)} %PLATFORM-2-PS_FAIL   Power supply 2 failed or shutdown (Serial number ABC12345)`,
      `${ts(210)} %PLATFORM-4-PS_REDUND Power supply redundancy lost`,
      `${ts(208)} pdu-a03-L INFO  Outlet 14 current 0.00 A (was 0.42 A)`,
    ],
  },
  {
    id: 'INC-4801', rackId: 'B-03', u: 1, device: 'stor-b03-u01 (4U storage)', category: 'storage', severity: 'minor',
    title: 'Backplane fan 2 below RPM floor', summary: 'Fan 2 at 1,900 rpm against a 2,400 rpm floor; drive bay temps trending +4 °C.', ageMin: 322,
    logs: [
      `${ts(322)} ipmi     WARN  Sensor 'FAN2' reading 1900 RPM below lower non-critical (2400 RPM)`,
      `${ts(300)} smartd   INFO  /dev/sdk: temperature 41 C (was 37 C 1 h ago)`,
      `${ts(180)} smartd   INFO  /dev/sdl: temperature 42 C (was 38 C 1 h ago)`,
    ],
  },
  {
    id: 'INC-4797', rackId: 'A-01', u: 14, device: 'web-a01-u14 (1U)', category: 'compute', severity: 'minor',
    title: 'Correctable ECC errors — DIMM_B2', summary: '1,204 corrected errors in 24 h; above the page-retirement threshold.', ageMin: 480,
    logs: [
      `${ts(480)} EDAC MC0 INFO  1 CE memory read error on CPU_SrcID#0_MC#1_Chan#1_DIMM#0 (DIMM_B2)`,
      `${ts(240)} rasdaemon WARN  DIMM_B2 CE count 24h: 1204 (threshold 1000)`,
      `${ts(200)} monitor   INFO  Schedule DIMM_B2 replacement on A-01 U14`,
    ],
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
  },
  {
    id: 'INC-4790', rackId: 'B-05', u: 34, device: 'pp-b05-u34 (patch panel)', category: 'network', severity: 'minor',
    title: 'Port 17 link light dark — patch cable unplugged', summary: 'Server at U25 lost its OOB link; cable audit shows port 17 loose.', ageMin: 55,
    logs: [
      `${ts(55)} %LINK-3-UPDOWN  Interface GigabitEthernet0/17, changed state to down (mgmt VLAN 99)`,
      `${ts(54)} ipmi        WARN  BMC of app-b05-u25 unreachable (ping timeout x5)`,
    ],
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
