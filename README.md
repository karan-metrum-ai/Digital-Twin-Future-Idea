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

### Incidents and remediation

Every rack in the hall carries its open alarms ON the rack — a notification card over the affected device's front
face plus a roof beacon (worst severity) — never as floating badges. Clicking a card opens the issue modal on the
right edge (title, device, age, summary, raw logs) and, for any issue that carries a `remediation` descriptor
(`src/rack/issues/issues.ts` — all twelve demo incidents do), a slide-to-dispatch control. Committing it:

1. calls the remediation API (`remediationApi.ts` — a real POST when `VITE_REMEDIATION_URL` is set, otherwise a
   mocked 1.4–2 s round trip) and flies the camera to a front-right shot of the rack;
2. dispatches the technician (`people/Technician.ts`): they badge in at the staff door, walk the cold-aisle and
   end-of-row corridors (`people/paths.ts` — axis-aligned routes that never cross a rack row, CDU or floor PDU),
   and kneel or reach to the device's height;
3. acts out the fix on the rack (`issues/RemediationScene.ts`): the interactive rack's unseated patch cable gets the
   staged RJ45 reseat (`cabling/reseatAnimation.ts`); every other incident — including the nine on baked replica
   racks that have no per-component meshes — gets a proxy FRU swap (`issues/fruSwapAnimation.ts`: drive sled, GPU
   sled, SFP, PSU, fan, DIMM tray, patch plug, QD coupling or blanking panel drawn out, held, pushed home, fault LED
   red → green) or, for software-only fixes, a console strip along the card; then
4. the card and beacon clear, the leak-zone / thermal state it drove is released, and the technician walks out.

### Facility plant

- **Power** (`environment/PowerPlant.ts`): A/B busway rails (orange / blue) with a tap-off box and two drop cords
  over every rack, an end-of-row floor PDU per row (breaker panel, feed LEDs, load LCD), a UPS bank along the back
  wall and a standby genset in the corner. **⚡ Simulate utility loss** (`power/PowerEvent.ts`) plays the scripted
  event: lighting flickers to emergency level and the red strips + horn/strobes come up, UPS LCDs go to battery,
  the genset beacon spins and picks up the load, lighting returns, then retransfer to utility (~18 s).
- **Life safety** (`environment/LifeSafety.ts`): clean-agent cylinder bank with roof discharge nozzles, VESDA
  aspirating detector with its sampling pipe, manual pull station and horn/strobes.
- **Leak detection** (`environment/LeakDetection.ts`): sensing rope under both rows' coolant headers and around each
  CDU, with a per-row leak controller whose zone goes WET/red while a facility incident is open (INC-4825).
- **Technician** (`people/Technician.ts`): a rigged, skinned humanoid — the CC0 mannequin from Quaternius' Universal
  Animation Library (`public/models/technician.glb`, Idle / Walk / Interact / Fixing-Kneeling clips) driven by an
  `AnimationMixer`, dressed at runtime in a navy uniform, hi-vis band and hard hat. Does rounds of the aisles between
  jobs; a dispatch pulls them off the rounds from wherever they are.
- **Staff entrance** (`environment/Environment.ts`): steel door with push bar and window, badge reader (flashes blue
  when the technician badges in) and EXIT sign.
- **NOC wall** (`environment/NocWall.ts`): 2×2 video wall over an operator desk, redrawn at 1 Hz with live PUE, IT
  load, coolant supply/ΔT, open alarms by severity, power source and an IT-load sparkline.
- **Ambience**: idle LED patterns per device (`ledPatterns.ts` — activity flicker, power steady, link strobe with
  dark ports, heartbeat), dimmed or dropped by the power event; and a synthesised sound bed (`audio/Ambience.ts`:
  fan hum + moving air scaled by camera proximity, genset rumble, alarm/badge/latch chirps) behind the 🔇/🔊 toggle
  beside the view tabs — off by default, remembered in `localStorage`.

### Scene items

**Scene items ▾** (beside the view tabs) lists every optional piece of fit-out with a checkbox — technician, alarm cards
& beacons, NOC wall, leak rope, overhead trays, staff door, busway, floor PDUs, UPS bank, genset, clean-agent
cylinders, VESDA, pull station & strobes — grouped by People / Monitoring / Facility / Power / Life safety, with
`all` / `none` / `defaults` shortcuts. Choices are remembered per browser (`localStorage` key `rackTwin.layers`); the
genset and the agent cylinders are off by default. Embedders can pin items with the `layers` prop (those checkboxes
show disabled) and listen with `onLayersChange`; the definitions live in `SCENE_LAYER_DEFS` (`src/rack/types.ts`).

Append `?debug` to the URL to expose `window.__rackTwin` (the scene's imperative API — `selectRack`, `flyTo`,
`setCamera`, `setRemediation`, `triggerPowerEvent`, …) for tooling and screenshot scripts.

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
  environment/                Floor, walls + staff door, lights, cooling grill
    RackRow.ts                Two-row hot-aisle layout + baked rack replicas
    RackAirflow.ts            Heat/vapor particle sims instanced at every replica rack
    PowerPlant.ts             Busway + drop cords, floor PDUs, UPS bank, genset (merged static + live LCDs/LEDs)
    LifeSafety.ts             Clean-agent suppression, VESDA, pull station, horn/strobes
    LeakDetection.ts          Leak rope under the coolant headers + per-row leak controller
    NocWall.ts                NOC video wall + operator desk, redrawn from live twin state
  issues/                     Rack registry, demo incidents, on-rack alarm visuals, issue modal
    issues.ts                 RACKS / DEMO_ISSUES with per-issue remediation descriptors
    RackFocus.ts              Alarm cards + roof beacons + selection hairline, rack picking
    IssueDetail.tsx           Right-edge issue modal; RemediationSlider.tsx is its slide-to-dispatch control
    RemediationScene.ts       Routes an in-flight remediation to the right on-rack act
    fruSwapAnimation.ts       Proxy FRU swap / console-strip animations (work on baked replica racks)
    remediationApi.ts         Remediation API client (real POST or mocked round trip)
  people/                     Technician avatar (Technician.ts) + corridor routing (paths.ts)
  power/PowerEvent.ts         Scripted utility-loss state machine (pure TS)
  audio/Ambience.ts           Web Audio sound bed + chirps
  ledPatterns.ts              Idle LED behaviour per device kind, gated by the power state
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

Built with Metrum AI (Anthropic/Claude account). © Metrum AI.
