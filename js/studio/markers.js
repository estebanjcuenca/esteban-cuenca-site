/* eslint-disable no-var */
// Sound mode — numbered dots on CV rows; hold to select, scroll wheel changes pulse rate.
window.ECAudio = window.ECAudio || {};

var SOFT_MIX_AT = 10;
var MIN_MARKER_DIST = 0.028;
var MARKER_STORE_KEY = 'ec-sound-markers';
var PIN_MOVE_PX = 28;
var HOLD_MAX_MS = 520;
var HOLD_MIN_MS = 24;
var QUICK_TAP_MS = 400;
var MARKER_SETTINGS_HOLD_MS = 420;
var DOUBLE_MS = 500;
var DOUBLE_DIST = 48;
var SIZE_MIN = 14;
var SIZE_MAX = 50;

var _press = null;
var _lastQuickTap = null;
var _selectedId = null;
var _layerSettingsOpen = null;
var _soloDotId = null;
var _placeSelectGraceUntil = 0;
var _syncingOverlay = false;
var DRAG_MARK_PX = 6;

function loopRoles() {
  return ECAudio.LOOP_ROLES || ['kick', 'chord', 'lead', 'hat'];
}

function normalizeRole(role) {
  if (ECAudio.Theory && ECAudio.Theory.normalizeLoopRole) {
    return ECAudio.Theory.normalizeLoopRole(role);
  }
  var legacy = ECAudio.LOOP_ROLE_LEGACY || {};
  return legacy[role] || role || 'kick';
}

function roleLabel(role) {
  var labels = ECAudio.LOOP_ROLE_LABELS || {};
  var r = normalizeRole(role);
  return labels[r] || (r ? r.charAt(0).toUpperCase() + r.slice(1) : 'Kick');
}

function roleShortLabel(role) {
  var shorts = ECAudio.LOOP_ROLE_SHORT || {};
  var r = normalizeRole(role);
  return shorts[r] || roleLabel(r).slice(0, 3).toUpperCase();
}

function densityOptions() {
  return ECAudio.LOOP_DENSITY_OPTIONS || [2, 4, 8];
}

function normalizeMarkerDensity(density) {
  if (ECAudio.Theory && ECAudio.Theory.normalizeMarkerDensity) {
    return ECAudio.Theory.normalizeMarkerDensity(density);
  }
  return density === 2 || density === 8 ? density : 4;
}

function defaultDensityForRole(role) {
  if (ECAudio.Theory && ECAudio.Theory.defaultDensityForRole) {
    return ECAudio.Theory.defaultDensityForRole(role);
  }
  return 4;
}

function densityToIndex(density) {
  var opts = densityOptions();
  var idx = opts.indexOf(normalizeMarkerDensity(density));
  return idx >= 0 ? idx : 1;
}

function indexToDensity(idx) {
  var opts = densityOptions();
  return opts[Math.max(0, Math.min(opts.length - 1, idx | 0))] || 4;
}

function formatDensity(density) {
  var n = normalizeMarkerDensity(density);
  if (n === 8) return '½ bar';
  if (n === 2) return '⅛ bar';
  return '¼ bar';
}

function markerDisplayName(marker) {
  return marker && marker.num != null ? String(marker.num) : '?';
}

function markerPresetLabel(marker) {
  if (!marker || !marker.presetId) return '';
  if (ECAudio.MarkerDrums && ECAudio.MarkerDrums.presetLabel) {
    return ECAudio.MarkerDrums.presetLabel(marker.presetId);
  }
  var p = ECAudio.SoundPresets && ECAudio.SoundPresets[marker.presetId];
  return p && p.label ? p.label : marker.presetId;
}

function markerIsDrum(marker) {
  return markerIsPercussion(marker);
}

function markerIsPercussion(marker) {
  return !!(marker && marker.presetId && ECAudio.MarkerDrums &&
    ECAudio.MarkerDrums.isPercussion && ECAudio.MarkerDrums.isPercussion(marker.presetId));
}

function markerIsSynth(marker) {
  return !!(marker && marker.presetId && ECAudio.MarkerDrums &&
    ECAudio.MarkerDrums.isSynthLayer && ECAudio.MarkerDrums.isSynthLayer(marker.presetId));
}

var VIZ_DENSITIES = ['2', '4', '8'];

var PRESET_CLASS_IDS = ['kick', 'hat', 'bass', 'clap', 'bright', 'minimal'];

function markerPresetId(marker) {
  if (ECAudio.BeatColors && ECAudio.BeatColors.markerPresetId) {
    return ECAudio.BeatColors.markerPresetId(marker);
  }
  if (!marker) return null;
  if (marker.presetId) return marker.presetId;
  var env = envForMarker(marker);
  if (env && env.type) return env.type;
  if (marker.envId) return marker.envId.replace(/^env-/, '');
  if (marker.role && PRESET_CLASS_IDS.indexOf(marker.role) >= 0) return marker.role;
  return null;
}

function applyMarkerVisual(marker) {
  var el = marker && marker.el;
  if (!el) return;
  var env = envForMarker(marker);
  var mp = env && env.params ? env.params : ensureMarkerParams(marker);
  var density = String(normalizeMarkerDensity(markerDensity(marker)));
  var i;
  for (i = 0; i < VIZ_DENSITIES.length; i++) el.classList.remove('viz-density-' + VIZ_DENSITIES[i]);
  el.classList.add('viz-density-' + density);

  var preset = markerPresetId(marker);
  if (preset && !marker.presetId) marker.presetId = preset;
  var z = markerNormZ(marker);
  var depth = ECAudio.BeatPresence && ECAudio.BeatPresence.depthScale
    ? ECAudio.BeatPresence.depthScale(z) : (0.78 + z * 0.34);
  if (ECAudio.BeatColors && ECAudio.BeatColors.applyToElement) {
    ECAudio.BeatColors.applyToElement(marker, el);
  }
  var pan = ECAudio.BeatMix && ECAudio.BeatMix.stereoPan
    ? ECAudio.BeatMix.stereoPan(marker) : 0;
  var panPct = Math.round(pan * 100);
  el.dataset.pan = String(panPct);
  el.dataset.panSide = panPct < -8 ? 'left' : (panPct > 8 ? 'right' : 'center');
  el.style.transform = 'translate(calc(-50% + ' + (pan * 10) + 'px), -50%) scale(' + depth + ')';
  el.dataset.presence = String(Math.round(z * 100));

  for (i = 0; i < PRESET_CLASS_IDS.length; i++) {
    el.classList.remove('preset-' + PRESET_CLASS_IDS[i]);
  }
  if (preset && ECAudio.BeatColors && ECAudio.BeatColors.PRESET_COLORS[preset]) {
    el.classList.add('preset-' + preset);
  }
  el.dataset.preset = preset || '';
  if (marker.envId) {
    el.dataset.envId = marker.envId;
    var overview = ECAudio.Environments && ECAudio.Environments.isOverview
      ? ECAudio.Environments.isOverview() : false;
    if (overview) {
      el.classList.add('is-env-active');
      el.classList.remove('is-env-muted');
    } else {
      var active = ECAudio.Environments && ECAudio.Environments.getActive
        ? ECAudio.Environments.getActive() : null;
      var on = active && active.id === marker.envId;
      el.classList.toggle('is-env-active', !!on);
      el.classList.toggle('is-env-muted', !on);
    }
  }
}

function envIdFromSaved(d) {
  if (!d) return 'env-kick';
  if (d.envId) return d.envId;
  if (d.presetId) return 'env-' + d.presetId;
  if (d.role && ECAudio.Environments && ECAudio.Environments.ELEMENT_TYPES &&
      ECAudio.Environments.ELEMENT_TYPES.indexOf(d.role) >= 0) {
    return 'env-' + d.role;
  }
  return 'env-kick';
}

function serializeMarkerData(m) {
  if (!m) return null;
  return {
    id: m.id,
    num: m.num,
    envId: m.envId || envIdFromSaved(m),
    secId: m.secId,
    normX: m.normX,
    normY: m.normY,
    beatPhase: m.beatPhase,
    rowIndex: m.rowIndex,
    laneIndex: m.laneIndex,
    step: m.step,
    toneNorm: m.toneNorm,
    density: markerDensity(m),
    sizeNorm: m.sizeNorm,
    levelMul: m.levelMul,
    normZ: markerNormZ(m),
    role: m.role || (m.presetId || 'kick'),
    presetId: m.presetId || null,
    pitchMul: m.pitchMul != null ? m.pitchMul : 1,
    gravityMode: m.gravityMode || 'auto',
    gravityDensity: m.gravityDensity != null ? m.gravityDensity : 28
  };
}

function syncMarkerDataFromLive() {
  ECAudio.State.markerData = (ECAudio.State.markers || []).map(serializeMarkerData).filter(Boolean);
  saveMarkerStore();
}

function migrateMarkerStoreEntry(d) {
  if (!d) return d;
  if (!d.envId) d.envId = envIdFromSaved(d);
  if (d.beatPhase == null && d.normX != null && ECAudio.BeatKaoss && ECAudio.BeatKaoss.beatPhaseFromX) {
    d.beatPhase = ECAudio.BeatKaoss.beatPhaseFromX(d.normX);
  }
  if (!d.presetId && d.envId) d.presetId = d.envId.replace(/^env-/, '');
  if (d.normZ == null) {
    d.normZ = ECAudio.BeatPresence && ECAudio.BeatPresence.DEFAULT
      ? ECAudio.BeatPresence.DEFAULT : 0.55;
  }
  if (!d.gravityMode) d.gravityMode = 'auto';
  if (d.gravityDensity == null) d.gravityDensity = 28;
  return d;
}

function markerNormZ(marker) {
  if (ECAudio.BeatPresence && ECAudio.BeatPresence.normZ) {
    return ECAudio.BeatPresence.normZ(marker);
  }
  return marker && marker.normZ != null ? marker.normZ : 0.55;
}

function adjustMarkerPresence(id, dir) {
  var marker = findMarker(id);
  if (!marker) return;
  var step = 0.06;
  var z = markerNormZ(marker) + dir * step;
  z = Math.max(0.05, Math.min(0.98, z));
  updateMarker(id, { normZ: z });
  if (ECAudio.BeatBonds && ECAudio.BeatBonds.schedule) ECAudio.BeatBonds.schedule();
  if (ECAudio.BeatView3d && ECAudio.BeatView3d.schedule) ECAudio.BeatView3d.schedule();
}

function findSavedMarker(marker, saved, index) {
  var i;
  if (!marker || !saved || !saved.length) return null;
  for (i = 0; i < saved.length; i++) {
    if (saved[i].id === marker.id) return saved[i];
  }
  if (marker.num != null) {
    for (i = 0; i < saved.length; i++) {
      if (saved[i].num === marker.num) return saved[i];
    }
  }
  if (index != null && index >= 0 && index < saved.length) return saved[index];
  return null;
}

function applySavedMarkerFields(marker, saved) {
  if (!marker || !saved) return;
  saved = migrateMarkerStoreEntry(saved);
  if (saved.envId) marker.envId = saved.envId;
  if (saved.presetId) marker.presetId = saved.presetId;
  if (saved.role) marker.role = saved.role;
  if (saved.normX != null) marker.normX = saved.normX;
  if (saved.normY != null) marker.normY = saved.normY;
  if (saved.beatPhase != null) marker.beatPhase = saved.beatPhase;
  if (saved.step != null) marker.step = saved.step;
  if (saved.toneNorm != null) marker.toneNorm = saved.toneNorm;
  if (saved.rowIndex != null) marker.rowIndex = saved.rowIndex;
  if (saved.laneIndex != null) marker.laneIndex = saved.laneIndex;
  if (saved.normZ != null) marker.normZ = saved.normZ;
  else if (!marker.normZ) marker.normZ = markerNormZ(marker);
  if (!marker.envId) marker.envId = envIdFromSaved(marker);
  if (!marker.presetId && marker.envId) marker.presetId = marker.envId.replace(/^env-/, '');
}

function renumberMarkers(preferId) {
  var markers = ECAudio.State.markers || [];
  var prevMarker = _layerSettingsOpen ? findMarker(_layerSettingsOpen) : null;
  var preferMarker = preferId ? findMarker(preferId) : null;
  var i;
  for (i = 0; i < markers.length; i++) {
    markers[i].num = i + 1;
    if (markers[i].el) {
      markers[i].el.setAttribute('aria-label', 'Dot ' + (i + 1));
    }
  }
  if (preferMarker) {
    _layerSettingsOpen = preferMarker.id;
    _selectedId = preferMarker.id;
  } else if (prevMarker) {
    _layerSettingsOpen = prevMarker.id;
    _selectedId = prevMarker.id;
  } else if (_layerSettingsOpen) {
    closeLayerSettings();
  }
  syncMarkerDataFromLive();
  markers.forEach(function(m) {
    syncMarkerLabel(m);
    applyMarkerVisual(m);
  });
}

function markerParamKeys() {
  return ECAudio.MARKER_PARAM_KEYS || [];
}

