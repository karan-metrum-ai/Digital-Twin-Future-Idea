# Advanced Digital Twin — Full Walkthrough & Demo Script

Presenter reference for introducing the **42U Interactive Server Rack** digital twin. Covers every scene item, every remediable incident the technician works, and scenario-based speaking points for a live demo.

---

## How to use this document

1. **Section A** — complete inventory (say it once, or leave as a checklist).
2. **Section B** — technician remediation: all 12 incidents, FRU type, what the scene does.
3. **Section C** — scenario-based demo script with exact speaking points (run in order or pick by audience).

Deep links:

| URL | Opens |
|-----|--------|
| `/` or default | Visual view |
| `?view=thermal` | Thermal camera |
| `?view=liquid` | Liquid cooling + HUD |
| `?debug` | `window.__rackTwin` API for tooling |

Toolbar: **Front covers**, **Airflow & heat**, **Randomize load temps**, **Explode view**, **Simulate utility loss**, **Scene items**, **Technician Auto / Manual**, view tabs (Visual / Thermal / Liquid), ambience mute.

---

# A. Complete component inventory

## A1. Hall layout (data hall)

| Item | Detail |
|------|--------|
| Room shell | Raised-floor tiles, four walls, roof, ceiling light strips + red emergency strips |
| Hot-aisle containment | Two rows of five racks; rears face across a **1.2 m** hot aisle |
| Row A | Five racks front-facing (`A-01` … `A-05`) |
| Row B | Five racks turned 180° (`B-01` … `B-05`) |
| Interactive rack | **X-01** — full mesh, doors, explode, thermal, reseat animation (middle of a row of five among replicas) |
| Neighbour racks | Nine baked replicas (merged per material) |
| Camera bounds | Orbit stays inside the enclosure |

## A2. Rack enclosure (X-01 frame — not exploded)

| Part | Notes |
|------|--------|
| Base plinth | Steel base |
| Top panel | With front/rear cable cutouts + brush strips |
| Corner posts (×4) | |
| Casters (×4) | Bracket, rubber wheel, hub |
| Leveling feet / pads (×4) | |
| Side panels (×2) | |
| Mounting rails + rail faces + brackets | Front and rear |
| Front door | Perforated grill, frame, handle, lock, hinge pins |
| Rear door | Same; lifts/opens in liquid mode and remediation |

## A3. Interactive rack — U layout (bottom → top)

Built in `buildRack.ts`. Explode view separates every item below; legend shows live counts.

| U range | Kind | Description |
|---------|------|-------------|
| U1–4 | Server · storage | 4U storage chassis + cover |
| U5 | Blanking panel | 1U blank |
| U6–8 | Server · storage | 3U storage (graphite) |
| U9–10 | Server · SFF | 2U SFF + cover |
| U11–12 | Server · LFF | 2U large-form-factor drives |
| U13 | Server · 1U | + cover |
| U14 | Server · 1U | |
| U15 | Server · 1U | |
| U16 | Server · 1U | + cover |
| U17–18 | Server · SFF | 2U |
| U19 | Blanking panel | 1U blank |
| U20–23 | Server · GPU | 4U GPU node + cover |
| U24 | Server · 1U | + cover |
| U25 | Server · 1U | |
| U26 | Server · 1U | graphite |
| U27 | Server · 1U | graphite |
| U28–29 | Server · SFF | 2U + cover |
| U30 | Horizontal PDU | 1U C13 PDU |
| U31 | Server · 1U | + cover |
| U32 | Server · 1U | |
| U33 | Server · 1U | |
| U34 | Patch panel | 24-port |
| U35 | Cable manager | 1U |
| U36 | Network switch | 24-port |
| U37 | Patch panel | 24-port |
| U38 | Cable manager | 1U |
| U39 | Network switch | **48-port ToR** (fault patch on port 9) |
| U40–42 | NUC shelf | 3U tray + **8× mini PCs** + blue patch leads |

