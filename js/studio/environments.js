/* eslint-disable no-var */
// Beat studio — one environment (layer) per element type; dots share env synth settings.
window.ECAudio = window.ECAudio || {};

var ENV_STORE_KEY = 'ec-beat-envs';
var ELEMENT_TYPES = ['kick', 'hat', 'clap', 'bass', 'bright', 'minimal'];
var ELEMENT_LABELS = {
  kick: 'Kick', hat: 'Hat', clap: 'Clap', bass: 'Bass', bright: 'Lead', minimal: 'Soft'
};
var ENV_PITCH_ROW = {
  kick: 0, clap: 0, bass: 1, hat: 3, bright: 2, minimal: 2
};
var ENV_Y_HINT = {
  kick: { min: 0.04, max: 0.42, label: 'low' },
  clap: { min: 0.2, max: 0.72, label: 'mid' },
  bass: { min: 0.08, max: 0.62, label: 'low-mid' },
  hat: { min: 0.55, max: 0.96, label: 'high' },
  bright: { min: 0.25, max: 0.92, label: 'mid-high' },
  minimal: { min: 0.18, max: 0.78, label: 'warm' }
};

var ENV_INFLUENCE_DEFAULTS = {
  harmonizePull: 28,
  reach: 48,
  couplingGain: 50,
  beatBuild: 50,
  melodicBlend: 50,
  snapBeat: true,
  snapPitch: true,
  autoHarmonize: true
};

function defaultEnvInfluence() {
  return JSON.parse(JSON.stringify(ENV_INFLUENCE_DEFAULTS));
}

function ensureEnvInfluence(env) {
  if (!env) return;
  if (!env.influence) env.influence = defaultEnvInfluence();
}

function envIdForType(type) {
  return 'env-' + type;
}

function defaultEnvParams(type) {
  if (ECAudio.Machines && ECAudio.Machines.defaults) {
    return ECAudio.Machines.defaults(type);
  }
  var defs = ECAudio.Markers && ECAudio.Markers.defaultMarkerParams
    ? ECAudio.Markers.defaultMarkerParams() : {};
  if (ECAudio.SoundPresets && ECAudio.SoundPresets[type]) {
    var preset = ECAudio.SoundPresets[type];
    var keys = ECAudio.MARKER_PRESET_KEYS || ECAudio.MARKER_PARAM_KEYS || [];
    keys.forEach(function(key) {
      if (preset[key] != null) defs[key] = preset[key];
    });
  }
  return defs;
}

function createEnv(type) {
  var preset = ECAudio.SoundPresets && ECAudio.SoundPresets[type];
  return {
    id: envIdForType(type),
    type: type,
    label: ELEMENT_LABELS[type] || type,
    params: defaultEnvParams(type),
    pitchMul: preset && preset.pitchMul != null ? preset.pitchMul : 1,
    yHint: ENV_Y_HINT[type] || { min: 0.05, max: 0.95, label: 'full' },
    influence: defaultEnvInfluence()
  };
}

function ensureEnvs() {
  if (!ECAudio.State.envs) ECAudio.State.envs = {};
  var i;
  for (i = 0; i < ELEMENT_TYPES.length; i++) {
    var type = ELEMENT_TYPES[i];
    var id = envIdForType(type);
    if (!ECAudio.State.envs[id]) ECAudio.State.envs[id] = createEnv(type);
    else ensureEnvInfluence(ECAudio.State.envs[id]);
  }
}

function saveEnvStore() {
  try {
    var out = {};
    ensureEnvs();
    Object.keys(ECAudio.State.envs).forEach(function(id) {
      var e = ECAudio.State.envs[id];
      ensureEnvInfluence(e);
      out[id] = {
        type: e.type,
        params: JSON.parse(JSON.stringify(e.params || {})),
        pitchMul: e.pitchMul != null ? e.pitchMul : 1,
        influence: JSON.parse(JSON.stringify(e.influence || defaultEnvInfluence()))
      };
    });
    sessionStorage.setItem(ENV_STORE_KEY, JSON.stringify(out));
  } catch (err) { /* ignore */ }
}

