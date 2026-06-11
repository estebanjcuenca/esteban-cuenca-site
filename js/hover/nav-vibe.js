window.NavVibe = (function() {
  var wrap, path, notes = new Map(), rafId = null, t0 = 0, lastNow = 0;
  var W = 200, H = 24, MID = H / 2, PTS = 96;
  var REF_FREQ = 110;
  var NOTE_DELAY_MS = 0;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function soundParams() {
    return (typeof ECAudio !== 'undefined' && ECAudio.params)
      ? ECAudio.params
      : { wave: 'sine', attack: 0.18, decay: 1.6 };
  }

  function init() {
    wrap = document.getElementById('nav-vibe');
    path = wrap && wrap.querySelector('.nav-vibe-path');
    setResting();
  }

  function waveVal(phase, type) {
    var p = phase * Math.PI * 2;
    switch (type) {
      case 'square':
        return Math.sign(Math.sin(p)) * 0.9;
      case 'triangle':
        return (Math.asin(Math.sin(p)) * 2 / Math.PI) * 0.9;
      case 'sawtooth': {
        var s = ((phase % 1) + 1) % 1;
        return (s * 2 - 1) * 0.9;
      }
      default:
        return Math.sin(p) * 0.9;
    }
  }

  function spatialCycles(freq) {
    return 1.4 * (freq / REF_FREQ);
  }

  function scrollHz(freq) {
    return 0.28 + 0.1 * Math.log2(freq / REF_FREQ + 1);
  }

  function setResting() {
    if (path) path.setAttribute('d', 'M0 ' + MID + ' L' + W + ' ' + MID);
  }

  function activeNotes() {
    var list = [];
    notes.forEach(function(note) {
      if (note.level > 0.01) list.push(note);
    });
    return list;
  }

  function buildPath(t) {
    var type = soundParams().wave;
    var live = activeNotes();
    if (!live.length) return 'M0 ' + MID + ' L' + W + ' ' + MID;

    var baseAmp = Math.min(11, 5.5 + live.length * 0.45);
    var segs = [];

    for (var i = 0; i <= PTS; i++) {
      var x = (i / PTS) * W;
      var norm = i / PTS;
      var y = MID;
      live.forEach(function(note) {
        var phase = norm * spatialCycles(note.freq) + t * scrollHz(note.freq);
        y += waveVal(phase, type) * baseAmp * note.level / live.length;
      });
      segs.push((i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(2));
    }
    return segs.join(' ');
  }

  function updateEnvelopes(now, dt) {
    var p = soundParams();
    var toDelete = [];
    notes.forEach(function(note, row) {
      if (now < note.delayUntil) return;
      if (note.target > note.level) {
        var step = dt / Math.max(0.02, Math.min(p.attack, 0.06));
        note.level = Math.min(note.target, note.level + step);
      } else if (note.target < note.level) {
        var step = dt / Math.max(0.04, Math.min(p.decay, 0.12));
        note.level = Math.max(note.target, note.level - step);
        if (note.releasing && note.level <= 0.02) toDelete.push(row);
      }
    });
    toDelete.forEach(function(row) { notes.delete(row); });
  }

  function tick(now) {
    if (!path) { rafId = null; return; }
    var dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0.016;
    lastNow = now;
    updateEnvelopes(now, dt);

    var live = activeNotes();
    var t = (now - t0) / 1000;

    if (!live.length && notes.size === 0) {
      setResting();
      wrap.classList.remove('active');
      rafId = null;
      lastNow = 0;
      return;
    }

    path.setAttribute('d', buildPath(t));
    wrap.classList.toggle('active', peakLevel() > 0.08);
    rafId = requestAnimationFrame(tick);
  }

  function peakLevel() {
    var peak = 0;
    notes.forEach(function(n) { if (n.level > peak) peak = n.level; });
    return peak;
  }

  function ensureLoop() {
    if (!rafId) {
      t0 = performance.now();
      lastNow = 0;
      rafId = requestAnimationFrame(tick);
    }
  }

  function noteOn(row, freq) {
    if (!path || reduceMotion) return;
    var now = performance.now();
    var prev = notes.get(row);
    notes.set(row, {
      freq: freq,
      level: prev && !prev.releasing ? prev.level : 0,
      target: 1,
      releasing: false,
      delayUntil: now + NOTE_DELAY_MS
    });
    ensureLoop();
  }

  function noteOff(row) {
    var note = notes.get(row);
    if (!note) return;
    note.target = 0;
    note.releasing = true;
    ensureLoop();
  }

  function reset() {
    notes.clear();
    setResting();
    if (wrap) wrap.classList.remove('active');
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    lastNow = 0;
  }

  function pulse(freq, ms) {
    if (!path || reduceMotion) return;
    var key = {};
    noteOn(key, freq);
    setTimeout(function() { noteOff(key); }, ms || 600);
  }

  return { init: init, noteOn: noteOn, noteOff: noteOff, reset: reset, pulse: pulse };
})();
