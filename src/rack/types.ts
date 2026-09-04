// Shared types for the rack model and the ServerRackTwin component.
import type React from 'react';

export type Slot = { y: number; h: number; zr: number };
export type RackView = 'visual' | 'thermal';

/** One decomposable rack item, as reported through `onItems` for building a parts legend. */
export interface RackItemMeta {
  kind: string;
  label: string;
}

export interface ServerRackTwinProps {
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
