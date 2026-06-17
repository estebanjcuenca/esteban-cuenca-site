# Esteban Cuenca — Personal Site

Portfolio site for film & immersive producer Esteban Cuenca. No build step.

---

## Beat Studio

The site includes an experimental **spatial beat studio** accessible from the toolbar. It is a separate, lazily-loaded module built on top of the same Web Audio system used by the main portfolio sound panel.

### What it is

A 2D/3D pad interface where each dot is a sound source placed in space. Dot position controls pitch (Y axis), beat phase (X axis), and harmonic depth (Z axis). Groups of dots form **environments** — one per machine type — that share sound settings and interact through gravity-based pattern generation.

### Sound environments (machine types)

Eight environments, each with its own timbre character and spatial role:

| Name | Type | Character |
|------|------|-----------|
| **Kick** | Percussion | MPC-style — click + body + sub |
| **Hat** | Percussion | 909 noise bandpass — vel 2 = open hat |
| **Clap** | Percussion | Staggered noise bursts + short room |
| **Bass** | Melodic | Mono sub — ↕ melody, sine body |
| **Lead** | Melodic | Dry filtered saw stab — short release |
| **Soft** | Melodic | Warm pad — slow attack, gentle space |
| **Synth** | Melodic | Analog stack — saw, filter sweep, LFO |
| **Arp** | Melodic | Step arpeggio — cycles scale tones per hit |

Each environment is tuned via the layer panel (wave, envelope, filter, LFO). Drum environments use synthesized machine playback; melodic environments use the full browse voice graph.

### Key files

| File | Role |
|------|------|
| `js/audio/machines.js` | Machine metadata, defaults, synth mods per type |
| `js/audio/machine-playback.js` | Per-machine Web Audio drum playback |
| `js/audio/theory.js` | Pitch, scales, arp patterns, beat step logic |
| `js/audio/engine.js` | Buses, reverb, limiter, AudioContext |
| `js/studio/environments.js` | Environment model — 8 layers, params, persistence |
| `js/studio/markers.js` | Dot placement, selection, voice lifecycle |
| `js/studio/beat-seq.js` | Gravity-based auto-pattern generation |
| `js/studio/beat-spatial.js` | Dot coupling, peer distance, phase fields |
| `js/studio/beat-influence.js` | Tuning: harmonize pull, reach, blend |
| `js/studio/beat-kaoss.js` | Soft-snap Kaoss XY, phase + pitch magnetism |
| `js/studio/beat-mix.js` | Frequency collision, sidechain, spatial EQ |
| `js/studio/beat-bonds.js` | 2D bond lines between related dots |
| `js/studio/beat-view3d.js` | Three.js molecule view (3D dots + bond tubes) |
| `js/studio/beat-colors.js` | Shared color palette for 2D and 3D |
| `js/studio/beat-presence.js` | Z-axis presence gain and coupling |
| `js/studio/beat-guide.js` | Contextual hints during first use |
| `js/studio/studio-loader.js` | Lazy bundle loader (Three.js + studio on demand) |

### Arpeggio environment — how it works

The `arpeggio` environment is the only machine type that changes pitch per step while the loop runs. Each dot's Z/Y position sets the root note; a 16-step pattern (`BEAT_ARP_PATTERN` in `theory.js`) walks scale tones around that root every time that dot hits in the pattern:

```
pattern: [0, 2, 4, 3, 2, 1, 3, 4, 2, 0, 1, 2, 4, 3, 1, 0]
         (scale degree offsets from dot's pitch anchor)
```

Gravity/coupling still controls hit density. Pitch cycling happens inside `markerBeatStepCore()` — the step index on each voice's `arpStep` counter drives `zoneArpStep()`.

### Loading strategy

The studio bundle (Three.js + all `js/studio/` files) is deferred until the user opens the studio panel. `studio-loader.js` chains the scripts in dependency order, shows a loading indicator, then activates the studio. Audio context boots on first user gesture.

### Live development server

```bash
python3 -m http.server      # http://localhost:8000
# or VS Code / Cursor Live Server on port 5500
```

---

## Road map — Ableton / Max for Live

> Full detail in [`BEATSTUDIO.md`](BEATSTUDIO.md) — development log, architecture decisions, stage-by-stage roadmap, controller plan, and commercial strategy.

The spatial beat model is designed to be host-independent. The plan below describes how to move from web-only to a Max for Live device — either as a MIDI sequencer that drives Live's instruments, or eventually as a self-contained audio device.

