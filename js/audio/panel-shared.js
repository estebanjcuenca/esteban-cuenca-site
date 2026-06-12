/* eslint-disable no-var */
// Shared panel param read/write — used by hover + studio drawers.
var BROWSE_LIVE_PARAMS = [
  'gain', 'attack', 'decay', 'browseTone', 'browseSpace', 'browseFilterMin',
  'browseFilterMax', 'browseFilterQ', 'browseSubMix', 'browseHp', 'browsePadX',
  'browseHarmonics', 'browseDrive', 'browseLfoRate', 'browseLfoDepth', 'browseLfoTarget',
  'browseSizeLevel', 'browseSizeSpace', 'browsePolyFloor', 'browsePolyPow',
  'detune', 'reverbAmt'
];
var BROWSE_RESTART_PARAMS = ['wave', 'mode', 'bpm'];
var MARKER_RESTART_PARAMS = ['wave'];
var VISUAL_STATIC_PARAMS = [
  'wave', 'browseHarmonics', 'browseDrive', 'browseTone',
  'browseFilterMin', 'browseFilterMax', 'browseFilterQ', 'browsePadX'
];

function getHoverPanel() {
  return document.getElementById('hover-panel');
}

function getStudioPanel() {
  return document.getElementById('studio-panel');
}

function isGlobalOnlyParam(param) {
  return ECAudio.GLOBAL_ONLY_PARAMS && ECAudio.GLOBAL_ONLY_PARAMS.indexOf(param) >= 0;
}

function panelEnvProxy() {
  if (!ECAudio.Environments || !ECAudio.Environments.panelEnv) return null;
  var env = ECAudio.Environments.panelEnv();
  if (!env) return null;
  return {
    envId: env.id,
    presetId: env.type,
    id: null,
    _envProxy: true
  };
}

function panelParamMarker() {
  if (soundEnabled) return null;
  if (typeof isBeatStudioActive === 'function' && isBeatStudioActive()) {
    if (ECAudio.Markers && ECAudio.Markers.getSelected) {
      var mk = ECAudio.Markers.getSelected();
      if (mk) return mk;
    }
    var envMk = panelEnvProxy();
    if (envMk) return envMk;
    return null;
  }
  if (!ECAudio.Markers || !ECAudio.Markers.layerSettingsOpen) return null;
  if (!ECAudio.Markers.layerSettingsOpen()) return null;
  return ECAudio.Markers.getSelected ? ECAudio.Markers.getSelected() : null;
}

function readPanelParam(param, scope) {
  if (scope === 'env') {
    var envMk = panelEnvProxy();
    if (envMk && ECAudio.Environments.getParam) {
      return ECAudio.Environments.getParam(ECAudio.Environments.get(envMk.envId), param);
    }
  }
  if (param === 'wave' && scope === 'global') return Sound.params.wave;
  if (param === 'wave' && (scope === 'dot' || scope === 'env')) {
    var mkWave = scope === 'env' ? panelEnvProxy() : panelParamMarker();
    if (mkWave && mkWave._envProxy && mkWave.envId && ECAudio.Environments) {
      return ECAudio.Environments.getParam(ECAudio.Environments.get(mkWave.envId), 'wave');
    }
    if (mkWave && ECAudio.Markers.getMarkerParam) return ECAudio.Markers.getMarkerParam(mkWave, 'wave');
    return Sound.params.wave;
  }
  var marker = panelParamMarker();
  if (marker && marker._envProxy && marker.envId && ECAudio.Environments && !isGlobalOnlyParam(param)) {
    return ECAudio.Environments.getParam(ECAudio.Environments.get(marker.envId), param);
  }
  if (marker && !isGlobalOnlyParam(param) && ECAudio.Markers.getMarkerParam) {
    return ECAudio.Markers.getMarkerParam(marker, param);
  }
  return Sound.params[param];
}

function isMarkerOnlyParam(param) {
  if (param === 'wave') return false;
  return ECAudio.MARKER_PARAM_KEYS && ECAudio.MARKER_PARAM_KEYS.indexOf(param) >= 0 &&
    !isGlobalOnlyParam(param);
}