function staticMarkerDefaults() {
  var d = ECAudio.BrowseSound || {};
  return {
    wave: d.WAVE || 'sawtooth',
    gain: d.GAIN != null ? d.GAIN : 0.09,
    attack: d.ATTACK != null ? d.ATTACK : 0.06,
    decay: d.DECAY != null ? d.DECAY : 1.0,
    browseTone: d.TONE != null ? d.TONE : 0.68,
    browseHarmonics: d.HARMONICS != null ? d.HARMONICS : 0.45,
    browseDrive: d.HARMONICS != null ? d.HARMONICS : 0.45,
    browseFilterMin: d.FILTER_MIN != null ? d.FILTER_MIN : 600,
    browseFilterMax: d.FILTER_MAX != null ? d.FILTER_MAX : 4800,
    browseFilterQ: d.FILTER_Q != null ? d.FILTER_Q : 0.75,
    browseSubMix: d.SUB_MIX != null ? d.SUB_MIX : 0.012,
    detune: d.DETUNE != null ? d.DETUNE : 0,
    browseSpace: d.SPACE != null ? d.SPACE : 0.06,
    browseLfoRate: d.LFO_RATE != null ? d.LFO_RATE : 0,
    browseLfoDepth: d.LFO_DEPTH != null ? d.LFO_DEPTH : 0.4,
    browseLfoTarget: d.LFO_TARGET || 'filter'
  };
}

function defaultMarkerParams() {
  return JSON.parse(JSON.stringify(staticMarkerDefaults()));
}

function ensureMarkerParams(marker) {
  if (!marker) return {};
  if (!marker.params || typeof marker.params !== 'object') marker.params = defaultMarkerParams();
  return marker.params;
}

function envForMarker(marker) {
  if (!marker || !marker.envId || !ECAudio.Environments) return null;
  return ECAudio.Environments.get(marker.envId);
}

function getMarkerParam(marker, key) {
  if (!marker) return ECAudio.params[key];
  var env = envForMarker(marker);
  if (env && ECAudio.Environments.getParam) return ECAudio.Environments.getParam(env, key);
  var mp = ensureMarkerParams(marker);
  if (mp[key] != null) return mp[key];
  if (markerParamKeys().indexOf(key) >= 0) {
    var defs = staticMarkerDefaults();
    if (defs[key] != null) return defs[key];
    return null;
  }
  return ECAudio.params[key];
}

function setMarkerParam(marker, key, val) {
  if (!marker) return;
  var env = envForMarker(marker);
  if (env && ECAudio.Environments.setParam) {
    ECAudio.Environments.setParam(env.id, key, val);
    applyMarkerVisual(marker);
    syncLayerPreview(marker);
    return;
  }
  var mp = ensureMarkerParams(marker);
  mp[key] = val;
  if (key === 'browseHarmonics') mp.browseDrive = val;
  persistMarkerData(marker);
  refreshMarkerVoice(marker);
  if (key === 'wave' && marker.voice && marker.voice.osc1) {
    marker.voice.osc1.type = val;
    if (marker.voice.unisonOsc) marker.voice.unisonOsc.type = val;
    restartMarkerVoice(marker);
    return;
  }
  if (typeof syncSoundPanelUI === 'function') syncSoundPanelUI();
  if (ECAudio.SoundVisual && ECAudio.SoundVisual.refreshStatic) ECAudio.SoundVisual.refreshStatic();
  applyMarkerVisual(marker);
  syncLayerPreview(marker);
}

function applyMarkerShape(el, role) {
  if (!el) return;
  var shapes = ['kick', 'chord', 'lead', 'hat', 'foundation', 'pad', 'air'];
  var i;
  for (i = 0; i < shapes.length; i++) el.classList.remove('shape-' + shapes[i]);
  el.classList.add('shape-' + normalizeRole(role));
}

function markerDensity(marker) {
  if (!marker) return 4;
  if (marker.density != null) return normalizeMarkerDensity(marker.density);
  return defaultDensityForRole(marker.role);
}

function markerNoteShort(marker) {
  if (!marker) return '—';
  if (markerIsPercussion(marker)) return 'drum';
  if (!ECAudio.Theory || !ECAudio.Theory.browsePadNoteLabel) return '—';
  return ECAudio.Theory.browsePadNoteLabel(markerLaneIndex(marker), marker.normY).split(' · ')[0];
}

function syncMarkerLabel(marker) {
  if (!marker || !marker.el) return;
  var chip = marker.el.querySelector('.sound-marker-chip');
  if (!chip) return;
  var roleEl = chip.querySelector('.sound-marker-role');
  var metaEl = chip.querySelector('.sound-marker-meta');
  var noteEl = chip.querySelector('.sound-marker-note');
  var density = markerDensity(marker);
  if (roleEl) {
    var label = markerPresetLabel(marker);
    roleEl.textContent = label ? (markerDisplayName(marker) + ' ' + label) : markerDisplayName(marker);
  }
  if (metaEl) {
    var beatNum = (marker.step != null ? marker.step : 0) + 1;
    var zPct = Math.round(markerNormZ(marker) * 100);
    if (isBeatStudioActive()) {
      var panPct = ECAudio.BeatMix && ECAudio.BeatMix.stereoPan
        ? Math.round(ECAudio.BeatMix.stereoPan(marker) * 100) : 0;
      var panTxt = panPct < -4 ? 'L' + Math.abs(panPct) : (panPct > 4 ? 'R' + panPct : 'C');
      metaEl.textContent = 'beat ' + beatNum + ' · ' + panTxt + ' · Z ' + zPct + '%';
    } else {
      metaEl.textContent = 'beat ' + beatNum;
    }
  }
  if (noteEl) noteEl.textContent = markerNoteShort(marker);
  marker.el.dataset.density = String(density);
}

function setDotSolo(id) {
  if (!id || !findMarker(id)) return;
  _soloDotId = id;
  document.documentElement.classList.add('dot-solo');
  document.querySelectorAll('.sound-marker').forEach(function(el) {
    el.classList.toggle('is-soloed', el.dataset.markerId === id);
    el.classList.toggle('is-solo-muted', el.dataset.markerId !== id);
  });
  var btn = document.querySelector('[data-action="solo-hold"]');
  if (btn) btn.classList.add('is-active');
  if (ECAudio.BeatView3d && ECAudio.BeatView3d.schedule) ECAudio.BeatView3d.schedule();
}

function clearDotSolo() {
  if (!_soloDotId) return;
  _soloDotId = null;
  document.documentElement.classList.remove('dot-solo');
  document.querySelectorAll('.sound-marker').forEach(function(el) {
    el.classList.remove('is-soloed', 'is-solo-muted');
  });
  var btn = document.querySelector('[data-action="solo-hold"]');
  if (btn) btn.classList.remove('is-active');
  if (ECAudio.BeatView3d && ECAudio.BeatView3d.schedule) ECAudio.BeatView3d.schedule();
}

function resolveSoloMarker() {
  var sel = getSelected();
  if (sel && sel.id) return sel;
  if (!ECAudio.Environments || !ECAudio.Environments.panelEnv) return null;
  var env = ECAudio.Environments.panelEnv();
  if (!env || !ECAudio.Environments.markersIn) return null;
  var dots = ECAudio.Environments.markersIn(env.id);
  if (dots.length === 1) return dots[0];
  return null;
}

function shouldPlayInMix(marker) {
  if (!_soloDotId) return true;
  return !!(marker && marker.id === _soloDotId);
}

function soloDotId() {
  return _soloDotId;
}

function selectDot(id) {
  var marker = findMarker(id);
  if (!marker) return;
  _layerSettingsOpen = id;
  _selectedId = id;
  if (marker.envId && ECAudio.Environments && ECAudio.Environments.activate) {
    ECAudio.Environments.activate(marker.envId);
  }
  document.querySelectorAll('.sound-marker').forEach(function(el) {
    el.classList.toggle('is-selected', el.dataset.markerId === id);
    if (_soloDotId) {
      el.classList.toggle('is-soloed', el.dataset.markerId === _soloDotId);
      el.classList.toggle('is-solo-muted', el.dataset.markerId !== _soloDotId);
    }
  });
  if (typeof slBindMarkerTarget === 'function') slBindMarkerTarget(marker);
  if (typeof syncSoundPanelUI === 'function') syncSoundPanelUI();
  syncMarkerEditor();
  if (ECAudio.SoundVisual && ECAudio.SoundVisual.ensureAnalyser) ECAudio.SoundVisual.ensureAnalyser();
  if (ECAudio.BeatGuide) {
    ECAudio.BeatGuide.fire('select_dot', { rect: marker.el ? marker.el.getBoundingClientRect() : null });
  }
  if (ECAudio.BeatView3d && ECAudio.BeatView3d.setSelected) {
    ECAudio.BeatView3d.setSelected(id);
  }
}

function openLayerSettings(id) {
  selectDot(id);
}

function closeLayerSettings() {
  clearDotSolo();
  _layerSettingsOpen = null;
  _selectedId = null;
  _placeSelectGraceUntil = 0;
  document.querySelectorAll('.sound-marker').forEach(function(el) {
    el.classList.remove('is-selected', 'is-soloed', 'is-solo-muted');
  });
  if (typeof slClearMarkerTarget === 'function') slClearMarkerTarget();
  syncMarkerEditor();
  if (ECAudio.BeatView3d && ECAudio.BeatView3d.setSelected) ECAudio.BeatView3d.setSelected(null);
}

function cycleMarkerDensity(id, dir) {
  var marker = findMarker(id);
  if (!marker) return;
  var opts = densityOptions();
  var idx = densityToIndex(markerDensity(marker));
  idx = (idx + dir + opts.length) % opts.length;
  updateMarker(id, { density: opts[idx] });
  applyMarkerVisual(marker);
  if (ECAudio.BeatGuide) ECAudio.BeatGuide.fire('scroll_density', { rect: marker.el.getBoundingClientRect() });
}

function defaultRoleForCount(n) {
  var roles = loopRoles();
  return roles[((n % roles.length) + roles.length) % roles.length];
}

function nextRole(role) {
  var roles = loopRoles();
  var r = normalizeRole(role);
  var i = roles.indexOf(r);
  if (i < 0) i = 0;
  return roles[(i + 1) % roles.length];
}

function applyMarkerRoleEl(el, role) {
  if (!el) return;
  var roles = loopRoles();
  var legacy = ['foundation', 'pad', 'air'];
  var i;
  for (i = 0; i < roles.length; i++) el.classList.remove('role-' + roles[i]);
  for (i = 0; i < legacy.length; i++) el.classList.remove('role-' + legacy[i]);
  var r = normalizeRole(role);
  el.classList.add('role-' + r);
  applyMarkerShape(el, r);
  el.dataset.role = r;
  var roleEl = el.querySelector('.sound-marker-role');
  if (roleEl) roleEl.textContent = roleShortLabel(r);
}

function markerId() {
  ECAudio.State.markerSeq += 1;
  return 'mk-' + ECAudio.State.markerSeq;
}

function zoneMarkers(zone) {
  return (ECAudio.State.markers || []).filter(function(m) { return m.zone === zone; });
}

function findMarker(id) {
  var markers = ECAudio.State.markers || [];
  var i;
  for (i = 0; i < markers.length; i++) {
    if (markers[i].id === id) return markers[i];
  }
  return null;
}

function getSelected() {
  if (_layerSettingsOpen) return findMarker(_layerSettingsOpen);
  return _selectedId ? findMarker(_selectedId) : null;
}

function markerLaneIndex(marker) {
  if (!marker) return 0;
  if (marker.laneIndex != null) return marker.laneIndex;
  if (marker.zone && ECAudio.Zones && ECAudio.Zones.globalRowIndex) {
    return ECAudio.Zones.globalRowIndex(marker.zone);
  }
  return marker.rowIndex || 0;
}

function envLabel(marker) {
  if (!marker) return '—';
  var env = envForMarker(marker);
  if (env) return env.label;
  if (marker.presetId && ECAudio.Environments && ECAudio.Environments.ELEMENT_LABELS) {
    return ECAudio.Environments.ELEMENT_LABELS[marker.presetId] || marker.presetId;
  }
  return marker.presetId || '—';
}

function loopNoteLabel(marker) {
  if (!marker) return '—';
  var step = marker.step != null ? marker.step : (ECAudio.Theory && ECAudio.Theory.stepFromNormX
    ? ECAudio.Theory.stepFromNormX(marker.normX) : 0);
  var line = envLabel(marker) + ' · beat ' + (step + 1);
  if (ECAudio.BeatKaoss && ECAudio.BeatKaoss.noteLabel) {
    var row = ECAudio.Theory.markerPitchRow
      ? ECAudio.Theory.markerPitchRow(marker) : marker.rowIndex;
    line += ' · ' + ECAudio.BeatKaoss.noteLabel(row, marker.normY);
  } else if (ECAudio.Theory && ECAudio.Theory.browsePadNoteLabel) {
    var row2 = ECAudio.Theory.markerPitchRow
      ? ECAudio.Theory.markerPitchRow(marker) : marker.rowIndex;
    line += ' · ' + ECAudio.Theory.browsePadNoteLabel(row2, marker.normY).split(' · ')[0];
  }
  return line;
}

