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
  wall. **⚡ Simulate utility loss** (`power/PowerEvent.ts`) plays the scripted event: lighting flickers to
  emergency level and the red strips come up, UPS LCDs go to battery, the standby feed picks up the load, lighting
  returns, then retransfer to utility (~18 s).
- **Life safety** (`environment/LifeSafety.ts`): VESDA aspirating smoke detector with its roof sampling pipe.
- **Leak detection** (`environment/LeakDetection.ts`): sensing rope under both rows' coolant headers and around each
  CDU, with a per-row leak controller whose zone goes WET/red while a facility incident is open (INC-4825).
- **Technician** (`people/Technician.ts`): a rigged, skinned humanoid — the CC0 mannequin from Quaternius' Universal
  Animation Library (`public/models/technician.glb`, Idle / Walk / Interact / Fixing-Kneeling clips) driven by an
  `AnimationMixer`. The uniform — navy polo with open collar, zipped hi-vis vest with reflective bands and shoulder
  straps, belt and buckle, work trousers, safety boots, woven cloth grain — is painted by a shader
  (`people/uniformMaterial.ts`) from each vertex's rest-pose position, so it deforms with the skin and its edges,
  stripes and seams are crisp per pixel; only the hard hat, lanyard/badge and tool pouch are props, sized from the mesh
  itself so they sit on the body. Adding a logo or name tape is a few lines in that shader. Does rounds of the aisles between jobs; a dispatch pulls them off the
  rounds from wherever they are. A procedural upper-body layer (`people/armOverlay.ts`) rides on top of the clips:
  the arm swing is amplified while walking, the head turns toward the rack being walked to, the right hand rises
  toward it over the last ~1.7 m and stays half-raised while the fix waits to be confirmed. Working a job, the
  technician stands at a distance chosen per pose from the rig's measured extents (`paths.WORK_STAND_M`) so neither the
  kneeling head nor the hands push through the rack front; above knee height they stand in the idle stance and a
  two-bone arm solve (`armOverlay.aimAt`) places the right hand on the drawn-out FRU (or the exact port for the cable
  reseat), leaning in at the waist for low units, eyes on the hand; kneeling jobs use the authored kneeling fix. They
  size the job up for a beat before the hands go in and stand back up before walking off. The technician can also be
  driven by hand — see "Driving the technician" below.
- **Staff entrance** (`environment/Environment.ts`): steel door with push bar and window, badge reader (flashes blue
  when the technician badges in) and EXIT sign.
- **NOC wall** (`environment/NocWall.ts`): 2×2 video wall over an operator desk, redrawn at 1 Hz with live PUE, IT
  load, coolant supply/ΔT, open alarms by severity, power source and an IT-load sparkline. It is a standing console
  (no chair). **Click the desk or wall** (or let go of the keys at the desk stop in Manual) and the technician walks
  over and stands at the console (hand to the keyboard, eyes on the wall), the camera takes the operator's point of
  view and the **NOC console panel** (`environment/NocConsole.tsx`) goes live: the same numbers as a real panel, with
  the incident list clickable into the issue modal. **Esc**, any arrow key, "Leave desk" or the Auto switch steps them
  away again.
- **Esc = out of focus**: wherever the view is focused — an open incident modal, an outlined rack (the camera flies
  back to where it was before the fly-in), the technician parked in front of a rack in Manual (they relax and the
  chase camera returns) or the NOC desk — Esc releases it.
