/* eslint-disable no-var */
// Beat studio — global pitch grid (root + scale).
window.ECAudio = window.ECAudio || {};

var STORE_KEY = 'ec-beat-scale';
var ROOT_MIN = 55;
var ROOT_MAX = 220;

function keyCountForScale(scale) {
  return scale === 'pent' ? 5 : 7;
}

function applyScaleState(scale, rootHz) {
  ECAudio.BROWSE_SCALE = scale || 'pent';
  ECAudio.BROWSE_ROOT_HZ = rootHz != null ? rootHz : 110;
  var n = keyCountForScale(ECAudio.BROWSE_SCALE);
  ECAudio.BROWSE_ROW_KEYS = n;
  ECAudio.BROWSE_DEGREES = n;
}

function save() {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify({
      scale: ECAudio.BROWSE_SCALE,
      rootHz: ECAudio.BROWSE_ROOT_HZ
    }));
  } catch (err) { /* ignore */ }
}

function load() {
  try {
    var raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return;
    var data = JSON.parse(raw);
    applyScaleState(data.scale || 'pent', data.rootHz != null ? data.rootHz : 110);
  } catch (err) { /* ignore */ }
}

function rootLabel(hz) {
  if (!ECAudio.Engine || !ECAudio.Engine.midiFromFreq) return Math.round(hz) + ' Hz';
  var midi = Math.round(ECAudio.Engine.midiFromFreq(hz));
  var names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var oct = Math.floor(midi / 12) - 1;
  return names[((midi % 12) + 12) % 12] + oct + ' · ' + Math.round(hz) + ' Hz';
}

function setScale(scale) {
  if (['pent', 'major', 'minor'].indexOf(scale) < 0) return;
  applyScaleState(scale, ECAudio.BROWSE_ROOT_HZ);
  save();
  syncUI();
  if (ECAudio.Markers && ECAudio.Markers.restartVoices) ECAudio.Markers.restartVoices();
  if (typeof syncSoundPanelUI === 'function') syncSoundPanelUI();
}

function setRootHz(hz) {
  hz = Math.max(ROOT_MIN, Math.min(ROOT_MAX, hz));
  applyScaleState(ECAudio.BROWSE_SCALE, hz);
  save();
  syncUI();
  if (ECAudio.Markers && ECAudio.Markers.restartVoices) ECAudio.Markers.restartVoices();
}

function syncUI() {
  var rootEl = document.getElementById('sl-beat-root');
  var rootVal = document.getElementById('sl-beat-root-val');
  var scale = ECAudio.BROWSE_SCALE || 'pent';
  if (rootEl && document.activeElement !== rootEl) {
    rootEl.value = String(Math.round(ECAudio.BROWSE_ROOT_HZ || 110));
  }
  if (rootVal) rootVal.textContent = rootLabel(ECAudio.BROWSE_ROOT_HZ || 110);
  var seg = document.getElementById('sl-beat-scale-seg');
  if (seg) {
    seg.querySelectorAll('.sp-seg-btn').forEach(function(b) {
      b.classList.toggle('active', b.getAttribute('data-val') === scale);
    });
  }
}

function bind() {
  if (bind.bound) return;
  bind.bound = true;
  var rootEl = document.getElementById('sl-beat-root');
  if (rootEl) {
    rootEl.addEventListener('input', function() {
      setRootHz(parseFloat(rootEl.value) || 110);
    });
  }
  var seg = document.getElementById('sl-beat-scale-seg');
  if (seg) {
    seg.querySelectorAll('.sp-seg-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        setScale(btn.getAttribute('data-val') || 'pent');
      });
    });
  }
}

function initBeatScale() {
  load();
  bind();
  syncUI();
}

ECAudio.BeatScale = {
  init: initBeatScale,
  setScale: setScale,
  setRoot: setRootHz,
  syncUI: syncUI,
  rootLabel: rootLabel
};