### What transfers vs. what must be rebuilt

| Module | Web role | M4L fate |
|--------|----------|----------|
| `theory.js` | Pitch, scales, arp, step timing | **Port to `v8`** |
| `beat-seq.js` | Gravity pattern generation | **Port** |
| `beat-spatial.js`, `beat-kaoss.js`, `beat-influence.js` | Coupling, snap, phase | **Port** |
| `machines.js`, `environments.js` | Parameter state | **Port** |
| `beat-mix.js` | Collision / duck logic | **Port** (→ MIDI vel) |
| `beat-colors.js`, `beat-bonds.js` | Visual style | Port if using `jweb` UI |
| `engine.js` | Web Audio buses | **Drop** (Path A) or **RNBO** (Path C) |
| `machine-playback.js`, `voices.js` | Web Audio synth | **Drop** or **RNBO** |
| `browse.js` | Hover preview + transport | **Split** — transport out, audio gone |
| `markers.js` | Dot state + DOM | **Refactor** — extract non-DOM core |
| `beat-view3d.js` + Three.js | 3D molecule view | **Drop** in v1 / `jweb` only |

Roughly 40% of the studio codebase (the logic layer) is portable without changes; 60% needs a new host.

### Four paths

#### Path A — MIDI brain device *(recommended first step)*

A Max for Live **MIDI effect** that keeps the spatial sequencer engine and outputs MIDI notes to downstream tracks (Drum Rack, Operator, Wavetable, etc.).

- `v8` object runs ported JS core
- Outputs 16-step MIDI per active dot per environment
- 8 environments → MIDI channel or note map → user's sounds
- Syncs to Live tempo via `live.object` → `song.tempo` + `is_playing`
- Arpeggio pitch cycling stays in JS logic — no DSP rebuild needed

**Effort:** 2–4 months part-time.
**Shippable.** Users bring their own instruments.

#### Path B — `jweb` hybrid *(most visual fidelity)*

A Max for Live device with `[jweb]` hosting the local pad UI. Max handles Live sync and MIDI/audio; the web page handles interaction and drawing.

- Pad interaction lives in a bundled local HTML page
- `window.max` / `postMessage` bridge between UI and `v8` sequencer
- 2D pad in v1; optional Three.js view later
- Local Web Audio preview ≠ Live sound (UX gap to manage)

**Effort:** 4–8 months. Recommended after core extraction (see Stage 0).

#### Path C — RNBO sound layer *(self-contained instrument)*

Rebuild the machine DSP in **RNBO** or MSP `gen~`, exported as a standalone `.amxd` instrument. All eight machine types become RNBO presets; no external Drum Rack or instrument needed.

- One device, no setup
- Audio runs inside Live's graph — proper session, background, low latency
- Sellable as a complete instrument

**Effort:** 6–12 months. Right choice when the product needs its own identity, not when it drives existing sounds.

#### Path D — Clip factory *(pattern baking)*

A device that reads the spatial layout and writes MIDI clips directly to Session or Arrangement view. Patterns become editable clips in Live's piano roll.

- No real-time scheduling in the device itself
- Heavy use of `ClipSlot`, `create_clip`, `set_notes` via Live Object Model
- Minimal UI; works with any Live setup

**Effort:** 3–5 months. Underrated for producers who want to compose spatially then edit in Live.

### Infrastructure required regardless of path

| Concern | Solution |
|---------|----------|
| **Transport sync** | `live.object` → `song.tempo`; `stepMs = 60000 / (tempo × 4)` |
| **Phase alignment** | Dot `normX` / `beatPhase` ↔ Live bar position |
| **Persistence** | `pattrstorage` or `dict` / embedded JSON (replaces `sessionStorage`) |
| **Audio preview** | Web Audio local preview for UI; Live signal for output |
| **Host adapter** | Abstraction layer over `AudioContext`, `document`, `setInterval` |

### Recommended build stages

**Stage 0 — Extract portable core** *(in this repo, 2–3 weeks)*
Move `theory.js`, `beat-seq.js`, `beat-spatial.js`, `beat-influence.js`, `machines.js`, and the non-DOM parts of `environments.js` into a `js/core/` folder. No `document`, no `AudioContext`, no `sessionStorage` in core. Core input/output: `{ markers, envs, tempo }` → `{ step, note, velocity, duration, channel }[]`.
This work benefits Capacitor, M4L, and long-term maintainability simultaneously.

