// @ts-nocheck
/* eslint-disable */
// Central quality knobs for the digital twin. Import from scene builders when adding new heavy content.
// Defaults target interactive FPS on mid-range GPUs while keeping close-up realism on the live rack.

export const QUALITY = {
  /** Cap device pixel ratio (plan: 1.5). */
  maxPixelRatio: 1.5,
  /** Key-light shadow map edge length. */
  shadowMapSize: 1024,
  /** Live heat-sim particle density multiplier base count factor (applied in HeatSim). */
  liveHeatCount: 1400,
  /** Live cooling-vapor particle base count. */
  liveVaporCount: 300,
  /** Replica airflow density vs live rack. */
  replicaAirflowDensity: 0.15,
  /** Tube path / radial segments for rack cables. */
  cableTubeSegments: 20,
  cableRadialSegments: 6,
  /** Liquid hose tube path / radial segments. */
  liquidTubeSegments: 24,
  liquidRadialSegments: 8,
  /** Liquid flow particle budgets. */
  rackFlowN: 900,
  headerFlowN: 220,
  /** Texture anisotropy cap. */
  anisotropy: 4,
};
