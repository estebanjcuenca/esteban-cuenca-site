/* eslint-disable no-var */
window.ECAudio = window.ECAudio || {};

ECAudio.BrowseSound = {
  GAIN: 0.09,
  ATTACK: 0.06,
  DECAY: 1.0,
  SPACE: 0.06,
  TONE: 0.68,
  DETUNE: 0,
  FILTER_MIN: 600,
  FILTER_MAX: 4800,
  FILTER_Q: 0.75,
  SUB_MIX: 0.012,
  HP: 80,
  PAD_X: 1,
  HARMONICS: 0.45,
  WAVE: 'sawtooth',
  LFO_RATE: 0,
  LFO_DEPTH: 0.4,
  LFO_TARGET: 'filter',
  SIZE_LEVEL_MIN: 0.7,
  SIZE_LEVEL_MAX: 1.15,
  SIZE_SPACE_MAX: 0.12,
  SIZE_ATTACK_MAX: 1.35,
  POLY_FLOOR: 0.28,
  POLY_POW: 0.48,
  MIN_FREQ: 120
};

var _driveCurves = {};

function clamp01(v) {
  return Math.max(0, Math.min(1, v != null ? v : 0));
}

function panelVal(key, fallback, markerParams) {
  if (markerParams && markerParams[key] != null) return markerParams[key];
  return ECAudio.params[key] != null ? ECAudio.params[key] : fallback;
}

function panelTone(markerParams) {
  if (markerParams && markerParams.browseTone != null) return markerParams.browseTone;
  if (ECAudio.params.browseTone != null) return ECAudio.params.browseTone;
  var bright = panelVal('browseBright', 0.58, markerParams);
  var warm = panelVal('browseWarmth', 0.22, markerParams);
  return clamp01(bright * 0.7 + (1 - warm) * 0.3);
}

function filterBounds(markerParams) {
  var fMin = panelVal('browseFilterMin', ECAudio.BrowseSound.FILTER_MIN, markerParams);
  var fMax = panelVal('browseFilterMax', ECAudio.BrowseSound.FILTER_MAX, markerParams);
  if (fMin > fMax) { var t = fMin; fMin = fMax; fMax = t; }
  return { min: fMin, max: fMax, span: Math.max(80, fMax - fMin) };
}

function padFilterHz(normX, tone, markerParams) {
  return filterEnvelope(normX, tone, markerParams).filterHz;
}

function filterEnvelope(normX, tone, markerParams) {
  var b = filterBounds(markerParams);
  var t = clamp01(tone);
  var xPos;
  if (markerParams) {
    xPos = t;
  } else {
    var x = clamp01(normX);
    var xWeight = clamp01(panelVal('browsePadX', ECAudio.BrowseSound.PAD_X, markerParams));
    xPos = x * xWeight + 0.5 * (1 - xWeight);
    xPos += (t - 0.5) * 0.22;
  }
  xPos = clamp01(xPos);
  var center = b.min + xPos * b.span;
  var sweep = b.span * (markerParams ? 0.48 : 0.3);
  var bright = markerParams ? clamp01(panelVal('browseHarmonics', 0.45, markerParams)) : 0.45;
  return {
    filterHz: Math.min(b.max, Math.max(b.min, center)),
    filterStartHz: Math.max(b.min * 0.85, center - sweep * (0.55 + t * 0.35)),
    filterEndHz: Math.min(b.max * 1.05, center - sweep * (0.15 + bright * 0.55))
  };
}

function lfoDepthAmount(target, markerParams) {
  var depth = clamp01(panelVal('browseLfoDepth', 0, markerParams));
  if (depth < 0.01) return 0;
  var tgt = panelVal('browseLfoTarget', 'filter', markerParams);
  if (target && tgt !== target) return 0;
  if (tgt === 'filter') return depth * filterBounds(markerParams).span * 0.48;
  if (tgt === 'gain') return depth * 0.09;
  if (tgt === 'pitch') return depth * 18;
  return 0;
}

function driveCurve(amount) {
  var key = Math.round(amount * 100);
  if (_driveCurves[key]) return _driveCurves[key];
  var n = 256;
  var curve = new Float32Array(n);
  var drive = 1 + amount * 4;
  for (var i = 0; i < n; i++) {
    var x = (i * 2) / (n - 1) - 1;
    curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
  }
  _driveCurves[key] = curve;
  return curve;
}

// Musical overtones — sine is pure (no built-in harmonics), so we add 2nd/3rd/4th + unison.
function harmonicLevels(wave, markerParams) {
  var h = clamp01(panelVal('browseHarmonics', panelVal('browseDrive', ECAudio.BrowseSound.HARMONICS, markerParams), markerParams));
  var waveScale = { sine: 1, triangle: 0.48, sawtooth: 0.22, square: 0.28 }[wave || 'triangle'] || 0.65;
  var s = h * waveScale * (markerParams ? 1.35 : 1);
  return {
    h2: s * 0.4,
    h3: s * 0.21,
    h4: s * 0.1,
    unison: s * 0.18,
    drive: Math.min(0.35, h * 0.08 + (wave === 'sine' ? h * 0.06 : 0))
  };
}