function panelEnvType(marker) {
  var env = marker ? envForMarker(marker) : null;
  if (!env && ECAudio.Environments && ECAudio.Environments.panelEnv) {
    env = ECAudio.Environments.panelEnv();
  }
  if (env && env.type) return env.type;
  if (marker && marker.presetId) return marker.presetId;
  return null;
}

function syncDotPanelMode(marker) {
  var lab = document.getElementById('studio-panel');
  if (!lab) return;
  var env = marker ? envForMarker(marker) : null;
  if (!env && ECAudio.Environments && ECAudio.Environments.panelEnv) {
    env = ECAudio.Environments.panelEnv();
  }
  var type = panelEnvType(marker);
  var isDrum = !!(type && ECAudio.MarkerDrums && ECAudio.MarkerDrums.isDrum(type));
  var isSynth = !!(type && ECAudio.MarkerDrums && ECAudio.MarkerDrums.isSynthLayer(type));
  var hasEnv = !!(env || (marker && marker.presetId));
  lab.classList.remove('sl-dot-is-drum', 'sl-dot-is-melodic', 'sl-dot-no-preset', 'sl-dot-step-grid', 'sl-env-is-synth');
  lab.classList.toggle('sl-dot-is-drum', isDrum);
  lab.classList.toggle('sl-dot-is-melodic', !isDrum);
  lab.classList.toggle('sl-env-is-synth', isSynth);
  lab.classList.toggle('sl-dot-no-preset', !hasEnv);
  var decayInput = document.getElementById('sl-env-decay');
  var decayLabel = document.getElementById('sl-env-decay-label');
  var harmLabel = document.getElementById('sl-env-harm-label');
  if (ECAudio.Machines && ECAudio.Machines.syncPanelLabels) {
    ECAudio.Machines.syncPanelLabels(type);
  } else if (harmLabel) {
    harmLabel.textContent = isDrum ? 'Snap / character' : 'Harmonics';
  }
  if (decayInput) {
    if (isDrum) {
      decayInput.min = '0.04';
      decayInput.max = '0.5';
      decayInput.step = '0.01';
      if (decayLabel) decayLabel.textContent = 'Length';
    } else {
      decayInput.min = '0.2';
      decayInput.max = '4';
      decayInput.step = '0.1';
      if (decayLabel) decayLabel.textContent = 'Release';
    }
    if (env && ECAudio.Environments.getParam) {
      var decayVal = ECAudio.Environments.getParam(env, 'decay');
      var decayFmt = document.getElementById('sp-decay-val');
      if (decayFmt && decayVal != null) {
        decayFmt.textContent = isDrum
          ? Math.round(decayVal * 1000) + 'ms'
          : decayVal.toFixed(1) + 's';
      }
    }
  }
  if (ECAudio.Environments && ECAudio.Environments.syncBar) ECAudio.Environments.syncBar();
  if (typeof syncSoundPanelUI === 'function') syncSoundPanelUI();
}

function syncMarkerStep(marker) {
  if (!marker || !ECAudio.Theory) return;
  if (marker.envId && ECAudio.BeatKaoss) {
    var nx = marker.normX != null ? marker.normX : 0.5;
    var phaseFromX = ECAudio.BeatKaoss.beatPhaseFromX(nx);
    if (marker.beatPhase == null) {
      marker.beatPhase = phaseFromX;
    } else if (ECAudio.BeatKaoss.beatXFromPhase) {
      var xFromPhase = ECAudio.BeatKaoss.beatXFromPhase(marker.beatPhase);
      if (Math.abs(xFromPhase - nx) > 0.035) marker.beatPhase = phaseFromX;
    }
    marker.step = Math.max(0, Math.min(beatStepCount() - 1, Math.round(marker.beatPhase)));
    if (marker.toneNorm == null) marker.toneNorm = marker.normX;
    return;
  }
  if (marker.step == null) {
    marker.step = ECAudio.Theory.stepFromNormX(marker.normX);
  }
  marker.normX = ECAudio.Theory.normXFromStep(marker.step);
  if (marker.toneNorm == null) marker.toneNorm = 0.5;
}

function syncMarkerLane(marker) {
  if (!marker || !marker.zone) return;
  if (marker.envId && ECAudio.Environments && ECAudio.Environments.pitchRow) {
    var pr = ECAudio.Environments.pitchRow(marker.envId);
    marker.laneIndex = pr;
    marker.rowIndex = pr;
    return;
  }
  if (marker.zone.classList && marker.zone.classList.contains('beat-lane')) {
    var li = marker.zone.dataset.laneIndex != null ? parseInt(marker.zone.dataset.laneIndex, 10) : 0;
    marker.laneIndex = li;
    marker.rowIndex = li;
    return;
  }
  marker.laneIndex = ECAudio.Zones && ECAudio.Zones.globalRowIndex
    ? ECAudio.Zones.globalRowIndex(marker.zone)
    : marker.rowIndex;
}

function cycleMarkerRole() {
  return false;
}

function markersInEnvSorted(envId) {
  var list = ECAudio.Environments && ECAudio.Environments.markersIn
    ? ECAudio.Environments.markersIn(envId) : [];
  return list.slice().sort(function(a, b) {
    return (a.step | 0) - (b.step | 0);
  });
}

function handleDotTap(id) {
  var marker = findMarker(id);
  if (!marker || !marker.envId) return;
  var wasOverview = ECAudio.Environments && ECAudio.Environments.isOverview
    ? ECAudio.Environments.isOverview() : false;
  if (ECAudio.Environments && ECAudio.Environments.activate) {
    ECAudio.Environments.activate(marker.envId);
  }
  if (wasOverview || _selectedId !== id || !_layerSettingsOpen) {
    selectDot(id);
    return;
  }
  var envDots = markersInEnvSorted(marker.envId);
  if (envDots.length <= 1) {
    selectDot(id);
    return;
  }
  var idx = -1;
  var i;
  for (i = 0; i < envDots.length; i++) {
    if (envDots[i].id === id) { idx = i; break; }
  }
  if (idx < 0) return;
  var nextIdx = (idx + 1) % envDots.length;
  if (nextIdx === 0) {
    removeMarker(id);
    if (envDots.length > 1) selectDot(envDots[1].id);
    return;
  }
  selectDot(envDots[nextIdx].id);
}

function cycleMarkerPreset(id) {
  handleDotTap(id);
}

function selectMarker(id) {
  if (isBeatStudioActive() && id) {
    selectDot(id);
    return;
  }
  _selectedId = id || null;
  document.querySelectorAll('.sound-marker').forEach(function(el) {
    el.classList.toggle('is-selected', !!id && el.dataset.markerId === id && _layerSettingsOpen === id);
  });
  syncMarkerEditor();
  if (ECAudio.SoundVisual && ECAudio.SoundVisual.refreshStatic) ECAudio.SoundVisual.refreshStatic();
}

function persistMarkerData(marker) {
  if (!marker) return;
  var data = ECAudio.State.markerData || [];
  var i;
  var snap = serializeMarkerData(marker);
  for (i = 0; i < data.length; i++) {
    if (data[i].id === marker.id) {
      data[i] = snap;
      saveMarkerStore();
      return;
    }
  }
  data.push(snap);
  ECAudio.State.markerData = data;
  saveMarkerStore();
}

function refreshMarkerVoice(marker) {
  if (!marker || !marker.voice || !ECAudio.Browse || !ECAudio.State.ctx) return;
  marker.voice.secId = marker.secId;
  marker.voice.normX = marker.normX;
  marker.voice.normY = marker.normY;
  if (marker.rowIndex != null) marker.voice.rowIndex = marker.rowIndex;
  ECAudio.Browse.applyMarkerTone(marker.voice, marker);
  var beatArp = marker.envId && marker.voice.arpeggio && !marker.voice.isDrum;
  if (!beatArp && ECAudio.Browse.setVoicePitch) {
    var row = ECAudio.Theory.markerPitchRow
      ? ECAudio.Theory.markerPitchRow(marker) : markerLaneIndex(marker);
    var mul = ECAudio.Theory.markerEnvPitchMul
      ? ECAudio.Theory.markerEnvPitchMul(marker) : 1;
    var freq = marker.envId && ECAudio.BeatKaoss && ECAudio.BeatKaoss.beatKaossPitch
      ? ECAudio.BeatKaoss.beatKaossPitch(row, marker.normY) * mul
      : ECAudio.Theory.browsePadPitch(row, marker.normY) * mul;
    ECAudio.Browse.setVoicePitch(marker.voice, freq, ECAudio.State.ctx.currentTime, 0.04);
  } else if (beatArp && marker.voice.padGain) {
    var t = ECAudio.State.ctx.currentTime;
    marker.voice.padGain.gain.cancelScheduledValues(t);
    marker.voice.padGain.gain.setValueAtTime(0, t);
  }
  ECAudio.Browse.applyPinnedMarkerLevel(marker.voice, marker);
}

function updateMarker(id, patch) {
  var marker = findMarker(id);
  if (!marker) return;
  if (patch.step != null) marker.step = patch.step;
  if (patch.normX != null) {
    marker.normX = patch.normX;
    if (marker.envId && ECAudio.BeatKaoss && ECAudio.BeatKaoss.beatPhaseFromX) {
      marker.beatPhase = ECAudio.BeatKaoss.beatPhaseFromX(marker.normX);
      marker.step = Math.max(0, Math.min(beatStepCount() - 1, Math.round(marker.beatPhase)));
      if (patch.toneNorm == null) marker.toneNorm = marker.normX;
    } else if (ECAudio.Theory.stepFromNormX) {
      marker.step = ECAudio.Theory.stepFromNormX(patch.normX);
    }
  }
  if (patch.toneNorm != null) marker.toneNorm = patch.toneNorm;
  if (patch.normY != null) marker.normY = patch.normY;
  syncMarkerStep(marker);
  if (patch.sizeNorm != null) marker.sizeNorm = patch.sizeNorm;
  if (patch.params != null) marker.params = patch.params;
  if (patch.levelMul != null) marker.levelMul = patch.levelMul;
  if (patch.normZ != null) marker.normZ = Math.max(0, Math.min(1, patch.normZ));
  if (patch.role != null) marker.role = normalizeRole(patch.role);
  if (patch.density != null) marker.density = normalizeMarkerDensity(patch.density);
  if (patch.gravityMode != null) marker.gravityMode = patch.gravityMode;
  if (patch.gravityDensity != null) {
    marker.gravityDensity = Math.max(0, Math.min(100, patch.gravityDensity));
  }
  persistMarkerData(marker);
  if (patch.density != null && marker.voice && ECAudio.Browse && ECAudio.Browse.armPinnedArp) {
    ECAudio.Browse.armPinnedArp(marker);
  }
  if (marker.el) {
    applyMarkerSize(marker.el, marker.sizeNorm);
    applyMarkerVisual(marker);
    syncMarkerElPosition(marker);
    syncMarkerLabel(marker);
    if (marker.step != null) marker.el.dataset.step = String(marker.step);
  }
  ECAudio.Browse.rebalancePinnedVoices();
  refreshMarkerVoice(marker);
  syncMarkerEditor();
  syncLayerPreview(marker);
  if (patch.normX != null || patch.normY != null || patch.normZ != null ||
      patch.gravityMode != null || patch.gravityDensity != null) {
    if (ECAudio.BeatBonds && ECAudio.BeatBonds.schedule) ECAudio.BeatBonds.schedule();
    if (ECAudio.BeatView3d && ECAudio.BeatView3d.schedule) ECAudio.BeatView3d.schedule();
    if (ECAudio.BeatSeq && ECAudio.BeatSeq.refreshAllPatterns) {
      ECAudio.BeatSeq.refreshAllPatterns();
    }
  }
  if (ECAudio.BeatSeq && ECAudio.BeatSeq.syncGravityUI && _layerSettingsOpen === id) {
    ECAudio.BeatSeq.syncGravityUI(marker);
  }
  if ((patch.normX != null || patch.normY != null || patch.normZ != null) &&
      ECAudio.BeatInfluence && ECAudio.BeatInfluence.syncUI && _layerSettingsOpen === id) {
    ECAudio.BeatInfluence.syncUI(marker);
  }
}

