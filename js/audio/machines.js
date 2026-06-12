/* eslint-disable no-var */
// Beat studio — one environment = one machine (kick, hat, clap, bass, bright, minimal).
window.ECAudio = window.ECAudio || {};

var MACHINE_TYPES = ['kick', 'hat', 'clap', 'bass', 'bright', 'minimal'];

var MACHINE_META = {
  kick: {
    label: 'Kick',
    machine: 'Punch drum',
    drum: true,
    hint: 'MPC-style kick — click + body + sub. Tone = tune · Snap = click.',
    paramKeys: ['gain', 'decay', 'browseTone', 'browseHarmonics', 'browseSubMix', 'browseDrive', 'browseSpace'],
    labels: { browseHarmonics: 'Click', browseTone: 'Body tune', decay: 'Length', browseSubMix: 'Sub' }
  },
  hat: {
    label: 'Hat',
    machine: '909 hi-hat',
    drum: true,
    hint: 'Noise bandpass hat — vel 2 = open hat. Brightness = BP center.',
    paramKeys: ['gain', 'decay', 'browseTone', 'browseHarmonics', 'browseFilterMin', 'browseFilterMax', 'browseFilterQ', 'browseSpace'],
    labels: { browseHarmonics: 'Crispness', browseTone: 'Brightness', decay: 'Length' }
  },
  clap: {
    label: 'Clap',
    machine: 'Layered clap',
    drum: true,
    hint: 'Staggered noise bursts + room. Snap = layer density.',
    paramKeys: ['gain', 'decay', 'browseTone', 'browseHarmonics', 'browseFilterMin', 'browseFilterMax', 'browseSpace'],
    labels: { browseHarmonics: 'Snap / layers', browseTone: 'Mid focus', decay: 'Length' }
  },
  bass: {
    label: 'Bass',
    machine: 'Mono sub',
    drum: false,
    hint: 'Minimal sub bass — ↕ melody · dry · sine body.',
    paramKeys: ['gain', 'attack', 'decay', 'wave', 'browseTone', 'browseHarmonics', 'browseFilterMin', 'browseFilterMax', 'browseFilterQ', 'browseSubMix', 'browseSpace', 'detune'],
    labels: { browseTone: 'Darkness', browseHarmonics: 'Warmth', decay: 'Release' }
  },
  bright: {
    label: 'Lead',
    machine: 'Dry stab',
    drum: false,
    hint: 'Filtered saw stab — short release · almost dry.',
    paramKeys: ['gain', 'attack', 'decay', 'wave', 'browseTone', 'browseHarmonics', 'browseFilterMin', 'browseFilterMax', 'browseFilterQ', 'browseSpace', 'detune'],
    labels: { browseTone: 'Brightness', decay: 'Stab length' }
  },
  minimal: {
    label: 'Soft',
    machine: 'Soft texture',
    drum: false,
    hint: 'Warm pad texture — slow attack · gentle space.',
    paramKeys: ['gain', 'attack', 'decay', 'wave', 'browseTone', 'browseHarmonics', 'browseFilterMin', 'browseFilterMax', 'browseFilterQ', 'browseSpace', 'browseLfoRate', 'browseLfoDepth'],
    labels: { browseTone: 'Warmth', decay: 'Tail' }
  }
};

