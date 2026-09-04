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
- Liquid cooling mode — direct-to-chip loop modelled on a real DLC row: overhead stainless supply/return headers
  with valved drops into every rack, an end-of-row CDU, side-mounted rack manifolds and black quick-disconnect
  branch hoses (blue/red collars) with animated coolant flow; the rear door lifts off and the camera flies to a rear
  three-quarter view. Telemetry HUD: flow (L/min) and rack ΔP (bar) gauges, 1 Hz time-series for pump efficiency,
  supply/return ΔT and CDU energy, and predictive analytics (pump bearing vibration vs ISO 10816 zones with a
  30-day forecast to alarm, coolant conductivity / pH / particulate degradation). `?view=liquid` deep-links it.
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
  environment/                Floor, neighbour racks, studio lighting
  thermal/                    Airflow particle sim + thermal camera shader
  liquid/                     Liquid cooling mode
    LiquidLoop.ts             Overhead headers + drops, end-of-row CDU, rack manifolds, branch hoses, flow particles
    LiquidLoopSim.ts          Lumped hydraulic loop model + 30-day condition forecasts (pure TS)
    charts.tsx                SVG chart kit: line chart w/ hover + table view, gauge, stat tile
    LiquidHud.tsx             The telemetry / predictive-analytics panel
  Playground.tsx              Demo harness
```

Each component builder takes the shared `ctx` (from `RackContext.ts`) as its first argument instead of closing
over free variables, so components stay independently readable/editable while sharing the same textures,
materials, and mesh-primitive helpers.

Original export sources remain under `export/` for reference.
