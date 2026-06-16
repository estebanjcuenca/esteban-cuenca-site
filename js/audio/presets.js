/* eslint-disable no-var */
window.ECAudio = window.ECAudio || {};

ECAudio.DEFAULT_SOUND_PRESET = 'bright';

ECAudio.MARKER_PRESET_KEYS = [
  'wave', 'gain', 'attack', 'decay', 'browseTone', 'browseHarmonics', 'browseDrive',
  'browseFilterMin', 'browseFilterMax', 'browseFilterQ', 'browseSubMix', 'detune',
  'browseSpace', 'browseLfoRate', 'browseLfoDepth', 'browseLfoTarget'
];

ECAudio.SoundPresets = {
  'kick': {
    label: 'Kick',
    hint: 'MPC-style kick — click + body + sub. Tone = tune · Snap = click.',
    drum: true,
    pitchMul: 0.52,
    wave: 'sine', gain: 0.34, attack: 0.003, decay: 0.28,
    browseTone: 0.1, browseHarmonics: 0.22, browseDrive: 0.45,
    browseFilterMin: 42, browseFilterMax: 160, browseFilterQ: 1.05,
    browseSubMix: 0.2, browseSpace: 0.02, browseLfoRate: 0,
    browseLfoDepth: 0, detune: -8
  },
  'hat': {
    label: 'Hat',
    hint: '909 hi-hat — noise bandpass. Pattern vel 2 = open hat.',
    drum: true,
    pitchMul: 1.35,
    wave: 'square', gain: 0.12, attack: 0.002, decay: 0.06,
    browseTone: 0.72, browseHarmonics: 0.55, browseDrive: 0.3,
    browseFilterMin: 6800, browseFilterMax: 13000,
    browseFilterQ: 0.35, browseSubMix: 0, browseSpace: 0.03, browseLfoRate: 0,
    browseLfoDepth: 0, detune: 10
  },
  'bass': {
    label: 'Bass',
    hint: 'Mono sub bass — ↕ melody · dry minimal low end.',
    pitchMul: 0.8,
    wave: 'sine', gain: 0.2, attack: 0.012, decay: 2.1,
    browseTone: 0.08, browseHarmonics: 0.14, browseDrive: 0.18,
    browseFilterMin: 36, browseFilterMax: 280,
    browseFilterQ: 0.95, browseSubMix: 0.22, browseSpace: 0.03,
    browseLfoRate: 0, browseLfoDepth: 0, browseLfoTarget: 'filter', detune: -8
  },
  'clap': {
    label: 'Clap',
    hint: 'Layered 909 clap — snap = layer density · short room.',
    drum: true,
    pitchMul: 1.05,
    wave: 'sawtooth', gain: 0.15, attack: 0.003, decay: 0.1,
    browseTone: 0.52, browseHarmonics: 0.65, browseDrive: 0.48,
    browseFilterMin: 480, browseFilterMax: 3800,
    browseFilterQ: 0.62, browseSubMix: 0.004, browseSpace: 0.06, browseLfoRate: 0,
    browseLfoDepth: 0, detune: 4
  },
  'bright': {
    label: 'Bright lead',
    hint: 'Dry filtered stab — short release · ↕ melody.',
    pitchMul: 1,
    wave: 'sawtooth', browseHarmonics: 0.32, gain: 0.1, attack: 0.008, decay: 0.55,
    browseTone: 0.68, browseSpace: 0.05, browseFilterMin: 420, browseFilterMax: 5200,
    browseFilterQ: 0.85, browseLfoRate: 0, browseLfoDepth: 0, browseLfoTarget: 'filter'
  },
  'soft-pad': {
    label: 'Soft pad',
    hint: 'Warm sustained pad — hold dots on different rows',
    wave: 'triangle', browseHarmonics: 0.68, gain: 0.1, attack: 0.22, decay: 2.0,
    browseTone: 0.4, browseSpace: 0.14, browseFilterMin: 380, browseFilterMax: 3200,
    browseFilterQ: 0.62, browseLfoRate: 0.22, browseLfoDepth: 0.3, browseLfoTarget: 'filter',
    mode: 'harmonic', bpm: 72
  },
  'gentle-arp': {
    label: 'Gentle arp',
    hint: 'Arp mode — pin on any row for simple patterns',
    wave: 'triangle', browseHarmonics: 0.55, gain: 0.08, attack: 0.08, decay: 1.1,
    browseTone: 0.52, browseSpace: 0.1, browseFilterMin: 450, browseFilterMax: 3400,
    mode: 'arpeggio', bpm: 88, browseLfoRate: 0.18, browseLfoDepth: 0.2, browseLfoTarget: 'filter'
  },
  'deep-loop': {
    label: 'Deep loop',
    hint: 'Low register — use rows lower on the page',
    wave: 'triangle', browseHarmonics: 0.72, gain: 0.11, attack: 0.2, decay: 1.5,
    browseTone: 0.32, browseSpace: 0.15, browseFilterMin: 280, browseFilterMax: 2600,
    browseFilterQ: 0.85, mode: 'harmonic', bpm: 80, browseLfoRate: 0.15, browseLfoDepth: 0.25
  },
  'minimal': {
    label: 'Minimal',
    hint: 'Soft texture pad — slow attack · gentle space.',
    pitchMul: 1,
    wave: 'triangle', browseHarmonics: 0.42, gain: 0.09, attack: 0.18, decay: 2.4,
    browseTone: 0.38, browseSpace: 0.1, browseFilterMin: 280, browseFilterMax: 2200,
    browseFilterQ: 0.58, browseLfoRate: 0.12, browseLfoDepth: 0.18, browseLfoTarget: 'filter'
  },
  'synth': {
    label: 'Synth',
    hint: 'Classic synth — saw stack · filter sweep · ↕ melody.',
    pitchMul: 1,
    wave: 'sawtooth', browseHarmonics: 0.48, gain: 0.11, attack: 0.035, decay: 1.35,
    browseTone: 0.55, browseSpace: 0.07, browseFilterMin: 180, browseFilterMax: 6400,
    browseFilterQ: 0.72, browseLfoRate: 0.08, browseLfoDepth: 0.12, browseLfoTarget: 'filter',
    detune: 0
  },
  'arpeggio': {
    label: 'Arp',
    hint: 'Scale arpeggio — cycles chord tones · fast plucks.',
    pitchMul: 1.02,
    wave: 'square', browseHarmonics: 0.4, gain: 0.09, attack: 0.004, decay: 0.42,
    browseTone: 0.58, browseSpace: 0.09, browseFilterMin: 320, browseFilterMax: 4800,
    browseFilterQ: 0.68, browseLfoRate: 0.14, browseLfoDepth: 0.16, browseLfoTarget: 'filter',
    detune: 2
  }
};

