# 42U Interactive Server Rack

React + Vite + TypeScript app for the interactive 42U server rack twin (three.js).

## Setup

```bash
npm install
npm run dev
```

## Usage

The app boots the `Playground` demo from `src/rack/Playground.tsx`:

- Visual / Thermal camera / Liquid cooling views
- Two-row hot-aisle hall: the interactive rack sits in the middle of a row of five facing front, with a second row of
  five behind it turned 180° so the rears face each other across a 1.2 m hot aisle. The nine neighbours are baked
  replicas of the procedural rack (merged per material, so each costs a few dozen draw calls) — see
  `src/rack/environment/RackRow.ts` for the layout constants
- Heat simulation and liquid cooling run on all ten racks, not just the interactive one. Every rack gets its own
  intake/exhaust airflow particles and cold-air vapour off its own floor grille (`RackAirflow.ts`, reduced particle
  density on the nine replicas), and its own liquid-cooling manifolds, feed hoses and per-server quick-disconnect
  branch hoses with animated coolant flow, fed by that row's overhead headers and CDU. The interactive rack's hoses
  stay individually meshed (so they can hide per-server in the exploded view); the other nine racks' hose hardware
  is built once and baked+merged per material, then cloned at each placement, and their coolant-flow particles share
  one animated geometry buffer across all ten racks — so wiring every rack costs a few dozen extra draw calls, not
  thousands.
- Liquid cooling mode — direct-to-chip loop modelled on a real DLC row: overhead stainless supply/return headers
  (one pair per row) with valved drops into every rack, an end-of-row CDU per row, side-mounted rack manifolds and
  black quick-disconnect branch hoses (blue/red collars) with animated coolant flow on every rack; the rear door
  lifts off and the camera flies to a rear three-quarter view. Telemetry HUD (scoped to the interactive rack's
  CDU-01): flow (L/min) and rack ΔP (bar) gauges, 1 Hz time-series for pump efficiency, supply/return ΔT and CDU
  energy, and predictive analytics (pump bearing vibration vs ISO 10816 zones with a 30-day forecast to alarm,
  coolant conductivity / pH / particulate degradation). `?view=liquid` deep-links it.
- Front covers and airflow toggles
- Randomize load temperatures
- Exploded view — pulls every component (servers, blanks, switches, patch panels, cable managers, PDUs, NUC) apart, with a live parts-count legend
- Download GLB export

## Code structure

`src/ServerRackTwin.tsx` is a thin React component (mounts the three.js scene, wires up props/UI). The
procedural rack model itself is decomposed under `src/rack/`, one file per concern:

```
src/rack/
  types.ts                    Shared types (Slot, RackView, ServerRackTwinProps)
  textures.ts                 Procedural canvas texture factory
  materials.ts                Material factory built from the textures
  hexBezelLattice.ts          Hex bezel normal/alpha/colour map generator
  RackContext.ts              Shared build context: constants, mesh primitives, exploded-view plumbing
  buildRack.ts                Orchestrator — assembles the frame + full 1U-42U layout + cabling
  frame/RackFrame.ts          Enclosure: base/top, corner posts, casters, side panels, doors
  components/                 One file per rack component
    Server.ts                 1U/2U/3U/4U server chassis (SFF/LFF/GPU drive layouts, bezel/cover)
    BlankPanel.ts              Blanking panel
    NetworkSwitch.ts            24/48-port switch
    PatchPanel.ts                24-port patch panel
    CableManager.ts               1U cable manager
    HorizontalPdu.ts                1U C13 PDU
    VerticalPdu.ts                   Full-height rear PDU
    Nuc.ts                            3U shelf with eight mini PCs on edge + patch leads
  cabling/wireCabling.ts      Patch/power/network cable routing pass
  environment/                Floor, ladder + lights, cooling grill
    RackRow.ts                Two-row hot-aisle layout + baked rack replicas
    RackAirflow.ts            Heat/vapor particle sims instanced at every replica rack
  thermal/                    Airflow particle sim + thermal camera shader
  liquid/                     Liquid cooling mode
    LiquidLoop.ts             Headers/drops/CDU per row + manifolds/hoses/flow on every rack (baked+merged for replicas)
    LiquidLoopSim.ts          Lumped hydraulic loop model + 30-day condition forecasts (pure TS)
    charts.tsx                SVG chart kit: line chart w/ hover + table view, gauge, stat tile
    LiquidHud.tsx             The telemetry / predictive-analytics panel
  Playground.tsx              Demo harness
```

Each component builder takes the shared `ctx` (from `RackContext.ts`) as its first argument instead of closing
over free variables, so components stay independently readable/editable while sharing the same textures,
materials, and mesh-primitive helpers.

Original export sources remain under `export/` for reference.