**Also on the rack (not U-mounted in the explode stack the same way):**

| Item | Detail |
|------|--------|
| Vertical PDU left | Full-height rear, outlets |
| Vertical PDU right | Full-height rear, outlets |

### Server sub-parts (per chassis)

- Drive carriers: SFF / LFF / GPU layouts with activity LEDs  
- Optional perforated bezel or PowerEdge-style hex-lattice cover  
- Rear I/O plate, power inlets, NIC positions  
- Ears / mounting hardware  

### NUC shelf sub-parts

| Part | Detail |
|------|--------|
| Steel tray | Base plate, tall back wall, front lip |
| Ears | Graphite mounting ears |
| Mini PC ×8 | Chassis, lid, face (power ring, USB, jack, status LED, vents) |
| Heartbeat LED ×8 | Per unit |
| Blue patch lead ×8 | Out rear-top, arc over back wall |

## A4. In-rack cabling (`wireCabling.ts`)

| Cable / hardware | Detail |
|------------------|--------|
| Front patch cables (blue) | 48-port switch ↔ upper patch panel via cable manager (6 routes; one is the **fault**) |
| Front patch cables (black) | 24-port switch ↔ lower patch panel (4 routes) |
| **Fault patch (INC-4802)** | Unseated RJ45 on 48-port port 9: clear housing, latch, 8 gold contacts, twisted pairs, red emissive boot/cable; reseat animation |
| Fiber patch (yellow) | From SFP cages up to top cable channel |
| Power cables (black) | Each server rear inlet → nearest vertical PDU outlet |
| Network drop cables (blue) | From top channel down to selected server NICs |
| Velcro straps | Front and rear dress points |
| Vertical cable rings | Rear channel |
| Cable management arms | On selected servers |

## A5. Liquid cooling (Liquid view — all 10 racks)

| Item | Detail |
|------|--------|
| Overhead supply header | Stainless, per row |
| Overhead return header | Stainless, per row |
| Unistrut hangers | Off ceiling ladder |
| Valved drops | Blue = supply, red = return, into every rack top |
| CDU (×2) | End-of-row coolant distribution unit; facility water out back |
| Rack manifolds | Black anodised, rear opening L/R |
| Large feed hoses | EPDM + stainless couplings over top |
| Branch hoses + QDs | Per server; blue/red collars |
| Coolant flow particles | Cool blue supply / warm return (shared buffer across racks) |
| Liquid HUD | Flow L/min, rack ΔP, pump efficiency, ΔT, CDU energy, predictive analytics |

## A6. Thermal / airflow

| Item | Detail |
|------|--------|
| Cooling floor grills | Two perforated tiles per rack cold aisle |
| Intake / exhaust particles | Per rack (reduced density on replicas) |
| Cold-air vapour | Rising off floor grilles |
| Thermal camera shader | Load temps drive heat map |
| Heat simulation | All ten racks |

## A7. Facility plant — power

| Item | Toggle layer | Detail |
|------|--------------|--------|
| Busway A rail | `busway` | Orange stripe |
| Busway B rail | `busway` | Blue stripe |
| Tap-off box | `busway` | Above every rack |
| Drop cords (A/B) | `busway` | Into each rack top |
| Floor PDU (×2) | `floorPdus` | End of row: breaker panel, feed LEDs, load LCD |
| UPS bank (×3) | `ups` | Back wall, status LCDs |
| Utility-loss event | Toolbar | ~18 s: flicker → emergency lights → UPS battery → standby → retransfer |

## A8. Facility plant — monitoring & life safety