**Stage 1 — Spatial MIDI M4L device** *(MVP)*
- Device type: MIDI Effect
- `v8` runs the ported core
- 8 environments → MIDI channel / note map
- Simple Max UI: env bar, density knob, "write clip" button
- Transport locked to Live

**Stage 2 — `jweb` pad** *(optional)*
- Local bundled pad HTML inside the device
- Bridge: dot drag → core state update → MIDI out
- 2D pad; 3D view deferred

**Stage 3 — Clip writer + full arpeggio**
- Bake spatial patterns into Session clips via LOM
- Full arpeggio step cycling (`BEAT_ARP_PATTERN`) in clips

**Stage 4 — RNBO sound layer** *(optional product tier)*
- Rebuild machines as RNBO DSP presets
- Promote from MIDI device to instrument

### Distribution
- M4L devices ship as `.amxd`
- Requires Ableton Live 11+ with Max for Live (Suite or add-on)
- Distribution: direct, Gumroad, or Ableton-curated marketplace
- GitHub Pages remains the web version; both share the same core logic

---

## Structure

- `index.html` — markup; loads `content.md` and the audio scripts
- `fonts.css` — PP Radio Grotesk `@font-face` rules (base64-embedded)
- `styles.css` — all other CSS (tokens, layout, dark mode, print, sound lab, etc.)
- `content.md` — all site content (markdown + frontmatter). **Edit this to change content.**
- `photo.jpg` — hero photo, referenced via `photo:` in the frontmatter
- `privacy.html` — standalone privacy policy page
- `js/audio/` — Web Audio system (see **Audio system** below)

## How it works

On load, the JS fetches `content.md`, parses the frontmatter (`photo`, `subtitle`, `location`, `email`, `privacy`) and markdown body, and renders the DOM.

## Local preview

Because content is fetched at runtime, the site must be served over HTTP — opening `index.html` directly from the file system will show a load error.

```bash
python3 -m http.server      # then open http://localhost:8000
```

Or use the Live Server extension in Cursor/VS Code.

## ⚠️ Note for tool-assisted editing

`index.html` has two script tags: `<script type="application/ld+json">` in `<head>` (SEO) and audio scripts at the end of `<body>`. Content lives in `content.md`, not embedded in HTML.

## Design system

- Font: PP Radio Grotesk (Regular, Italic, Black) — base64-embedded in `fonts.css`
- CSS tokens: `--ink` `--bg` `--mid` `--border` `--pad-x`
- Dark mode: `html.dark` class, toggled via `◐` button, persisted in `localStorage` (key `ec-dark`)
- Layout: desktop = text left + sticky photo right (54%); mobile = photo top, text below

---

## Audio system

The toolbar button toggles between **Sound** and **Music**. These are two separate engines that share some panel settings (wave, gain, attack, etc.) but behave very differently.

| | **Sound mode** (default) | **Music mode** |
|---|---|---|
| Toggle label | `Sound` | `Music` |
| Trigger | Hover / hold on CV table rows | Step sequencer on Film & Commercial tables |
| Synth | Multi-oscillator “browse voice” (filter, harmonics, sub, LFO) | Simple one-shot blips (kick, clap, bass, note) |
| Panel tabs | Generator · Harmony · Loops | Sequencer |

Settings are saved to `localStorage` under key `ec-sound` (schema v10). Presets and sliders survive reload.

### How rows map to pitch (keys + synth)

Each markdown **table row** is one horizontal pad. In **Sound mode**:

```
ROW (CV line)  →  octave band (row 1 = lowest, row 2 = +1 octave, …)
Y on row       →  key (5 pent notes: A · B · C# · E · F#, bottom→top)
X on row       →  tone only (filter / oscillator colour — not pitch)
```

**Scale:** one global **A major pentatonic** (root A2 = 110 Hz). Same rules in every section.

**Key count** is configurable via `ECAudio.BROWSE_ROW_KEYS` in `constants.js` (default **5**).

Implementation: `js/audio/theory.js` → `browsePadMidi(rowIndex, normY)`.

Row tooltips are set by `js/audio/zones.js` → `annotateRowPad()`. More table lines in `content.md` → more row pads (more octaves).

**Music mode** uses the same map with Y fixed at centre key when `quantizeNotes` is on. Only **Film** and **Commercial** have the step sequencer (`.midi-bank`).

### How Sound-mode audio is generated