function writePanelParam(param, val, scope) {
  if (scope === 'env') {
    var envMk = panelEnvProxy();
    if (envMk && ECAudio.Environments.setParam) {
      ECAudio.Environments.setParam(envMk.envId, param, val);
      return 'marker';
    }
  }
  var marker = panelParamMarker();
  if (param === 'wave') {
    if ((scope === 'dot' || scope === 'env') && marker && marker._envProxy && marker.envId && ECAudio.Environments) {
      ECAudio.Environments.setParam(marker.envId, param, val);
      return 'marker';
    }
    if (scope === 'env') {
      var envWave = panelEnvProxy();
      if (envWave && ECAudio.Environments.setParam) {
        ECAudio.Environments.setParam(envWave.envId, param, val);
        return 'marker';
      }
    }
    if (scope === 'dot' && marker && ECAudio.Markers.setMarkerParam) {
      ECAudio.Markers.setMarkerParam(marker, param, val);
      return 'marker';
    }
    Sound.params.wave = val;
    return 'global';
  }
  if (marker && marker._envProxy && marker.envId && ECAudio.Environments && !isGlobalOnlyParam(param)) {
    ECAudio.Environments.setParam(marker.envId, param, val);
    return 'marker';
  }
  if (isMarkerOnlyParam(param)) {
    if (!marker || !ECAudio.Markers.setMarkerParam) return 'none';
    ECAudio.Markers.setMarkerParam(marker, param, val);
    return 'marker';
  }
  if (marker && !isGlobalOnlyParam(param) && ECAudio.Markers.setMarkerParam) {
    ECAudio.Markers.setMarkerParam(marker, param, val);
    return 'marker';
  }
  Sound.params[param] = val;
  if (param === 'browseHarmonics') Sound.params.browseDrive = val;
  return 'global';
}

function updateSoundParamLabel(param, val) {
  var lbl = document.getElementById('sp-' + param + '-val');
  if (lbl && ECAudio.soundFmt[param]) lbl.textContent = ECAudio.soundFmt[param](val);
}

function refreshSoundVisuals(param) {
  if (soundEnabled || !ECAudio.SoundVisual) return;
  if (!param || VISUAL_STATIC_PARAMS.indexOf(param) >= 0) {
    ECAudio.SoundVisual.refreshStatic();
  }
}

function refreshBrowseVoices(param) {
  if (soundEnabled || !ECAudio.Browse) return;
  refreshSoundVisuals(param);
  if (param === 'browseHp' || param === 'reverbAmt') {
    if (ECAudio.BrowseSound && ECAudio.BrowseSound.applyEngine) ECAudio.BrowseSound.applyEngine();
    return;
  }
  if (BROWSE_RESTART_PARAMS.indexOf(param) >= 0) {
    if (ECAudio.Markers) ECAudio.Markers.restartVoices();
    if (ECAudio.Browse.restartHoldVoice) ECAudio.Browse.restartHoldVoice();
    return;
  }
  var marker = (typeof isBeatStudioActive === 'function' && isBeatStudioActive())
    ? panelParamMarker() : null;
  if (marker && marker._envProxy && marker.envId && ECAudio.Environments) {
    if (MARKER_RESTART_PARAMS.indexOf(param) >= 0 && ECAudio.Environments.restartVoices) {
      ECAudio.Environments.restartVoices(marker.envId);
    } else if (ECAudio.Environments.restartVoices) {
      ECAudio.Environments.restartVoices(marker.envId);
    }
    if (typeof slRefreshLivePad === 'function') slRefreshLivePad();
    return;
  }
  if (marker) {
    if (MARKER_RESTART_PARAMS.indexOf(param) >= 0 && param !== 'wave' &&
        ECAudio.Markers.restartMarkerVoice) {
      ECAudio.Markers.restartMarkerVoice(marker);
    } else if (ECAudio.Markers.refreshTimbre) {
      ECAudio.Markers.refreshTimbre();
      if (ECAudio.Browse.applyMarkerTone) {
        ECAudio.Browse.applyMarkerTone(marker.voice, marker);
      }
    }
    if (typeof slRefreshLivePad === 'function') slRefreshLivePad();
    return;
  }
  if (BROWSE_LIVE_PARAMS.indexOf(param) >= 0) {
    ECAudio.Browse.refreshLiveBrowseAudio();
    if (typeof slRefreshLivePad === 'function') slRefreshLivePad();
  }
}