var MACHINE_DEFAULTS = {
  kick: {
    drum: true, pitchMul: 0.52,
    gain: 0.34, attack: 0.003, decay: 0.28,
    browseTone: 0.1, browseHarmonics: 0.22, browseDrive: 0.45,
    browseFilterMin: 42, browseFilterMax: 160, browseFilterQ: 1.05,
    browseSubMix: 0.2, browseSpace: 0.02,
    browseLfoRate: 0, browseLfoDepth: 0, detune: -8
  },
  hat: {
    drum: true, pitchMul: 1.35,
    gain: 0.12, attack: 0.002, decay: 0.06,
    browseTone: 0.72, browseHarmonics: 0.55, browseDrive: 0.3,
    browseFilterMin: 6800, browseFilterMax: 13000, browseFilterQ: 0.35,
    browseSubMix: 0, browseSpace: 0.03,
    browseLfoRate: 0, browseLfoDepth: 0, detune: 10
  },
  clap: {
    drum: true, pitchMul: 1.05,
    gain: 0.15, attack: 0.003, decay: 0.1,
    browseTone: 0.52, browseHarmonics: 0.65, browseDrive: 0.48,
    browseFilterMin: 480, browseFilterMax: 3800, browseFilterQ: 0.62,
    browseSubMix: 0.004, browseSpace: 0.06,
    browseLfoRate: 0, browseLfoDepth: 0, detune: 4
  },
  bass: {
    pitchMul: 0.8,
    wave: 'sine', gain: 0.2, attack: 0.012, decay: 2.1,
    browseTone: 0.08, browseHarmonics: 0.14, browseDrive: 0.18,
    browseFilterMin: 36, browseFilterMax: 280, browseFilterQ: 0.95,
    browseSubMix: 0.22, browseSpace: 0.03,
    browseLfoRate: 0, browseLfoDepth: 0, browseLfoTarget: 'filter', detune: -8
  },
  bright: {
    pitchMul: 1,
    wave: 'sawtooth', gain: 0.1, attack: 0.008, decay: 0.55,
    browseTone: 0.68, browseHarmonics: 0.32, browseDrive: 0.22,
    browseFilterMin: 420, browseFilterMax: 5200, browseFilterQ: 0.85,
    browseSubMix: 0.006, browseSpace: 0.05,
    browseLfoRate: 0, browseLfoDepth: 0, browseLfoTarget: 'filter', detune: -4
  },
  minimal: {
    pitchMul: 1,
    wave: 'triangle', gain: 0.09, attack: 0.18, decay: 2.4,
    browseTone: 0.38, browseHarmonics: 0.42, browseDrive: 0.15,
    browseFilterMin: 280, browseFilterMax: 2200, browseFilterQ: 0.58,
    browseSubMix: 0.008, browseSpace: 0.1,
    browseLfoRate: 0.12, browseLfoDepth: 0.18, browseLfoTarget: 'filter', detune: 0
  }
};

function machineType(marker) {
  if (!marker) return null;
  if (marker.presetId && MACHINE_META[marker.presetId]) return marker.presetId;
  if (marker.envId) {
    var t = marker.envId.replace(/^env-/, '');
    if (MACHINE_META[t]) return t;
  }
  return marker.presetId || null;
}

function meta(type) {
  return MACHINE_META[type] || null;
}

function defaults(type) {
  var d = MACHINE_DEFAULTS[type];
  return d ? JSON.parse(JSON.stringify(d)) : {};
}

function normalizeParams(type, params) {
  var base = defaults(type);
  var out = Object.assign({}, base);
  if (!params) return out;
  Object.keys(params).forEach(function(key) {
    if (params[key] != null) out[key] = params[key];
  });
  return out;
}

function markerParams(marker) {
  if (!marker) return {};
  if (marker.envId && ECAudio.Environments && ECAudio.Environments.envParams) {
    return ECAudio.Environments.envParams(marker.envId);
  }
  return marker.params || {};
}

function loopStepSec() {
  return ECAudio.Theory && ECAudio.Theory.loopStepMs
    ? ECAudio.Theory.loopStepMs() / 1000 : 0.125;
}