When the pointer enters a row, `js/audio/browse.js` → `playZone()` starts or updates a **hold voice**. The signal chain (created in `createHoldVoice()`) is:

```
osc1          ─┐
unisonOsc (+7¢)─┤
harm2 (sine 2×) ┤→ toneMix → waveShaper (drive) → lowpass filter → padGain → envGain → browse bus → master
harm3 (sine 3×) ┤                                                      ↘ reverb send
harm4 (sine 4×) ┤
subOsc (sine ½×)┘
optional LFO → filter frequency / padGain / osc1.detune
```

**Pitch** comes from `ECAudio.Theory.resolveBrowsePitch(secId, normX, normY, rowIndex)` — `rowIndex` + snapped **Y** set the note; **X** does not change pitch.

**Timbre** comes from `ECAudio.BrowseSound.resolve()` in `js/audio/browse-sound.js`, which reads panel params plus pointer position:

| Input | Affects |
|-------|---------|
| `normX` (position along row) | Lowpass cutoff between `browseFilterMin` and `browseFilterMax` |
| `browseTone` | Brightness bias on filter |
| `browseHarmonics` | Levels of harm2/3/4, unison, and drive (scaled by wave type — see below) |
| `browseSubMix` | Sub-oscillator level |
| `gain`, `attack`, `decay` | Envelope |
| `browseSpace`, `reverbAmt` | Reverb send |
| `detune` | Cents on main osc |
| `browseLfoRate/Depth/Target` | LFO |
| Loop `sizeNorm` | Louder / spacier / slower attack when you pin a loop |

**Hold vs Arp:** `mode: harmonic` sustains while hovering. `mode: arpeggio` runs a pentatonic arp pattern (`ARP_PATTERNS.pent` in `theory.js`) stepped at BPM.

**Pinned loops** (hold on a row → dot) reuse the same voice graph via `createPinnedVoice()`. Multiple loops duck each other (`browsePolyFloor`, `browsePolyPow`).

### Sound lab (⛥ panel)

The full-screen generator has its own XY pad. It always previews **Film** section pitch (`SL_TEST_SEC` in `js/audio/sound-lab.js`). Moving X changes filter readout; Y changes the note label. The lab pad uses the full browse voice stack, not the simplified test oscillator.

### What changed from the older deployed version

The earlier version was closer to “one oscillator per hover, root + scale per section, Y position picks the note.”

The current version deliberately split responsibilities:

1. **Row = note, X = tone** — pitch no longer follows vertical mouse position within a row.
2. **Multi-oscillator voice** — saw/square/sine plus optional harmonic oscillators, sub, drive, and filter (the “generator” work).
3. **Presets** — Bright / Soft pad / etc. set a bundle of browse params (`js/audio/presets.js`). Default preset is **Bright** (saw).
4. **Loops** — hold-to-pin markers with size affecting level and space.
5. **One pentatonic everywhere** — section roots no longer shift to unrelated keys; sections differ by *starting degree*, not by scale type.

If something “doesn’t respond” after a change, check whether you are in Sound vs Music mode and whether the control is browse-only (see table below).

### Generator panel — what works in Sound mode, and wave types

Almost all **Generator** tab sliders are **Sound-mode only**. They route through `BrowseSound.resolve()` → `applyVoiceSpec()`.

| Control | Sound mode | Music mode | Notes |
|---------|------------|------------|-------|
| Presets | ✓ | — | Sound only |
| Wave (sine / triangle / saw / square) | ✓ | ✓ (notes only) | See wave caveats below |
| Detune | ✓ | ✓ | |
| Sub mix | ✓ | — | |
| Volume, Attack, Release | ✓ | partial | Music uses attack + decay on note blips; not the full browse envelope |
| Tone, Harmonics, Filter min/max/Q, Pad X, High-pass | ✓ | — | |
| LFO rate/depth/target | ✓ | — | |
| Space, Reverb | ✓ | partial | Music: reverb on notes/claps, not browse space |
| BPM, Hold/Arp | ✓ | ✓ | BPM drives arp + sequencer |
| Harmony tab | info | — | Shows section → note ladder |
| Loops tab | ✓ | — | |
| Sequencer tab | — | ✓ | |

#### Wave type behaviour (Sound mode)

All four waves use the **same** signal path. Differences:

