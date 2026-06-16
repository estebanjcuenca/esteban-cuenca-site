/* eslint-disable no-var */
// Beat studio — shared palette + color logic (2D pad + 3D + bonds).
window.ECAudio = window.ECAudio || {};

var PRESET_COLORS = {
  kick: { h: 14, s: 76, l: 46 },
  hat: { h: 192, s: 48, l: 66 },
  bass: { h: 268, s: 52, l: 42 },
  clap: { h: 38, s: 68, l: 54 },
  bright: { h: 88, s: 70, l: 52 },
  minimal: { h: 215, s: 24, l: 56 },
  synth: { h: 300, s: 58, l: 50 },
  arpeggio: { h: 172, s: 62, l: 48 }
};

var PRESET_CLASS_IDS = ['kick', 'hat', 'bass', 'clap', 'bright', 'minimal', 'synth', 'arpeggio'];
var PERC_TYPES = { kick: 1, hat: 1, clap: 1 };

var GOLD = { h: 42, s: 76, l: 56 };
var CLASH = { h: 18, s: 72, l: 46 };

var SEMANTIC = {
  bondTime: { h: 197, s: 56, l: 50 },
  bondHarm: { h: 145, s: 48, l: 46 },
  bondBoth: { h: 40, s: 76, l: 56 },
  bondZ: { h: 268, s: 30, l: 58 },
  bondClash: CLASH,
  gold: GOLD,
  clash: CLASH,
  guide: { h: 215, s: 22, l: 62 }
};

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function markerPresetId(marker) {
  if (!marker) return null;
  if (marker.presetId) return marker.presetId;
  if (marker.envId) return marker.envId.replace(/^env-/, '');
  if (marker.role && PRESET_CLASS_IDS.indexOf(marker.role) >= 0) return marker.role;
  return null;
}

function presetBaseHsl(presetId) {
  var p = presetId && PRESET_COLORS[presetId];
  return p ? { h: p.h, s: p.s, l: p.l } : { h: 210, s: 40, l: 50 };
}

function presetBaseHslFromMarker(marker) {
  return presetBaseHsl(markerPresetId(marker));
}

function presetHue(typeOrMarker) {
  var id = typeof typeOrMarker === 'object' ? markerPresetId(typeOrMarker) : typeOrMarker;
  return presetBaseHsl(id).h;
}

function blendHsl(a, b, ratio) {
  ratio = ratio != null ? ratio : 0.5;
  return {
    h: Math.round(a.h * (1 - ratio) + b.h * ratio),
    s: Math.round(a.s * (1 - ratio) + b.s * ratio),
    l: Math.round(a.l * (1 - ratio) + b.l * ratio)
  };
}

function markerNormZ(marker) {
  if (ECAudio.BeatPresence && ECAudio.BeatPresence.normZ) {
    return ECAudio.BeatPresence.normZ(marker);
  }
  return marker && marker.normZ != null ? marker.normZ : 0.55;
}

function markerOnBeat(marker) {
  if (!marker || marker.step == null) return false;
  if (ECAudio.Theory && ECAudio.Theory.normXFromStep) {
    var snapX = ECAudio.Theory.normXFromStep(marker.step);
    return Math.abs((marker.normX != null ? marker.normX : 0.5) - snapX) < 0.022;
  }
  if (marker.beatPhase != null) {
    var phase = marker.beatPhase % 1;
    if (phase < 0) phase += 1;
    var nx = marker.normX != null ? marker.normX : 0.5;
    var fromX = ECAudio.BeatKaoss && ECAudio.BeatKaoss.beatPhaseFromX
      ? ECAudio.BeatKaoss.beatPhaseFromX(nx) : phase;
    return Math.abs(fromX - phase) < 0.04;
  }
  return false;
}

function markerInTune(marker) {
  var preset = markerPresetId(marker);
  if (preset && PERC_TYPES[preset]) return true;
  if (!ECAudio.Theory || !ECAudio.Theory.padSnapRowNormY) return false;
  var ny = marker.normY != null ? marker.normY : 0.5;
  var snapped = ECAudio.Theory.padSnapRowNormY(ny);
  return Math.abs(ny - snapped) < 0.028;
}

function markerClash(marker) {
  if (!marker || !marker.envId || !ECAudio.BeatMix || !ECAudio.BeatMix.placementWouldClash) {
    return false;
  }
  var preset = markerPresetId(marker);
  if (preset && PERC_TYPES[preset]) return false;
  var place = {
    normX: marker.normX,
    normY: marker.normY,
    beatPhase: marker.beatPhase,
    step: marker.step,
    toneNorm: marker.toneNorm
  };
  return !!ECAudio.BeatMix.placementWouldClash(place, marker.envId, marker.id).clash;
}