| Item | Toggle layer | Detail |
|------|--------------|--------|
| Overhead cable trays | `overheadCabling` | Hanger rods, unistrut trapezes, stringers, hot-aisle ladder rack, 4 wire-basket trays, tray clamps, silver patch enclosures, blue trunk loops/bundles, drops into each rack |
| Leak-detection rope | `leakDetection` | Orange sensing rope under headers + around CDUs; per-row leak controller; zone WET/red on INC-4825 |
| VESDA | `vesda` | Wall detector + display/LED; red sampling pipe on roof with sample points |
| NOC video wall | `nocWall` | 2×2 wall: PUE, IT load, coolant supply/ΔT, alarms by severity, power source, IT-load sparkline; standing operator desk, 2 monitors (no chair) |
| Staff door | `staffDoor` | Steel door, push bar, window, badge reader (blue flash on badge-in), EXIT sign |
| Alarm cards & beacons | `alarmCards` | On-device cards, roof beacons (worst severity), nameplates |
| Technician | `technician` | See Section B |

## A9. Scene layers checklist (UI: Scene items)

| Group | Layer | Default |
|-------|-------|---------|
| People | Technician | On |
| Monitoring | Alarm cards & beacons | On |
| Monitoring | NOC video wall | On |
| Monitoring | Leak-detection rope | On |
| Facility | Overhead cable trays | On |
| Facility | Staff door & badge reader | On |
| Power | Busway & drop cords | On |
| Power | Floor PDUs | On |
| Power | UPS bank | On |
| Life safety | VESDA smoke detection | On |

Shortcuts: **all** / **none** / **defaults**. Choices persist in `localStorage` (`rackTwin.layers`).

## A10. People & interaction extras

| Item | Detail |
|------|--------|
| Technician avatar | Skinned humanoid; Idle / Walk / Interact / Fixing-Kneeling; navy uniform, hi-vis vest, tool belt, hard hat |
| Arm / head overlay | Amplified walk swing; head toward target rack; right hand rises last ~1.7 m |
| Corridor network | Both cold aisles, end-of-row passages, staff-door lane, approach to X-01 |
| Auto mode | Aisle rounds; answers remediations |
| Manual mode | WASD / arrows; junction turns; rack stop squares; inspect pose; chase / OTS camera |
| Ambience audio | Fan hum, air, standby rumble, alarm/badge/latch chirps (off by default) |
| Idle LEDs | Activity flicker, power steady, link strobe, heartbeat (gated by power state) |

## A11. Explode-view kind labels (legend)

| Kind key | Label in UI |
|----------|-------------|
| `server` | Servers |
| `blank` | Blanking panels |
| `switch` | Network switches |
| `patch` | Patch panels |
| `cablemgr` | Cable managers |
| `hpdu` | Horizontal PDU |
| `pdu` | Vertical PDUs |
| `nuc` | NUC shelf (8× mini PC) |

---

# B. Technician remediation — all scenarios

## B0. Shared remediation flow (every incident)

Say this once; then only name what changes per ticket.

1. Operator clicks the **on-rack alarm card** → issue modal (title, device, age, summary, logs).  
2. **Slide-to-dispatch** commits the remediation.  
3. **API** — real `POST` if `VITE_REMEDIATION_URL` is set; else mocked ~1.4–2 s.  
4. Camera flies to a front-right shot of the target rack; front door opens as needed.  
5. Technician leaves rounds (or Manual), **badges in** at the staff door, walks **cold-aisle / end-of-row corridors** (never through racks, CDUs, or floor PDUs), kneels or reaches to device height.  
6. On-rack act (see table below).  
7. Card + beacon clear; leak/thermal side-effects release if any; technician walks out; mode returns to Auto or Manual.

**Animation types**

| Type | When | What you see |
|------|------|----------------|
| **RJ45 reseat** | INC-4802 only (live rack) | Real unseated plug pushed home; red fault cable → blue; latch seats |
| **Proxy FRU swap** | Hardware remediations on any rack (incl. replicas) | FRU drawn out, held, pushed home; fault LED red → green |
| **Console strip** | Software-only (`fru: none`) | Console UI strip along the card; no hardware pull |

---

## B1. Full incident catalogue (12)

### INC-4821 — Hot-swap failed drives