function loadEnvStore() {
  ensureEnvs();
  try {
    var raw = sessionStorage.getItem(ENV_STORE_KEY);
    if (!raw) return;
    var data = JSON.parse(raw);
    Object.keys(data || {}).forEach(function(id) {
      var src = data[id];
      if (!src || !src.type) return;
      var env = ECAudio.State.envs[id] || createEnv(src.type);
      if (src.params) env.params = Object.assign(defaultEnvParams(src.type), src.params);
      if (src.pitchMul != null) env.pitchMul = src.pitchMul;
      if (src.influence) {
        ensureEnvInfluence(env);
        Object.assign(env.influence, src.influence);
      }
      ensureEnvInfluence(env);
      ECAudio.State.envs[id] = env;
    });
  } catch (err) { /* ignore */ }
}

function getEnv(id) {
  ensureEnvs();
  return id ? ECAudio.State.envs[id] : null;
}

function isEnvOverview() {
  return ECAudio.State.activeEnvId == null;
}

function getActiveEnv() {
  ensureEnvs();
  if (isEnvOverview()) return null;
  if (ECAudio.State.activeEnvId) return getEnv(ECAudio.State.activeEnvId);
  return null;
}

function placementEnv() {
  ensureEnvs();
  var active = getActiveEnv();
  if (active) return active;
  var id = ECAudio.State.lastEnvId || envIdForType('kick');
  return getEnv(id);
}

function syncEnvDotVisibility() {
  var overview = isEnvOverview();
  var active = getActiveEnv();
  var activeId = active ? active.id : '';
  document.querySelectorAll('.sound-marker[data-env-id]').forEach(function(el) {
    if (overview) {
      el.classList.add('is-env-active');
      el.classList.remove('is-env-muted');
      return;
    }
    var on = el.dataset.envId === activeId;
    el.classList.toggle('is-env-active', on);
    el.classList.toggle('is-env-muted', !on);
  });
}

function syncOverviewClass() {
  document.documentElement.classList.toggle('beat-env-overview', isEnvOverview());
}

function clearPadEnvTint() {
  var pad = document.getElementById('beat-pad');
  if (!pad) return;
  ELEMENT_TYPES.forEach(function(t) { pad.classList.remove('beat-pad-env-' + t); });
}

function activateOverview() {
  ensureEnvs();
  ECAudio.State.activeEnvId = null;
  syncOverviewClass();
  clearPadEnvTint();
  syncEnvBarUI();
  syncEnvDotVisibility();
  if (ECAudio.BeatBonds && ECAudio.BeatBonds.schedule) ECAudio.BeatBonds.schedule();
  if (ECAudio.BeatView3d && ECAudio.BeatView3d.schedule) ECAudio.BeatView3d.schedule();
  if (ECAudio.Markers && ECAudio.Markers.syncMarkerEditor) ECAudio.Markers.syncMarkerEditor();
  if (typeof syncSoundPanelUI === 'function') syncSoundPanelUI();
  if (ECAudio.BeatInfluence && ECAudio.BeatInfluence.syncUI) ECAudio.BeatInfluence.syncUI();
  return null;
}

function activateEnv(idOrType) {
  ensureEnvs();
  var id = idOrType;
  if (idOrType && idOrType.indexOf('env-') !== 0) id = envIdForType(idOrType);
  if (!getEnv(id)) return null;
  ECAudio.State.activeEnvId = id;
  ECAudio.State.lastEnvId = id;
  syncOverviewClass();
  syncEnvBarUI();
  syncEnvDotVisibility();
  var pad = document.getElementById('beat-pad');
  if (pad) {
    clearPadEnvTint();
    var env = getEnv(id);
    if (env) pad.classList.add('beat-pad-env-' + env.type);
  }
  if (ECAudio.BeatBonds && ECAudio.BeatBonds.schedule) ECAudio.BeatBonds.schedule();
  if (ECAudio.BeatView3d && ECAudio.BeatView3d.schedule) ECAudio.BeatView3d.schedule();
  if (ECAudio.Markers && ECAudio.Markers.syncMarkerEditor) ECAudio.Markers.syncMarkerEditor();
  if (typeof syncSoundPanelUI === 'function') syncSoundPanelUI();
  if (ECAudio.BeatInfluence && ECAudio.BeatInfluence.syncUI) ECAudio.BeatInfluence.syncUI();
  return getEnv(id);
}

