# Esteban Cuenca — Personal Site

Portfolio site for film & immersive producer Esteban Cuenca. No build step.

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
