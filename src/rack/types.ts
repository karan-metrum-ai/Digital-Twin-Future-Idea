// Shared types for the rack model and the ServerRackTwin component.
import type React from 'react';
import type { RackIssue } from './issues/issues';
import type { PowerPhase } from './power/PowerEvent';

export type { RackIssue, RackInfo, IssueCategory, IssueSeverity, Remediation, RemediationAction, FruKind } from './issues/issues';
export type { PowerPhase, PowerInfo, LedMode } from './power/PowerEvent';

export type Slot = { y: number; h: number; zr: number };

/** Toggleable scene items (the "Scene items" dropdown beside the view tabs). */
export type SceneLayer =
  | 'technician' | 'alarmCards' | 'overheadCabling' | 'staffDoor' | 'nocWall' | 'leakDetection'
  | 'busway' | 'floorPdus' | 'ups' | 'genset'
  | 'fireSuppression' | 'vesda' | 'alarmDevices';
export type SceneLayers = Record<SceneLayer, boolean>;
export interface SceneLayerDef { id: SceneLayer; label: string; group: string; hint?: string }
export const SCENE_LAYER_DEFS: SceneLayerDef[] = [
  { id: 'technician', label: 'Technician', group: 'People', hint: 'Does rounds; dispatched by a remediation' },
  { id: 'alarmCards', label: 'Alarm cards & beacons', group: 'Monitoring', hint: 'On-rack incident cards, roof beacons, rack nameplates' },
  { id: 'nocWall', label: 'NOC video wall', group: 'Monitoring' },
  { id: 'leakDetection', label: 'Leak-detection rope', group: 'Monitoring' },
  { id: 'overheadCabling', label: 'Overhead cable trays', group: 'Facility' },
  { id: 'staffDoor', label: 'Staff door & badge reader', group: 'Facility' },
  { id: 'busway', label: 'Busway & drop cords', group: 'Power' },
  { id: 'floorPdus', label: 'Floor PDUs', group: 'Power' },
  { id: 'ups', label: 'UPS bank', group: 'Power' },
  { id: 'genset', label: 'Standby genset & day tank', group: 'Power' },
  { id: 'fireSuppression', label: 'Clean-agent cylinders & nozzles', group: 'Life safety' },
  { id: 'vesda', label: 'VESDA smoke detection', group: 'Life safety' },
  { id: 'alarmDevices', label: 'Pull station & horn/strobes', group: 'Life safety' },
];
export const DEFAULT_SCENE_LAYERS: SceneLayers = {
  technician: true, alarmCards: true, nocWall: true, leakDetection: true, overheadCabling: true, staffDoor: true,
  busway: true, floorPdus: true, ups: true, genset: false,
  fireSuppression: false, vesda: true, alarmDevices: true,
};
export type RackView = 'visual' | 'thermal' | 'liquid';
/**
 * Lifecycle of the one remediation that can be in flight at a time. 'requested': API call in flight, technician
 * dispatched, camera flying to the rack; 'confirmed': API responded, the fix is being acted out on the rack;
 * 'done': the issue has cleared; 'idle': nothing active.
 */
export type RemediationPhase = 'idle' | 'requested' | 'confirmed' | 'done';
export interface RemediationState { issueId: string | null; phase: RemediationPhase }
export const REMEDIATION_IDLE: RemediationState = { issueId: null, phase: 'idle' };

/** One decomposable rack item, as reported through `onItems` for building a parts legend. */
export interface RackItemMeta {
  kind: string;
  label: string;
}

export interface ServerRackTwinProps {
  /** Open issues to mark on the racks; defaults to the built-in demo set. */
  issues?: RackIssue[];
  /** Controlled rack selection (rack id, e.g. "A-03"; null = none). Uncontrolled when omitted. */
  selectedRack?: string | null;
  /** Fires when a rack is picked in the scene (null when the selection is cleared). */
  onSelectRack?: (id: string | null) => void;
  /** Active remediation (see RemediationState). Default idle. */
  remediation?: RemediationState;
  /** Operator committed the slide-to-confirm for `issue` in the detail modal. */
  onRemediate?: (issue: RackIssue) => void;
  /** Fires once the scene has finished acting out the fix for `issueId`. */
  onRemediationDone?: (issueId: string) => void;
  /** Status line shown in the modal under the slider (API result / error). */
  remediationNote?: string | null;
  /** Which scene items are shown; uncontrolled (remembered per browser) when omitted. */
  layers?: Partial<SceneLayers>;
  onLayersChange?: (layers: SceneLayers) => void;
  /** Increment to run the scripted utility-loss event (UPS -> generator -> utility). */
  powerEvent?: number;
  /** Fires on every phase change of the utility-loss event. */
  onPowerPhase?: (phase: PowerPhase) => void;
  /** Per-server-slot load temperature 0..1 (bottom → top). Drives thermal view. */
  temps?: number[];
  view?: RackView;
  onViewChange?: (v: RackView) => void;
  showCovers?: boolean;
  showAirflow?: boolean;
  /** 0 = assembled, 1 = fully exploded — separates every server, blank, switch, patch panel, cable manager, PDU and the NUC into free space. */
  explode?: number;
  /** Called once after the rack is built with every decomposable component (kind + label), for building a parts legend. */
  onItems?: (items: RackItemMeta[]) => void;
  background?: string;
  className?: string;
  style?: React.CSSProperties;
}
