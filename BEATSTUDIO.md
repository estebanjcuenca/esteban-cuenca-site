# Beat Studio — Development Log & Roadmap

Spatial beat sequencer born as a browser prototype. Currently embedded in the portfolio site as an experimental module. The plan is to extract the core logic, move audio to Ableton Live, and eventually ship as a standalone commercial instrument with a hardware controller.

---

## Current state (web prototype)

### What it is

A 2D/3D pad interface where each dot is a sound source placed in space. Dot position controls pitch (Y axis), beat phase (X axis), and harmonic depth (Z axis). Groups of dots form **environments** — one per machine type — that share synthesis settings and interact through gravitational pattern generation.

The studio runs as a lazily-loaded module on top of the portfolio's Web Audio engine. It is not a web app product — it was a tool for developing and testing the ideas.

### Eight sound environments

| Name | Type | Character | Status |
|------|------|-----------|--------|
| **Kick** | Percussion | MPC-style — click + body + sub | Working |
| **Hat** | Percussion | 909 noise bandpass — vel 2 = open hat | Working |
| **Clap** | Percussion | Staggered noise bursts + short room | Working |
| **Bass** | Melodic | Mono sub — ↕ melody, sine body | Working |
| **Lead** | Melodic | Dry filtered saw stab — short release | Working |
| **Soft** | Melodic | Warm pad — slow attack, gentle space | Working |
| **Synth** | Melodic | Analog stack — saw, filter sweep, LFO | Added Jun 2026 |
| **Arp** | Melodic | Step arpeggio — cycles scale tones per hit | Added Jun 2026 |

### What works well

- Gravitational coupling between dots — dots pull each other into timing sync or harmonic alignment based on distance and environment type
- Spatial phase fields — X position maps to beat phase, creating natural swing and polyrhythm
- Arpeggio step cycling — pitch walks a 16-step pattern around each dot's root note while gravity controls hit density
- 3D molecule view — Three.js bond tubes between coupled dots
- Environment isolation — each machine type has its own bus, sidechain, and EQ curve
- Kaoss XY soft-snap — pitch and phase magnetism for expressive real-time control

### What doesn't work well yet

- **Instrument quality** — Web Audio synthesis is limited. Kick transients, synth timbres, and pad textures are rough compared to what Ableton's native instruments deliver
- **Wave types** — sine/saw/square/triangle switching works but sounds different from professional synths; needs proper DSP
- **Gravity tuning** — force curves and reach values were set experimentally and need iteration with a real musical context
- **Sequencer programming** — gravity-generated patterns are interesting but unpredictable; needs better control over density and swing
- **Latency** — Web Audio callback scheduling is adequate but not sample-accurate; real-time performance feels slightly detached

The decision has been made: **the web is a prototype environment**. The audio quality ceiling of Web Audio API has been reached for this use case. Moving to Ableton solves every one of the problems above immediately.

### Key source files

| File | Role |
|------|------|
| `js/audio/machines.js` | Machine metadata, defaults, synth modifiers per type |
| `js/audio/machine-playback.js` | Web Audio drum synthesis per machine |
| `js/audio/theory.js` | Pitch, scales, arp patterns (`BEAT_ARP_PATTERN`), beat step logic |
| `js/audio/engine.js` | AudioContext, buses, reverb, limiter, iOS unlock |
| `js/studio/environments.js` | Environment model — 8 layers, params, persistence |
| `js/studio/markers.js` | Dot placement, selection, voice lifecycle |
| `js/studio/beat-seq.js` | Gravity-based pattern generation |
| `js/studio/beat-spatial.js` | Dot coupling, peer distance, phase fields |
| `js/studio/beat-influence.js` | Harmonize pull, reach, blend tuning |
| `js/studio/beat-kaoss.js` | Kaoss XY soft-snap, phase + pitch magnetism |
| `js/studio/beat-mix.js` | Frequency collision, sidechain, spatial EQ |
| `js/studio/beat-bonds.js` | 2D bond lines between coupled dots |
| `js/studio/beat-view3d.js` | Three.js molecule view |
| `js/studio/beat-colors.js` | Shared color palette, 2D and 3D |
| `js/studio/beat-presence.js` | Z-axis presence gain and coupling |
| `js/studio/beat-guide.js` | First-use contextual hints |
| `js/studio/studio-loader.js` | Lazy bundle loader — Three.js + studio on demand |