function panelEnv() {
  var sel = ECAudio.Markers && ECAudio.Markers.getSelected
    ? ECAudio.Markers.getSelected() : null;
  if (sel && sel.envId) return getEnv(sel.envId);
  var active = getActiveEnv();
  if (active) return active;
  return placementEnv();
}

function envParams(id) {
  var env = getEnv(id);
  return env ? env.params : null;
}

function getParam(env, key) {
  if (!env) return ECAudio.params[key];
  var mp = env.params || {};
  if (mp[key] != null) return mp[key];
  var defs = ECAudio.Markers && ECAudio.Markers.defaultMarkerParams
    ? ECAudio.Markers.defaultMarkerParams() : {};
  if (defs[key] != null) return defs[key];
  return ECAudio.params[key];
}

function setParam(envId, key, val) {
  var env = getEnv(envId);
  if (!env) return;
  if (!env.params) env.params = defaultEnvParams(env.type);
  env.params[key] = val;
  if (key === 'browseHarmonics') env.params.browseDrive = val;
  saveEnvStore();
  restartEnvVoices(envId);
  if (typeof syncSoundPanelUI === 'function') syncSoundPanelUI();
  if (ECAudio.SoundVisual && ECAudio.SoundVisual.refreshStatic) ECAudio.SoundVisual.refreshStatic();
}

function applyPresetToEnv(envId, presetId) {
  var env = getEnv(envId);
  if (!env || !presetId || !ECAudio.SoundPresets || !ECAudio.SoundPresets[presetId]) return false;
  var preset = ECAudio.SoundPresets[presetId];
  var keys = ECAudio.MARKER_PRESET_KEYS || ECAudio.MARKER_PARAM_KEYS || [];
  keys.forEach(function(key) {
    if (preset[key] == null) return;
    env.params[key] = preset[key];
    if (key === 'browseHarmonics') env.params.browseDrive = preset[key];
  });
  env.type = presetId;
  env.label = ELEMENT_LABELS[presetId] || presetId;
  if (preset.pitchMul != null) env.pitchMul = preset.pitchMul;
  saveEnvStore();
  (ECAudio.State.markers || []).forEach(function(m) {
    if (m.envId === envId) {
      m.presetId = presetId;
      if (m.el) m.el.classList.remove.apply(m.el.classList,
        ELEMENT_TYPES.map(function(t) { return 'preset-' + t; }));
      if (m.el) m.el.classList.add('preset-' + presetId);
      syncMarkerLabelIfExists(m);
    }
  });
  restartEnvVoices(envId);
  syncEnvBarUI();
  if (typeof syncSoundPanelUI === 'function') syncSoundPanelUI();
  if (ECAudio.syncPresetUI) ECAudio.syncPresetUI(presetId, env);
  return true;
}

function syncMarkerLabelIfExists(marker) {
  if (ECAudio.Markers && ECAudio.Markers.syncMarkerLabel) {
    ECAudio.Markers.syncMarkerLabel(marker);
  }
}

function restartEnvVoices(envId) {
  (ECAudio.State.markers || []).forEach(function(m) {
    if (m.envId !== envId) return;
    if (ECAudio.Markers && ECAudio.Markers.restartMarkerVoice) {
      ECAudio.Markers.restartMarkerVoice(m);
    }
  });
  if (ECAudio.BeatSeq && ECAudio.BeatSeq.refreshAllPatterns) {
    ECAudio.BeatSeq.refreshAllPatterns();
  }
}