function markerCoupling(marker) {
  if (ECAudio.BeatSeq && ECAudio.BeatSeq.clusterStrength) {
    return ECAudio.BeatSeq.clusterStrength(marker);
  }
  return 0;
}

function markerState(marker) {
  var harmonized = markerOnBeat(marker) && markerInTune(marker);
  var clash = markerClash(marker);
  var coupling = markerCoupling(marker);
  return {
    harmonized: harmonized,
    clash: clash,
    coupling: coupling,
    onBeat: markerOnBeat(marker),
    inTune: markerInTune(marker)
  };
}

function envToneHarm(marker) {
  var env = null;
  if (marker && marker.envId && ECAudio.Environments && ECAudio.Environments.get) {
    env = ECAudio.Environments.get(marker.envId);
  }
  var mp = env && env.params ? env.params : (marker && marker.params ? marker.params : {});
  return {
    tone: mp.browseTone != null ? mp.browseTone : 0.58,
    harm: mp.browseHarmonics != null ? mp.browseHarmonics : 0.5,
    gain: mp.gain != null ? mp.gain : 0.13
  };
}

function resolveMarkerHsl(marker) {
  var preset = markerPresetId(marker);
  var th = envToneHarm(marker);
  var z = markerNormZ(marker);
  var size = marker && marker.sizeNorm != null ? marker.sizeNorm : 0.35;
  var level = marker && marker.levelMul != null ? marker.levelMul : 1;
  var state = markerState(marker);
  var base = presetBaseHsl(preset);
  if (!preset) {
    base = {
      h: Math.round(28 + th.tone * 90),
      s: Math.round(32 + th.harm * 38),
      l: 50
    };
  }

  var h = base.h;
  var s = clamp(Math.round(base.s + th.harm * 4 + state.coupling * 10), 22, 78);
  var l = clamp(Math.round(base.l + size * 8 + (level - 1) * 6 + z * 4), 32, 62);
  var alpha = clamp01(0.82 + z * 0.14 + level * 0.06);

  if (state.harmonized) {
    h = Math.round(h * 0.68 + GOLD.h * 0.32);
    s = clamp(Math.round(s * 0.78 + GOLD.s * 0.22), 32, 72);
    l = clamp(Math.round(l * 0.9 + GOLD.l * 0.1), 34, 58);
  } else if (state.clash) {
    h = Math.round(h * 0.72 + CLASH.h * 0.28);
    s = clamp(Math.round(s * 0.82 + CLASH.s * 0.18), 30, 72);
  }

  return {
    h: h,
    s: s,
    l: l,
    alpha: alpha,
    state: state,
    preset: preset
  };
}

function bondKind(bond) {
  if (!bond) return 'z';
  if (bond.clash) return 'clash';
  if (bond.time && bond.harm) return 'both';
  if (bond.time) return 'time';
  if (bond.harm) return 'harm';
  return 'z';
}

function resolveBondHsl(bond) {
  var kind = bondKind(bond);
  var strength = bond && bond.strength != null ? bond.strength : 0.5;
  var hsl;

  if (kind === 'z' && bond && bond.a && bond.b) {
    hsl = blendHsl(presetBaseHslFromMarker(bond.a), presetBaseHslFromMarker(bond.b), 0.5);
    hsl = {
      h: Math.round(hsl.h * 0.55 + SEMANTIC.bondZ.h * 0.45),
      s: clamp(Math.round(hsl.s * 0.65 + SEMANTIC.bondZ.s * 0.35), 18, 55),
      l: clamp(Math.round(hsl.l * 0.7 + SEMANTIC.bondZ.l * 0.3), 40, 65)
    };
  } else if (kind === 'clash') {
    hsl = SEMANTIC.bondClash;
  } else if (kind === 'both') {
    hsl = SEMANTIC.bondBoth;
  } else if (kind === 'time') {
    hsl = SEMANTIC.bondTime;
  } else if (kind === 'harm') {
    hsl = SEMANTIC.bondHarm;
  } else {
    hsl = SEMANTIC.bondZ;
  }

  var alpha = 0.28 + strength * 0.48;
  if (kind === 'clash') alpha = 0.72 + strength * 0.18;
  else if (kind === 'both') alpha = 0.58 + strength * 0.28;
  else if (kind === 'harm') alpha = 0.42 + strength * 0.38;
  else if (kind === 'time') alpha = 0.38 + strength * 0.36;
  else if (kind === 'z') alpha = 0.3 + strength * 0.28;

  return { h: hsl.h, s: hsl.s, l: hsl.l, alpha: alpha, kind: kind };
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  var c = (1 - Math.abs(2 * l - 1)) * s;
  var x = c * (1 - Math.abs((h / 60) % 2 - 1));
  var m = l - c / 2;
  var r = 0;
  var g = 0;
  var b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  var ri = Math.round((r + m) * 255);
  var gi = Math.round((g + m) * 255);
  var bi = Math.round((b + m) * 255);
  return (ri << 16) | (gi << 8) | bi;
}

