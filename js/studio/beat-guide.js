/* eslint-disable no-var */
// Contextual beat-studio guide — one tip at a time, tied to user actions.
window.ECAudio = window.ECAudio || {};

var GUIDE_STORE_KEY = 'ec-beat-guide-done';
var GUIDE_ORDER = [
  'welcome', 'hover', 'hold', 'placed', 'beat_mode', 'ruler_hit',
  'tap_role', 'drag_time', 'drag_note', 'select_dot', 'density',
  'dblclick_remove', 'dblclick_clear'
];
var GUIDE_EVENT_STEP = {
  page_ready: 'welcome',
  row_hover: 'hover',
  pin_hold: 'hold',
  dot_placed: 'placed',
  beat_mode: 'beat_mode',
  ruler_hit: 'ruler_hit',
  tap_role: 'tap_role',
  drag_time: 'drag_time',
  drag_note: 'drag_note',
  select_dot: 'select_dot',
  scroll_density: 'density',
  dblclick_remove: 'dblclick_remove',
  dblclick_clear: 'dblclick_clear'
};
var GUIDE_COPY = {
  welcome: 'Dot mode — hold a CV row to place a dot. Press X or ⚙ for the side panel.',
  hover: 'Hover a row to hear a note.',
  hold: 'Hold on a row to place a layer — no settings popup, just play.',
  placed: 'Each dot is unique (mk-1, mk-2…). Tap to cycle color. Hold dot to tune.',
  beat_mode: 'Beat mode — lanes + ruler. Global sound in Generator · per-dot in Layer tab.',
  ruler_hit: 'Colored ruler ticks = that layer hit. Matches the dot flash.',
  tap_role: 'Tap a dot to cycle Kick → Hat → Bass → Clap → Lead → Soft.',
  drag_time: 'Drag left ↔ right — when this layer starts in the loop.',
  drag_note: 'Drag up ↕ down — note. Row = higher octave.',
  select_dot: 'Layer open — fine-tune in Layer tab + pad. Scroll dot for repeat ÷2/÷4/÷8.',
  density: 'Repeat changed — ÷2 fast, ÷8 slow. Unique per dot.',
  dblclick_remove: 'Double-click a dot to remove that hit only.',
  dblclick_clear: 'Use Clear all dots in the panel to reset the loop.'
};

var _guideEl = null;
var _guideText = null;
var _guideDismiss = null;
var _hideTimer = null;
var _done = null;

function loadGuideDone() {
  if (_done) return _done;
  try {
    var raw = localStorage.getItem(GUIDE_STORE_KEY);
    _done = raw ? JSON.parse(raw) : {};
  } catch (e) {
    _done = {};
  }
  if (!_done || typeof _done !== 'object') _done = {};
  return _done;
}

function saveGuideDone() {
  try {
    localStorage.setItem(GUIDE_STORE_KEY, JSON.stringify(_done || {}));
  } catch (e) { /* ignore */ }
}

function guideIsDone(id) {
  return !!loadGuideDone()[id];
}

function guideMarkDone(id) {
  loadGuideDone();
  _done[id] = true;
  saveGuideDone();
}

function guideSkipAll() {
  GUIDE_ORDER.forEach(function(id) {
    guideMarkDone(id);
  });
  hideBeatGuide();
}

function nextGuideId() {
  var i;
  for (i = 0; i < GUIDE_ORDER.length; i++) {
    if (!guideIsDone(GUIDE_ORDER[i])) return GUIDE_ORDER[i];
  }
  return null;
}

function ensureGuideEl() {
  if (_guideEl) return _guideEl;
  _guideEl = document.getElementById('beat-guide');
  if (!_guideEl) return null;
  _guideText = _guideEl.querySelector('.beat-guide-text');
  _guideDismiss = _guideEl.querySelector('.beat-guide-dismiss');
  if (_guideDismiss && !ensureGuideEl.bound) {
    ensureGuideEl.bound = true;
    _guideDismiss.addEventListener('click', guideSkipAll);
  }
  return _guideEl;
}

function hideBeatGuide() {
  if (_hideTimer) {
    clearTimeout(_hideTimer);
    _hideTimer = null;
  }
  var el = ensureGuideEl();
  if (el) {
    el.hidden = true;
    el.classList.remove('beat-guide--anchored');
    el.style.removeProperty('left');
    el.style.removeProperty('top');
  }
}

function showBeatGuide(stepId, anchorRect) {
  if (soundEnabled || guideIsDone(stepId)) return;
  var copy = GUIDE_COPY[stepId];
  if (!copy) return;
  var el = ensureGuideEl();
  if (!el || !_guideText) return;

  guideMarkDone(stepId);
  _guideText.textContent = copy;
  el.hidden = false;
  el.classList.toggle('beat-guide--anchored', !!anchorRect);

  if (anchorRect) {
    var pad = 10;
    var left = anchorRect.left + anchorRect.width * 0.5;
    var top = anchorRect.bottom + pad;
    var maxW = Math.min(280, window.innerWidth - 24);
    left = Math.max(12 + maxW * 0.5, Math.min(window.innerWidth - 12 - maxW * 0.5, left));
    if (top > window.innerHeight - 80) top = anchorRect.top - pad - 48;
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  } else {
    el.style.removeProperty('left');
    el.style.removeProperty('top');
  }

  if (_hideTimer) clearTimeout(_hideTimer);
  _hideTimer = setTimeout(hideBeatGuide, 7000);
}

function fireBeatGuide(eventName, detail) {
  if (soundEnabled) return;
  var stepId = GUIDE_EVENT_STEP[eventName];
  if (!stepId || guideIsDone(stepId)) return;
  if (nextGuideId() !== stepId) return;
  var rect = detail && detail.rect ? detail.rect : null;
  showBeatGuide(stepId, rect);
}

function initBeatGuide() {
  ensureGuideEl();
  if (!guideIsDone('welcome')) {
    setTimeout(function() {
      fireBeatGuide('page_ready');
    }, 600);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBeatGuide);
} else {
  initBeatGuide();
}

ECAudio.BeatGuide = {
  fire: fireBeatGuide,
  hide: hideBeatGuide,
  skipAll: guideSkipAll,
  reset: function() {
    _done = {};
    try { localStorage.removeItem(GUIDE_STORE_KEY); } catch (e) { /* ignore */ }
  }
};
