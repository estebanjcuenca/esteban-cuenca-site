# Beat studio — six machines (one environment = one machine)

Reference BPM for tuning: **128**. Mono check kick+bass before hats.

---

## Kick machine (MPC / minimal techno)

**Path:** click (HP noise) → body (sine pitch drop 90→48 Hz) → sub (sine) → soft clip bus

| Param | Range | Meaning |
|-------|-------|---------|
| gain | 0.22–0.42 | Hit level |
| decay | 0.14–0.38 s | Body length |
| browseTone | 0–1 | Body tune (low fundamental) |
| browseHarmonics | 0–1 | Click transient |
| browseSubMix | 0–0.3 | Sub weight |
| browseDrive | 0–1 | Punch / saturation |
| browseSpace | 0–0.08 | Room (keep low) |

**X/Y/Z:** X = micro-timing · Y = body tune · Z = level + slight decay  
**Vel 1:** full punch · **Vel 2:** ghost (shorter, less click, −3 dB)

**Pass:** tight kick, sub controlled, not boomy next to 909-style hat at 128 BPM.

---

## Hat machine (TR-909)

**Path:** noise → HP → BP → amp (exp decay)

| Param | Range | Meaning |
|-------|-------|---------|
| gain | 0.06–0.18 | Level |
| decay | 0.03–0.14 s | Length |
| browseTone | 0–1 | Brightness / BP center |
| browseHarmonics | 0–1 | Crispness |
| browseFilterMin/Max | 5–14 kHz | BP window |
| browseFilterQ | 0.2–0.8 | Sharpness |
| browseSpace | 0–0.1 | Air |

**Vel 1:** closed (short) · **Vel 2:** open (2–3× decay, wider BP)

---

## Clap machine (layered 909)

**Path:** 3–5 staggered noise bursts → BP → tiny room

| Param | Range | Meaning |
|-------|-------|---------|
| gain | 0.08–0.22 | Level |
| decay | 0.06–0.18 s | Tail |
| browseTone | 0–1 | Mid focus |
| browseHarmonics | 0–1 | Layer density / snap |
| browseFilterMin/Max | 400–5 kHz | Band |
| browseSpace | 0–0.12 | Room |

**Vel 2:** fewer layers, shorter tail

---

## Bass machine (minimal sub)

**Path:** mono sine/tri → LP (static/slow) → amp · optional soft sat

| Param | Range | Meaning |
|-------|-------|---------|
| wave | sine/tri | Body |
| gain | 0.14–0.28 | Level |
| attack | 4–30 ms | Pluck vs soft |
| decay | 1.2–3.5 s | Note length |
| browseTone | 0–1 | LP cutoff (36–320 Hz) |
| browseSubMix | 0–0.35 | Sub weight |
| browseSpace | 0–0.08 | Dry |
| detune | ±20 ct | Weight |

**Y = scale note · X = subtle tone · Z = level + sustain**

---

## Bright machine (dry stab / lead)

**Path:** 1–2 detuned saw → plucky filter env → amp (dry)

| Param | Range | Meaning |
|-------|-------|---------|
| wave | saw/tri/sqr | Timbre |
| attack | 3–80 ms | Pluck |
| decay | 0.25–1.2 s | Stab length |
| browseTone / filter | 400–6 kHz | Brightness |
| browseHarmonics | 0–1 | Edge |
| browseSpace | 0–0.1 | Dry |

**Vel 2:** shorter, darker stab

---

## Minimal machine (soft texture)

**Path:** tri/sine → gentle LP → longer amp · light space

| Param | Range | Meaning |
|-------|-------|---------|
| attack | 80–400 ms | Soft onset |
| decay | 1.5–4 s | Pad tail |
| browseTone | 0–1 | Warmth |
| browseSpace | 0–0.18 | Air (still restrained) |
| LFO | slow optional | Movement |

---

## Shared

- **Drum bus:** HP ~28 Hz → gentle compressor → browse chain  
- **Pattern vel 1/2** → per-machine timbre map  
- **Factory reset** → machine `defaults`, not global preset keys  