function syncPanelParamUI(panel) {
  if (!panel) return;
  panel.querySelectorAll('.sp-seg[data-param]').forEach(function(seg) {
    var param = seg.getAttribute('data-param');
    var scope = seg.getAttribute('data-scope') || '';
    var val = readPanelParam(param, scope);
    if (ECAudio.SOUND_BOOL_PARAMS.indexOf(param) >= 0) val = val ? '1' : '0';
    seg.querySelectorAll('.sp-seg-btn').forEach(function(b) {
      var raw = b.getAttribute('data-val');
      var match;
      if (ECAudio.SOUND_BOOL_PARAMS.indexOf(param) >= 0) match = raw === val;
      else if (isNaN(raw)) match = raw === val;
      else match = Math.abs(parseFloat(raw) - Number(val)) < 0.02;
      b.classList.toggle('active', match);
    });
  });
  panel.querySelectorAll('input.sp-range[data-param]').forEach(function(input) {
    var param = input.getAttribute('data-param');
    var scope = input.getAttribute('data-scope') || '';
    var val = readPanelParam(param, scope);
    if (val === undefined) return;
    input.value = String(val);
    updateSoundParamLabel(param, val);
  });
}

function setPanelOpen(panel, open, bodyClass, btn) {
  if (!panel) return false;
  panel.classList.toggle('open', open);
  panel.setAttribute('aria-hidden', String(!open));
  document.body.classList.toggle(bodyClass, open);
  if (btn) btn.classList.toggle('panel-open', open);
  return open;
}

function handlePanelSegClick(btn, allowMarker) {
  var seg = btn.closest('[data-param]');
  if (!seg) return;
  var raw = btn.getAttribute('data-val');
  var param = seg.getAttribute('data-param');
  var scope = seg.getAttribute('data-scope') || '';
  if (allowMarker && scope === 'env' && !panelEnvProxy()) return;
  if (allowMarker && isMarkerOnlyParam(param) && scope !== 'env' && !panelParamMarker()) return;
  if (allowMarker && param === 'wave' && scope === 'dot' && !panelParamMarker()) return;
  var val;
  if (ECAudio.SOUND_BOOL_PARAMS.indexOf(param) >= 0) val = raw === '1';
  else if (isNaN(raw)) val = raw;
  else val = parseFloat(raw);
  if (ECAudio.SECTION_ROOT_KEYS[param]) ECAudio.setSectionRoot(param, val);
  else if (param === 'noteLength') Sound.params.noteLength = val;
  else if (param === 'scaleType') {
    Sound.params.scaleType = val;
    if (ECAudio.SECTION_HARMONY) {
      if (!Sound.params.sectionScales) Sound.params.sectionScales = {};
      Object.keys(ECAudio.SECTION_HARMONY).forEach(function(secId) {
        Sound.params.sectionScales[secId] = val;
      });
    }
  } else writePanelParam(param, val, scope);
  seg.querySelectorAll('.sp-seg-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  if (param === 'steps') {
    document.documentElement.dataset.steps = String(Sound.params.steps);
    if (soundEnabled) TrackSeq.remount();
  }
  if (ECAudio.SECTION_ROOT_KEYS[param] && !soundEnabled) {
    if (ECAudio.Zones && ECAudio.Zones.refreshLadders) ECAudio.Zones.refreshLadders();
    if (ECAudio.Markers) ECAudio.Markers.restartVoices();
  }
  refreshBrowseVoices(param);
  if ((param === 'wave' || param === 'mode') && typeof reconcileCurrentHover === 'function') {
    reconcileCurrentHover();
  }
  ECAudio.saveSoundPrefs();
}

function handlePanelInput(el, allowMarker) {
  var param = el.getAttribute('data-param');
  var scope = el.getAttribute('data-scope') || '';
  if (allowMarker && scope === 'env' && !panelEnvProxy()) return;
  if (allowMarker && isMarkerOnlyParam(param) && scope !== 'env' && !panelParamMarker()) return;
  var val = parseFloat(el.value);
  if (writePanelParam(param, val, scope) === 'none') return;
  updateSoundParamLabel(param, val);
  if (param === 'reverbAmt' && typeof Sound.setReverbAmt === 'function') {
    Sound.setReverbAmt(val);
  }
  if (soundEnabled && (param === 'bpm' || param === 'swing')) TrackSeq.restartSeq();
  refreshBrowseVoices(param);
  if (!soundEnabled && typeof slUpdateReadout === 'function') {
    var nx = typeof slGetPadNormX === 'function' ? slGetPadNormX() : 0.5;
    var ny = typeof slGetPadNormY === 'function' ? slGetPadNormY() : 0.5;
    slUpdateReadout(nx, ny);
  }
  refreshSoundVisuals(param);
  ECAudio.saveSoundPrefs();
}

function syncSoundPanelUI() {
  if (typeof syncHoverPanelUI === 'function') syncHoverPanelUI();
  if (typeof syncStudioPanelUI === 'function') syncStudioPanelUI();
}

function toggleSoundPanel() {
  if (typeof toggleStudio === 'function') toggleStudio();
}