function fillMarkerEditorFields(sel) {
  var panel = document.getElementById('studio-panel');
  if (panel) panel.classList.toggle('sl-no-dot-selected', !sel);
  if (!sel) {
    var env = ECAudio.Environments && ECAudio.Environments.getActive
      ? ECAudio.Environments.getActive() : null;
    var titleEl = document.getElementById('sl-layer-title');
    var noteEl = document.getElementById('sl-loop-note');
    if (titleEl) titleEl.textContent = '—';
    if (noteEl) {
      var overview = ECAudio.Environments && ECAudio.Environments.isOverview
        ? ECAudio.Environments.isOverview() : false;
      if (overview) {
        noteEl.textContent = 'Layer 0 — tap any dot to edit its layer · hold empty pad to place';
      } else {
        var hint = env && env.yHint ? env.yHint.label + ' register' : '';
        noteEl.textContent = env
          ? ('Hold pad to add ' + env.label + ' hits' + (hint ? ' · ' + hint : ''))
          : '—';
      }
    }
    syncDotPanelMode(null);
    if (ECAudio.BeatSeq && ECAudio.BeatSeq.syncGravityUI) ECAudio.BeatSeq.syncGravityUI(null);
    if (ECAudio.BeatInfluence && ECAudio.BeatInfluence.syncUI) ECAudio.BeatInfluence.syncUI(null);
    var mapHintEmpty = document.getElementById('sl-spatial-map-hint');
    if (mapHintEmpty) {
      mapHintEmpty.textContent =
        'Y = pentatonic pitch per layer · X = beat step · Z = presence + coupling strength';
    }
    return;
  }
  var titleEl = document.getElementById('sl-layer-title');
  var noteEl = document.getElementById('sl-loop-note');
  var stepEl = document.getElementById('sl-loop-step');
  var stepVal = document.getElementById('sl-loop-step-val');
  var size = document.getElementById('sl-loop-size');
  var level = document.getElementById('sl-loop-level');
  var levelVal = document.getElementById('sl-loop-level-val');
  var sizeVal = document.getElementById('sl-loop-size-val');
  var summary = loopNoteLabel(sel);

  if (titleEl) {
    titleEl.textContent = envLabel(sel) + ' · dot ' + markerDisplayName(sel);
  }
  syncDotPanelMode(sel);
  if (noteEl) noteEl.textContent = summary;
  syncMarkerStep(sel);
  var d = String(normalizeMarkerDensity(markerDensity(sel)));
  document.querySelectorAll('[data-loop-density] .sp-seg-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-val') === d);
  });
  if (stepEl && document.activeElement !== stepEl) stepEl.value = String(sel.step);
  if (stepVal) stepVal.textContent = String((sel.step | 0) + 1);
  if (size && document.activeElement !== size) size.value = String(sel.sizeNorm);
  if (sizeVal) sizeVal.textContent = Math.round((sel.sizeNorm != null ? sel.sizeNorm : 0.35) * 100) + '%';
  if (level && document.activeElement !== level) level.value = String(sel.levelMul != null ? sel.levelMul : 1);
  if (levelVal) levelVal.textContent = Math.round((sel.levelMul != null ? sel.levelMul : 1) * 100) + '%';
  var presence = document.getElementById('sl-loop-presence');
  var presenceVal = document.getElementById('sl-loop-presence-val');
  if (presence && document.activeElement !== presence) {
    presence.value = String(markerNormZ(sel));
  }
  if (presenceVal) presenceVal.textContent = Math.round(markerNormZ(sel) * 100) + '%';

  if (typeof slSyncMarkerPad === 'function') slSyncMarkerPad(sel);
  if (ECAudio.BeatSeq && ECAudio.BeatSeq.syncGravityUI) ECAudio.BeatSeq.syncGravityUI(sel);
  if (ECAudio.BeatInfluence && ECAudio.BeatInfluence.syncUI) ECAudio.BeatInfluence.syncUI(sel);
  var mapHint = document.getElementById('sl-spatial-map-hint');
  if (mapHint) {
    var row = ECAudio.Theory && ECAudio.Theory.markerPitchRow
      ? ECAudio.Theory.markerPitchRow(sel) : (sel.rowIndex | 0);
    var note = ECAudio.BeatKaoss && ECAudio.BeatKaoss.noteLabel
      ? ECAudio.BeatKaoss.noteLabel(row, sel.normY) : '';
    mapHint.textContent = note
      ? ('Playing ' + note + ' · step ' + ((sel.step | 0) + 1) + '/16 · presence ' +
        Math.round(markerNormZ(sel) * 100) + '% — auto-snaps to scale & nearby spheres')
      : ('Y = pentatonic pitch per layer · X = beat step · Z = presence + coupling strength');
  }
  syncLayerPreview(sel);
  syncInstructions();
}

function syncLayerPreview(marker) {
  var dot = document.getElementById('sl-preview-dot');
  if (!dot) return;
  if (!marker) {
    dot.className = 'sl-preview-dot is-empty';
    dot.style.width = '';
    dot.style.height = '';
    dot.style.transform = '';
    return;
  }
  var px = sizePxFromNorm(marker.sizeNorm != null ? marker.sizeNorm : 0.35);
  var maxPx = 72;
  var scale = Math.min(1, maxPx / Math.max(px, 14));
  var showPx = Math.max(14, px * scale);
  var density = String(normalizeMarkerDensity(markerDensity(marker)));
  dot.className = 'sl-preview-dot viz-density-' + density;
  dot.style.width = showPx + 'px';
  dot.style.height = showPx + 'px';
  if (marker.el) {
    dot.style.setProperty('--dot-hue', marker.el.style.getPropertyValue('--dot-hue') || '210');
    dot.style.setProperty('--dot-sat', marker.el.style.getPropertyValue('--dot-sat') || '48%');
    dot.style.setProperty('--dot-light', marker.el.style.getPropertyValue('--dot-light') || '48%');
    dot.style.setProperty('--dot-alpha', marker.el.style.getPropertyValue('--dot-alpha') || '1');
    dot.style.setProperty('--dot-border-w', marker.el.style.getPropertyValue('--dot-border-w') || '2px');
  }
}

function syncInstructions() {
  var el = document.getElementById('sl-instructions');
  if (!el) return;
  var n = (ECAudio.State.markers || []).length;
  var sel = _layerSettingsOpen ? findMarker(_layerSettingsOpen) : null;
  if (sel) {
    el.innerHTML = '<p class="sl-instr-title">' + envLabel(sel) + ' · dot ' + markerDisplayName(sel) + '</p>' +
      '<p class="sl-instr-body">' + loopNoteLabel(sel) + '</p>' +
      '<p class="sl-instr-hint">Knobs tune the whole <strong>' + envLabel(sel) +
      '</strong> layer. Tap again to cycle dots · <kbd>Delete</kbd> removes.</p>';
    return;
  }
  var env = ECAudio.Environments && ECAudio.Environments.getActive
    ? ECAudio.Environments.getActive() : null;
  var overview = ECAudio.Environments && ECAudio.Environments.isOverview
    ? ECAudio.Environments.isOverview() : false;
  if (!n) {
    el.innerHTML = '<p class="sl-instr-title">Layer 0 — beat space</p>' +
      '<p class="sl-instr-body">All layers visible. <strong>Tap a dot</strong> to open its environment · <strong>tap empty pad</strong> returns here.</p>' +
      '<p class="sl-instr-hint">Hold pad to place a hit · ↔ micro-timing · ↕ pitch & tone</p>';
    return;
  }
  el.innerHTML = '<p class="sl-instr-title">' + n + ' dot' + (n === 1 ? '' : 's') +
    (overview ? ' · layer 0' : (env ? ' · ' + env.label + ' active' : '')) + '</p>' +
    '<p class="sl-instr-body">' + (overview
      ? 'Every dot is selectable. Lines link dots on the same beat or consonant pitch.'
      : 'Drag ↔ move beat · ↕ change note/tone. Bonds show ties to nearby layers.') + '</p>' +
    '<p class="sl-instr-hint">' + (overview
      ? '<strong>Tap dot</strong> = open layer · dashed = same beat · solid = harmony · scroll dot = presence (Z)'
      : '<strong>Tap dot</strong> = select · scroll = presence · stronger dots pull harder') + '</p>';
}