### Arpeggio logic

The arpeggio environment is the only machine that changes pitch per step mid-loop. Each dot's Y/Z position sets a root note. A 16-step pattern walks scale degree offsets from that root on every hit:

```
BEAT_ARP_PATTERN = [0, 2, 4, 3, 2, 1, 3, 4, 2, 0, 1, 2, 4, 3, 1, 0]
```

Gravity still controls whether a dot fires on a given step. Pitch cycling happens in `markerBeatStepCore()` — each dot's `arpStep` counter drives `zoneArpStep()` in `theory.js`.

---

## Architecture decisions for the next version

Two core decisions made before starting the M4L build:

### Physics run on the musical clock, not the frame rate

In the web version, gravity calculations happen in `requestAnimationFrame` — tied to the screen's 60fps refresh. This causes:
- Timing drift when the browser tab is under load
- Non-deterministic patterns (same layout sounds different on replay)
- Physics that can't be ported cleanly to a non-browser host

In the M4L version, **physics steps are locked to the musical transport**. The core engine ticks every 16th note (or every n subdivisions), not every frame. The visual canvas becomes a "dumb" display that reads state and redraws — it does not drive timing.

Benefits:
- Patterns are deterministic and reproducible
- Transport sync is exact
- The same core JS runs in `v8` inside Max, in a future iOS app, or in a standalone C++ process without modification

### Presets and state via unified snapshots, not individual automation

The web version saves state to `sessionStorage` as a flat key-value map. In M4L, the entire world state — all dot positions, environment params, phase offsets — is saved as a single JSON snapshot inside a Max `[dict]` object, linked to `[pattrstorage]`. This means:

- Ableton project files automatically include full instrument state
- No CPU spikes from automating dozens of floating-point XY coordinates
- Preset browser is trivial to implement — swap the dict, redraw
- Undo/redo is one snapshot diff

---

## Roadmap

### What transfers from web to M4L without changes

| Module | Role | M4L fate |
|--------|------|----------|
| `theory.js` | Pitch, scales, arp patterns, step timing | **Port directly to `v8`** |
| `beat-seq.js` | Gravity pattern generation | **Port** |
| `beat-spatial.js` | Dot coupling, peer distance | **Port** |
| `beat-kaoss.js` | Phase + pitch snap | **Port** |
| `beat-influence.js` | Reach and blend tuning | **Port** |
| `machines.js` | Environment parameter state | **Port** |
| `beat-mix.js` | Collision / duck logic | **Port** → mapped to MIDI velocity |
| `beat-colors.js`, `beat-bonds.js` | Visual style | Port if using `[jweb]` UI |

### What must be rebuilt or dropped

| Module | Web role | M4L fate |
|--------|----------|----------|
| `engine.js` | Web Audio buses | **Drop** (Path A/B) or **RNBO** (Path C) |
| `machine-playback.js`, `voices.js` | Web Audio synthesis | **Drop** → Ableton instruments |
| `browse.js` | Hover preview + transport | **Split** — transport logic out, audio gone |
| `markers.js` | Dot state + DOM rendering | **Refactor** — extract non-DOM core |
| `beat-view3d.js` + Three.js | 3D molecule view | **Drop in v1** / `[jweb]` only later |

~40% of the codebase (logic layer) ports unchanged. ~60% is host-specific and gets replaced.

---

### Stage 0 — Extract the portable core *(in this repo)*

**Duration:** 2–3 weeks  
**Goal:** create a `js/core/` folder with zero host dependencies

Move into `js/core/`:
- `theory.js`
- `beat-seq.js`
- `beat-spatial.js`
- `beat-influence.js`
- `machines.js`
- Non-DOM parts of `environments.js`

Rules for core files:
- No `document`, no `window`, no `AudioContext`, no `sessionStorage`
- No `requestAnimationFrame`
- Input: `{ markers, envs, tempo }` → Output: `{ step, note, velocity, duration, channel }[]`
- One adapter interface abstracting host-specific calls (timer, storage, transport)