function markersInEnv(envId) {
  return (ECAudio.State.markers || []).filter(function(m) {
    return m.envId === envId;
  });
}

function pitchRowForEnv(envId) {
  var env = getEnv(envId);
  if (!env) return 0;
  return ENV_PITCH_ROW[env.type] != null ? ENV_PITCH_ROW[env.type] : 0;
}

function pitchRowForType(type) {
  return ENV_PITCH_ROW[type] != null ? ENV_PITCH_ROW[type] : 0;
}

function resetEnv(envId) {
  var env = getEnv(envId);
  if (!env) return;
  env.params = defaultEnvParams(env.type);
  saveEnvStore();
  restartEnvVoices(envId);
  if (typeof syncSoundPanelUI === 'function') syncSoundPanelUI();
}

var _envPreviewStub = null;

function previewEnvSound(envId) {
  if (soundEnabled) return;
  var env = getEnv(envId);
  if (!env) return;
  var dots = markersInEnv(envId);
  if (dots.length && ECAudio.Browse && ECAudio.Browse.previewMarkerSound) {
    ECAudio.Browse.previewMarkerSound(dots[0]);
    return;
  }
  ECAudio.Engine.bootAudio();
  ECAudio.Engine.boot();
  if (ECAudio.Machines && ECAudio.Machines.preview) {
    ECAudio.Machines.preview(env.type, env.params);
    return;
  }
  if (ECAudio.MarkerDrums && ECAudio.MarkerDrums.isDrum(env.type)) {
    var drumStub = { envId: envId, presetId: env.type, params: env.params, levelMul: 1 };
    ECAudio.MarkerDrums.play(drumStub, { hit: true, vel: 1 });
    return;
  }
  if (!_envPreviewStub) _envPreviewStub = { _envPreview: true, voice: null };
  var row = pitchRowForEnv(envId);
  Object.assign(_envPreviewStub, {
    envId: envId,
    presetId: env.type,
    secId: ECAudio.BEAT_STUDIO_SEC_ID || 'beat-studio',
    normX: 0.5,
    normY: env.type === 'bass' ? 0.32 : (env.type === 'bright' ? 0.62 : 0.5),
    normZ: 0.55,
    step: 0,
    rowIndex: row,
    laneIndex: row,
    levelMul: 1,
    _envPreview: true
  });
  if (ECAudio.Browse && ECAudio.Browse.previewMarkerSound) {
    ECAudio.Browse.previewMarkerSound(_envPreviewStub);
  }
}

function buildEnvBar() {
  var bar = document.getElementById('beat-env-bar');
  if (!bar) return;
  if (!bar.querySelector('[data-env="all"]')) {
    var allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'beat-env-btn beat-env-btn-all';
    allBtn.dataset.env = 'all';
    allBtn.textContent = 'All';
    allBtn.title = 'Layer 0 — every dot visible and selectable';
    allBtn.addEventListener('click', function() {
      activateOverview();
      if (ECAudio.Markers && ECAudio.Markers.closeLayerSettings) {
        ECAudio.Markers.closeLayerSettings();
      }
      if (ECAudio.BeatGuide) ECAudio.BeatGuide.fire('env_overview');
    });
    var anchor = bar.querySelector('#btn-beat-3d');
    if (anchor) bar.insertBefore(allBtn, anchor.nextSibling);
    else bar.insertBefore(allBtn, bar.firstChild);
  }
  if (bar.querySelector('[data-env="kick"]')) return;
  ELEMENT_TYPES.forEach(function(type) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'beat-env-btn';
    btn.dataset.env = type;
    btn.textContent = ELEMENT_LABELS[type];
    btn.addEventListener('click', function() {
      activateEnv(type);
      if (ECAudio.BeatGuide) ECAudio.BeatGuide.fire('env_pick');
    });
    bar.appendChild(btn);
  });
}

