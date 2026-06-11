/* eslint-disable no-var */
// Sound lab — readouts + charts for selected dot (pitch/tone live on CV lanes only).
var SL_TEST_SEC = 'sec-film-and-immersive-work';
var SL_TEST_ROW = 2;
var _slMarkerTarget = null;

function slGetPadNormX() {
  if (_slMarkerTarget) return _slMarkerTarget.toneNorm != null ? _slMarkerTarget.toneNorm : 0.5;
  return 0.5;
}
function slGetPadNormY() {
  if (_slMarkerTarget) return slMarkerKeyNorm(_slMarkerTarget);
  return 0.5;
}
function slIsPadActive() { return false; }
function slGetMarkerTarget() { return _slMarkerTarget; }
function slGetPadRowNormY() { return slPadRowNormY(slGetPadNormY()); }

function slPadRowNormY(keyNorm) {
  if (ECAudio.Theory && ECAudio.Theory.rowNormFromKeyNorm) {
    return ECAudio.Theory.rowNormFromKeyNorm(keyNorm);
  }
  return 1 - (keyNorm != null ? keyNorm : 0.5);
}

function slMarkerKeyNorm(marker) {
  if (!marker) return 0.5;
  if (ECAudio.Theory && ECAudio.Theory.keyNormFromRowNorm) {
    return ECAudio.Theory.keyNormFromRowNorm(marker.normY);
  }
  return 1 - (marker.normY != null ? marker.normY : 0.5);
}

function slRefreshLivePad() { /* pad removed — CV lanes handle live tone */ }

function slFreqLabel(hz) {
  if (!hz || hz < 20) return '—';
  if (hz >= 1000) return (hz / 1000).toFixed(1) + ' kHz';
  return Math.round(hz) + ' Hz';
}

function slUpdateReadout(normX, keyNorm, marker) {
  var noteEl = document.getElementById('sl-ro-note');
  var filtEl = document.getElementById('sl-ro-filter');
  var gainEl = document.getElementById('sl-ro-gain');
  var spaceEl = document.getElementById('sl-ro-space');
  var idEl = document.getElementById('sl-ro-layer-id');
  if (!ECAudio.BrowseSound || !ECAudio.Theory) return;
  var rowNormY = slPadRowNormY(keyNorm);
  var rowIndex = marker && marker.laneIndex != null
    ? marker.laneIndex
    : (marker && marker.rowIndex != null ? marker.rowIndex : SL_TEST_ROW);
  var mp = marker && ECAudio.Markers && ECAudio.Markers.ensureMarkerParams
    ? ECAudio.Markers.ensureMarkerParams(marker) : null;
  var spec = ECAudio.BrowseSound.resolve({
    normX: normX, normY: rowNormY, count: 1,
    sizeNorm: marker ? marker.sizeNorm : null,
    markerParams: mp
  });
  if (idEl) {
    idEl.textContent = marker && marker.num != null ? String(marker.num) : '—';
  }
  if (noteEl && ECAudio.Theory.browsePadNoteLabel) {
    noteEl.textContent = marker
      ? ECAudio.Theory.browsePadNoteLabel(rowIndex, rowNormY)
      : '—';
  }
  if (filtEl) filtEl.textContent = slFreqLabel(spec.filterHz);
  if (gainEl) gainEl.textContent = Math.round(spec.peakGain * 100) + '%';
  if (spaceEl) spaceEl.textContent = Math.round(spec.space * 100) + '%';
}

function slBindMarkerTarget(marker) {
  _slMarkerTarget = marker || null;
  if (!marker) {
    slClearMarkerTarget();
    return;
  }
  var nx = marker.toneNorm != null ? marker.toneNorm : 0.5;
  var ny = slMarkerKeyNorm(marker);
  slUpdateReadout(nx, ny, marker);
  if (ECAudio.Markers && ECAudio.Markers.syncLayerPreview) ECAudio.Markers.syncLayerPreview(marker);
  if (ECAudio.SoundVisual && ECAudio.SoundVisual.refreshStatic) ECAudio.SoundVisual.refreshStatic();
}

function slClearMarkerTarget() {
  _slMarkerTarget = null;
  slUpdateReadout(0.5, 0.5, null);
  if (ECAudio.Markers && ECAudio.Markers.syncLayerPreview) ECAudio.Markers.syncLayerPreview(null);
  if (ECAudio.SoundVisual && ECAudio.SoundVisual.refreshStatic) ECAudio.SoundVisual.refreshStatic();
}

function slSyncMarkerPad(marker) {
  if (!marker) return;
  slBindMarkerTarget(marker);
}

function initSoundLabPad() {
  if (initSoundLabPad.bound) return;
  initSoundLabPad.bound = true;
  slUpdateReadout(0.5, 0.5, null);
}

function syncSoundLabMode() {
  var panel = document.getElementById('studio-panel');
  if (!panel) return;
  panel.setAttribute('data-active-mode', 'studio');
}

function onStudioPanelOpen() {
  syncSoundLabMode();
  if (_slMarkerTarget) slBindMarkerTarget(_slMarkerTarget);
  else slUpdateReadout(0.5, 0.5, null);
  if (ECAudio.BrowseSound && ECAudio.BrowseSound.applyEngine) ECAudio.BrowseSound.applyEngine();
  if (ECAudio.SoundVisual && ECAudio.SoundVisual.init) ECAudio.SoundVisual.init();
  if (ECAudio.Markers && ECAudio.Markers.syncMarkerEditor) ECAudio.Markers.syncMarkerEditor();
  if (ECAudio.Markers && ECAudio.Markers.syncInstructions) ECAudio.Markers.syncInstructions();
}

function onStudioPanelClose() {
  if (ECAudio.Markers && ECAudio.Markers.closeLayerSettings) ECAudio.Markers.closeLayerSettings();
  document.body.classList.remove('studio-panel-open');
}

function onSoundLabOpen() { onStudioPanelOpen(); }
function onSoundLabClose() { onStudioPanelClose(); }

function initSoundLab() {
  initSoundLabPad();
  if (ECAudio.SoundVisual && ECAudio.SoundVisual.init) ECAudio.SoundVisual.init();
}