| Field | Value |
|-------|--------|
| Rack / U | **A-02** · U6 |
| Device | stor-a02-u06 (3U storage) |
| Category / severity | Storage · **Critical** |
| Title | RAID-6 array degraded — 2 drives failed |
| Slider label | Hot-swap failed drives (slots 7, 11) |
| Action / FRU | `replace_drive` · **drive** |
| Duration | ~6 s |
| Done message | Drives replaced · VD 3 rebuilding (ETA 4 h 10 min) |
| Technician act | Proxy drive sled pull → replace → seat; LED green |

**Speaking point:** *“Critical storage — no parity margin. Dispatch hot-swap; watch the tech reseat the sleds and the alarm clear.”*

---

### INC-4819 — Reseat GPU

| Field | Value |
|-------|--------|
| Rack / U | **B-04** · U20 |
| Device | gpu-b04-u20 (4U GPU node) |
| Category / severity | Compute · **Critical** |
| Title | GPU 3 Xid 79 — fell off the bus |
| Slider label | Pull GPU sled, reseat GPU 3 |
| Action / FRU | `reseat_gpu` · **gpu_sled** |
| Duration | ~7 s |
| Done message | GPU 3 back on the bus · node returned to service |
| Technician act | Proxy GPU sled pull / reseat |

**Speaking point:** *“AI training node isolated after Xid 79. Same dispatch loop on a replica rack — FRU proxy works without per-mesh GPUs.”*

---

### INC-4816 — Replace optic

| Field | Value |
|-------|--------|
| Rack / U | **A-05** · U39 |
| Device | sw-a05-core-1 (48-port ToR) |
| Category / severity | Network · **Major** |
| Title | Uplink Ethernet1/49 flapping — CRC errors |
| Slider label | Replace Ethernet1/49 optic |
| Action / FRU | `replace_optic` · **sfp** · port 49 |
| Duration | ~5 s |
| Done message | Optic replaced · Rx -3.1 dBm · rejoined port-channel10 |
| Technician act | Proxy SFP swap |

**Speaking point:** *“Spine uplink flapping — swap the optic, LACP comes back.”*

---

### INC-4812 — Replace NVMe

| Field | Value |
|-------|--------|
| Rack / U | **B-01** · U17 |
| Device | db-b01-u17 (2U SFF) |
| Category / severity | Storage · **Major** |
| Title | NVMe wear at 97% — predictive failure |
| Slider label | Replace nvme1n1 |
| Action / FRU | `replace_nvme` · **nvme** |
| Duration | ~6 s |
| Done message | nvme1n1 replaced · md0 resync started |
| Technician act | Proxy NVMe swap |

**Speaking point:** *“Predictive wear-out — planned FRU before hard failure.”*

---

### INC-4808 — Fit blanking panels

| Field | Value |
|-------|--------|
| Rack / U | **X-01** · U26 |
| Device | app-x01-u26 (1U) |
| Category / severity | Compute · **Major** |
| Title | CPU thermal throttling — inlet 31 °C |
| Slider label | Fit blanking panels, clear recirculation |
| Action / FRU | `fit_blanking_panel` · **blank** |
| Duration | ~5 s |
| Done message | Inlet 24 °C · clocks back to nominal |
| Technician act | Proxy blanking panel fit |

**Speaking point:** *“Airflow hygiene on the live rack — blanks stop hot-aisle recirculation.”* Pair with Thermal view if useful.

---

### INC-4802 — Reseat patch cable (signature live-rack demo)

| Field | Value |
|-------|--------|
| Rack / U | **X-01** · U39 |
| Device | sw-x01-core-48p (48-port ToR) |
| Category / severity | Network · **Major** |
| Title | Port 9 link down — patch cable unseated |
| Slider label | Reseat patch cable on port 9 |
| Action / FRU | `reseat_patch_cable` · **cable** · port 9 |
| Duration | ~2.2 s (plus door open) |
| Done message | Link restored · 10GbE full-duplex |
| Technician act | **High-fidelity RJ45 reseat** (not proxy) |

