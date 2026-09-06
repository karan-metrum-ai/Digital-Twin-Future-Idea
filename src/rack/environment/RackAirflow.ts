// @ts-nocheck
/* eslint-disable */
// Airflow + heat simulation for the ten non-interactive racks in the two rows: each gets its own intake/exhaust
// particle sim (HeatSim), its own cold-air vapour rising off its own raised-floor grille (CoolingVapor +
// CoolingFloor), built once in "rack-local" coordinates (identical to how the interactive rack's own systems
// are built) and then instanced at every rack's placement via a wrapper group — the same position/rotation
// transform `RackRow.buildRackReplicas` uses for the visual geometry. Particle counts are scaled down per
// replica (they're numerous and mostly read at a glance from a distance) to keep the combined point budget
// reasonable.
import { rackPlacement, ROW_XS } from './RackRow';
import { buildHeatSim } from '../thermal/HeatSim';
import { buildCoolingVapor } from '../thermal/CoolingVapor';
import { buildCoolingFloor } from './CoolingFloor';

const REPLICA_DENSITY = 0.15; // fraction of the interactive rack's particle count, per replica

export function buildRackAirflowReplicas(THREE, slots) {
  const group = new THREE.Group(); group.name = 'rack_airflow_replicas';
  const instances = [];
  for (const row of ['A', 'B']) for (let i = 0; i < ROW_XS.length; i++) {
    const { x, z, rotY } = rackPlacement(row, i);
    const wrap = new THREE.Group(); wrap.name = `rack_airflow_${row}${i}`; wrap.position.set(x, 0, z); wrap.rotation.y = rotY;
    const floor = buildCoolingFloor(THREE);
    const heat = buildHeatSim(THREE, slots, REPLICA_DENSITY);
    const vapor = buildCoolingVapor(THREE, REPLICA_DENSITY);
    wrap.add(floor, heat, vapor);
    group.add(wrap);
    instances.push({ heat, vapor });
  }
  group.userData.tick = (t, pr) => { for (const { heat, vapor } of instances) { heat.userData.tick(t, pr); vapor.userData.tick(t, pr); } };
  group.userData.setAirVisible = (on) => { for (const { heat, vapor } of instances) { heat.visible = on; vapor.visible = on; } };
  return group;
}