function hslToCss(h, s, l, alpha) {
  var a = alpha != null ? alpha : 1;
  return 'hsl(' + h + ' ' + s + '% ' + l + '% / ' + a + ')';
}

function semanticHsl(name) {
  return SEMANTIC[name] || SEMANTIC.guide;
}

function semanticHex(name) {
  var s = semanticHsl(name);
  return hslToHex(s.h, s.s, s.l);
}

function markerHex(marker) {
  var c = resolveMarkerHsl(marker);
  return hslToHex(c.h, c.s, c.l);
}

function markerEmissiveHex(marker) {
  var c = resolveMarkerHsl(marker);
  if (c.state.harmonized) return hslToHex(GOLD.h, GOLD.s - 20, GOLD.l - 14);
  return hslToHex(c.h, clamp(c.s - 6, 0, 100), clamp(c.l - 18, 0, 100));
}

function bondHex(bond) {
  var c = resolveBondHsl(bond);
  return hslToHex(c.h, c.s, c.l);
}

function bondStyle3d(bond) {
  var c = resolveBondHsl(bond);
  var radius = c.kind === 'both' ? 0.062
    : c.kind === 'clash' ? 0.055
    : c.kind === 'harm' ? 0.05
    : c.kind === 'time' ? 0.044
    : 0.032;
  return {
    color: hslToHex(c.h, c.s, c.l),
    radius: radius,
    opacity: Math.min(0.95, c.alpha),
    kind: c.kind,
    hsl: c
  };
}

function applyBondLine(line, bond) {
  if (!line || !bond) return resolveBondHsl(bond);
  var c = resolveBondHsl(bond);
  line.style.setProperty('--bond-h', String(c.h));
  line.style.setProperty('--bond-s', c.s + '%');
  line.style.setProperty('--bond-l', c.l + '%');
  line.style.opacity = String(c.alpha);
  return c;
}

function applyToElement(marker, el) {
  if (!marker || !el) return resolveMarkerHsl(marker);
  var c = resolveMarkerHsl(marker);
  var z = markerNormZ(marker);
  var depth = ECAudio.BeatPresence && ECAudio.BeatPresence.depthScale
    ? ECAudio.BeatPresence.depthScale(z) : (0.78 + z * 0.34);
  var size = marker.sizeNorm != null ? marker.sizeNorm : 0.35;
  var pan = ECAudio.BeatMix && ECAudio.BeatMix.stereoPan
    ? ECAudio.BeatMix.stereoPan(marker) : 0;

  el.style.setProperty('--dot-hue', String(c.h));
  el.style.setProperty('--dot-sat', c.s + '%');
  el.style.setProperty('--dot-light', c.l + '%');
  el.style.setProperty('--dot-light-num', String(c.l));
  el.style.setProperty('--dot-light-hi', clamp(c.l + 8, 0, 100) + '%');
  el.style.setProperty('--dot-light-lo', clamp(c.l - 10, 0, 100) + '%');
  el.style.setProperty('--dot-alpha', String(c.alpha));
  el.style.setProperty('--dot-border-w', String(1.5 + size * 2.2) + 'px');
  el.style.setProperty('--dot-presence', String(z));
  el.style.setProperty('--dot-depth-scale', String(depth));
  el.style.setProperty('--dot-glow', String(0.08 + z * 0.18 + c.state.coupling * 0.12));
  el.style.setProperty('--dot-coupling', String(c.state.coupling));
  el.style.setProperty('--dot-pan', String(pan));
  el.classList.toggle('is-harmonized', !!c.state.harmonized);
  el.classList.toggle('is-on-beat', !!c.state.onBeat);
  el.classList.toggle('is-in-tune', !!c.state.inTune);
  el.classList.toggle('is-mix-clash', !!c.state.clash);

  return c;
}

ECAudio.BeatColors = {
  PRESET_COLORS: PRESET_COLORS,
  PRESET_CLASS_IDS: PRESET_CLASS_IDS,
  SEMANTIC: SEMANTIC,
  markerPresetId: markerPresetId,
  presetHue: presetHue,
  presetBaseHsl: presetBaseHsl,
  markerState: markerState,
  resolveMarkerHsl: resolveMarkerHsl,
  resolveHsl: resolveMarkerHsl,
  resolveBondHsl: resolveBondHsl,
  bondKind: bondKind,
  markerHex: markerHex,
  markerEmissiveHex: markerEmissiveHex,
  bondHex: bondHex,
  bondStyle3d: bondStyle3d,
  semanticHex: semanticHex,
  semanticHsl: semanticHsl,
  hslToHex: hslToHex,
  hslToCss: hslToCss,
  applyBondLine: applyBondLine,
  applyToElement: applyToElement
};