function applySynthMachineMods(type, spec, mp, marker) {
  var stepSec = loopStepSec();
  var atk = mp.attack != null ? mp.attack : spec.attack;
  var dec = mp.decay != null ? mp.decay : spec.decay;
  spec.attack = atk;
  spec.decay = dec;
  spec.synthLayer = true;
  spec.beatAttack = Math.max(0.003, Math.min(0.22, atk));
  spec.beatDecay = Math.max(0.35, Math.min(6.5, dec / Math.max(stepSec * 1.1, 0.04)));
  spec.beatPeak = 0.9 + (marker.sizeNorm != null ? marker.sizeNorm : 0.35) * 0.3;
  spec.beatPunch = 0.8 + (mp.browseHarmonics != null ? mp.browseHarmonics : 0.4) * 0.35;

  if (type === 'bass') {
    spec.lfoRate = 0;
    spec.lfoDepth = 0;
    spec.space = Math.min(0.08, spec.space != null ? spec.space : 0.03);
    spec.filterEndHz = Math.min(spec.filterEndHz || 400, 360);
    spec.beatDecay = Math.min(7, spec.beatDecay * 1.15);
    spec.subMix = Math.min(0.4, (spec.subMix || 0.1) * 1.1);
    spec.beatPunch *= 0.92;
  } else if (type === 'bright') {
    spec.lfoRate = 0;
    spec.lfoDepth = 0;
    spec.space = Math.min(0.1, spec.space != null ? spec.space : 0.05);
    spec.beatAttack = Math.max(0.004, Math.min(0.02, atk));
    spec.beatDecay = Math.max(0.45, Math.min(2.2, dec / Math.max(stepSec, 0.05)));
    spec.beatPeak *= 1.05;
    if (spec.filterStartHz != null && spec.filterHz != null) {
      spec.filterStartHz = Math.min(spec.filterHz * 1.35, spec.filterStartHz * 1.2);
      spec.filterEndHz = Math.max(120, spec.filterHz * 0.55);
    }
  } else if (type === 'minimal') {
    spec.beatAttack = Math.max(0.06, atk);
    spec.beatDecay = Math.max(1.2, spec.beatDecay);
    spec.space = Math.min(0.18, spec.space != null ? spec.space : 0.1);
    spec.beatPeak *= 0.88;
    spec.beatPunch *= 0.82;
  }
  return spec;
}

function composeSpec(marker) {
  if (!marker || !ECAudio.BrowseSound || !ECAudio.BrowseSound.resolve) return null;
  var type = machineType(marker);
  if (!type || MACHINE_META[type].drum) return null;
  var mp = normalizeParams(type, markerParams(marker));
  var toneX = marker.toneNorm != null ? marker.toneNorm : marker.normX;
  var spec = ECAudio.BrowseSound.resolve({
    normX: toneX != null ? toneX : 0.5,
    normY: marker.normY,
    sizeNorm: marker.sizeNorm,
    count: (ECAudio.State.markers || []).length,
    markerParams: mp
  });
  spec = applySynthMachineMods(type, spec, mp, marker);
  if (ECAudio.BeatPresence && ECAudio.BeatPresence.presenceGain) {
    var zg = ECAudio.BeatPresence.presenceGain(ECAudio.BeatPresence.normZ(marker));
    var zInf = ECAudio.BeatPresence.presenceInfluence
      ? ECAudio.BeatPresence.presenceInfluence(ECAudio.BeatPresence.normZ(marker)) : 1;
    if (spec.beatPeak != null) spec.beatPeak *= zg;
    if (spec.beatPunch != null) spec.beatPunch *= zg;
    if (type === 'bass' && spec.beatDecay != null) {
      spec.beatDecay = Math.min(7.5, spec.beatDecay * (0.92 + zInf * 0.12));
    }
    if (type === 'minimal' && spec.beatDecay != null) {
      spec.beatDecay = Math.min(8, spec.beatDecay * (0.95 + zInf * 0.1));
    }
  }
  if (ECAudio.BeatSpatial && ECAudio.BeatSpatial.modulateSpec) {
    spec = ECAudio.BeatSpatial.modulateSpec(marker, spec);
  }
  return spec;
}

function playHit(marker, stepData) {
  if (!marker || !ECAudio.MachinePlayback) return false;
  var type = machineType(marker);
  if (!type) return false;
  var mp = ECAudio.MachinePlayback.paramsFromMarker(marker);
  var peak = ECAudio.MachinePlayback.peakFromMarker(marker, stepData);
  stepData = stepData || { hit: true, vel: 1 };

  if (type === 'kick') {
    ECAudio.MachinePlayback.playKick(peak, mp, stepData);
    return true;
  }
  if (type === 'hat') {
    ECAudio.MachinePlayback.playHat(peak, mp, stepData);
    return true;
  }
  if (type === 'clap') {
    ECAudio.MachinePlayback.playClap(peak, mp, stepData);
    return true;
  }
  return false;
}