**Speaking point:** *“This is the hero network fix — real unseated RJ45 on the interactive switch, plug pushed home, link back.”* Best first hardware remediation.

---

### INC-4805 — Swap PSU

| Field | Value |
|-------|--------|
| Rack / U | **A-03** · U36 |
| Device | sw-a03-mgmt (24-port) |
| Category / severity | Network · **Minor** |
| Title | PSU-2 lost input power |
| Slider label | Swap PSU-2 |
| Action / FRU | `replace_psu` · **psu** |
| Duration | ~6 s |
| Done message | PSU-2 online · redundancy restored |
| Technician act | Proxy PSU swap |

**Speaking point:** *“Redundancy lost on the mgmt switch — restore the second supply.”*

---

### INC-4801 — Replace fan

| Field | Value |
|-------|--------|
| Rack / U | **B-03** · U1 |
| Device | stor-b03-u01 (4U storage) |
| Category / severity | Storage · **Minor** |
| Title | Backplane fan 2 below RPM floor |
| Slider label | Replace backplane fan 2 |
| Action / FRU | `replace_fan` · **fan** |
| Duration | ~5 s |
| Done message | FAN2 6,100 rpm · bay temps falling |
| Technician act | Proxy fan swap |

**Speaking point:** *“Low RPM before drive bay heat becomes critical.”*

---

### INC-4797 — Replace DIMM

| Field | Value |
|-------|--------|
| Rack / U | **A-01** · U14 |
| Device | web-a01-u14 (1U) |
| Category / severity | Compute · **Minor** |
| Title | Correctable ECC errors — DIMM_B2 |
| Slider label | Replace DIMM_B2 |
| Action / FRU | `replace_dimm` · **dimm_tray** |
| Duration | ~7 s |
| Done message | DIMM_B2 replaced · memtest clean · CE count 0 |
| Technician act | Proxy DIMM tray swap |

**Speaking point:** *“Correctable ECC trending past threshold — replace before uncorrectable.”*

---

### INC-4794 — Restart kubelet (software-only)

| Field | Value |
|-------|--------|
| Rack / U | **B-02** · U9 |
| Device | k8s-b02-u09 (2U SFF) |
| Category / severity | Compute · **Major** |
| Title | Node NotReady — kubelet PLEG unhealthy |
| Slider label | Restart containerd + kubelet |
| Action / FRU | `restart_kubelet` · **none** |
| Duration | ~4 s |
| Done message | Node Ready · uncordoned · 38 pods rescheduled |
| Technician act | **Console strip** (no FRU pull) |

**Speaking point:** *“Not every ticket is a wrench — software remediation still dispatches the tech and clears the card.”*

---

### INC-4790 — Reseat patch-panel cable

| Field | Value |
|-------|--------|
| Rack / U | **B-05** · U34 |
| Device | pp-b05-u34 (patch panel) |
| Category / severity | Network · **Minor** |
| Title | Port 17 link light dark — patch cable unplugged |
| Slider label | Reseat port 17 patch cable |
| Action / FRU | `reseat_patch_panel_cable` · **cable** · port 17 |
| Duration | ~3 s |
| Done message | Gi0/17 up · BMC of app-b05-u25 reachable |
| Technician act | Proxy cable / patch plug |

**Speaking point:** *“OOB / BMC lost because the patch panel port was loose — classic cable audit fix.”*

---

### INC-4825 — Re-torque manifold QD (facility + leak)

| Field | Value |
|-------|--------|
| Rack / U | **A-04** · U41 |
| Device | dlc-a04-manifold (supply drop QD) |
| Category / severity | Facility · **Major** |
| Title | Leak zone 1 wet — drip at A-04 supply drop |
| Slider label | Re-torque A-04 supply QD collar |
| Action / FRU | `tighten_manifold_qd` · **qd_coupling** |
| Duration | ~5 s |
| Done message | Collar torqued · zone 1 DRY · make-up water stable |
| Side effect | Leak rope / controller zone 1 → WET/red while open |
| Technician act | Proxy QD coupling tighten |