- **`osc1` and `unisonOsc`** use the selected wave (`params.wave`).
- **`harm2/3/4` and `subOsc`** are always sine.
- **Harmonics slider** auto-scales by wave (`harmonicLevels()` in `browse-sound.js`):
  - **Sine** — harmonics at full strength (sine has no overtones, so extras are added deliberately).
  - **Saw** — harmonics at ~22% (saw is already bright).
  - **Square** — ~28%.
  - **Triangle** — ~48%.

So: on **sine**, Harmonics does a lot; on **saw**, the same slider moves less (by design).

#### Live update vs restart

When you move a slider in Sound mode, `js/audio/panel.js` classifies params:

- **Live** (filter, gain, tone, harmonics, detune, LFO, etc.) — updates the current voice without rebuilding oscillators (`refreshLiveBrowseAudio()`).
- **Restart** (`wave`, `mode`, `bpm`) — rebuilds **pinned loop** voices (`Markers.restartVoices()`). The **hover hold** voice is *not* rebuilt; leave the row and re-enter to hear a wave change while hovering.

The **▶ Test tone** button in the sound lab uses a *simple* single oscillator (`browse.js` → `test()`), not the full multi-osc voice. It is a quick level check, not a full preset preview.

### Music-mode audio (simpler)

`js/audio/voices.js` → `playShortBlip()`:

- One `OscillatorNode` with `params.wave` and `params.detune`
- Gain envelope from `attack`, `noteLength`, track gain
- Bass track adds a sweeping lowpass
- Kick/clap are synthesized noise bursts — wave setting does not affect them

Music mode does **not** use browse filter, harmonics, sub mix, LFO, or drive.

### Audio file map

Scripts load in this order (see bottom of `index.html`):

| File | Role |
|------|------|
| `constants.js` | Schema version, param keys, section IDs |
| `harmony.js` | Global A pent harmony defaults |
| `store.js` | `ECAudio.params`, localStorage load/save |
| `state.js` | AudioContext, buses, scale definitions |
| `engine.js` | Master/browse/music buses, reverb, limiter |
| `browse-sound.js` | Timbre resolver (`BrowseSound.resolve`) |
| `presets.js` | Generator presets |
| `theory.js` | Pitch, scales, row MIDI |
| `zones.js` | Row pads, overlays, note labels |
| `browse.js` | Hover voice, hold/arp, loops |
| `markers.js` | Pin / loop gestures |
| `voices.js` | Music-mode blips |
| `sound.js` | `window.Sound` facade |
| `seq.js` | Step sequencer UI |
| `sound-lab.js` | Full-screen panel, scope, XY pad |
| `panel.js` | Slider/segment wiring |
| `debug.js` | `?debug=1` diagnostics |
| `app.js` | Mode toggle, pointer pipeline |

### Debugging

Add `?debug=1` to the URL (or `localStorage ec-debug=1`). Console prints table integrity, row-pad counts, and param state.

---

## Features

- Markdown-driven content rendering (fetched from `content.md`)
- Dark/light mode with localStorage persistence
- Section hide/show with localStorage persistence
- Scroll fade-in animations (IntersectionObserver)
- Web Audio: Sound mode (row-hover generator) and Music mode (step sequencer)
- Sound settings panel (⛥): presets, oscillator, filter, LFO, loops; persisted in `localStorage`
- Print CSS (A4, hides UI, respects hidden sections)
- Mobile responsive layout
- SEO: meta description, Open Graph tags, JSON-LD Person schema

## TODO

- [x] **Replace `https://yourdomain.com` placeholders** — `https://estebanjcuenca.github.io/esteban-cuenca-site/`
- [x] Extract base64 photo to `photo.jpg` — done 2026-06-10
- [x] Extract markdown content to `content.md` — done 2026-06-10
- [x] Persist sound settings to localStorage — done (`ec-sound`, schema v9)
- [ ] Mobile: sound panel should be a bottom sheet on small screens (currently side panel)
- [ ] Mobile: toolbar has too many buttons at small breakpoints
- [x] Deploy to GitHub Pages — `https://estebanjcuenca.github.io/esteban-cuenca-site/`

## Deploy (GitHub Pages)

```bash
git init
git add .
git commit -m "Initial commit: single-file portfolio site"
git branch -M main
git remote add origin git@github.com:USERNAME/REPO.git
git push -u origin main
```

Then: repo → Settings → Pages → Source: "Deploy from a branch" → branch `main`, folder `/ (root)` → Save. Site appears at `https://USERNAME.github.io/REPO/` within a minute or two.