function syncEnvBarUI() {
  var overview = isEnvOverview();
  var active = getActiveEnv();
  var activeType = active ? active.type : '';
  document.querySelectorAll('.beat-env-btn').forEach(function(btn) {
    var isAll = btn.dataset.env === 'all';
    btn.classList.toggle('active', overview ? isAll : btn.dataset.env === activeType);
  });
  document.querySelectorAll('.sl-preset-btn[data-env]').forEach(function(btn) {
    btn.classList.toggle('active', !overview && btn.dataset.env === activeType);
  });
  var title = document.getElementById('sl-env-title');
  if (title) {
    title.textContent = overview
      ? 'All layers (layer 0)'
      : (active ? active.label + ' environment' : 'Beat environment');
  }
  var tuning = panelEnv();
  if (ECAudio.Machines && ECAudio.Machines.syncPanelLabels) {
    ECAudio.Machines.syncPanelLabels(tuning ? tuning.type : null);
  } else {
    var editing = document.getElementById('sl-env-editing');
    if (editing) {
      editing.textContent = tuning
        ? ('Tuning: ' + tuning.label + ' — every dot on this layer uses these settings')
        : 'Pick Kick, Bass, Clap… above to tune that layer\'s preset sound';
    }
  }
}

function syncActiveEnvUI() {
  syncOverviewClass();
  syncEnvBarUI();
  syncEnvDotVisibility();
}

function restoreActiveEnvFromSession() {
  var sel = ECAudio.Markers && ECAudio.Markers.getSelected
    ? ECAudio.Markers.getSelected() : null;
  if (sel && sel.envId) {
    activateEnv(sel.envId);
    return;
  }
  if (ECAudio.State.activeEnvId != null) {
    syncActiveEnvUI();
    return;
  }
  activateOverview();
}

function initEnvironments() {
  ensureEnvs();
  loadEnvStore();
  ELEMENT_TYPES.forEach(function(type) {
    var env = getEnv(envIdForType(type));
    if (env && ECAudio.SoundPresets && ECAudio.SoundPresets[type]) {
      var fresh = defaultEnvParams(type);
      if (!sessionStorage.getItem(ENV_STORE_KEY)) {
        env.params = fresh;
        env.pitchMul = ECAudio.SoundPresets[type].pitchMul != null
          ? ECAudio.SoundPresets[type].pitchMul : 1;
      }
    }
  });
  if (!ECAudio.State.lastEnvId) ECAudio.State.lastEnvId = envIdForType('kick');
  buildEnvBar();
  restoreActiveEnvFromSession();
}

ECAudio.Environments = {
  ELEMENT_TYPES: ELEMENT_TYPES,
  ELEMENT_LABELS: ELEMENT_LABELS,
  init: initEnvironments,
  ensure: ensureEnvs,
  get: getEnv,
  getActive: getActiveEnv,
  isOverview: isEnvOverview,
  activateOverview: activateOverview,
  placementEnv: placementEnv,
  activate: activateEnv,
  panelEnv: panelEnv,
  envParams: envParams,
  getParam: getParam,
  setParam: setParam,
  applyPreset: applyPresetToEnv,
  reset: resetEnv,
  previewSound: previewEnvSound,
  markersIn: markersInEnv,
  pitchRow: pitchRowForEnv,
  pitchRowForType: pitchRowForType,
  save: saveEnvStore,
  load: loadEnvStore,
  syncBar: syncEnvBarUI,
  restartVoices: restartEnvVoices,
  syncDotVisibility: syncEnvDotVisibility,
  yHint: function(type) { return ENV_Y_HINT[type]; },
  defaultInfluence: defaultEnvInfluence,
  ensureInfluence: ensureEnvInfluence,
  influence: function(envId) {
    var env = getEnv(envId);
    if (!env) return defaultEnvInfluence();
    ensureEnvInfluence(env);
    return env.influence;
  }
};
