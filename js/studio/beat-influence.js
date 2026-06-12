/* eslint-disable no-var */
// Beat studio — per-layer influence / harmonize controls.
window.ECAudio = window.ECAudio || {};

var LEGACY_STORE_KEY = 'ec-beat-influence';
var PER_DOT_PRESENCE_ACTIVE = false;

var DEFAULTS = {
  harmonizePull: 28,
  reach: 48,
  couplingGain: 50,
  beatBuild: 50,
  melodicBlend: 50,
  snapBeat: true,
  snapPitch: true,
  autoHarmonize: true
};

function resolveEnvId(markerOrEnvId) {
  if (markerOrEnvId) {
    if (typeof markerOrEnvId === 'string') return markerOrEnvId;
    if (markerOrEnvId.envId) return markerOrEnvId.envId;
  }
  if (ECAudio.Environments && ECAudio.Environments.panelEnv) {
    var env = ECAudio.Environments.panelEnv();
    if (env && env.id) return env.id;
  }
  return null;
}

function state(markerOrEnvId) {
  var envId = resolveEnvId(markerOrEnvId);
  if (!envId || !ECAudio.Environments || !ECAudio.Environments.influence) {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
  return ECAudio.Environments.influence(envId);
}

function panelEnv() {
  return ECAudio.Environments && ECAudio.Environments.panelEnv
    ? ECAudio.Environments.panelEnv() : null;
}

function save() {
  if (ECAudio.Environments && ECAudio.Environments.save) ECAudio.Environments.save();
}

function migrateLegacyGlobal() {
  try {
    var raw = sessionStorage.getItem(LEGACY_STORE_KEY);
    if (!raw) return;
    var data = JSON.parse(raw);
    if (!ECAudio.Environments || !ECAudio.Environments.ensure) return;
    ECAudio.Environments.ensure();
    var envs = ECAudio.State.envs || {};
    Object.keys(envs).forEach(function(id) {
      var env = envs[id];
      if (!env) return;
      if (ECAudio.Environments.ensureInfluence) ECAudio.Environments.ensureInfluence(env);
      if (!env.influence) env.influence = JSON.parse(JSON.stringify(DEFAULTS));
      if (data.harmonizePull != null) env.influence.harmonizePull = data.harmonizePull;
      if (data.reach != null) env.influence.reach = data.reach;
      if (data.couplingGain != null) env.influence.couplingGain = data.couplingGain;
      if (data.beatBuild != null) env.influence.beatBuild = data.beatBuild;
      if (data.melodicBlend != null) env.influence.melodicBlend = data.melodicBlend;
      if (data.snapBeat != null) env.influence.snapBeat = !!data.snapBeat;
      if (data.snapPitch != null) env.influence.snapPitch = !!data.snapPitch;
      if (data.autoHarmonize != null) env.influence.autoHarmonize = !!data.autoHarmonize;
    });
    save();
    sessionStorage.removeItem(LEGACY_STORE_KEY);
  } catch (err) { /* ignore */ }
}

function pullMul(markerOrEnvId) {
  var s = state(markerOrEnvId);
  return Math.max(0, Math.min(1, s.harmonizePull / 100));
}

function markerPresenceMul(marker) {
  if (!PER_DOT_PRESENCE_ACTIVE) return 1;
  if (!marker || !ECAudio.BeatPresence || !ECAudio.BeatPresence.presenceInfluence) return 1;
  return ECAudio.BeatPresence.presenceInfluence(ECAudio.BeatPresence.normZ(marker));
}

function markerPullMul(marker) {
  return pullMul(marker) * markerPresenceMul(marker);
}

function effectivePullPct(marker) {
  return Math.round(markerPullMul(marker) * 100);
}

function reachMul(markerOrEnvId) {
  var s = state(markerOrEnvId);
  return Math.max(0.15, Math.min(1.4, 0.45 + (s.reach / 100) * 0.95));
}

function peerMinCoupling(markerOrEnvId) {
  var s = state(markerOrEnvId);
  return Math.max(0.04, 0.14 - (s.reach / 100) * 0.09);
}

function peerThreshold(bias, markerOrEnvId) {
  var min = peerMinCoupling(markerOrEnvId);
  if (bias == null) return min;
  return Math.max(0.03, min + bias);
}

function couplingGainMul(markerOrEnvId) {
  var s = state(markerOrEnvId);
  var g = s.couplingGain != null ? s.couplingGain : 50;
  return Math.max(0.2, Math.min(1.45, 0.38 + (g / 100) * 1.02));
}

function couplingGainMulPair(a, b) {
  return Math.sqrt(couplingGainMul(a) * couplingGainMul(b));
}

function beatBuildMul(markerOrEnvId) {
  var s = state(markerOrEnvId);
  var b = s.beatBuild != null ? s.beatBuild : 50;
  return Math.max(0.15, Math.min(1.35, 0.28 + (b / 100) * 1.02));
}

function melodicBlendMul(markerOrEnvId) {
  var s = state(markerOrEnvId);
  var m = s.melodicBlend != null ? s.melodicBlend : 50;
  return Math.max(0.12, Math.min(1.4, 0.22 + (m / 100) * 1.12));
}

function melodicBlendMulPair(a, b) {
  return Math.sqrt(melodicBlendMul(a) * melodicBlendMul(b));
}

function onSettingsChanged() {
  if (ECAudio.BeatSeq && ECAudio.BeatSeq.scheduleRefreshAllPatterns) {
    ECAudio.BeatSeq.scheduleRefreshAllPatterns();
  } else if (ECAudio.BeatSeq && ECAudio.BeatSeq.refreshAllPatterns) {
    ECAudio.BeatSeq.refreshAllPatterns();
  }
  if (ECAudio.BeatBonds && ECAudio.BeatBonds.schedule) {
    ECAudio.BeatBonds.schedule();
  }
  if (ECAudio.BeatView3d && ECAudio.BeatView3d.schedule) {
    ECAudio.BeatView3d.schedule();
  }
  var sel = ECAudio.Markers && ECAudio.Markers.getSelected
    ? ECAudio.Markers.getSelected() : null;
  if (sel && ECAudio.BeatSeq && ECAudio.BeatSeq.syncGravityUI) {
    ECAudio.BeatSeq.syncGravityUI(sel);
  }
  syncInfluenceUI(sel);
}

function snapBeatOn(markerOrEnvId) {
  return !!state(markerOrEnvId).snapBeat;
}

function snapPitchOn(markerOrEnvId) {
  return !!state(markerOrEnvId).snapPitch;
}

function autoHarmonizeOn(markerOrEnvId) {
  return !!state(markerOrEnvId).autoHarmonize;
}

function set(key, val, envId) {
  var id = envId || (panelEnv() ? panelEnv().id : null);
  if (!id || !ECAudio.Environments || !ECAudio.Environments.get) return;
  var env = ECAudio.Environments.get(id);
  if (!env) return;
  if (ECAudio.Environments.ensureInfluence) ECAudio.Environments.ensureInfluence(env);
  var inf = env.influence;
  if (key === 'harmonizePull' || key === 'reach' || key === 'couplingGain' ||
      key === 'beatBuild' || key === 'melodicBlend') {
    inf[key] = Math.max(0, Math.min(100, val | 0));
  } else if (key === 'snapBeat' || key === 'snapPitch' || key === 'autoHarmonize') {
    inf[key] = !!val;
  } else return;
  save();
  onSettingsChanged();
}

function envLabel(marker) {
  if (!marker || !marker.envId || !ECAudio.Environments) return 'dot';
  var env = ECAudio.Environments.get(marker.envId);
  return env && env.label ? env.label : marker.envId.replace(/^env-/, '');
}

function layerLabel(envId) {
  if (!envId || !ECAudio.Environments) return 'layer';
  var env = ECAudio.Environments.get(envId);
  return env && env.label ? env.label : envId.replace(/^env-/, '');
}

function describeMarker(marker) {
  if (!marker || !ECAudio.BeatSpatial || !ECAudio.BeatSpatial.peers) {
    return 'Pick a layer above — influence is per layer. Select a dot to preview its neighbors.';
  }
  var near = ECAudio.BeatSpatial.peers(marker, peerMinCoupling(marker));
  var inf = state(marker);
  if (!near.length) {
    return layerLabel(marker.envId) + ' — reach ' + inf.reach +
      '% · no neighbors coupled. Move dots closer or raise Reach on this layer.';
  }
  var parts = [];
  var i;
  for (i = 0; i < near.length && i < 3; i++) {
    parts.push(envLabel(near[i].marker) + ' ' + Math.round(near[i].coupling * 100) + '%');
  }
  var extra = near.length > 3 ? ' +' + (near.length - 3) : '';
  var pull = ECAudio.BeatSeq && ECAudio.BeatSeq.clusterStrength
    ? Math.round(ECAudio.BeatSeq.clusterStrength(marker) * 100) : 0;
  var tier = ECAudio.BeatSeq && ECAudio.BeatSeq.clusterTier
    ? ECAudio.BeatSeq.clusterTier(pull / 100) : 'solo';
  var peerN = ECAudio.BeatSeq && ECAudio.BeatSeq.clusterPeers
    ? ECAudio.BeatSeq.clusterPeers(marker).length : 0;
  var eff = effectivePullPct(marker);
  var mixNote = ECAudio.BeatMix && ECAudio.BeatMix.describeCollisions
    ? ECAudio.BeatMix.describeCollisions(marker) : '';
  return near.length + ' neighbor' + (near.length === 1 ? '' : 's') +
    ': ' + parts.join(' · ') + extra +
    ' — ' + layerLabel(marker.envId) + ' pull ' + eff + '% · cluster ' + pull +
    '% (' + tier + ', ' + peerN + ' peer' + (peerN === 1 ? '' : 's') + ')' +
    ' · coupling ' + (inf.couplingGain != null ? inf.couplingGain : 50) + '%' +
    ' · beat build ' + (inf.beatBuild != null ? inf.beatBuild : 50) + '%' +
    ' · melodic ' + (inf.melodicBlend != null ? inf.melodicBlend : 50) + '%' +
    (mixNote ? ' · ' + mixNote : '');
}

function setInfluenceControlsDisabled(disabled) {
  var ids = [
    'sl-influence-reach', 'sl-influence-coupling', 'sl-influence-pull',
    'sl-influence-beat-build', 'sl-influence-melodic'
  ];
  var i;
  for (i = 0; i < ids.length; i++) {
    var el = document.getElementById(ids[i]);
    if (el) el.disabled = !!disabled;
  }
  ['snapBeat', 'snapPitch', 'autoHarmonize'].forEach(function(key) {
    var seg = document.getElementById('sl-influence-' + key + '-seg');
    if (!seg) return;
    seg.querySelectorAll('.sp-seg-btn').forEach(function(b) {
      b.disabled = !!disabled;
    });
  });
  var harmBtn = document.querySelector('[data-action="harmonize-now"]');
  if (harmBtn) harmBtn.disabled = !!disabled;
}

function syncInfluenceUI(marker) {
  if (marker === undefined && ECAudio.Markers && ECAudio.Markers.getSelected) {
    marker = ECAudio.Markers.getSelected();
  }
  var env = panelEnv();
  var layerEl = document.getElementById('sl-influence-layer');
  var pullEl = document.getElementById('sl-influence-pull');
  var reachEl = document.getElementById('sl-influence-reach');
  var coupleEl = document.getElementById('sl-influence-coupling');
  var beatBuildEl = document.getElementById('sl-influence-beat-build');
  var melodicEl = document.getElementById('sl-influence-melodic');
  var pullVal = document.getElementById('sl-influence-pull-val');
  var reachVal = document.getElementById('sl-influence-reach-val');
  var coupleVal = document.getElementById('sl-influence-coupling-val');
  var beatBuildVal = document.getElementById('sl-influence-beat-build-val');
  var melodicVal = document.getElementById('sl-influence-melodic-val');
  var presenceEl = document.getElementById('sl-loop-presence');
  var presenceVal = document.getElementById('sl-loop-presence-val');
  var effEl = document.getElementById('sl-influence-effective-pull');
  var readout = document.getElementById('sl-influence-readout');
  var s = env ? state(env.id) : state(null);
  var hasLayer = !!env;

  if (layerEl) {
    layerEl.textContent = hasLayer
      ? ('Layer: ' + env.label + ' — sliders apply to every ' + env.label + ' dot')
      : 'Pick Kick, Bass, Lead… in section 1 to tune layer coupling';
  }
  setInfluenceControlsDisabled(!hasLayer);

  if (pullEl && document.activeElement !== pullEl) pullEl.value = String(s.harmonizePull);
  if (reachEl && document.activeElement !== reachEl) reachEl.value = String(s.reach);
  if (pullVal) {
    pullVal.textContent = marker && hasLayer
      ? (s.harmonizePull + '% → ' + effectivePullPct(marker) + '% on dot')
      : (s.harmonizePull + '%');
  }
  if (reachVal) reachVal.textContent = s.reach + '%';
  if (coupleEl && document.activeElement !== coupleEl) {
    coupleEl.value = String(s.couplingGain != null ? s.couplingGain : 50);
  }
  if (coupleVal) coupleVal.textContent = (s.couplingGain != null ? s.couplingGain : 50) + '%';
  if (beatBuildEl && document.activeElement !== beatBuildEl) {
    beatBuildEl.value = String(s.beatBuild != null ? s.beatBuild : 50);
  }
  if (beatBuildVal) beatBuildVal.textContent = (s.beatBuild != null ? s.beatBuild : 50) + '%';
  if (melodicEl && document.activeElement !== melodicEl) {
    melodicEl.value = String(s.melodicBlend != null ? s.melodicBlend : 50);
  }
  if (melodicVal) melodicVal.textContent = (s.melodicBlend != null ? s.melodicBlend : 50) + '%';

  if (marker && ECAudio.BeatPresence && presenceEl && document.activeElement !== presenceEl) {
    presenceEl.value = String(ECAudio.BeatPresence.normZ(marker));
  }
  if (marker && ECAudio.BeatPresence && presenceVal) {
    presenceVal.textContent = Math.round(ECAudio.BeatPresence.normZ(marker) * 100) + '%';
  }
  if (presenceEl) {
    presenceEl.disabled = true;
  }
  if (effEl) {
    if (!hasLayer) {
      effEl.textContent = 'Influence is saved per layer — pick an element in section 1.';
    } else if (marker) {
      effEl.textContent = env.label + ' harmonize pull ' + s.harmonizePull +
        '% on this dot (per-dot Z scaling is inactive for now).';
    } else {
      effEl.textContent = env.label + ' layer pull ' + s.harmonizePull +
        '% — select a dot to preview neighbor coupling.';
    }
  }

  ['snapBeat', 'snapPitch', 'autoHarmonize'].forEach(function(key) {
    var seg = document.getElementById('sl-influence-' + key + '-seg');
    if (!seg) return;
    var on = s[key];
    seg.querySelectorAll('.sp-seg-btn').forEach(function(b) {
      b.classList.toggle('active', (b.getAttribute('data-val') === '1') === on);
    });
  });

  if (readout) {
    readout.textContent = marker ? describeMarker(marker) : describeMarker(null);
  }
}

function bindInfluencePanel() {
  if (bindInfluencePanel.bound) return;
  bindInfluencePanel.bound = true;
  var panel = document.getElementById('studio-panel');
  if (!panel) return;

  var pullEl = document.getElementById('sl-influence-pull');
  var reachEl = document.getElementById('sl-influence-reach');
  var coupleEl = document.getElementById('sl-influence-coupling');
  var beatBuildEl = document.getElementById('sl-influence-beat-build');
  var melodicEl = document.getElementById('sl-influence-melodic');
  if (pullEl) {
    pullEl.addEventListener('input', function() {
      set('harmonizePull', parseInt(pullEl.value, 10) || 0);
    });
  }
  if (reachEl) {
    reachEl.addEventListener('input', function() {
      set('reach', parseInt(reachEl.value, 10) || 0);
    });
  }
  if (coupleEl) {
    coupleEl.addEventListener('input', function() {
      set('couplingGain', parseInt(coupleEl.value, 10) || 0);
    });
  }
  if (beatBuildEl) {
    beatBuildEl.addEventListener('input', function() {
      set('beatBuild', parseInt(beatBuildEl.value, 10) || 0);
    });
  }
  if (melodicEl) {
    melodicEl.addEventListener('input', function() {
      set('melodicBlend', parseInt(melodicEl.value, 10) || 0);
    });
  }

  ['snapBeat', 'snapPitch', 'autoHarmonize'].forEach(function(key) {
    var seg = document.getElementById('sl-influence-' + key + '-seg');
    if (!seg) return;
    seg.querySelectorAll('.sp-seg-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (btn.disabled) return;
        set(key, btn.getAttribute('data-val') === '1');
      });
    });
  });

  panel.addEventListener('click', function(e) {
    var action = e.target.closest('[data-action]');
    if (!action) return;
    if (action.getAttribute('data-action') !== 'harmonize-now') return;
    if (soundEnabled || action.disabled) return;
    var sel = ECAudio.Markers && ECAudio.Markers.getSelected
      ? ECAudio.Markers.getSelected() : null;
    if (!sel || !ECAudio.BeatSpatial || !ECAudio.BeatSpatial.applyField) return;
    ECAudio.BeatSpatial.applyField(sel.id);
    if (ECAudio.Markers.syncMarkerEditor) ECAudio.Markers.syncMarkerEditor();
    onSettingsChanged();
  });
}

function initBeatInfluence() {
  migrateLegacyGlobal();
  if (ECAudio.Environments && ECAudio.Environments.ensure) ECAudio.Environments.ensure();
  bindInfluencePanel();
  syncInfluenceUI(null);
}

ECAudio.BeatInfluence = {
  init: initBeatInfluence,
  defaults: function() { return JSON.parse(JSON.stringify(DEFAULTS)); },
  state: state,
  set: set,
  pullMul: pullMul,
  markerPullMul: markerPullMul,
  markerPresenceMul: markerPresenceMul,
  effectivePullPct: effectivePullPct,
  reachMul: reachMul,
  couplingGainMul: couplingGainMul,
  couplingGainMulPair: couplingGainMulPair,
  beatBuildMul: beatBuildMul,
  melodicBlendMul: melodicBlendMul,
  melodicBlendMulPair: melodicBlendMulPair,
  peerMinCoupling: peerMinCoupling,
  peerThreshold: peerThreshold,
  onSettingsChanged: onSettingsChanged,
  snapBeatOn: snapBeatOn,
  snapPitchOn: snapPitchOn,
  autoHarmonizeOn: autoHarmonizeOn,
  describeMarker: describeMarker,
  syncUI: syncInfluenceUI
};
