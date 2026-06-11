/* eslint-disable no-var */
// Rotary knobs — upgrades sp-range inputs inside audio drawer panels.
window.ECAudio = window.ECAudio || {};

function knobNorm(val, min, max) {
  if (max <= min) return 0;
  return Math.max(0, Math.min(1, (val - min) / (max - min)));
}

function knobVal(norm, min, max, step) {
  var raw = min + norm * (max - min);
  if (!step || step >= (max - min)) return raw;
  return Math.round(raw / step) * step;
}

function knobPointerNorm(e, el) {
  var r = el.getBoundingClientRect();
  var cx = r.left + r.width * 0.5;
  var cy = r.top + r.height * 0.5;
  var ang = Math.atan2(e.clientY - cy, e.clientX - cx);
  var deg = (ang * 180 / Math.PI + 90 + 360) % 360;
  return Math.max(0, Math.min(1, (deg - 35) / 290));
}

function syncKnobDial(wrap) {
  var input = wrap.querySelector('input[data-param]');
  var dial = wrap.querySelector('.sp-knob-dial');
  if (!input || !dial) return;
  var min = parseFloat(input.min);
  var max = parseFloat(input.max);
  var val = parseFloat(input.value);
  if (isNaN(min)) min = 0;
  if (isNaN(max)) max = 1;
  var norm = knobNorm(val, min, max);
  dial.style.setProperty('--knob-angle', String(-135 + norm * 270) + 'deg');
}

function wrapRangeAsKnob(input) {
  if (!input || input.dataset.knobWrapped === '1') return;
  if (input.closest('.sl-music-only')) return;
  input.dataset.knobWrapped = '1';

  var wrap = document.createElement('div');
  wrap.className = 'sp-knob-wrap';
  var label = input.closest('.sl-field');
  var labelEl = label ? label.querySelector('.sl-field-label') : null;
  var valEl = label ? label.querySelector('.sp-val') : null;

  var dial = document.createElement('div');
  dial.className = 'sp-knob-dial';
  dial.setAttribute('tabindex', '0');
  dial.setAttribute('role', 'slider');
  if (labelEl) dial.setAttribute('aria-label', labelEl.textContent);

  var track = document.createElement('div');
  track.className = 'sp-knob-track';
  track.appendChild(dial);

  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(track);
  wrap.appendChild(input);
  input.classList.add('sp-knob-input');

  syncKnobDial(wrap);

  var dragging = false;
  var startY = 0;
  var startVal = 0;

  function applyNorm(norm) {
    var min = parseFloat(input.min) || 0;
    var max = parseFloat(input.max) || 1;
    var step = parseFloat(input.step) || 0;
    var val = knobVal(norm, min, max, step);
    input.value = String(val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    syncKnobDial(wrap);
  }

  dial.addEventListener('pointerdown', function(e) {
    dragging = true;
    startY = e.clientY;
    startVal = knobNorm(parseFloat(input.value), parseFloat(input.min) || 0, parseFloat(input.max) || 1);
    dial.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  dial.addEventListener('pointermove', function(e) {
    if (!dragging) return;
    var dy = startY - e.clientY;
    applyNorm(Math.max(0, Math.min(1, startVal + dy * 0.004)));
  });

  dial.addEventListener('pointerup', function() { dragging = false; });
  dial.addEventListener('pointercancel', function() { dragging = false; });

  dial.addEventListener('wheel', function(e) {
    e.preventDefault();
    var min = parseFloat(input.min) || 0;
    var max = parseFloat(input.max) || 1;
    var step = parseFloat(input.step) || (max - min) / 100;
    var val = parseFloat(input.value) || min;
    val += e.deltaY > 0 ? -step : step;
    val = Math.max(min, Math.min(max, val));
    input.value = String(val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    syncKnobDial(wrap);
  }, { passive: false });

  input.addEventListener('input', function() { syncKnobDial(wrap); });
}

function initSoundKnobs(root) {
  if (!root) return;
  root.querySelectorAll('input.sp-range[data-param]').forEach(wrapRangeAsKnob);
  root.querySelectorAll('#sl-loop-step, #sl-loop-size, #sl-loop-level').forEach(wrapRangeAsKnob);
}

function syncAllKnobs(root) {
  if (!root) return;
  root.querySelectorAll('.sp-knob-wrap').forEach(syncKnobDial);
}

ECAudio.Knobs = { init: initSoundKnobs, sync: syncAllKnobs };
