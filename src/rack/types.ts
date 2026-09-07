// Shared types for the rack model and the ServerRackTwin component.
import type React from 'react';
import type { RackIssue } from './issues/issues';

export type { RackIssue, RackInfo, IssueCategory, IssueSeverity } from './issues/issues';

export type Slot = { y: number; h: number; zr: number };
export type RackView = 'visual' | 'thermal' | 'liquid';
/** Remediation state of the unseated patch cable on the interactive rack. */
export type SwitchFixPhase = 'idle' | 'requested' | 'confirmed' | 'done';

/** One decomposable rack item, as reported through `onItems` for building a parts legend. */
export interface RackItemMeta {
  kind: string;
  label: string;
}

export interface ServerRackTwinProps {
  /** Open issues to list in the side panel and badge over racks; defaults to the built-in demo set. */
  issues?: RackIssue[];
  /** Hide the open-issues panel (badges and rack selection still work). */
  showIssues?: boolean;
  /** Controlled rack selection (rack id, e.g. "A-03"; null = none). Uncontrolled when omitted. */
  selectedRack?: string | null;
  /** Fires when a rack is picked in the scene or from the issues panel (null when the selection is cleared). */
  onSelectRack?: (id: string | null) => void;
  /**
   * 'requested' flies the camera to the switch and opens the front door (remediation API call in flight);
   * 'confirmed' (API responded) plays the reseat animation; 'done' keeps the cable seated. Default 'idle'.
   */
  switchFix?: SwitchFixPhase;
  /** Fires once the reseat animation has finished and the cable has returned to normal. */
  onSwitchFixDone?: () => void;
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