function sizeMods(sizeNorm) {
  var s = clamp01(sizeNorm != null ? sizeNorm : 0.3);
  var cfg = ECAudio.BrowseSound;
  var levelMul = panelVal('browseSizeLevel', 1);
  var spaceMul = panelVal('browseSizeSpace', cfg.SIZE_SPACE_MAX) / cfg.SIZE_SPACE_MAX;
  return {
    level: (cfg.SIZE_LEVEL_MIN + s * (cfg.SIZE_LEVEL_MAX - cfg.SIZE_LEVEL_MIN)) * levelMul,
    space: s * cfg.SIZE_SPACE_MAX * spaceMul,
    attack: 1 + s * (cfg.SIZE_ATTACK_MAX - 1),
    arpSpeed: 1.06 - s * 0.18,
    shimmer: s * 4
  };
}

function polyLevel(count) {
  var n = Math.max(1, count || 1);
  var floor = panelVal('browsePolyFloor', ECAudio.BrowseSound.POLY_FLOOR);
  var pow = panelVal('browsePolyPow', ECAudio.BrowseSound.POLY_POW);
  return Math.max(floor, 0.98 / Math.pow(n, pow));
}

function applyRoleMods(spec, role) {
  if (!spec || !role) return spec;
  var s = Object.assign({}, spec);
  s.harmLevels = Object.assign({}, spec.harmLevels || {});
  s.beatPeak = 1;
  s.beatDecay = 1;
  if (role === 'kick') {
    s.filterHz = Math.max(90, s.filterHz * 0.38);
    s.filterQ = Math.min(2.2, s.filterQ * 1.35);
    s.subMix = Math.min(0.28, s.subMix * 3.6);
    s.peakGain *= 1.42;
    s.mixLevel *= 1.2;
    s.attack = 0.008;
    s.beatPeak = 1.55;
    s.beatDecay = 0.55;
    s.space *= 0.35;
    s.harmLevels.h2 *= 0.12;
    s.harmLevels.h3 *= 0.08;
    s.harmLevels.h4 *= 0.05;
    s.harmLevels.unison *= 0.2;
    s.lfoRate = 0;
  } else if (role === 'chord') {
    s.filterHz = Math.max(180, s.filterHz * 0.62);
    s.space = Math.min(0.5, s.space * 2.1);
    s.peakGain *= 0.78;
    s.mixLevel *= 0.88;
    s.attack = Math.min(0.42, Math.max(0.12, s.attack * 2.2));
    s.beatPeak = 0.82;
    s.beatDecay = 1.85;
    s.harmLevels.h2 *= 0.42;
    s.harmLevels.h3 *= 0.35;
    s.harmLevels.unison *= 0.55;
    s.lfoRate *= 0.35;
  } else if (role === 'lead') {
    s.filterHz = Math.min(14000, s.filterHz * 1.45);
    s.peakGain *= 1.28;
    s.mixLevel *= 1.18;
    s.attack = 0.012;
    s.beatPeak = 1.22;
    s.beatDecay = 0.72;
    s.harmLevels.h2 *= 1.55;
    s.harmLevels.h3 *= 1.35;
    s.harmLevels.unison *= 1.15;
    s.space *= 0.7;
    s.lfoRate *= 0.5;
  } else if (role === 'hat') {
    s.filterHz = Math.min(15000, s.filterHz * 2.1);
    s.filterQ = Math.min(1.4, s.filterQ * 0.72);
    s.peakGain *= 0.48;
    s.mixLevel *= 0.55;
    s.subMix *= 0.08;
    s.attack = 0.004;
    s.beatPeak = 0.62;
    s.beatDecay = 0.32;
    s.space = Math.min(0.35, s.space * 0.75);
    s.harmLevels.h2 *= 0.15;
    s.harmLevels.h3 *= 0.1;
    s.harmLevels.h4 *= 1.8;
    s.harmLevels.unison *= 0.25;
    s.lfoRate = 0;
  }
  return s;
}