function syncPresetUI(id, marker) {
  var presetId = id || (marker && marker.presetId) || ECAudio._activePreset || ECAudio.DEFAULT_SOUND_PRESET;
  if (!marker) ECAudio._activePreset = presetId;
  var lab = document.getElementById('studio-panel');
  if (lab) {
    lab.querySelectorAll('.sl-preset-btn[data-scope="dot"]').forEach(function(b) {
      b.classList.toggle('active', b.getAttribute('data-preset') === presetId);
    });
    lab.querySelectorAll('.sl-preset-btn[data-env]').forEach(function(b) {
      b.classList.toggle('active', b.getAttribute('data-env') === presetId);
    });
  }
  var hint = document.getElementById('sl-preset-hint');
  var preset = ECAudio.SoundPresets[presetId];
  if (hint) hint.textContent = preset ? preset.hint : '';
}

function applySoundPreset(id) {
  var preset = ECAudio.SoundPresets[id];
  if (!preset) return false;
  Object.keys(preset).forEach(function(key) {
    if (key === 'label' || key === 'hint') return;
    ECAudio.params[key] = preset[key];
    if (key === 'browseHarmonics') ECAudio.params.browseDrive = preset[key];
  });
  if (ECAudio.BrowseSound && ECAudio.BrowseSound.applyEngine) ECAudio.BrowseSound.applyEngine();
  if (typeof syncSoundPanelUI === 'function') syncSoundPanelUI();
  syncPresetUI(id);
  if (!soundEnabled && ECAudio.Markers && ECAudio.Markers.restartVoices && !(ECAudio.State.markers || []).length) {
    ECAudio.Markers.restartVoices();
  }
  if (!soundEnabled && ECAudio.Browse && ECAudio.Browse.refreshLiveBrowseAudio) {
    ECAudio.Browse.refreshLiveBrowseAudio();
  }
  if (typeof slRefreshLivePad === 'function') slRefreshLivePad();
  if (typeof slUpdateReadout === 'function') {
    var nx = typeof slGetPadNormX === 'function' ? slGetPadNormX() : 0.5;
    var ny = typeof slGetPadNormY === 'function' ? slGetPadNormY() : 0.5;
    slUpdateReadout(nx, ny);
  }
  ECAudio.saveSoundPrefs();
  return preset;
}

function applyDefaultSoundPreset() {
  return applySoundPreset(ECAudio.DEFAULT_SOUND_PRESET);
}

ECAudio.applySoundPreset = applySoundPreset;
ECAudio.applyDefaultSoundPreset = applyDefaultSoundPreset;
ECAudio.syncPresetUI = syncPresetUI;