function syncMarkerEditor() {
  var list = document.getElementById('sl-loop-list');
  var layerBlock = document.getElementById('sl-block-layer');
  var empty = document.getElementById('sl-layer-empty');
  var markers = ECAudio.State.markers || [];
  if (!layerBlock) return;

  syncInstructions();

  if (!markers.length) {
    if (list) { list.hidden = true; list.innerHTML = ''; }
    var studioActive = isBeatStudioActive();
    layerBlock.hidden = !studioActive;
    if (empty) empty.hidden = studioActive;
    if (studioActive) {
      syncDotPanelMode(null);
      fillMarkerEditorFields(null);
    } else {
      syncLayerPreview(null);
    }
    clearDotSolo();
    _layerSettingsOpen = null;
    _selectedId = null;
    document.querySelectorAll('.sound-marker').forEach(function(el) {
      el.classList.remove('is-selected', 'is-soloed', 'is-solo-muted');
    });
    if (typeof slClearMarkerTarget === 'function') slClearMarkerTarget();
    if (typeof syncSoundPanelUI === 'function') syncSoundPanelUI();
    return;
  }

  if (list) {
    list.hidden = markers.length < 2;
    list.innerHTML = '';
    markers.forEach(function(m) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sl-loop-item' + (m.id === _layerSettingsOpen ? ' active' : '');
      btn.dataset.markerId = m.id;
      btn.textContent = 'Dot ' + markerDisplayName(m);
      btn.addEventListener('click', function() { selectDot(m.id); });
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  var sel = _layerSettingsOpen ? findMarker(_layerSettingsOpen) : null;
  layerBlock.hidden = !sel;
  if (empty) empty.hidden = !!sel;
  if (!sel && typeof slClearMarkerTarget === 'function') slClearMarkerTarget();
  if (sel) {
    fillMarkerEditorFields(sel);
    if (sel.presetId && ECAudio.syncPresetUI) ECAudio.syncPresetUI(sel.presetId, sel);
  }
  if (typeof syncSoundPanelUI === 'function') syncSoundPanelUI();
}

function syncLoopEditor() {
  syncMarkerEditor();
}

function markerStepFromX(normX) {
  return ECAudio.Theory && ECAudio.Theory.stepFromNormX
    ? ECAudio.Theory.stepFromNormX(normX) : 0;
}

function tooClose(zone, normX, normY, laneIndex, envId, excludeId) {
  var snapY = normY;
  if (zone && zone.classList && zone.classList.contains('beat-pad')) {
    var step = markerStepFromX(normX);
    return (ECAudio.State.markers || []).some(function(m) {
      if (excludeId && m.id === excludeId) return false;
      if (envId && m.envId !== envId) return false;
      var ms = m.step != null ? m.step : markerStepFromX(m.normX);
      if (ms !== step) return false;
      return Math.abs(m.normY - normY) < 0.035;
    });
  }
  var step = markerStepFromX(normX);
  snapY = snapNormY(
    zone && zone.closest('.cv-section') ? canonicalSectionId(zone.closest('.cv-section').id) : '',
    normY
  );
  return (ECAudio.State.markers || []).some(function(m) {
    if (m.zone !== zone && laneIndex != null && markerLaneIndex(m) !== laneIndex) return false;
    var ms = m.step != null ? m.step : markerStepFromX(m.normX);
    if (ms !== step) return false;
    var my = snapNormY(m.secId, m.normY);
    return Math.abs(my - snapY) < 0.12;
  });
}

function resolveMarkerPos(zone, normX, normY, laneIndex, envId) {
  if (zone && zone.classList && zone.classList.contains('beat-pad') &&
      ECAudio.BeatKaoss && ECAudio.BeatKaoss.mapPlacement) {
    var mapped = ECAudio.BeatKaoss.mapPlacement(normX, normY, envId, null);
    var i;
    for (i = 0; i < 6 && tooClose(zone, mapped.normX, mapped.normY, laneIndex, envId); i++) {
      mapped.normX = Math.min(0.96, mapped.normX + 0.024);
      mapped = ECAudio.BeatKaoss.mapPlacement(mapped.normX, mapped.normY, envId, null);
    }
    return {
      x: mapped.normX,
      y: mapped.normY,
      step: mapped.step,
      beatPhase: mapped.beatPhase,
      toneNorm: mapped.toneNorm
    };
  }
  var step = markerStepFromX(normX);
  var x = ECAudio.Theory.normXFromStep ? ECAudio.Theory.normXFromStep(step) : normX;
  var y = normY;
  var i;
  if (zone && zone.tagName === 'TR') {
    for (i = 0; i < beatStepCount() && tooClose(zone, x, y, laneIndex); i++) {
      step = (step + 1) % beatStepCount();
      x = ECAudio.Theory.normXFromStep(step);
    }
    return { x: x, y: y, step: step };
  }
  for (i = 0; i < 8 && tooClose(zone, x, y); i++) {
    x = Math.min(0.94, x + 0.038);
    y = Math.max(0.06, y - 0.022);
  }
  return { x: x, y: y, step: step };
}

function beatStepCount() {
  return ECAudio.Theory && ECAudio.Theory.beatStepCount
    ? ECAudio.Theory.beatStepCount() : 16;
}

function sizeNormFromHold(holdMs) {
  var linear = Math.max(0, Math.min(1, (holdMs - HOLD_MIN_MS) / (HOLD_MAX_MS - HOLD_MIN_MS)));
  return Math.pow(linear, 0.42);
}

function sizePxFromNorm(sizeNorm) {
  return SIZE_MIN + (SIZE_MAX - SIZE_MIN) * Math.max(0, Math.min(1, sizeNorm));
}

function saveMarkerStore() {
  try {
    sessionStorage.setItem(MARKER_STORE_KEY, JSON.stringify(ECAudio.State.markerData || []));
  } catch (e) { /* ignore */ }
}

function loadMarkerStore() {
  try {
    var raw = sessionStorage.getItem(MARKER_STORE_KEY);
    if (!raw) return;
    var data = JSON.parse(raw);
    if (Array.isArray(data)) {
      ECAudio.State.markerData = data.map(migrateMarkerStoreEntry);
    }
  } catch (e) { /* ignore */ }
}

function ensureMarkerLayer(zone) {
  if (!zone) return null;
  if (zone.classList && (zone.classList.contains('beat-lane') ||
      zone.classList.contains('beat-pad')) && ECAudio.BeatStudio) {
    return ECAudio.BeatStudio.overlayForLane(zone);
  }
  if (zone.tagName === 'TR') {
    return ECAudio.Zones && ECAudio.Zones.overlayForRow
      ? ECAudio.Zones.overlayForRow(zone)
      : null;
  }
  var layer = zone.querySelector('.marker-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'marker-layer';
    layer.setAttribute('aria-hidden', 'true');
    zone.appendChild(layer);
  }
  return layer;
}

function syncMarkerElPosition(marker) {
  if (!marker || !marker.el || !marker.zone) return;
  if (marker.zone.classList && (marker.zone.classList.contains('beat-lane') ||
      marker.zone.classList.contains('beat-pad')) && ECAudio.BeatStudio) {
    var bpt = ECAudio.BeatStudio.padOverlayPoint
      ? ECAudio.BeatStudio.padOverlayPoint(marker.normX, marker.normY)
      : ECAudio.BeatStudio.laneOverlayPoint(marker.zone, marker.normX, marker.normY);
    if (!bpt) return;
    marker.el.style.left = bpt.left + 'px';
    marker.el.style.top = bpt.top + 'px';
    return;
  }
  if (marker.zone.tagName === 'TR' && ECAudio.Zones && ECAudio.Zones.rowOverlayPoint) {
    var pt = ECAudio.Zones.rowOverlayPoint(marker.zone, marker.normX, marker.normY);
    if (!pt) return;
    marker.el.style.left = pt.left + 'px';
    marker.el.style.top = pt.top + 'px';
    return;
  }
  marker.el.style.left = (marker.normX * 100) + '%';
  marker.el.style.top = (marker.normY * 100) + '%';
}

function refreshAllMarkerVisuals() {
  (ECAudio.State.markers || []).forEach(function(m) {
    if (m && m.el) applyMarkerVisual(m);
  });
}

function syncMarkerPresence(marker) {
  if (!marker) return;
  if (marker.el) {
    applyMarkerVisual(marker);
    syncMarkerLabel(marker);
  }
  if (_layerSettingsOpen === marker.id) {
    var presence = document.getElementById('sl-loop-presence');
    var presenceVal = document.getElementById('sl-loop-presence-val');
    var z = markerNormZ(marker);
    if (presence && document.activeElement !== presence) presence.value = String(z);
    if (presenceVal) presenceVal.textContent = Math.round(z * 100) + '%';
  }
}

function syncAllMarkerPositions() {
  (ECAudio.State.markers || []).forEach(function(m) {
    syncMarkerElPosition(m);
    syncMarkerPresence(m);
  });
  if (ECAudio.BeatBonds && ECAudio.BeatBonds.schedule) ECAudio.BeatBonds.schedule();
  if (ECAudio.BeatView3d && ECAudio.BeatView3d.schedule) ECAudio.BeatView3d.schedule();
}

function ensureBeatSectionsVisible() {
  var sections = document.querySelectorAll('#cv-sections .cv-section');
  var visible = 0;
  var i;
  for (i = 0; i < sections.length; i++) {
    if (!sections[i].classList.contains('sec-hidden')) visible++;
  }
  if (visible > 0 || !sections.length) return;
  sections[0].classList.remove('sec-hidden');
  var btn = sections[0].querySelector('.sec-toggle');
  if (btn) btn.textContent = 'Hide';
}

function expandSectionsForMarkerData(list) {
  var seen = {};
  (list || []).forEach(function(d) {
    var secId = canonicalSectionId(d.secId);
    if (!secId || seen[secId]) return;
    seen[secId] = true;
    var sec = document.getElementById(secId) || document.getElementById(d.secId);
    if (!sec || !sec.classList.contains('sec-hidden')) return;
    sec.classList.remove('sec-hidden');
    var btn = sec.querySelector('.sec-toggle');
    if (btn) btn.textContent = 'Hide';
    try {
      var state = JSON.parse(localStorage.getItem('ec-hidden') || '{}');
      if (state[secId]) {
        delete state[secId];
        localStorage.setItem('ec-hidden', JSON.stringify(state));
      }
    } catch (e) { /* ignore */ }
  });
}

function scheduleMarkerRelayout() {
  function sync() { syncAllMarkerPositions(); }
  requestAnimationFrame(function() { requestAnimationFrame(sync); });
  setTimeout(sync, 100);
  setTimeout(sync, 500);
  setTimeout(sync, 950);
}

function snapNormY(secId, normY) {
  if (typeof ECAudio.Theory.zoneSnapY === 'function') {
    return ECAudio.Theory.zoneSnapY(secId, normY);
  }
  return normY;
}

function applyMarkerSize(el, sizeNorm) {
  if (!el) return;
  var s = Math.max(0, Math.min(1, sizeNorm != null ? sizeNorm : 0.35));
  var px = sizePxFromNorm(s);
  var border = 2 + s * 6;
  el.style.width = px + 'px';
  el.style.height = px + 'px';
  el.dataset.size = String(Math.round(s * 100));
  el.style.setProperty('--marker-glow', String(s));
  el.style.setProperty('--marker-border', border + 'px');
}

function renderMarkerEl(marker) {
  if (!marker.zone || !marker.zone.isConnected) return;
  var layer = ensureMarkerLayer(marker.zone);
  if (!layer) return;
  if (marker.el && marker.el.parentNode) marker.el.remove();
  var el = document.createElement('button');
  el.className = 'sound-marker';
  el.type = 'button';
  el.dataset.markerId = marker.id;
  el.setAttribute('aria-label', envLabel(marker) + ' dot ' + markerDisplayName(marker) +
    ' — drag time and pitch, tap to cycle, delete to remove');
  if (marker.id === _selectedId) el.classList.add('is-selected');
  applyMarkerSize(el, marker.sizeNorm != null ? marker.sizeNorm : 0.35);
  syncMarkerStep(marker);
  el.dataset.step = String(marker.step);
  var chip = document.createElement('span');
  chip.className = 'sound-marker-chip';
  chip.innerHTML =
    '<span class="sound-marker-role"></span>' +
    '<span class="sound-marker-meta"></span>' +
    '<span class="sound-marker-note"></span>';
  el.appendChild(chip);
  marker.el = el;
  applyMarkerVisual(marker);
  syncMarkerLabel(marker);
  el.addEventListener('wheel', function(e) {
    if (soundEnabled) return;
    e.preventDefault();
    var mk = findMarker(el.dataset.markerId);
    if (!mk) return;
    if (isBeatStudioActive()) {
      adjustMarkerPresence(mk.id, e.deltaY > 0 ? -1 : 1);
      return;
    }
    if (markerIsPercussion(mk)) return;
    cycleMarkerDensity(mk.id, e.deltaY > 0 ? 1 : -1);
  }, { passive: false });
  layer.appendChild(el);
  syncMarkerElPosition(marker);
  refreshMarkerCount();
}

function beatTransportEl() {
  return document.getElementById('beat-transport');
}

function refreshBeatRulerMeta() {
  var meta = document.querySelector('#beat-transport .beat-ruler-meta');
  if (!meta) return;
  var steps = ECAudio.LOOP_BEAT_STEPS || 16;
  var bpm = ECAudio.params.bpm || 92;
  var n = (ECAudio.State.markers || []).length;
  var layerCount = ECAudio.MarkerDrums && ECAudio.MarkerDrums.BEAT_LAYER_COUNT
    ? ECAudio.MarkerDrums.BEAT_LAYER_COUNT : 6;
  var grooveDots = 0;
  (ECAudio.State.markers || []).forEach(function(m) {
    if (!ECAudio.BeatSeq || !ECAudio.BeatSeq.patternForMarker) return;
    var info = ECAudio.BeatSeq.patternForMarker(m);
    if (info && info.hits > 1) grooveDots++;
  });
  var seqNote = grooveDots ? ' · ' + grooveDots + ' groove' : '';
  meta.textContent = bpm + ' bpm · ' + steps + ' steps · ' + layerCount +
    ' layers (Kick · Hat · Bass · Clap · Lead · Soft)' +
    (n ? ' · ' + n + ' hit' + (n === 1 ? '' : 's') : '') + seqNote;
}

function buildBeatRuler(transport) {
  if (!transport || transport.querySelector('.beat-ruler')) return;
  var steps = ECAudio.LOOP_BEAT_STEPS || 16;
  var ruler = document.createElement('div');
  ruler.className = 'beat-ruler';
  var meta = document.createElement('span');
  meta.className = 'beat-ruler-meta';
  ruler.appendChild(meta);
  var grid = document.createElement('div');
  grid.className = 'beat-ruler-grid';
  var i;
  for (i = 0; i < steps; i++) {
    var tick = document.createElement('span');
    tick.className = 'beat-ruler-step';
    if (i % 4 === 0) tick.classList.add('is-downbeat');
    tick.dataset.step = String(i);
    grid.appendChild(tick);
  }
  ruler.appendChild(grid);
  transport.appendChild(ruler);
  refreshBeatRulerMeta();
}

function mountBeatTransport(active) {
  var transport = beatTransportEl();
  var host = document.querySelector('#beat-studio .beat-studio-inner');
  if (!transport || !host) return;
  if (active && transport.parentNode !== host) {
    host.insertBefore(transport, host.firstChild);
  }
}

function syncBeatRulers(active) {
  var transport = beatTransportEl();
  if (!transport) return;
  if (!active) {
    mountBeatTransport(false);
    transport.hidden = true;
    transport.setAttribute('aria-hidden', 'true');
    transport.innerHTML = '';
    updateBeatRuler(-1);
    return;
  }
  mountBeatTransport(true);
  transport.hidden = false;
  transport.setAttribute('aria-hidden', 'false');
  buildBeatRuler(transport);
  refreshBeatRulerMeta();
}

var BEAT_HIT_ROLES = ['kick', 'chord', 'lead', 'hat'];

function clearBeatRulerStep(el) {
  el.classList.remove('is-active', 'is-pulse', 'is-hit');
  BEAT_HIT_ROLES.forEach(function(role) {
    el.classList.remove('hit-' + role);
  });
  el.style.background = '';
  el.style.boxShadow = '';
}

function beatRulerHitStyle(roles) {
  if (!roles || !roles.length) return { background: '', boxShadow: '' };
  if (roles.length === 1) {
    var one = roles[0];
    return {
      background: 'var(--role-' + one + ')',
      boxShadow: '0 1px 14px color-mix(in srgb, var(--role-' + one + ') 55%, transparent)'
    };
  }
  var parts = roles.map(function(role, i) {
    var a = (i / roles.length) * 100;
    var b = ((i + 1) / roles.length) * 100;
    return 'var(--role-' + role + ') ' + a + '% ' + b + '%';
  });
  return {
    background: 'linear-gradient(90deg, ' + parts.join(', ') + ')',
    boxShadow: '0 1px 12px color-mix(in srgb, var(--role-' + roles[0] + ') 40%, transparent)'
  };
}

function updateBeatRuler(step, hitRoles) {
  hitRoles = hitRoles || [];
  document.querySelectorAll('.beat-ruler-step').forEach(function(el) {
    clearBeatRulerStep(el);
    if (step < 0) return;
    var s = parseInt(el.dataset.step, 10);
    if (s !== step) return;
    el.classList.add('is-active');
    if (hitRoles.length) {
      var style = beatRulerHitStyle(hitRoles);
      el.classList.add('is-hit');
      hitRoles.forEach(function(role) {
        el.classList.add('hit-' + role);
      });
      el.style.background = style.background;
      el.style.boxShadow = style.boxShadow;
      el.classList.add('is-pulse');
    }
  });
  if (step >= 0) {
    requestAnimationFrame(function() {
      document.querySelectorAll('.beat-ruler-step.is-pulse').forEach(function(el) {
        el.classList.remove('is-pulse');
      });
    });
  }
}

function isPanelOpen() {
  var lab = document.getElementById('studio-panel');
  return !!(lab && lab.classList.contains('open'));
}

function isBeatStudioActive() {
  return ECAudio.BeatStudio && ECAudio.BeatStudio.isActive && ECAudio.BeatStudio.isActive();
}

function onBeatStudioChange(active) {
  if (active && ECAudio.BeatStudio && ECAudio.BeatStudio.init) ECAudio.BeatStudio.init();
  syncBeatOverlayMode();
}

function parkComposition() {
  if ((ECAudio.State.markers || []).length) syncMarkerDataFromLive();
  (ECAudio.State.markers || []).forEach(function(m) {
    if (m.voice && ECAudio.Browse && ECAudio.Browse.stopPinnedVoice) {
      ECAudio.Browse.stopPinnedVoice(m.voice);
    }
    m.voice = null;
    if (m.el && m.el.parentNode) m.el.remove();
    m.el = null;
  });
  document.querySelectorAll('.sound-marker').forEach(function(el) {
    el.remove();
  });
  if (ECAudio.Browse && ECAudio.Browse.stopLoopTransport) ECAudio.Browse.stopLoopTransport();
  if (ECAudio.Browse && ECAudio.Browse.hardZoneLeave) ECAudio.Browse.hardZoneLeave();
}

function unparkComposition() {
  loadMarkerStore();
  var saved = (ECAudio.State.markerData || []).map(migrateMarkerStoreEntry);
  var live = ECAudio.State.markers || [];
  if (!live.length && saved.length) {
    restoreMarkers();
    return;
  }
  if (!live.length) return;

  var pad = ECAudio.BeatStudio && ECAudio.BeatStudio.padZone
    ? ECAudio.BeatStudio.padZone() : null;
  var beatSec = ECAudio.BEAT_STUDIO_SEC_ID || 'beat-studio';

  live.forEach(function(m, i) {
    applySavedMarkerFields(m, findSavedMarker(m, saved, i));
    if (pad && (!m.zone || !m.zone.isConnected || m.secId === beatSec)) {
      m.zone = pad;
      m.secId = beatSec;
    }
    syncMarkerStep(m);
    syncMarkerLane(m);
    if (!m.el) renderMarkerEl(m);
    else {
      applyMarkerVisual(m);
      syncMarkerLabel(m);
      syncMarkerElPosition(m);
    }
    if (!m.voice) startMarkerVoice(m);
  });

  if (pad) pad.classList.add('has-markers');
  live.forEach(function(m) {
    applyMarkerVisual(m);
    syncMarkerLabel(m);
  });
  if (ECAudio.Environments && ECAudio.Environments.syncDotVisibility) {
    ECAudio.Environments.syncDotVisibility();
  }
  syncMarkerDataFromLive();
  if (ECAudio.Browse && ECAudio.Browse.restartLoopTransport) {
    ECAudio.Browse.restartLoopTransport();
  } else if (ECAudio.Browse && ECAudio.Browse.ensureLoopTransport) {
    ECAudio.Browse.ensureLoopTransport();
  }
  refreshMarkerCount();
  syncMarkerEditor();
  if (ECAudio.BeatBonds && ECAudio.BeatBonds.schedule) ECAudio.BeatBonds.schedule();
  if (ECAudio.BeatView3d && ECAudio.BeatView3d.schedule) ECAudio.BeatView3d.schedule();
  if (ECAudio.BeatView3d && ECAudio.BeatView3d.resume) ECAudio.BeatView3d.resume();
}

function initMarkersOnLoad() {
  loadMarkerStore();
  ECAudio.State.markers = [];
  parkComposition();
  document.querySelectorAll('.influence-zone.has-markers').forEach(function(z) {
    z.classList.remove('has-markers');
  });
  refreshMarkerCount();
  syncBeatOverlayMode();
  syncMarkerEditor();
}

function syncBeatOverlayMode() {
  if (_syncingOverlay) return;
  _syncingOverlay = true;
  try {
    var active = isBeatStudioActive();
    var wasActive = document.documentElement.classList.contains('beat-studio');
    syncBeatRulers(active);
    if (active) {
      (ECAudio.State.markers || []).forEach(syncMarkerLane);
      if (ECAudio.Browse && ECAudio.Browse.hardZoneLeave) ECAudio.Browse.hardZoneLeave();
      if (ECAudio.Browse && ECAudio.Browse.enterBeatMode) ECAudio.Browse.enterBeatMode();
      unparkComposition();
      if (!wasActive && ECAudio.BeatGuide) ECAudio.BeatGuide.fire('beat_mode');
    } else {
      parkComposition();
      if (ECAudio.Browse && ECAudio.Browse.leaveBeatMode) ECAudio.Browse.leaveBeatMode();
      closeLayerSettings();
    }
    syncAllMarkerPositions();
    scheduleMarkerRelayout();
  } finally {
    _syncingOverlay = false;
  }
}

function attachMarkerToZone(marker, zone, secId, rowIndex) {
  if (!marker || !zone) return;
  var oldZone = marker.zone;
  marker.zone = zone;
  marker.secId = secId;
  marker.rowIndex = rowIndex;
  syncMarkerLane(marker);
  if (oldZone === zone) return;
  if (marker.el && marker.el.parentNode) marker.el.remove();
  marker.el = null;
  renderMarkerEl(marker);
  if (oldZone && !zoneMarkers(oldZone).length) oldZone.classList.remove('has-markers');
  zone.classList.add('has-markers');
}

function refreshMarkerCount() {
  var n = (ECAudio.State.markers || []).length;
  var badge = document.getElementById('sp-marker-count');
  if (badge) {
    if (!n) {
      badge.textContent = '';
    } else {
      var label = n + ' dot' + (n === 1 ? '' : 's');
      if (n >= SOFT_MIX_AT) label += ' · soft mix';
      badge.textContent = label;
    }
  }
  refreshBeatRulerMeta();
}

function startMarkerVoice(marker) {
  ECAudio.Engine.bootAudio();
  ECAudio.Engine.boot();
  function go() {
    marker.voice = ECAudio.Browse.createPinnedVoice(marker);
    if (marker.voice && marker.voice.arpeggio && ECAudio.Browse.armPinnedArp) {
      ECAudio.Browse.armPinnedArp(marker);
    }
    if (marker.el) marker.el.classList.add('is-playing');
  }
  if (ECAudio.State.ctx.state === 'suspended') {
    ECAudio.State.ctx.resume().then(go);
  } else {
    go();
  }
}

function addMarker(zone, secId, normX, normY, existingId, sizeNorm, rowIndex, initialRole, initialStep, initialTone, initialNormZ) {
  if (soundEnabled || !zone || !secId) return null;
  var env = ECAudio.Environments && ECAudio.Environments.placementEnv
    ? ECAudio.Environments.placementEnv()
    : (ECAudio.Environments && ECAudio.Environments.getActive
      ? ECAudio.Environments.getActive() : null);
  if (!env) return null;
  if (ECAudio.Environments && ECAudio.Environments.activate && env.type) {
    ECAudio.Environments.activate(env.type);
  }

  var pitchRow = ECAudio.Environments.pitchRowForType
    ? ECAudio.Environments.pitchRowForType(env.type) : 0;
  var pos = resolveMarkerPos(zone, normX, normY, pitchRow, env.id);
  var norm = sizeNorm != null ? sizeNorm : 0.35;
  var marker = {
    id: existingId || markerId(),
    envId: env.id,
    secId: secId,
    normX: pos.x,
    normY: pos.y,
    beatPhase: pos.beatPhase != null ? pos.beatPhase : null,
    step: initialStep != null ? initialStep : pos.step,
    toneNorm: initialTone != null ? initialTone : (pos.toneNorm != null ? pos.toneNorm : pos.x),
    density: 16,
    rowIndex: pitchRow,
    laneIndex: pitchRow,
    sizeNorm: norm,
    levelMul: 1,
    normZ: initialNormZ != null ? initialNormZ
      : (ECAudio.BeatPresence ? ECAudio.BeatPresence.DEFAULT : 0.55),
    presetId: env.type,
    pitchMul: env.pitchMul != null ? env.pitchMul : 1,
    role: normalizeRole(initialRole) || env.type,
    zone: zone,
    el: null,
    voice: null
  };
  syncMarkerStep(marker);

  if (!ECAudio.State.markers) ECAudio.State.markers = [];
  if (!ECAudio.State.markerData) ECAudio.State.markerData = [];

  ECAudio.State.markers.push(marker);
  if (!existingId) {
    syncMarkerDataFromLive();
    if (ECAudio.Browse.stopPreview) ECAudio.Browse.stopPreview();
  }
  renderMarkerEl(marker);
  ECAudio.Browse.rebalancePinnedVoices();
  startMarkerVoice(marker);
  zone.classList.add('has-markers');
  renumberMarkers(marker.id);
  selectDot(marker.id);
  if (ECAudio.BeatView3d && ECAudio.BeatView3d.schedule) ECAudio.BeatView3d.schedule();
  _placeSelectGraceUntil = Date.now() + 750;
  syncMarkerEditor();
  if (ECAudio.Browse.ensureLoopTransport) ECAudio.Browse.ensureLoopTransport();
  if (ECAudio.BeatSeq && ECAudio.BeatSeq.refreshAllPatterns) {
    ECAudio.BeatSeq.refreshAllPatterns();
  }
  if (!existingId && ECAudio.BeatSpatial && ECAudio.BeatSpatial.applyField) {
    var autoHarm = !ECAudio.BeatInfluence || !ECAudio.BeatInfluence.autoHarmonizeOn ||
      ECAudio.BeatInfluence.autoHarmonizeOn(marker);
    if (autoHarm) {
      requestAnimationFrame(function() {
        ECAudio.BeatSpatial.applyField(marker.id, { pullScale: 0.72 });
        if (ECAudio.BeatSeq && ECAudio.BeatSeq.refreshAllPatterns) {
          ECAudio.BeatSeq.refreshAllPatterns();
        }
        if (ECAudio.BeatSeq && ECAudio.BeatSeq.syncGravityUI) {
          ECAudio.BeatSeq.syncGravityUI(findMarker(marker.id));
        }
      });
    }
  }
  if (!existingId && ECAudio.BeatGuide) {
    ECAudio.BeatGuide.fire('dot_placed', { rect: marker.el ? marker.el.getBoundingClientRect() : null });
  }
  return marker;
}

function removeMarker(id) {
  var markers = ECAudio.State.markers || [];
  var idx = -1;
  var i;
  for (i = 0; i < markers.length; i++) {
    if (markers[i].id === id) { idx = i; break; }
  }
  if (idx < 0) return;

  var marker = markers[idx];
  if (marker.voice) ECAudio.Browse.stopPinnedVoice(marker.voice);
  if (marker.el && marker.el.parentNode) marker.el.remove();

  markers.splice(idx, 1);
  ECAudio.State.markerData = (ECAudio.State.markerData || []).filter(function(d) {
    return d.id !== id;
  });
  saveMarkerStore();

  if (marker.zone && !zoneMarkers(marker.zone).length) {
    marker.zone.classList.remove('has-markers');
  }
  ECAudio.Browse.rebalancePinnedVoices();
  refreshMarkerCount();
  if (_layerSettingsOpen === id) closeLayerSettings();
  renumberMarkers();
  if (!(ECAudio.State.markers || []).length && ECAudio.Browse.stopLoopTransport) {
    ECAudio.Browse.stopLoopTransport();
  }
  syncMarkerEditor();
  if (ECAudio.BeatBonds && ECAudio.BeatBonds.schedule) ECAudio.BeatBonds.schedule();
  if (ECAudio.BeatView3d && ECAudio.BeatView3d.sync) ECAudio.BeatView3d.sync();
  if (ECAudio.BeatSeq && ECAudio.BeatSeq.refreshAllPatterns) {
    ECAudio.BeatSeq.refreshAllPatterns();
  }
}

function clearAllMarkers() {
  (ECAudio.State.markers || []).slice().forEach(function(m) {
    if (m.voice) ECAudio.Browse.stopPinnedVoice(m.voice);
    if (m.el && m.el.parentNode) m.el.remove();
    if (m.zone && !zoneMarkers(m.zone).filter(function(z) { return z.id !== m.id; }).length) {
      m.zone.classList.remove('has-markers');
    }
  });
  ECAudio.State.markers = [];
  ECAudio.State.markerData = [];
  saveMarkerStore();
  document.querySelectorAll('.influence-zone.has-markers').forEach(function(z) {
    z.classList.remove('has-markers');
  });
  refreshMarkerCount();
  closeLayerSettings();
  if (ECAudio.Browse.stopLoopTransport) ECAudio.Browse.stopLoopTransport();
  syncBeatOverlayMode();
  syncMarkerEditor();
  if (ECAudio.BeatBonds && ECAudio.BeatBonds.sync) ECAudio.BeatBonds.sync();
  if (ECAudio.BeatView3d && ECAudio.BeatView3d.sync) ECAudio.BeatView3d.sync();
  if (ECAudio.BeatSeq && ECAudio.BeatSeq.refreshAllPatterns) {
    ECAudio.BeatSeq.refreshAllPatterns();
  }
}

function bumpMarkerSeq(saved) {
  saved.forEach(function(d) {
    if (!d.id || d.id.indexOf('mk-') !== 0) return;
    var n = parseInt(d.id.slice(3), 10);
    if (!isNaN(n) && n > ECAudio.State.markerSeq) ECAudio.State.markerSeq = n;
  });
}

function isPinBlocked(clientX, clientY) {
  var el = document.elementFromPoint(clientX, clientY);
  if (!el) return true;
  return !!el.closest(
    '#toolbar, #hover-panel, #studio-panel, #beat-guide, #beat-view3d, #beat-view3d-canvas, ' +
    '.beat-env-bar, .sec-toggle, .sec-head, a, .tb-btn, ' +
    'button:not(.sound-marker), input, select, textarea'
  );
}

function resolvePinTarget(clientX, clientY) {
  if (soundEnabled || isPinBlocked(clientX, clientY)) return null;
  if (!isBeatStudioActive()) return null;
  if (!ECAudio.Browse.findZoneAt || !ECAudio.Browse.zoneNorm) return null;

  var hit = ECAudio.Browse.findZoneAt(clientX, clientY);
  if (!hit || !hit.zone) return null;

  var norm = ECAudio.Browse.zoneNorm(hit.zone, clientX, clientY, hit);
  var env = ECAudio.Environments && ECAudio.Environments.placementEnv
    ? ECAudio.Environments.placementEnv()
    : (ECAudio.Environments && ECAudio.Environments.getActive
      ? ECAudio.Environments.getActive() : null);
  if (hit.zone && hit.zone.classList && hit.zone.classList.contains('beat-pad') &&
      ECAudio.BeatKaoss && ECAudio.BeatKaoss.mapPlacement && env) {
    var mapped = ECAudio.BeatKaoss.mapPlacement(norm.x, norm.y, env.id, null);
    norm.x = mapped.normX;
    norm.y = mapped.normY;
  } else if (ECAudio.Theory && ECAudio.Theory.padSnapRowNormY) {
    norm.y = ECAudio.Theory.padSnapRowNormY(norm.y);
    if (ECAudio.Theory.stepFromNormX && ECAudio.Theory.normXFromStep) {
      var st = ECAudio.Theory.stepFromNormX(norm.x);
      norm.x = ECAudio.Theory.normXFromStep(st);
    }
  }
  var lane = hit.laneIndex != null ? hit.laneIndex : hit.rowIndex;
  return {
    zone: hit.zone,
    secId: hit.secId || ECAudio.BEAT_STUDIO_SEC_ID,
    normX: norm.x,
    normY: norm.y,
    rowIndex: hit.rowIndex,
    laneIndex: lane
  };
}

function stopPreviewGrow() {
  if (_press && _press.growId) {
    cancelAnimationFrame(_press.growId);
    _press.growId = null;
  }
}

function clearPressPreviewFor(press) {
  if (!press) return;
  if (press.growId) {
    cancelAnimationFrame(press.growId);
    press.growId = null;
  }
  if (press.preview && press.preview.parentNode) press.preview.remove();
  press.preview = null;
}

function clearPressPreview() {
  clearPressPreviewFor(_press);
}

function tickPreviewGrow() {
  if (!_press || _press.mode !== 'pin') return;
  var hold = Date.now() - _press.t;
  updatePressPreview(sizeNormFromHold(hold));
  if (hold < HOLD_MAX_MS + 40) {
    _press.growId = requestAnimationFrame(tickPreviewGrow);
  }
}

function positionPreviewEl(preview, target) {
  if (!preview || !target || !target.zone) return;
  if (target.zone.classList && (target.zone.classList.contains('beat-lane') ||
      target.zone.classList.contains('beat-pad')) && ECAudio.BeatStudio) {
    var bpt = ECAudio.BeatStudio.padOverlayPoint
      ? ECAudio.BeatStudio.padOverlayPoint(target.normX, target.normY)
      : ECAudio.BeatStudio.laneOverlayPoint(target.zone, target.normX, target.normY);
    if (!bpt) return;
    preview.style.left = bpt.left + 'px';
    preview.style.top = bpt.top + 'px';
    return;
  }
  if (target.zone.tagName === 'TR' && ECAudio.Zones && ECAudio.Zones.rowOverlayPoint) {
    var pt = ECAudio.Zones.rowOverlayPoint(target.zone, target.normX, target.normY);
    if (!pt) return;
    preview.style.left = pt.left + 'px';
    preview.style.top = pt.top + 'px';
    return;
  }
  preview.style.left = (target.normX * 100) + '%';
  preview.style.top = (target.normY * 100) + '%';
}

function updatePressPreview(sizeNorm) {
  if (!_press || !_press.target) return;
  var layer = ensureMarkerLayer(_press.target.zone);
  if (!layer) return;
  if (!_press.preview) {
    _press.preview = document.createElement('div');
    _press.preview.className = 'sound-marker-preview';
    layer.appendChild(_press.preview);
  }
  var previewTarget = _press.target;
  if (isBeatStudioActive() && _press.target && ECAudio.BeatMix) {
    var env = ECAudio.Environments && ECAudio.Environments.placementEnv
      ? ECAudio.Environments.placementEnv()
      : (ECAudio.Environments && ECAudio.Environments.getActive
        ? ECAudio.Environments.getActive() : null);
    if (env && ECAudio.BeatKaoss && ECAudio.BeatKaoss.mapPlacement) {
      var mapped = ECAudio.BeatKaoss.mapPlacement(
        _press.target.normX, _press.target.normY, env.id, null, { dragging: true }
      );
      previewTarget = Object.assign({}, _press.target, {
        normX: mapped.normX,
        normY: mapped.normY
      });
      if (ECAudio.BeatMix.placementWouldClash) {
        var clash = ECAudio.BeatMix.placementWouldClash(mapped, env.id, null);
        _press.preview.classList.toggle('is-clash-preview', !!clash.clash);
        _press.preview.classList.toggle('is-safe-preview', !clash.clash);
        _press.preview.classList.toggle('is-nudged-preview', !!mapped._placementDeClashed);
      }
    }
  }
  positionPreviewEl(_press.preview, previewTarget);
  applyMarkerSize(_press.preview, sizeNorm);
}

function tapDist2(ax, ay, bx, by) {
  var dx = ax - bx;
  var dy = ay - by;
  return dx * dx + dy * dy;
}

function isDoubleTapAt(clientX, clientY, now) {
  if (!_lastQuickTap) return false;
  return now - _lastQuickTap.t <= DOUBLE_MS &&
    tapDist2(clientX, clientY, _lastQuickTap.x, _lastQuickTap.y) <= DOUBLE_DIST * DOUBLE_DIST;
}

function onPointerDown(clientX, clientY, pointerId) {
  if (soundEnabled) return;

  var now = Date.now();
  var target = document.elementFromPoint(clientX, clientY);
  if (target && target.closest('#beat-view3d, #beat-view3d-canvas')) return;
  var markerEl = target && target.closest('.sound-marker');
  if (markerEl) {
    var mk = findMarker(markerEl.dataset.markerId);
    if (!mk) return;
    _press = {
      id: pointerId, x: clientX, y: clientY, t: now,
      mode: 'marker-drag', marker: mk, dragged: false, axisLocked: null,
      startStep: mk.step, startNormY: mk.normY
    };
    return;
  }

  var pin = resolvePinTarget(clientX, clientY);
  if (!pin) return;

  if (ECAudio.BeatGuide) ECAudio.BeatGuide.fire('pin_hold');
  _press = {
    id: pointerId, x: clientX, y: clientY, t: now,
    mode: 'pin', target: pin, preview: null, growId: null
  };
  updatePressPreview(sizeNormFromHold(0));
  _press.growId = requestAnimationFrame(tickPreviewGrow);
}

function dragMarkerTo(clientX, clientY) {
  var marker = _press && _press.marker;
  if (!marker || !ECAudio.Browse.findZoneAt || !ECAudio.Browse.zoneNorm) return;
  var hit = ECAudio.Browse.findZoneAt(clientX, clientY);
  if (!hit || !hit.zone) return;
  var norm = ECAudio.Browse.zoneNorm(hit.zone, clientX, clientY, hit);
  var lock = _press && _press.axisLocked;

  if (marker.envId && ECAudio.BeatKaoss && ECAudio.BeatKaoss.mapPlacement) {
    var dragMap = ECAudio.BeatKaoss.mapPlacement(
      lock === 'y' ? marker.normX : norm.x,
      lock === 'x' ? marker.normY : norm.y,
      marker.envId,
      marker.id,
      { dragging: true }
    );
    if (lock !== 'y') {
      marker.normX = dragMap.normX;
      marker.beatPhase = dragMap.beatPhase;
      marker.step = dragMap.step;
      marker.toneNorm = dragMap.toneNorm;
    }
    if (lock !== 'x') marker.normY = dragMap.normY;
  } else {
    if (lock !== 'y') {
      marker.step = markerStepFromX(norm.x);
      syncMarkerStep(marker);
      marker.toneNorm = norm.x;
    }
    if (lock !== 'x') {
      if (ECAudio.Theory && ECAudio.Theory.padSnapRowNormY) {
        marker.normY = ECAudio.Theory.padSnapRowNormY(norm.y);
      } else {
        marker.normY = norm.y;
      }
    } else if (_press.startNormY != null) {
      marker.normY = _press.startNormY;
    }
  }

  attachMarkerToZone(marker, hit.zone, hit.secId, hit.rowIndex);
  syncMarkerElPosition(marker);
  syncMarkerLabel(marker);
  refreshMarkerVoice(marker);
  persistMarkerData(marker);
  if (ECAudio.BeatBonds && ECAudio.BeatBonds.schedule) ECAudio.BeatBonds.schedule();
  if (ECAudio.BeatView3d && ECAudio.BeatView3d.schedule) ECAudio.BeatView3d.schedule();
  if (_press && !_press.axisLocked) {
    var ds = Math.abs((marker.step | 0) - (_press.startStep | 0));
    var dy = Math.abs(marker.normY - (_press.startNormY != null ? _press.startNormY : marker.normY));
    if (ds > 0 || dy > 0.04) {
      _press.axisLocked = ds >= dy ? 'x' : 'y';
      if (ECAudio.BeatGuide) {
        ECAudio.BeatGuide.fire(_press.axisLocked === 'x' ? 'drag_time' : 'drag_note', {
          rect: marker.el ? marker.el.getBoundingClientRect() : null
        });
      }
    }
  }
  if (ECAudio.BeatSeq && ECAudio.BeatSeq.invalidatePattern) {
    ECAudio.BeatSeq.invalidatePattern(marker.id);
  }
  syncMarkerEditor();
}

function finishMarkerDrag(marker) {
  if (!marker) return;
  if (marker.envId && ECAudio.BeatKaoss && ECAudio.BeatKaoss.mapPlacement) {
    var settled = ECAudio.BeatKaoss.mapPlacement(
      marker.normX, marker.normY, marker.envId, marker.id, { settle: true }
    );
    marker.normX = settled.normX;
    marker.normY = settled.normY;
    marker.beatPhase = settled.beatPhase;
    marker.step = settled.step;
    marker.toneNorm = settled.toneNorm;
  }
  syncMarkerStep(marker);
  persistMarkerData(marker);
  refreshMarkerVoice(marker);
  if (ECAudio.BeatSeq && ECAudio.BeatSeq.cancelScheduledRefresh) {
    ECAudio.BeatSeq.cancelScheduledRefresh();
  }
  if (ECAudio.BeatSeq && ECAudio.BeatSeq.refreshAllPatternsNow) {
    ECAudio.BeatSeq.refreshAllPatternsNow();
  } else if (ECAudio.BeatSeq && ECAudio.BeatSeq.refreshAllPatterns) {
    ECAudio.BeatSeq.refreshAllPatterns();
  }
  var autoHarm = !ECAudio.BeatInfluence || !ECAudio.BeatInfluence.autoHarmonizeOn ||
    ECAudio.BeatInfluence.autoHarmonizeOn(marker);
  if (autoHarm && ECAudio.BeatSpatial && ECAudio.BeatSpatial.applyField) {
    ECAudio.BeatSpatial.applyField(marker.id, { beatLock: true, pullScale: 0.55 });
  }
  if (ECAudio.BeatBonds && ECAudio.BeatBonds.schedule) ECAudio.BeatBonds.schedule();
  if (ECAudio.BeatView3d && ECAudio.BeatView3d.schedule) ECAudio.BeatView3d.schedule();
  if (ECAudio.BeatSeq && ECAudio.BeatSeq.syncGravityUI) {
    ECAudio.BeatSeq.syncGravityUI(marker);
  }
  if (ECAudio.BeatInfluence && ECAudio.BeatInfluence.syncUI) {
    ECAudio.BeatInfluence.syncUI(marker);
  }
  syncMarkerEditor();
}

function onPointerMove(clientX, clientY, pointerId) {
  if (!_press || _press.id !== pointerId) return;
  if (_press.mode === 'marker-drag') {
    var dx = clientX - _press.x;
    var dy = clientY - _press.y;
    if (dx * dx + dy * dy > DRAG_MARK_PX * DRAG_MARK_PX) {
      _press.dragged = true;
      dragMarkerTo(clientX, clientY);
    }
    return;
  }
  if (_press.mode !== 'pin') return;
  var dx = clientX - _press.x;
  var dy = clientY - _press.y;
  if (dx * dx + dy * dy > PIN_MOVE_PX * PIN_MOVE_PX) {
    stopPreviewGrow();
    clearPressPreview();
    _press = null;
    return;
  }
  var hold = Date.now() - _press.t;
  updatePressPreview(sizeNormFromHold(hold));
}

function onPointerUp(clientX, clientY, pointerId) {
  if (!_press || _press.id !== pointerId) return;

  var press = _press;
  _press = null;
  clearPressPreviewFor(press);

  if (press.mode === 'marker-drag' && press.marker) {
    if (press.dragged) {
      finishMarkerDrag(press.marker);
    } else {
      handleDotTap(press.marker.id);
    }
    return;
  }

  var now = Date.now();
  var hold = now - press.t;
  var dx = clientX - press.x;
  var dy = clientY - press.y;
  if (dx * dx + dy * dy > PIN_MOVE_PX * PIN_MOVE_PX) return;

  if (press.mode !== 'pin' || !press.target) return;

  var isQuick = hold <= QUICK_TAP_MS;

  if (isQuick) {
    if (Date.now() < _placeSelectGraceUntil) return;
    _lastQuickTap = { t: now, x: clientX, y: clientY };
    if (ECAudio.Environments && ECAudio.Environments.activateOverview) {
      ECAudio.Environments.activateOverview();
    }
    closeLayerSettings();
    return;
  }

  _lastQuickTap = null;
  var sizeNorm = sizeNormFromHold(hold);
  var normZ = ECAudio.BeatPresence && ECAudio.BeatPresence.normZFromHold
    ? ECAudio.BeatPresence.normZFromHold(hold) : 0.55;
  addMarker(
    press.target.zone, press.target.secId, press.target.normX, press.target.normY,
    null, sizeNorm, press.target.rowIndex, null, null, null, normZ
  );
}

function findRowByIndex(sec, rowIndex) {
  var rows = sec.querySelectorAll('tr.row-pad');
  if (!rows.length) return null;
  if (rowIndex == null || rowIndex < 0 || rowIndex >= rows.length) return rows[0];
  return rows[rowIndex];
}

function restoreMarkerFromData(d) {
  if (!d) return null;
  d = migrateMarkerStoreEntry(JSON.parse(JSON.stringify(d)));
  var beatSec = ECAudio.BEAT_STUDIO_SEC_ID || 'beat-studio';
  var secId = d.secId === beatSec ? beatSec : canonicalSectionId(d.secId);
  var zone = null;

  if (secId === beatSec && ECAudio.BeatStudio && ECAudio.BeatStudio.padZone) {
    zone = ECAudio.BeatStudio.padZone();
  } else {
    var sec = document.getElementById(secId) || document.getElementById(d.secId);
    if (!sec) return null;
    zone = findRowByIndex(sec, d.rowIndex);
  }
  if (!zone) return null;

  var envId = d.envId || envIdFromSaved(d);
  var presetId = d.presetId || envId.replace(/^env-/, '');
  var pitchRow = ECAudio.Environments && ECAudio.Environments.pitchRowForType
    ? ECAudio.Environments.pitchRowForType(presetId) : (d.rowIndex | 0);

  var marker = {
    id: d.id || markerId(),
    envId: envId,
    secId: secId,
    normX: d.normX != null ? d.normX : 0.5,
    normY: d.normY != null ? d.normY : 0.5,
    beatPhase: d.beatPhase,
    step: d.step,
    toneNorm: d.toneNorm != null ? d.toneNorm : d.normX,
    density: d.density != null ? normalizeMarkerDensity(d.density) : 16,
    rowIndex: d.rowIndex != null ? d.rowIndex : pitchRow,
    laneIndex: d.laneIndex != null ? d.laneIndex : pitchRow,
    sizeNorm: d.sizeNorm != null ? d.sizeNorm : 0.35,
    levelMul: d.levelMul != null ? d.levelMul : 1,
    normZ: d.normZ != null ? d.normZ : (ECAudio.BeatPresence ? ECAudio.BeatPresence.DEFAULT : 0.55),
    presetId: presetId,
    pitchMul: d.pitchMul != null ? d.pitchMul : 1,
    role: d.role || presetId,
    gravityMode: d.gravityMode || 'auto',
    gravityDensity: d.gravityDensity != null ? d.gravityDensity : 28,
    zone: zone,
    el: null,
    voice: null
  };
  syncMarkerStep(marker);
  syncMarkerLane(marker);

  if (!ECAudio.State.markers) ECAudio.State.markers = [];
  ECAudio.State.markers.push(marker);
  renderMarkerEl(marker);
  startMarkerVoice(marker);
  zone.classList.add('has-markers');
  return marker;
}

function restoreMarkers() {
  loadMarkerStore();
  var saved = (ECAudio.State.markerData || []).slice().map(migrateMarkerStoreEntry);
  bumpMarkerSeq(saved);
  (ECAudio.State.markers || []).slice().forEach(function(m) {
    if (m.voice) ECAudio.Browse.stopPinnedVoice(m.voice);
    if (m.el && m.el.parentNode) m.el.remove();
  });
  ECAudio.State.markers = [];
  if (!saved.length) {
    refreshMarkerCount();
    return;
  }
  expandSectionsForMarkerData(saved);
  saved.forEach(function(d) {
    restoreMarkerFromData(d);
  });
  ECAudio.State.markerData = saved.map(serializeMarkerData).filter(Boolean);
  saveMarkerStore();
  renumberMarkers();
  if (ECAudio.Environments && ECAudio.Environments.syncDotVisibility) {
    ECAudio.Environments.syncDotVisibility();
  }
  if (ECAudio.Browse && ECAudio.Browse.ensureLoopTransport) {
    ECAudio.Browse.ensureLoopTransport();
  }
  syncLoopEditor();
  scheduleMarkerRelayout();
}

function refreshMarkerTimbre() {
  if (!ECAudio.Browse || !ECAudio.Browse.refreshLiveBrowseAudio) return;
  ECAudio.Browse.refreshLiveBrowseAudio();
}

function restartMarkerVoice(marker) {
  if (!marker) return;
  if (marker.voice && ECAudio.Browse.stopPinnedVoice) ECAudio.Browse.stopPinnedVoice(marker.voice);
  marker.voice = null;
  if (marker.el) marker.el.classList.remove('is-playing');
  startMarkerVoice(marker);
}

function restartMarkerVoices() {
  if (ECAudio.Browse.stopLoopTransport) ECAudio.Browse.stopLoopTransport();
  (ECAudio.State.markers || []).forEach(restartMarkerVoice);
}

function applyPresetToMarker(marker, presetId) {
  if (!marker || !presetId || !ECAudio.SoundPresets) return false;
  var preset = ECAudio.SoundPresets[presetId];
  if (!preset) return false;
  var keys = ECAudio.MARKER_PRESET_KEYS || markerParamKeys();
  var mp = ensureMarkerParams(marker);
  keys.forEach(function(key) {
    if (preset[key] == null) return;
    mp[key] = preset[key];
    if (key === 'browseHarmonics') mp.browseDrive = preset[key];
  });
  marker.presetId = presetId;
  marker.pitchMul = preset.pitchMul != null ? preset.pitchMul : 1;
  if (preset.defaultDensity != null) {
    marker.density = normalizeMarkerDensity(preset.defaultDensity);
    if (marker.voice && ECAudio.Browse && ECAudio.Browse.armPinnedArp) {
      ECAudio.Browse.armPinnedArp(marker);
    }
  }
  persistMarkerData(marker);
  syncMarkerLabel(marker);
  applyMarkerVisual(marker);
  restartMarkerVoice(marker);
  syncDotPanelMode(marker);
  if (typeof syncSoundPanelUI === 'function') syncSoundPanelUI();
  if (ECAudio.syncPresetUI) ECAudio.syncPresetUI(presetId, marker);
  if (ECAudio.SoundVisual && ECAudio.SoundVisual.refreshStatic) ECAudio.SoundVisual.refreshStatic();
  return true;
}

function bindMarkerFieldPair(ids, field, parser) {
  ids.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function() {
      var sel = _layerSettingsOpen ? findMarker(_layerSettingsOpen) : null;
      if (!sel) return;
      var patch = {};
      patch[field] = parser ? parser(el.value) : parseFloat(el.value);
      updateMarker(sel.id, patch);
      fillMarkerEditorFields(getSelected());
      if (field === 'normZ' && ECAudio.BeatInfluence && ECAudio.BeatInfluence.onSettingsChanged) {
        ECAudio.BeatInfluence.onSettingsChanged();
      }
      if (ECAudio.SoundVisual && ECAudio.SoundVisual.refreshStatic) {
        ECAudio.SoundVisual.refreshStatic();
      }
    });
  });
}