This work is prerequisite for everything below. It also benefits any future Capacitor / iPad / standalone app path.

---

### Stage 1 — Spatial MIDI device in Max for Live *(MVP)*

**Duration:** 2–4 months part-time  
**Device type:** MIDI Effect (`.amxd`)

- `[v8]` object runs the ported core JS
- 8 environments → MIDI channel or note map → downstream instruments (Drum Rack, Operator, Wavetable, user's choice)
- Transport syncs to Live via `live.object` → `song.tempo` + `is_playing`
- Step clock: `stepMs = 60000 / (tempo × 4)` — locked to transport beats
- Phase alignment: dot `normX` / `beatPhase` maps to Live's bar position
- Arpeggio step cycling stays entirely in JS — no DSP rebuild required
- Persistence: `[pattrstorage]` + `[dict]` stores full state snapshot in the Ableton project file
- Basic Max UI: environment strip, density knob per env, master transport, "write clip" button
- No visual pad in v1 — just the core engine and a functional parameter panel

**Why this first:** Ableton handles all sound quality immediately. The logic is the hard part and this tests it in a real musical environment. Users bring their own instruments — nothing to sell yet, but everything to learn.

---

### Stage 2 — Visual pad via `[jweb]` *(optional, after Stage 1)*

**Duration:** 4–8 months  
**Prerequisite:** Stage 0 complete, Stage 1 stable

- `[jweb]` hosts a bundled local HTML page inside the Max device window
- Dot drag in the pad → `window.max.outlet()` → `[v8]` core state update → MIDI out
- `postMessage` bridge between UI thread and sequencer thread
- 2D pad view only in v1; Three.js molecule view deferred
- Local Web Audio still available for UI preview (does not go to Live's output)

**Note:** there's a UX gap to manage — the pad preview sounds different from what Live plays through its instruments. This needs clear affordance in the UI.

---

### Stage 3 — Clip writer + full arpeggio in clips

**Duration:** 3–5 months  
**Alternative to real-time sequencing for some use cases**

- Reads the full spatial layout and writes MIDI clips directly to Session or Arrangement view
- Uses `ClipSlot.create_clip()` and `Clip.set_notes()` via the Live Object Model
- Full arpeggio step cycling (`BEAT_ARP_PATTERN`) baked into the clip notes
- No real-time scheduling inside the device — patterns become editable in Live's piano roll
- Minimal UI: layout snapshot → "Bake to clip" button
- Works with any Live setup, no instrument dependency

**Why this matters:** producers who want to compose spatially then edit traditionally in Live. The spatial layout becomes a composition tool, not a live performance instrument. Also significantly easier to build than a realtime MIDI device.

---

### Stage 4 — RNBO sound layer *(optional product tier)*

**Duration:** 6–12 months  
**Prerequisite:** Stages 1–3 complete and stable

Rebuild all eight machine DSP patches in **RNBO** (Cycling '74's portable DSP environment). RNBO compiles to:
- Standalone Max externals
- VST3 / AU plugins
- Web Audio (exportable back to browser)
- C++ for embedded hardware

When complete, the device becomes a self-contained instrument. No Drum Rack or external instruments needed. Audio runs inside Live's graph — proper latency, background audio, session recall.

This is the step that makes it sellable as a complete product, not just a MIDI utility.

**RNBO path also enables:**
- Standalone desktop app (no Ableton required)
- iOS / iPad app via RNBO's iOS export
- The hardware controller running the same DSP locally

---

### Stage 5 — Hardware controller (ESP32) *(long-term)*

**Duration:** open  
**Prerequisite:** Stages 1–4 complete

Physical controller based on ESP32 microcontroller. Preliminary thinking:

- Wireless MIDI over Bluetooth LE (ESP32 has native BLE MIDI support)
- Physical controls map to core parameters: dot density per environment, phase offset, gravity reach, arp speed
- LED matrix or small display reflects live dot activity
- USB MIDI fallback for latency-critical use

The ESP32 communicates with the M4L device via MIDI CC or OSC. The device's `[v8]` core translates controller input into state updates — the controller does not need to understand the spatial model, just send normalized values.

When the hardware controller is defined as a specific device with specific physical interactions, **this is where patent strategy makes sense**. A utility patent covering the system (hardware + firmware + spatial sequencer method) is more defensible and more valuable than a software-only patent. File after the design is stable, before public disclosure of the hardware.

---

## Commercial strategy

### IP protection right now

- **Copyright** — automatic, already in force. Covers the specific source code expression.
- **Trade secret** — the new M4L device repository will be private from creation. Do not publish until you choose to.
- **Git history** — timestamped commits are useful evidence of prior invention date.
- Do not apply MIT or any open-source license to the commercial codebase.

### When to file for a patent

Not now. Software-only patents are expensive (€10–30k to file and prosecute properly), take 2–5 years, and are difficult to enforce for an individual. The right time is after the hardware controller design is stable — a combined hardware + software + method patent is more defensible and more worth the cost.

### Distribution

- M4L devices ship as `.amxd` files
- Requires Ableton Live 11+ with Max for Live (included in Suite; add-on for Standard)
- Price range for a serious spatial sequencer: €25–80 for software only; €150–400+ for software + hardware bundle
- Distribution: direct (own site), Gumroad, Isotonik Studios, or Cycling '74's M4L marketplace
- The portfolio site (`www.estebancuenca.com`) remains public and independent of the commercial repo

### Why the M4L device market makes sense

What is genuinely novel in the current M4L catalog:
- Gravitational coupling between environments (cross-environment timing influence)
- Spatial arpeggio step cycling tied to 2D position
- The visual metaphor of placing sounds in physical space with emergent musical behavior from proximity

None of these three things exist as a combination in available M4L devices. The closest are probabilistic sequencers (e.g. Euclidean tools) and physics-inspired generators, but none use continuous spatial gravity fields across multiple sound environments with real-time visual coupling.

---

## Infrastructure notes

### Transport sync in Max

```javascript
// In v8 — poll tempo and running state
var liveSet = new LiveAPI("live_set");
var tempo = liveSet.get("tempo")[0];        // float BPM
var isPlaying = liveSet.get("is_playing")[0]; // 0 or 1
var stepMs = 60000 / (tempo * 4);           // 16th note duration in ms
```

### Persistence structure (dict snapshot)

```json
{
  "version": 1,
  "tempo": 120,
  "environments": [
    { "type": "kick", "dots": [{"x": 0.2, "y": 0.7, "z": 0.5}], "params": {} },
    { "type": "arp",  "dots": [{"x": 0.6, "y": 0.3, "z": 0.8}], "params": {} }
  ],
  "globalPhase": 0.0
}
```

`[pattrstorage]` in Max serialises this dict into the `.amxd` file. Loading a saved Ableton project restores the full spatial layout automatically.

### Host adapter interface (Stage 0 target)

```javascript
// The core depends on this interface only — never on document or AudioContext
var HostAdapter = {
  now: function() { /* returns current time in ms */ },
  scheduleStep: function(ms, callback) { /* fires callback after ms */ },
  saveState: function(key, value) { /* pattrstorage / dict / localStorage */ },
  loadState: function(key) { /* returns saved value */ },
  emitMidi: function(note, vel, ch, dur) { /* MIDI out / Web Audio / stub */ }
};
```

Web version passes a `localStorage` + `AudioContext` adapter. M4L version passes a `dict` + `v8` scheduler adapter. Same core, different hosts.

---

## Immediate next steps

1. **Name the product.** Everything — repository structure, trademark registration, patent timing, brand — follows from this decision. The name should be short, own-able, and not conflict with existing music software.

2. **Create the private repository.** Empty, private, named after the product. This becomes the permanent home for commercial work.

3. **Stage 0** — extract `js/core/` in the portfolio repo. No new features; just the separation. Test that the web studio still works after extraction. Push.

4. **Copy core to the private repo.** Start the M4L host adapter. Test `v8` running the ported `theory.js` inside Max with a minimal patch.

5. **Stage 1 MIDI device.** First thing that actually plays music inside Ableton.