- **Incident modal beside its card**: clicking an alarm card opens the issue modal next to that card (flipped to the
  card's left near the right edge, always inside the viewport) and it stays pinned to the card as the camera moves;
  opened from the NOC console it anchors to the same card on the rack.
- **Ambience**: idle LED patterns per device (`ledPatterns.ts` — activity flicker, power steady, link strobe with
  dark ports, heartbeat), dimmed or dropped by the power event; and a synthesised sound bed (`audio/Ambience.ts`:
  fan hum + moving air scaled by camera proximity, standby-power rumble, alarm/badge/latch chirps) behind the 🔇/🔊 toggle
  beside the view tabs — off by default, remembered in `localStorage`.

### Scene items

**Scene items ▾** (beside the view tabs) lists every optional piece of fit-out with a checkbox — technician, alarm cards
& beacons, NOC wall, leak rope, overhead trays, staff door, busway, floor PDUs, UPS bank, VESDA — grouped by
People / Monitoring / Facility / Power / Life safety, with `all` / `none` / `defaults` shortcuts. Choices are
remembered per browser (`localStorage` key `rackTwin.layers`). Embedders can pin items with the `layers` prop (those checkboxes
show disabled) and listen with `onLayersChange`; the definitions live in `SCENE_LAYER_DEFS` (`src/rack/types.ts`).

### Driving the technician

The toolbar has a **Technician** switch: **🚶 Auto** (the default) has them do rounds of the hall and answer remediation
dispatches; **⌨ Manual** hands them to the keyboard (pressing any arrow key switches to Manual too). In Manual the arrow
keys / WASD walk them along the hall's corridor network (`people/corridors.ts`: both cold aisles, the end-of-row
passages, the lane in from the staff door and the approach lane to the interactive rack). **↑** walks forward, **↓** turns
them round on the spot and walks the other way while held (they never walk backwards); **← / →** queue a 90° turn that is taken at the next junction with that branch (immediately when already
standing at one). Every rack has a stop square in front of it, one metre out: let go of the keys anywhere along a row
and the technician steps onto the nearest rack's stop, turns to the rack, raises a hand toward it and scans the device
stack (`Inspecting Rack A-04` in the chip at bottom-left); the camera eases to an over-the-shoulder shot of the rack
face. While walking, a chase camera follows behind and a little over the right shoulder; orbiting or zooming with the
mouse pauses the follow until the next key press. The technician waits at a stop until the next key or until Auto is
chosen again. A remediation dispatch always takes them over and hands back to whichever mode was active.

Append `?debug` to the URL to expose `window.__rackTwin` (the scene's imperative API — `selectRack`, `flyTo`,
`setCamera`, `setRemediation`, `triggerPowerEvent`, `stats`, `meshCensus`, `setTechMode`, `techDrive`,
`techDriving`, …) for tooling and screenshot scripts. `scripts/corridors.check.mjs` unit-checks the corridor
geometry in node; `scripts/drive.cdp.mjs` drives the built app in headless Chrome with real key events (needs
`npx vite preview --port 4173 --host 127.0.0.1`).

### Rendering budget

- **Static merge** (`src/rack/mergeStatics.ts`): after the replicas are baked, the interactive rack's small decorative
  parts (drive carriers, ears, screws, trims, outlet pins, LED dots…) are merged into one mesh per material per
  exploded-view item — about half its draw calls, with covers, doors, cables and ports left individually meshed.
- **Shadow pass on demand**: the shadow map is re-rendered every frame only while a caster is moving (technician
  walking, a door swinging, the exploded view separating), otherwise every 2nd/3rd frame.
- **Adaptive resolution**: the pixel ratio starts at the device ratio (capped at 1.5) and steps down toward 1.0 when
  the smoothed frame time sits above ~25 ms, back up when frames come easily again.
- **Coarse picking**: hover/click rays are tested against per-rack bounding boxes first and only descend into the
  racks they actually cross.
- Camera fly-to, door swing and exploded-view motion are frame-rate independent (time-based easing).

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
    PowerPlant.ts             Busway + drop cords, floor PDUs, UPS bank (merged static + live LCDs/LEDs)
    LifeSafety.ts             VESDA smoke detection + roof sampling pipe
    LeakDetection.ts          Leak rope under the coolant headers + per-row leak controller
    NocWall.ts                NOC video wall + operator desk, redrawn from live twin state
    NocConsole.tsx            Live NOC console panel shown while the technician is standing at the desk
  issues/                     Rack registry, demo incidents, on-rack alarm visuals, issue modal
    issues.ts                 RACKS / DEMO_ISSUES with per-issue remediation descriptors
    RackFocus.ts              Alarm cards + roof beacons + selection hairline, rack picking
    IssueDetail.tsx           Right-edge issue modal; RemediationSlider.tsx is its slide-to-dispatch control
    RemediationScene.ts       Routes an in-flight remediation to the right on-rack act
    fruSwapAnimation.ts       Proxy FRU swap / console-strip animations (work on baked replica racks)
    remediationApi.ts         Remediation API client (real POST or mocked round trip)
  people/                     Technician avatar (Technician.ts), shader-painted uniform (uniformMaterial.ts), procedural arm/head layer (armOverlay.ts), corridor routing (paths.ts),
                              keyboard drive: corridor network, junction turns, rack stops (corridors.ts)
  mergeStatics.ts             Per-item static merge of the interactive rack's decorative parts (draw-call budget)
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
