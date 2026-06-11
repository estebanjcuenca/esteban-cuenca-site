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
    hint: 'Real kick drum — drag ↔ for timing. Color = red. Default: every beat.',
    drum: true,
    defaultDensity: 4,
    pitchMul: 1,
    wave: 'sine', gain: 0.28, attack: 0.006, decay: 0.22,
    browseTone: 0.12, browseHarmonics: 0.08, browseFilterMin: 55, browseFilterMax: 260,
    browseFilterQ: 0.85, browseSubMix: 0.14, browseSpace: 0.02, browseLfoRate: 0,
    browseLfoDepth: 0
  },
  'hat': {
    label: 'Hat',
    hint: 'Real hi-hat — drag ↔ for timing. Color = cyan. Default: offbeats (⅛ bar).',
    drum: true,
    defaultDensity: 2,
    pitchMul: 1,
    wave: 'square', gain: 0.09, attack: 0.003, decay: 0.06,
    browseTone: 0.92, browseHarmonics: 0.55, browseFilterMin: 3800, browseFilterMax: 14000,
    browseFilterQ: 0.35, browseSubMix: 0.001, browseSpace: 0.03, browseLfoRate: 0,
    browseLfoDepth: 0
  },
  'bass': {
    label: 'Bass',
    hint: 'Synth bass — ↕ pitch · scroll/pulse for pattern · full oscillator',
    defaultDensity: 4,
    pitchMul: 1,
    wave: 'triangle', gain: 0.18, attack: 0.06, decay: 1.4,
    browseTone: 0.28, browseHarmonics: 0.52, browseFilterMin: 120, browseFilterMax: 920,
    browseFilterQ: 0.72, browseSubMix: 0.08, browseSpace: 0.1, browseLfoRate: 0.12,
    browseLfoDepth: 0.22, browseLfoTarget: 'filter'
  },
  'clap': {
    label: 'Clap',
    hint: 'Real clap burst — drag ↔ for timing. Color = amber.',
    drum: true,
    defaultDensity: 4,
    pitchMul: 1,
    wave: 'sawtooth', gain: 0.14, attack: 0.004, decay: 0.11,
    browseTone: 0.58, browseHarmonics: 0.62, browseFilterMin: 520, browseFilterMax: 5200,
    browseFilterQ: 0.6, browseSubMix: 0.003, browseSpace: 0.09, browseLfoRate: 0,
    browseLfoDepth: 0
  },
  'bright': {
    label: 'Bright lead',
    hint: 'Saw lead synth — ↕ melody · ↔ timbre · pulse for organic repeats',
    defaultDensity: 4,
    pitchMul: 1,
    wave: 'sawtooth', browseHarmonics: 0.48, gain: 0.1, attack: 0.08, decay: 1.6,
    browseTone: 0.68, browseSpace: 0.1, browseFilterMin: 520, browseFilterMax: 5200,
    browseFilterQ: 0.72, browseLfoRate: 0.2, browseLfoDepth: 0.35, browseLfoTarget: 'filter'
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
    hint: 'Soft triangle synth — slow pulse · warm filter motion',
    defaultDensity: 8,
    pitchMul: 1,
    wave: 'triangle', browseHarmonics: 0.58, gain: 0.09, attack: 0.16, decay: 2.0,
    browseTone: 0.45, browseSpace: 0.14, browseFilterMin: 380, browseFilterMax: 2800,
    browseFilterQ: 0.62, browseLfoRate: 0.28, browseLfoDepth: 0.38, browseLfoTarget: 'filter'
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
