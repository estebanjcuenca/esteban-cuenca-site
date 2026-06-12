# Beat compound mix — staged rollout

Spatial coupling drives who interacts; each stage adds a mix rule visible in audio + graphics.

## Stage 1 — Pattern & timing (groove discipline)

| Feature | Module | Behavior |
|---------|--------|----------|
| Proactive pattern de-clash | `beat-mix.refinePattern` → `beat-seq.refreshAllPatterns` | After all patterns build, coupled losers demote clash steps to ghost or shift +1 step |
| Mute groups | `beat-mix.applyMuteGroups` | Hat + clap on same step → weaker coupling ghosts |
| Swing-aware separation | `beat-mix.stepTimingOffset` → `browse.playArpStep` | Micro-timing from X + swing separates “same step” hits in time |

## Stage 2 — Mix bus (Akai pump & space)

| Feature | Module | Behavior |
|---------|--------|----------|
| Stereo pan from X | `beat-mix.stereoPan` → voice `StereoPanner` | Pan from beat position; coupled clusters pull toward shared center |
| Dynamic EQ carve | `beat-mix.applyEqCarve` → `applyToSpec` | Coupled peers carve notches in each other's filter path |
| Melodic bus compression | `engine.ensureMelodicBus` | Synth voices → comp bus; kick sidechain depth scales with coupling % |

## Stage 3 — Graphics (read the mix)

| Feature | Module | Behavior |
|---------|--------|----------|
| Scope duck meter | `beat-mix.recordDuck` → `sound-visual.drawScope` | Live scope shows sidechain dip depth when kick pumps coupled layers |
| Compound wave clash wash | `sound-visual.drawWaveShape` | (Stage 0) layered waves + orange clash regions |
| Band lanes on spectrum | `sound-visual.drawSpectrum` | (Stage 0) per-role frequency lanes |

## Stage 4 — Placement & spatial mix view

| Feature | Module | Behavior |
|---------|--------|----------|
| Placement de-clash | `beat-mix.resolvePlacementClash` → `beat-kaoss.mapPlacement` | On drop/drag, nudge beat step or pitch away from coupled frequency clashes |
| Hold preview feedback | `markers.updatePressPreview` | Orange preview = clash at cursor · faded green = clean · nudged = auto-shifted |
| Pad stereo lanes | `beat-studio.ensurePadStereoLanes` | L / beat·pitch / R guides on the XY pad |
| Dot pan spread | `beat-mix.stereoPan` → `markers.applyMarkerVisual` | Dots shift L/R on pad; chip shows `L42` / `R18` / `C` |
| 3D stereo wings | `beat-view3d.syncStereoSpread` | Floor wings + arc under each sphere show pan spread |
| Clash affinity (3D) | `beat-view3d.syncAffinityGuides` | Orange line between selected dot and clash peer |

## Dependency order

```
beat-spatial (coupling)
  → beat-mix (rules)
    → beat-kaoss (placement snap)
    → beat-seq (patterns)
    → theory / browse (playback)
    → engine (buses)
    → sound-visual (meters)
    → beat-view3d / pad (spatial mix view)
```