function initLoopEditorPanel() {
  if (initLoopEditorPanel.bound) return;
  initLoopEditorPanel.bound = true;

  bindMarkerFieldPair(['sl-loop-size'], 'sizeNorm');
  bindMarkerFieldPair(['sl-loop-level'], 'levelMul');
  bindMarkerFieldPair(['sl-loop-presence'], 'normZ');
  bindMarkerFieldPair(['sl-gravity-density'], 'gravityDensity');

  var modeSeg = document.getElementById('sl-gravity-mode-seg');
  if (modeSeg) {
    modeSeg.querySelectorAll('.sp-seg-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var sel = _layerSettingsOpen ? findMarker(_layerSettingsOpen) : null;
        if (!sel) return;
        var mode = btn.getAttribute('data-val') || 'auto';
        updateMarker(sel.id, { gravityMode: mode });
        fillMarkerEditorFields(sel);
      });
    });
  }

  document.querySelectorAll('[data-loop-density] .sp-seg-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var sel = _layerSettingsOpen ? findMarker(_layerSettingsOpen) : null;
      if (!sel) return;
      var d = parseInt(btn.getAttribute('data-val'), 10);
      if (!d) return;
      updateMarker(sel.id, { density: d });
      fillMarkerEditorFields(sel);
    });
  });

  var stepEl = document.getElementById('sl-loop-step');
  if (stepEl) {
    stepEl.addEventListener('input', function() {
      var sel = _layerSettingsOpen ? findMarker(_layerSettingsOpen) : null;
      if (!sel) return;
      updateMarker(sel.id, { step: parseInt(stepEl.value, 10) || 0 });
      fillMarkerEditorFields(findMarker(_layerSettingsOpen));
    });
  }

  var closeLayer = document.querySelector('[data-action="close-layer"]');
  if (closeLayer) {
    closeLayer.addEventListener('click', function() {
      closeLayerSettings();
    });
  }
}

