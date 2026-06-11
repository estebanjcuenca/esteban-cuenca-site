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
var SIZE_MIN = 12;
var SIZE_MAX = 44;

var _press = null;
var _lastQuickTap = null;
var _selectedId = null;
var _layerSettingsOpen = null;
var _soloDotId = null;
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

var PRESET_COLORS = {
  kick: { h: 14, s: 76, l: 46 },
  hat: { h: 192, s: 48, l: 66 },
  bass: { h: 268, s: 52, l: 42 },
  clap: { h: 38, s: 68, l: 54 },
  bright: { h: 88, s: 70, l: 52 },
  minimal: { h: 215, s: 24, l: 56 }
};

var PRESET_CLASS_IDS = ['kick', 'hat', 'bass', 'clap', 'bright', 'minimal'];

function applyMarkerVisual(marker) {
  var el = marker && marker.el;
  if (!el) return;
  var mp = ensureMarkerParams(marker);
  var density = String(normalizeMarkerDensity(markerDensity(marker)));
  var i;
  for (i = 0; i < VIZ_DENSITIES.length; i++) el.classList.remove('viz-density-' + VIZ_DENSITIES[i]);
  el.classList.add('viz-density-' + density);

  var preset = marker.presetId;
  var tone = mp.browseTone != null ? mp.browseTone : 0.58;
  var harm = mp.browseHarmonics != null ? mp.browseHarmonics : 0.5;
  var gain = mp.gain != null ? mp.gain : 0.13;
  var size = marker.sizeNorm != null ? marker.sizeNorm : 0.35;
  var level = marker.levelMul != null ? marker.levelMul : 1;
  var base = preset && PRESET_COLORS[preset]
    ? PRESET_COLORS[preset]
    : { h: Math.round(28 + tone * 90), s: Math.round(32 + harm * 38), l: 50 };

  el.style.setProperty('--dot-hue', String(base.h));
  el.style.setProperty('--dot-sat', Math.round(Math.min(88, base.s + harm * 6)) + '%');
  el.style.setProperty('--dot-light', Math.round(Math.min(72, base.l + size * 14 + (level - 1) * 10)) + '%');
  el.style.setProperty('--dot-alpha', String(Math.min(1, 0.72 + level * 0.22)));
  el.style.setProperty('--dot-border-w', String(1.5 + size * 2.2) + 'px');

  for (i = 0; i < PRESET_CLASS_IDS.length; i++) {
    el.classList.remove('preset-' + PRESET_CLASS_IDS[i]);
  }
  if (preset && PRESET_COLORS[preset]) el.classList.add('preset-' + preset);
  el.dataset.preset = preset || '';
}