**Speaking point:** *“Facilities and IT in one twin — wet zone on the rope, CDU make-up tick, then torque the QD and watch the zone go dry.”* Strong with Liquid view + leak rope visible.

---

## B2. FRU types quick reference

| FRU | Used by |
|-----|---------|
| `drive` | INC-4821 |
| `gpu_sled` | INC-4819 |
| `sfp` | INC-4816 |
| `nvme` | INC-4812 |
| `blank` | INC-4808 |
| `cable` | INC-4802 (real reseat), INC-4790 (proxy) |
| `psu` | INC-4805 |
| `fan` | INC-4801 |
| `dimm_tray` | INC-4797 |
| `none` | INC-4794 (console) |
| `qd_coupling` | INC-4825 |

---

## B3. Power event (not a remediation, but technician-adjacent)

**Simulate utility loss** (~18 s): hall lighting flickers to emergency; red strips on; UPS LCDs → battery; standby feed picks up; lighting returns; retransfer to utility. NOC wall power source updates. LEDs dim/drop with power phase.

**Speaking point:** *“Resilience story without leaving the twin — UPS carries the hall, then clean retransfer.”*

---

# C. Scenario-based demo speaking points

Run as a single ~10–12 minute arc, or pick scenarios by audience.

---

## Scenario 1 — Open the hall (context)

**Goal:** Prove this is a data hall, not a lonely rack.

**Do**

1. Start in Visual view; orbit so both rows and the hot aisle read.  
2. Point at X-01 vs baked neighbours.  
3. Optionally open **Scene items** and tick through groups.

**Say**

> “This is a two-row hot-aisle hall — ten racks, rears facing across a 1.2 metre aisle. Nine are efficient replicas; one is fully interactive. Heat, liquid, and airflow run on every rack so the story stays hall-scale.”

> “Around them: busway and drop cords, floor PDUs, UPS, overhead wire trays and ladder rack, leak rope, VESDA, staff door, and a live NOC wall. Scene items lets us strip or pin layers for the audience.”

**Checklist to name aloud (optional):** trays · busway · floor PDUs · UPS · VESDA · leak rope · NOC · door · technician · alarms.

---

## Scenario 2 — Inside the interactive rack (BOM / explode)

**Goal:** Show every IT component class.

**Do**

1. Zoom X-01; open front door if closed.  
2. Toggle **Front covers** off once to show drive faces.  
3. Drag **Explode view** up; read the parts legend.  
4. Call out U layout bottom → top; linger on NUC U40–42 and the network stack U34–39.  
5. Point at vertical PDUs and the red fault patch on the 48-port.

**Say**

> “Bottom-up: storage and compute density — 4U and 3U storage, SFF and LFF, a 4U GPU chassis, then 1U apps. Horizontal PDU at U30. Then the network block: patch, cable manager, 24-port, patch, cable manager, 48-port ToR.”

> “Top of rack: a 3U NUC shelf — eight mini PCs on edge, each with its own blue patch lead over the tray back wall. Vertical PDUs feed every server. Explode separates every item with a live count — servers, blanks, switches, patches, managers, PDUs, NUC.”

> “That glowing red patch on port 9 is deliberate — our next remediation hero shot.”

---

## Scenario 3 — Cabling & overhead trays

**Goal:** Structured cabling end-to-end.

**Do**

1. Pull camera up to the ceiling trays (layer `overheadCabling` on).  
2. Follow a blue trunk drop into a rack top.  
3. Drop back to X-01 rear/front: power to PDUs, drops to NICs, fiber yellow, velcro / rings / arms.

**Say**