function onBeatDoubleClick(e) {
  if (soundEnabled) return;
  if (!isBeatStudioActive()) return;
  if (e.target.closest(
    '#toolbar, #hover-panel, #studio-panel, #beat-guide, .sec-toggle, .sec-head, a, .tb-btn, input, select, textarea, label'
  )) return;
  var markerEl = e.target.closest('.sound-marker');
  if (markerEl && markerEl.dataset.markerId) {
    e.preventDefault();
    e.stopPropagation();
    removeMarker(markerEl.dataset.markerId);
    if (ECAudio.BeatGuide) ECAudio.BeatGuide.fire('dblclick_remove');
    return;
  }
}

function initMarkerGestures() {
  if (initMarkerGestures.bound) return;
  initMarkerGestures.bound = true;
  document.addEventListener('dblclick', onBeatDoubleClick, true);
  initLoopEditorPanel();
}

initMarkerGestures();

ECAudio.Markers = {
  add: addMarker, remove: removeMarker, clearAll: clearAllMarkers,
  update: updateMarker, select: selectMarker, getSelected: getSelected,
  openLayerSettings: openLayerSettings, selectDot: selectDot, closeLayerSettings: closeLayerSettings,
  setDotSolo: setDotSolo, clearDotSolo: clearDotSolo, shouldPlayInMix: shouldPlayInMix, soloDotId: soloDotId,
  resolveSoloMarker: resolveSoloMarker,
  layerSettingsOpen: function() { return _layerSettingsOpen; },
  cycleRole: cycleMarkerRole, cyclePreset: cycleMarkerPreset, roleLabel: roleLabel,
  updateBeatRuler: updateBeatRuler,
  restore: restoreMarkers, initOnLoad: initMarkersOnLoad,
  syncPositions: syncAllMarkerPositions,
  syncPresence: syncMarkerPresence,
  refreshVisuals: refreshAllMarkerVisuals,
  scheduleRelayout: scheduleMarkerRelayout,
  getMarkerParam: getMarkerParam, setMarkerParam: setMarkerParam,
  ensureMarkerParams: ensureMarkerParams, defaultMarkerParams: defaultMarkerParams,
  syncInstructions: syncInstructions, syncLayerPreview: syncLayerPreview,
  syncBeatOverlay: syncBeatOverlayMode, isPanelOpen: isPanelOpen,
  isBeatStudioActive: isBeatStudioActive, onBeatStudioChange: onBeatStudioChange,
  syncLoopEditor: syncLoopEditor, syncMarkerEditor: syncMarkerEditor,
  syncMarkerDataFromLive: syncMarkerDataFromLive, refreshMarkerVoice: refreshMarkerVoice,
  markerDensity: markerDensity, formatDensity: formatDensity,
  onPointerDown: onPointerDown, onPointerMove: onPointerMove, onPointerUp: onPointerUp,
  refreshTimbre: refreshMarkerTimbre, restartVoices: restartMarkerVoices,
  restartMarkerVoice: restartMarkerVoice, applyPresetToMarker: applyPresetToMarker,
  syncMarkerLabel: syncMarkerLabel, handleDotTap: handleDotTap, envLabel: envLabel
};