function renumberMarkers() {
  var markers = ECAudio.State.markers || [];
  var prevOpen = _layerSettingsOpen;
  var prevNum = prevOpen ? (findMarker(prevOpen) || {}).num : null;
  var i;
  for (i = 0; i < markers.length; i++) {
    markers[i].num = i + 1;
    markers[i].id = 'dot-' + (i + 1);
    if (markers[i].el) {
      markers[i].el.dataset.markerId = markers[i].id;
      markers[i].el.setAttribute('aria-label', 'Dot ' + (i + 1));
    }
  }
  if (prevNum != null && prevNum <= markers.length) {
    _layerSettingsOpen = 'dot-' + prevNum;
    _selectedId = _layerSettingsOpen;
  } else if (prevOpen) {
    closeLayerSettings();
  }
  ECAudio.State.markerData = markers.map(function(m) {
    return {
      id: m.id, num: m.num, secId: m.secId, normX: m.normX, normY: m.normY,
      rowIndex: m.rowIndex, laneIndex: m.laneIndex, step: m.step,
      toneNorm: m.toneNorm, density: markerDensity(m),
      sizeNorm: m.sizeNorm, levelMul: m.levelMul, role: m.role || 'kick',
      params: m.params ? JSON.parse(JSON.stringify(m.params)) : defaultMarkerParams(),
      presetId: m.presetId || null,
      pitchMul: m.pitchMul != null ? m.pitchMul : 1
    };
  });
  saveMarkerStore();
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

function getMarkerParam(marker, key) {
  if (!marker) return ECAudio.params[key];
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
    if (markerIsSynth(marker)) {
      metaEl.textContent = 'beat ' + beatNum + ' · ' + formatDensity(density);
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
}

function openLayerSettings(id) {
  selectDot(id);
}

function closeLayerSettings() {
  clearDotSolo();
  _layerSettingsOpen = null;
  _selectedId = null;
  document.querySelectorAll('.sound-marker').forEach(function(el) {
    el.classList.remove('is-selected', 'is-soloed', 'is-solo-muted');
  });
  if (typeof slClearMarkerTarget === 'function') slClearMarkerTarget();
  syncMarkerEditor();
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

function loopNoteLabel(marker) {
  if (!marker) return '—';
  var step = marker.step != null ? marker.step : (ECAudio.Theory && ECAudio.Theory.stepFromNormX
    ? ECAudio.Theory.stepFromNormX(marker.normX) : 0);
  var lane = marker.laneIndex != null ? marker.laneIndex : marker.rowIndex;
  var laneName = ECAudio.MarkerDrums && ECAudio.MarkerDrums.laneLabel
    ? ECAudio.MarkerDrums.laneLabel(lane) : ('Lane ' + ((lane | 0) + 1));
  var line = laneName + ' · step ' + (step + 1);
  if (marker.presetId === 'bass') line += ' · ' + markerNoteShort(marker);
  else if (marker.presetId === 'bright' || marker.presetId === 'minimal') {
    line += ' · ' + markerNoteShort(marker);
  }
  return line;
}

function syncDotPanelMode(marker) {
  var lab = document.getElementById('studio-panel');
  if (!lab) return;
  var perc = markerIsPercussion(marker);
  var synth = markerIsSynth(marker);
  var hasPreset = !!(marker && marker.presetId);
  lab.classList.toggle('sl-dot-is-drum', perc);
  lab.classList.toggle('sl-dot-is-melodic', synth);
  lab.classList.toggle('sl-dot-no-preset', !hasPreset);
  lab.classList.toggle('sl-dot-step-grid', perc);
  lab.querySelectorAll('.sl-dot-melodic-only').forEach(function(el) {
    el.hidden = !synth;
  });
  lab.querySelectorAll('.sl-dot-drum-only').forEach(function(el) {
    el.hidden = !perc;
  });
}

function syncMarkerStep(marker) {
  if (!marker || !ECAudio.Theory) return;
  if (marker.step == null) {
    marker.step = ECAudio.Theory.stepFromNormX(marker.normX);
  }
  marker.normX = ECAudio.Theory.normXFromStep(marker.step);
  if (marker.toneNorm == null) marker.toneNorm = 0.5;
}

function syncMarkerLane(marker) {
  if (!marker || !marker.zone) return;
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

function cycleMarkerPreset(id) {
  var marker = findMarker(id);
  if (!marker || !ECAudio.MarkerDrums || !ECAudio.MarkerDrums.nextPresetInCycle) return;
  var lane = marker.laneIndex != null ? marker.laneIndex : marker.rowIndex;
  var next = ECAudio.MarkerDrums.nextPresetInCycle(marker.presetId, lane);
  applyPresetToMarker(marker, next);
  if (ECAudio.MarkerDrums.isPercussion && ECAudio.MarkerDrums.isPercussion(next)) {
    marker.normY = 0.5;
    syncMarkerElPosition(marker);
    persistMarkerData(marker);
  }
  selectDot(id);
  if (marker.voice && ECAudio.Browse.previewMarkerSound) {
    ECAudio.Browse.previewMarkerSound(marker);
  }
}

function selectMarker(id) {
  _selectedId = id || null;
  document.querySelectorAll('.sound-marker').forEach(function(el) {
    el.classList.toggle('is-selected', !!id && el.dataset.markerId === id && _layerSettingsOpen === id);
  });
  syncMarkerEditor();
  if (ECAudio.SoundVisual && ECAudio.SoundVisual.refreshStatic) ECAudio.SoundVisual.refreshStatic();
}

function persistMarkerData(marker) {
  var data = ECAudio.State.markerData || [];
  var i;
  for (i = 0; i < data.length; i++) {
    if (data[i].id === marker.id) {
      data[i].normX = marker.normX;
      data[i].normY = marker.normY;
      data[i].step = marker.step;
      data[i].toneNorm = marker.toneNorm;
      data[i].density = markerDensity(marker);
      data[i].sizeNorm = marker.sizeNorm;
      data[i].levelMul = marker.levelMul;
      data[i].role = marker.role;
      data[i].rowIndex = marker.rowIndex;
      data[i].laneIndex = marker.laneIndex;
      data[i].secId = marker.secId;
      if (marker.params) data[i].params = JSON.parse(JSON.stringify(marker.params));
      if (marker.presetId != null) data[i].presetId = marker.presetId;
      if (marker.pitchMul != null) data[i].pitchMul = marker.pitchMul;
      break;
    }
  }
  saveMarkerStore();
}

function refreshMarkerVoice(marker) {
  if (!marker || !marker.voice || !ECAudio.Browse || !ECAudio.State.ctx) return;
  marker.voice.secId = marker.secId;
  marker.voice.normX = marker.normX;
  marker.voice.normY = marker.normY;
  if (marker.rowIndex != null) marker.voice.rowIndex = marker.rowIndex;
  ECAudio.Browse.applyMarkerTone(marker.voice, marker);
  if (ECAudio.Theory.browsePadPitch && ECAudio.Browse.setVoicePitch) {
    var freq = ECAudio.Theory.browsePadPitch(markerLaneIndex(marker), marker.normY);
    ECAudio.Browse.setVoicePitch(marker.voice, freq, ECAudio.State.ctx.currentTime, 0.04);
  }
  ECAudio.Browse.applyPinnedMarkerLevel(marker.voice, marker);
}

function updateMarker(id, patch) {
  var marker = findMarker(id);
  if (!marker) return;
  if (patch.step != null) marker.step = patch.step;
  if (patch.normX != null) {
    marker.normX = patch.normX;
    if (ECAudio.Theory.stepFromNormX) marker.step = ECAudio.Theory.stepFromNormX(patch.normX);
  }
  if (patch.toneNorm != null) marker.toneNorm = patch.toneNorm;
  if (patch.normY != null) marker.normY = patch.normY;
  syncMarkerStep(marker);
  if (patch.sizeNorm != null) marker.sizeNorm = patch.sizeNorm;
  if (patch.params != null) marker.params = patch.params;
  if (patch.levelMul != null) marker.levelMul = patch.levelMul;
  if (patch.role != null) marker.role = normalizeRole(patch.role);
  if (patch.density != null) marker.density = normalizeMarkerDensity(patch.density);
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
}

function fillMarkerEditorFields(sel) {
  if (!sel) return;
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
    var pl = markerPresetLabel(sel);
    titleEl.textContent = pl ? ('Dot ' + markerDisplayName(sel) + ' · ' + pl) : ('Dot ' + markerDisplayName(sel));
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

  if (typeof slSyncMarkerPad === 'function') slSyncMarkerPad(sel);
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
    var pl = markerPresetLabel(sel);
    el.innerHTML = '<p class="sl-instr-title">Dot ' + markerDisplayName(sel) +
      (pl ? ' · ' + pl : '') + '</p>' +
      '<p class="sl-instr-body">' + loopNoteLabel(sel) + '</p>' +
      '<p class="sl-instr-hint">' + (pl ? '' : 'Pick an instrument in the panel. ') +
      'Hold <strong>Solo</strong> to isolate this dot.</p>';
    return;
  }
  if (!n) {
    el.innerHTML = '<p class="sl-instr-title">Loop layers</p>' +
      '<p class="sl-instr-body">Kick/Hat/Clap = drums. Bass/Lead/Soft = <strong>synth</strong> (↕ pitch, ↔ tone, scroll = pulse).</p>' +
      '<p class="sl-instr-hint"><strong>Tap dot</strong> = cycle · <strong>dbl-click</strong> = remove · drums = one step, synth = repeating pattern</p>';
    return;
  }
  el.innerHTML = '<p class="sl-instr-title">' + n + ' dot' + (n === 1 ? '' : 's') + ' placed</p>' +
    '<p class="sl-instr-body"><strong>Tap a dot</strong> on a lane to select it. Drag ↔ step · ↕ pitch on synth rows.</p>' +
    '<p class="sl-instr-hint">Use <strong>Clear all dots</strong> below to reset the loop</p>';
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
    layerBlock.hidden = true;
    if (empty) empty.hidden = false;
    syncLayerPreview(null);
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

function tooClose(zone, normX, normY, laneIndex) {
  var step = markerStepFromX(normX);
  var snapY = snapNormY(
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

function resolveMarkerPos(zone, normX, normY, laneIndex) {
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
    if (Array.isArray(data)) ECAudio.State.markerData = data;
  } catch (e) { /* ignore */ }
}

function ensureMarkerLayer(zone) {
  if (!zone) return null;
  if (zone.classList && zone.classList.contains('beat-lane') && ECAudio.BeatStudio) {
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
  if (marker.zone.classList && marker.zone.classList.contains('beat-lane') &&
      ECAudio.BeatStudio && ECAudio.BeatStudio.laneOverlayPoint) {
    var bpt = ECAudio.BeatStudio.laneOverlayPoint(marker.zone, marker.normX, marker.normY);
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

function syncAllMarkerPositions() {
  (ECAudio.State.markers || []).forEach(syncMarkerElPosition);
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
  el.setAttribute('aria-label', 'Dot ' + markerDisplayName(marker) + ' — drag step, tap cycle, double-click remove');
  if (marker.id === _selectedId) el.classList.add('is-selected');
  applyMarkerSize(el, marker.sizeNorm != null ? marker.sizeNorm : 0.35);
  applyMarkerVisual(marker);
  syncMarkerStep(marker);
  el.dataset.step = String(marker.step);
  var chip = document.createElement('span');
  chip.className = 'sound-marker-chip';
  chip.innerHTML =
    '<span class="sound-marker-role"></span>' +
    '<span class="sound-marker-meta"></span>' +
    '<span class="sound-marker-note"></span>';
  el.appendChild(chip);
  syncMarkerLabel(marker);
  el.addEventListener('wheel', function(e) {
    if (soundEnabled) return;
    e.preventDefault();
    var mk = findMarker(el.dataset.markerId);
    if (!mk || markerIsPercussion(mk)) return;
    cycleMarkerDensity(mk.id, e.deltaY > 0 ? 1 : -1);
  }, { passive: false });
  layer.appendChild(el);
  marker.el = el;
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
  meta.textContent = bpm + ' bpm · ' + steps + ' steps · ' + layerCount +
    ' layers (Kick · Hat · Bass · Clap · Lead · Soft)' +
    (n ? ' · ' + n + ' hit' + (n === 1 ? '' : 's') : '');
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
  var saved = ECAudio.State.markerData || [];
  var live = ECAudio.State.markers || [];
  if (!live.length && saved.length) {
    restoreMarkers();
    return;
  }
  live.forEach(function(m) {
    if (!m.el && m.zone && m.zone.isConnected) renderMarkerEl(m);
    if (!m.voice) startMarkerVoice(m);
  });
  if (live.length && ECAudio.Browse && ECAudio.Browse.restartLoopTransport) {
    ECAudio.Browse.restartLoopTransport();
  }
}

function initMarkersOnLoad() {
  try { sessionStorage.removeItem(MARKER_STORE_KEY); } catch (e) { /* ignore */ }
  ECAudio.State.markers = [];
  ECAudio.State.markerData = [];
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

function addMarker(zone, secId, normX, normY, existingId, sizeNorm, rowIndex, initialRole, initialStep, initialTone) {
  if (soundEnabled || !zone || !secId) return null;
  var lane = ECAudio.Zones && ECAudio.Zones.globalRowIndex
    ? ECAudio.Zones.globalRowIndex(zone) : rowIndex;
  var lanePreset = ECAudio.MarkerDrums && ECAudio.MarkerDrums.defaultPresetForLane
    ? ECAudio.MarkerDrums.defaultPresetForLane(lane) : 'kick';
  var melodicLane = ECAudio.MarkerDrums && ECAudio.MarkerDrums.isMelodicLane
    ? ECAudio.MarkerDrums.isMelodicLane(lane) : false;
  var placeToneX = normX;
  var snapY = melodicLane ? snapNormY(secId, normY) : 0.5;
  var pos = resolveMarkerPos(zone, normX, snapY, lane);
  var norm = sizeNorm != null ? sizeNorm : 0.35;
  var count = (ECAudio.State.markers || []).length;
  var marker = {
    id: existingId || markerId(),
    secId: secId,
    normX: pos.x,
    normY: pos.y,
    step: initialStep != null ? initialStep : pos.step,
    toneNorm: initialTone != null ? initialTone : (melodicLane ? placeToneX : 0.5),
    density: defaultDensityForRole(initialRole || defaultRoleForCount(count)),
    rowIndex: rowIndex,
    laneIndex: null,
    sizeNorm: norm,
    levelMul: 1,
    params: defaultMarkerParams(),
    role: normalizeRole(initialRole) || defaultRoleForCount(count),
    zone: zone,
    el: null,
    voice: null
  };
  syncMarkerStep(marker);

  if (!ECAudio.State.markers) ECAudio.State.markers = [];
  if (!ECAudio.State.markerData) ECAudio.State.markerData = [];

  ECAudio.State.markers.push(marker);
  if (!existingId) {
    ECAudio.State.markerData.push({
      id: marker.id, secId: secId, normX: pos.x, normY: pos.y,
      rowIndex: rowIndex, laneIndex: marker.laneIndex, step: marker.step,
      toneNorm: marker.toneNorm, density: markerDensity(marker),
      sizeNorm: norm, levelMul: 1, role: marker.role,
      params: JSON.parse(JSON.stringify(marker.params)),
      presetId: marker.presetId || null,
      pitchMul: marker.pitchMul != null ? marker.pitchMul : 1
    });
    saveMarkerStore();
    if (ECAudio.Browse.stopPreview) ECAudio.Browse.stopPreview();
  }
  syncMarkerLane(marker);
  renderMarkerEl(marker);
  if (!existingId && !marker.presetId && ECAudio.MarkerDrums && applyPresetToMarker) {
    var lanePreset = ECAudio.MarkerDrums.defaultPresetForLane(lane);
    applyPresetToMarker(marker, lanePreset);
    if (ECAudio.MarkerDrums.isPercussion && ECAudio.MarkerDrums.isPercussion(lanePreset)) {
      marker.normY = 0.5;
    } else {
      marker.toneNorm = placeToneX;
    }
    syncMarkerStep(marker);
    syncMarkerElPosition(marker);
  }
  ECAudio.Browse.rebalancePinnedVoices();
  startMarkerVoice(marker);
  zone.classList.add('has-markers');
  renumberMarkers();
  syncMarkerEditor();
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
    '#toolbar, #hover-panel, #studio-panel, #beat-guide, .sec-toggle, .sec-head, a, .tb-btn, button:not(.sound-marker), input, select, textarea'
  );
}

function resolvePinTarget(clientX, clientY) {
  if (soundEnabled || isPinBlocked(clientX, clientY)) return null;
  if (!isBeatStudioActive()) return null;
  if (!ECAudio.Browse.findZoneAt || !ECAudio.Browse.zoneNorm) return null;

  var hit = ECAudio.Browse.findZoneAt(clientX, clientY);
  if (!hit || !hit.zone) return null;

  var norm = ECAudio.Browse.zoneNorm(hit.zone, clientX, clientY, hit);
  if (ECAudio.Theory && ECAudio.Theory.padSnapRowNormY) {
    norm.y = ECAudio.Theory.padSnapRowNormY(norm.y);
  }
  if (ECAudio.Theory.stepFromNormX && ECAudio.Theory.normXFromStep) {
    var st = ECAudio.Theory.stepFromNormX(norm.x);
    norm.x = ECAudio.Theory.normXFromStep(st);
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
  if (target.zone.classList && target.zone.classList.contains('beat-lane') &&
      ECAudio.BeatStudio && ECAudio.BeatStudio.laneOverlayPoint) {
    var bpt = ECAudio.BeatStudio.laneOverlayPoint(target.zone, target.normX, target.normY);
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
  positionPreviewEl(_press.preview, _press.target);
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
  var lane = marker.laneIndex != null ? marker.laneIndex : marker.rowIndex;
  var laneMelodic = ECAudio.MarkerDrums && ECAudio.MarkerDrums.isMelodicLane
    ? ECAudio.MarkerDrums.isMelodicLane(lane) : false;
  var melodic = markerIsSynth(marker) || laneMelodic;
  var lock = _press && _press.axisLocked;

  if (lock !== 'y') {
    marker.step = markerStepFromX(norm.x);
    syncMarkerStep(marker);
    if (melodic) marker.toneNorm = norm.x;
  }

  if (lock !== 'x') {
    if (melodic) {
      if (ECAudio.Theory && ECAudio.Theory.padSnapRowNormY) {
        marker.normY = ECAudio.Theory.padSnapRowNormY(norm.y);
      } else {
        marker.normY = norm.y;
      }
    } else {
      marker.normY = 0.5;
    }
  } else if (_press.startNormY != null) {
    marker.normY = _press.startNormY;
  }

  attachMarkerToZone(marker, hit.zone, hit.secId, hit.rowIndex);
  syncMarkerElPosition(marker);
  syncMarkerLabel(marker);
  refreshMarkerVoice(marker);
  persistMarkerData(marker);
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
      persistMarkerData(press.marker);
    } else {
      cycleMarkerPreset(press.marker.id);
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
    _lastQuickTap = { t: now, x: clientX, y: clientY };
  } else {
    _lastQuickTap = null;
  }

  var sizeNorm = isQuick ? sizeNormFromHold(HOLD_MIN_MS) : sizeNormFromHold(hold);
  addMarker(
    press.target.zone, press.target.secId, press.target.normX, press.target.normY,
    null, sizeNorm, press.target.rowIndex
  );
}

function findRowByIndex(sec, rowIndex) {
  var rows = sec.querySelectorAll('tr.row-pad');
  if (!rows.length) return null;
  if (rowIndex == null || rowIndex < 0 || rowIndex >= rows.length) return rows[0];
  return rows[rowIndex];
}

function restoreMarkers() {
  loadMarkerStore();
  var saved = (ECAudio.State.markerData || []).slice();
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
    var beatSec = ECAudio.BEAT_STUDIO_SEC_ID || 'beat-studio';
    var secId = d.secId === beatSec ? beatSec : canonicalSectionId(d.secId);
    var zone = null;
    if (secId === beatSec && ECAudio.BeatStudio && ECAudio.BeatStudio.laneByIndex) {
      zone = ECAudio.BeatStudio.laneByIndex(d.rowIndex);
    } else {
      var sec = document.getElementById(secId) || document.getElementById(d.secId);
      if (!sec) return;
      zone = findRowByIndex(sec, d.rowIndex);
    }
    if (zone) {
      var m = addMarker(
        zone, secId, d.normX, d.normY, d.id,
        d.sizeNorm != null ? d.sizeNorm : 0.35, d.rowIndex, d.role, d.step, d.toneNorm
      );
      if (m) {
        if (d.levelMul != null) m.levelMul = d.levelMul;
        if (d.laneIndex != null) m.laneIndex = d.laneIndex;
        if (d.density != null) m.density = normalizeMarkerDensity(d.density);
        if (d.params) m.params = Object.assign(defaultMarkerParams(), d.params);
        else ensureMarkerParams(m);
        if (d.presetId) m.presetId = d.presetId;
        if (d.pitchMul != null) m.pitchMul = d.pitchMul;
        syncMarkerStep(m);
        syncMarkerLabel(m);
        syncMarkerLane(m);
        refreshMarkerVoice(m);
      }
    }
  });
  renumberMarkers();
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
  layerSettingsOpen: function() { return _layerSettingsOpen; },
  cycleRole: cycleMarkerRole, cyclePreset: cycleMarkerPreset, roleLabel: roleLabel,
  updateBeatRuler: updateBeatRuler,
  restore: restoreMarkers, initOnLoad: initMarkersOnLoad,
  syncPositions: syncAllMarkerPositions,
  scheduleRelayout: scheduleMarkerRelayout,
  getMarkerParam: getMarkerParam, setMarkerParam: setMarkerParam,
  ensureMarkerParams: ensureMarkerParams, defaultMarkerParams: defaultMarkerParams,
  syncInstructions: syncInstructions, syncLayerPreview: syncLayerPreview,
  syncBeatOverlay: syncBeatOverlayMode, isPanelOpen: isPanelOpen,
  isBeatStudioActive: isBeatStudioActive, onBeatStudioChange: onBeatStudioChange,
  syncLoopEditor: syncLoopEditor, syncMarkerEditor: syncMarkerEditor,
  markerDensity: markerDensity, formatDensity: formatDensity,
  onPointerDown: onPointerDown, onPointerMove: onPointerMove, onPointerUp: onPointerUp,
  refreshTimbre: refreshMarkerTimbre, restartVoices: restartMarkerVoices,
  restartMarkerVoice: restartMarkerVoice, applyPresetToMarker: applyPresetToMarker
};