> “Overhead: hanger rods, unistrut trapezes, wire-basket trays and a wide ladder over the hot aisle. Silver patch enclosures, blue trunk loops, controlled drops into every rack — including the interactive one.”

> “Inside the rack: blue and black front patches through the cable managers, yellow fiber out of the SFPs, black power to the vertical PDUs, network drops from the top channel, rings and arms dressing the rear.”

---

## Scenario 4 — Thermal & airflow

**Goal:** Cooling as something you can see.

**Do**

1. Switch to **Thermal**.  
2. Ensure **Airflow & heat** is on.  
3. **Randomize load temps**; point at hotspots and cold-aisle vapour off the perforated floor tiles.

**Say**

> “Thermal camera plus particle airflow. Cold air rises from the perforated floor tiles in the cold aisle; exhaust leaves the rear. Randomize load and the heat map moves — useful when we talk density and blanking.”

---

## Scenario 5 — Liquid cooling + predictive HUD

**Goal:** AI-ready DLC story.

**Do**

1. Switch to **Liquid** (or `?view=liquid`).  
2. Watch rear door / camera fly to rear three-quarter.  
3. Trace header → drop → manifold → branch hose → CDU.  
4. Read HUD: flow, ΔP, efficiency, ΔT, forecasts (vibration, conductivity, pH, particulate).

**Say**

> “Direct-to-chip liquid: overhead stainless supply and return per row, valved drops into every rack, end-of-row CDUs, side manifolds, and per-server quick-disconnect hoses with blue and red collars. Coolant flow is animated on all ten racks.”

> “The HUD is scoped to the interactive rack’s CDU — live hydraulics and a 30-day condition forecast. This is how we talk AI density without a schematic on a slide.”

---

## Scenario 6 — Hero remediation: reseat patch (INC-4802)

**Goal:** Best single technician demo.

**Do**

1. Visual view; click the card on **X-01** ToR (port 9 / unseated cable).  
2. Read logs briefly.  
3. Slide to dispatch.  
4. Narrate badge-in → walk → reach → RJ45 push home → clear.

**Say**

> “Alarm lives on the device face — not a floating badge. Port 9 is down; the RJ45 has backed out. Slide to dispatch.”

> “Technician badges in at the staff door, walks the cold aisle — routes never cut through racks or plant — reaches the switch, and reseats the real plug. Link restored, card and beacon clear.”

---

## Scenario 7 — Critical storage on a replica (INC-4821)

**Goal:** Show hall-wide ops, not only X-01.

**Do**

1. Click **A-02** RAID critical card.  
2. Dispatch hot-swap drives.  
3. Note proxy FRU on a baked rack.

**Say**

> “Critical RAID on a neighbour rack. Same dispatch loop. Replica racks don’t have per-drive meshes, so we animate a proxy FRU sled — still readable for training and demos.”

---

## Scenario 8 — GPU / AI node (INC-4819)

**Goal:** Compute / AI audience.

**Do:** Dispatch **B-04** GPU Xid 79 · reseat GPU sled.

**Say**

> “Training job crashed; GPU fell off the bus. Drain the node, pull the sled, reseat, return to service — the twin makes that story visual in under a minute.”

---

## Scenario 9 — Software remediation (INC-4794)

**Goal:** Not everything is hardware.

**Do:** Dispatch **B-02** kubelet / containerd restart.

**Say**

> “Node NotReady — PLEG unhealthy. The fix is restart containerd and kubelet. No FRU pull: a console strip runs on the rack, then the alarm clears. Same people path, different act.”

---

## Scenario 10 — Facility leak + QD (INC-4825)

**Goal:** Facilities + liquid together.

**Do**

1. Point at orange leak rope and zone controller (zone 1 wet).  
2. Optional: Liquid view for manifold/QD context.  
3. Dispatch **A-04** re-torque supply QD.  
4. Watch zone return DRY.

**Say**

> “Leak zone one is wet under the A-04 supply drop. CDU make-up water ticked up. Dispatch re-torque the quick-disconnect collar — facility category, FRU is the QD coupling. Rope and controller go dry when the ticket closes.”