function resolve(spec) {
  var normX = spec.normX != null ? spec.normX : 0.5;
  var normY = spec.normY != null ? spec.normY : 0.5;
  var sizeNorm = spec.sizeNorm;
  var count = spec.count != null ? spec.count : 1;
  var mp = spec.markerParams || null;
  var tone = panelTone(mp);
  var mods = sizeMods(sizeNorm);
  var poly = polyLevel(count);
  var baseSpace = panelVal('browseSpace', ECAudio.BrowseSound.SPACE, mp);
  var gain = panelVal('gain', ECAudio.BrowseSound.GAIN, mp);
  var atk = panelVal('attack', ECAudio.BrowseSound.ATTACK, mp);
  var filterQ = panelVal('browseFilterQ', ECAudio.BrowseSound.FILTER_Q, mp);
  var subMix = panelVal('browseSubMix', ECAudio.BrowseSound.SUB_MIX, mp);
  var lfoRate = Math.max(0, panelVal('browseLfoRate', 0, mp));

  var wave = panelVal('wave', ECAudio.BrowseSound.WAVE, mp);
  var harm = harmonicLevels(wave, mp);

  var decay = panelVal('decay', ECAudio.BrowseSound.DECAY, mp);
  var filt = filterEnvelope(normX, tone, mp);
  return {
    wave: wave,
    filterHz: filt.filterHz,
    filterStartHz: filt.filterStartHz,
    filterEndHz: filt.filterEndHz,
    filterQ: filterQ,
    subMix: subMix,
    harmLevels: harm,
    drive: harm.drive,
    space: Math.min(0.55, baseSpace * (mp ? 0.92 : 0.55) + mods.space + normY * baseSpace * 0.2),
    peakGain: gain * mods.level * poly,
    mixLevel: mods.level * poly,
    attack: Math.min(atk * mods.attack, mp ? 0.65 : 0.55),
    decay: decay,
    arpStepMs: ECAudio.Theory.stepMs() * mods.arpSpeed,
    detune: (panelVal('detune', 0, mp) || 0) + mods.shimmer,
    lfoRate: lfoRate,
    lfoDepthFilter: lfoDepthAmount('filter', mp),
    lfoDepthGain: lfoDepthAmount('gain', mp),
    lfoDepthPitch: lfoDepthAmount('pitch', mp),
    lfoTarget: panelVal('browseLfoTarget', 'filter', mp),
    gainMul: 0.9
  };
}

function applyEngine() {
  if (!ECAudio.Engine || !ECAudio.Engine.setBrowseHp) return;
  ECAudio.Engine.setBrowseHp(panelVal('browseHp', ECAudio.BrowseSound.HP));
  if (ECAudio.Engine.setReverbAmt) {
    ECAudio.Engine.setReverbAmt(panelVal('reverbAmt', 0.14));
  }
}

function resetPanelDefaults() {
  if (ECAudio.applySoundPreset) {
    ECAudio.applySoundPreset(ECAudio.DEFAULT_SOUND_PRESET || 'bright');
    return;
  }
  var d = ECAudio.BrowseSound;
  ECAudio.params.gain = d.GAIN;
  ECAudio.params.attack = d.ATTACK;
  ECAudio.params.decay = d.DECAY;
  ECAudio.params.browseTone = d.TONE;
  ECAudio.params.browseSpace = d.SPACE;
  ECAudio.params.detune = d.DETUNE;
  ECAudio.params.wave = d.WAVE;
  ECAudio.params.mode = 'harmonic';
  ECAudio.params.browseFilterMin = d.FILTER_MIN;
  ECAudio.params.browseFilterMax = d.FILTER_MAX;
  ECAudio.params.browseFilterQ = d.FILTER_Q;
  ECAudio.params.browseSubMix = d.SUB_MIX;
  ECAudio.params.browseHp = d.HP;
  ECAudio.params.browsePadX = d.PAD_X;
  ECAudio.params.browseHarmonics = d.HARMONICS;
  ECAudio.params.browseDrive = d.HARMONICS;
  ECAudio.params.browseLfoRate = d.LFO_RATE;
  ECAudio.params.browseLfoDepth = d.LFO_DEPTH;
  ECAudio.params.browseLfoTarget = d.LFO_TARGET;
  ECAudio.params.browseSizeLevel = 1;
  ECAudio.params.browseSizeSpace = d.SIZE_SPACE_MAX;
  ECAudio.params.browsePolyFloor = d.POLY_FLOOR;
  ECAudio.params.browsePolyPow = d.POLY_POW;
  applyEngine();
}

ECAudio.BrowseSound.filterBounds = filterBounds;
ECAudio.BrowseSound.filterEnvelope = filterEnvelope;
ECAudio.BrowseSound.panelTone = panelTone;
ECAudio.BrowseSound.applyRoleMods = applyRoleMods;
ECAudio.BrowseSound.resolve = resolve;
ECAudio.BrowseSound.polyLevel = polyLevel;
ECAudio.BrowseSound.driveCurve = driveCurve;
ECAudio.BrowseSound.harmonicLevels = harmonicLevels;
ECAudio.BrowseSound.resetPanelDefaults = resetPanelDefaults;
ECAudio.BrowseSound.applyEngine = applyEngine;
