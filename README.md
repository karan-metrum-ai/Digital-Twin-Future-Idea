# 42U Interactive Server Rack

React + Vite + TypeScript app for the interactive 42U server rack twin (three.js).

## Setup

```bash
npm install
npm run dev
```

## Usage

The app boots the `Playground` demo from `src/rack/Playground.tsx`:

- Visual / Thermal camera views
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
    Nuc.ts                            Shelf-mounted mini PC accessory
  cabling/wireCabling.ts      Patch/power/network cable routing pass
  environment/                Floor, neighbour racks, studio lighting
  thermal/                    Airflow particle sim + thermal camera shader
  Playground.tsx              Demo harness
```

Each component builder takes the shared `ctx` (from `RackContext.ts`) as its first argument instead of closing
over free variables, so components stay independently readable/editable while sharing the same textures,
materials, and mesh-primitive helpers.

Original export sources remain under `export/` for reference.