function preview(type, envParams) {
  var stub = {
    envId: 'env-' + type,
    presetId: type,
    params: normalizeParams(type, envParams || {}),
    levelMul: 1,
    normZ: 0.55
  };
  if (MACHINE_META[type].drum) {
    playHit(stub, { hit: true, vel: 1 });
    return;
  }
  var row = ECAudio.Environments && ECAudio.Environments.pitchRowForType
    ? ECAudio.Environments.pitchRowForType(type) : 2;
  if (type === 'bass' && ECAudio.MachinePlayback.playBassOneShot) {
    var freq = ECAudio.Theory && ECAudio.Theory.browsePadPitch
      ? ECAudio.Theory.browsePadPitch(row, 0.32) : 65;
    var peak = stub.params.gain != null ? stub.params.gain : 0.2;
    ECAudio.MachinePlayback.playBassOneShot(freq, peak, stub.params, { vel: 1 });
    return;
  }
  stub.normX = 0.5;
  stub.normY = type === 'bright' ? 0.62 : 0.5;
  stub.rowIndex = row;
  stub.laneIndex = row;
  if (ECAudio.Browse && ECAudio.Browse.previewMarkerSound) {
    ECAudio.Browse.previewMarkerSound(stub);
  }
}

function syncPanelLabels(type) {
  var lab = document.getElementById('studio-panel');
  if (!lab) return;
  MACHINE_TYPES.forEach(function(t) {
    lab.classList.remove('sl-machine-' + t);
  });
  if (type) lab.classList.add('sl-machine-' + type);
  var m = meta(type);
  var editing = document.getElementById('sl-env-editing');
  var hint = document.getElementById('sl-preset-hint');
  if (editing && m) {
    editing.textContent = m.machine + ' — layer sound for all ' + m.label.toLowerCase() + ' dots';
  }
  if (hint && m) hint.textContent = m.hint;
  if (!m) return;
  Object.keys(m.labels || {}).forEach(function(key) {
    var el = document.querySelector('[data-scope="env"][data-param="' + key + '"]');
    if (!el) return;
    var label = el.closest('.sl-field');
    if (label) {
      var lbl = label.querySelector('.sl-field-label');
      if (lbl) lbl.textContent = m.labels[key];
    }
  });
  var harmLabel = document.getElementById('sl-env-harm-label');
  if (harmLabel && m.labels && m.labels.browseHarmonics) {
    harmLabel.textContent = m.labels.browseHarmonics;
  }
  var decayLabel = document.getElementById('sl-env-decay-label');
  if (decayLabel && m.labels && m.labels.decay) {
    decayLabel.textContent = m.labels.decay;
  }
  lab.querySelectorAll('[data-scope="env"][data-param]').forEach(function(el) {
    var key = el.getAttribute('data-param');
    var field = el.closest('.sl-field');
    if (!field) return;
    var show = m.paramKeys.indexOf(key) >= 0;
    if (key === 'wave') return;
    field.style.display = show ? '' : 'none';
  });
  var waveWrap = document.getElementById('sl-env-wave');
  if (waveWrap) waveWrap.style.display = m.drum ? 'none' : '';
}

function syncSoundPresetsFromMachines() {
  if (!ECAudio.SoundPresets) return;
  MACHINE_TYPES.forEach(function(type) {
    var d = defaults(type);
    var m = meta(type);
    if (!ECAudio.SoundPresets[type]) ECAudio.SoundPresets[type] = {};
    Object.assign(ECAudio.SoundPresets[type], d, {
      label: m.label,
      hint: m.hint
    });
  });
}

function initMachines() {
  syncSoundPresetsFromMachines();
}

ECAudio.Machines = {
  TYPES: MACHINE_TYPES,
  meta: meta,
  defaults: defaults,
  normalizeParams: normalizeParams,
  machineType: machineType,
  composeSpec: composeSpec,
  playHit: playHit,
  preview: preview,
  syncPanelLabels: syncPanelLabels,
  init: initMachines,
  isDrum: function(type) {
    return !!(MACHINE_META[type] && MACHINE_META[type].drum);
  },
  isSynth: function(type) {
    return !!(MACHINE_META[type] && !MACHINE_META[type].drum);
  }
};

initMachines();