---

## Scenario 11 — Utility loss

**Goal:** Power resilience.

**Do:** Click **Simulate utility loss**; watch lights, UPS LCDs, NOC power source (~18 s).

**Say**

> “Drop utility. Emergency lighting, UPS on battery, standby picks up the load, then clean retransfer. The NOC wall tracks power source with the rest of the twin.”

---

## Scenario 12 — NOC wall as single pane

**Goal:** Ops / exec close.

**Do:** Frame the left-wall 2×2 display and desk.

**Say**

> “PUE, IT load, coolant supply and delta-T, open alarms by severity, power source, and a load sparkline — redrawn from the same twin state. One place for the operating picture while the 3D hall stays the ground truth.”

---

## Scenario 13 — Drive the technician (Manual)

**Goal:** Training / immersion.

**Do**

1. Switch Technician to **Manual** (or press an arrow).  
2. Walk a cold aisle; release near a rack → stop square, inspect pose, OTS camera.  
3. Optional: return **Auto**.

**Say**

> “Manual mode: WASD or arrows on the corridor network. Release near a rack and they step onto the stop square, face the gear, and raise a hand — Inspecting Rack. Chase camera while walking; mouse orbit pauses follow until the next key. A remediation always takes priority and hands control back.”

---

## Scenario 14 — Suggested full demo arc (~12 min)

| Time | Scenario | Focus |
|------|----------|--------|
| 0:00–1:00 | 1 · Hall | Layout + layers |
| 1:00–2:30 | 2 · Explode | Full BOM + NUC + fault cable |
| 2:30–3:15 | 3 · Trays | Overhead + in-rack cable |
| 3:15–4:00 | 4 · Thermal | Airflow + temps |
| 4:00–5:30 | 5 · Liquid | DLC + HUD |
| 5:30–7:00 | 6 · INC-4802 | Hero RJ45 reseat |
| 7:00–8:00 | 7 or 8 | Critical replica (drives or GPU) |
| 8:00–8:45 | 9 | Software console fix |
| 8:45–9:45 | 10 | Leak + QD |
| 9:45–10:30 | 11 | Utility loss |
| 10:30–11:15 | 12–13 | NOC + Manual tech |
| 11:15–12:00 | Close | Tagline |

**Close line**

> “Advanced digital twin: hall geometry, full rack BOM including NUC leads and overhead trays, thermal and liquid, facility plant, twelve remediable incidents with a technician who badges in and clears the work — all in the browser.”

---

## Audience shortcuts

| Audience | Run scenarios | Prefer incidents |
|----------|---------------|------------------|
| Exec / sales | 1, 2 (light), 5, 6, 11, 12 | 4802, 4819, utility loss |
| Ops / NOC | 1, 6, 7, 9, 11, 12, 13 | 4802, 4821, 4794 |
| Facilities / cooling | 1, 4, 5, 10, 11 | 4825, 4808 |
| Network | 2, 3, 6, optic/patch | 4802, 4816, 4790 |
| AI / GPU | 2 (GPU U), 5, 8 | 4819 |
| Training | 6, 13, then any FRU | Mix FRU + console |

---

## Quick reference — racks with open demo alarms

| Rack | Issues |
|------|--------|
| A-01 | INC-4797 DIMM |
| A-02 | INC-4821 drives (critical) |
| A-03 | INC-4805 PSU |
| A-04 | INC-4825 leak / QD |
| A-05 | INC-4816 optic |
| B-01 | INC-4812 NVMe |
| B-02 | INC-4794 kubelet |
| B-03 | INC-4801 fan |
| B-04 | INC-4819 GPU (critical) |
| B-05 | INC-4790 patch panel |
| X-01 | INC-4808 blanks · INC-4802 patch (hero) |

---

*Built for the 42U Interactive Server Rack twin · Metrum AI*
