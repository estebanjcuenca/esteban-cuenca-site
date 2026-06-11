window.TrackSeq = (function() {
  var seqTimer = null;
  var seqRunning = false;
  var playhead = 0;
  var mounted = false;
  var previewTimer = null;
  var TYPES = ['drums', 'kick', 'bass', 'clap', 'note'];
  var TYPE_LABEL = {
    drums: 'Drums', kick: 'Kick', bass: 'Bass', clap: 'Clap', note: 'Note'
  };

  function stepCount() {
    return Sound.params.steps === 8 ? 8 : 16;
  }

  function rowIndex(row) {
    return Array.from(row.parentNode.children).indexOf(row);
  }

  function trackId(row) {
    var sec = row.closest('.cv-section');
    var sid = sec ? canonicalSectionId(sec.id) : 'sec';
    return sid + '-' + rowIndex(row);
  }

  function defaultType(idx) {
    if (idx === 0) return 'drums';
    if (idx === 1) return 'kick';
    if (idx === 2) return 'bass';
    if (idx === 3) return 'clap';
    return 'note';
  }

  function getType(id, idx) {
    var t = Sound.params.trackTypes[id] || defaultType(idx);
    return TYPES.indexOf(t) >= 0 ? t : defaultType(idx);
  }

  function normStep(val) {
    if (!val) return 0;
    return val === 2 ? 2 : 1;
  }

  function ensurePattern(id) {
    var n = stepCount();
    if (!Sound.params.patterns[id] || Sound.params.patterns[id].length !== n) {
      var old = Sound.params.patterns[id] || [];
      Sound.params.patterns[id] = new Array(n).fill(0);
      for (var i = 0; i < Math.min(old.length, n); i++) {
        Sound.params.patterns[id][i] = normStep(old[i]);
      }
    }
    return Sound.params.patterns[id];
  }

  function patternActive(pat) {
    return pat && pat.some(function(v) { return v; });
  }

  function syncStepButton(btn, val) {
    btn.classList.toggle('on', val > 0);
    btn.classList.toggle('soft', val === 2);
    btn.setAttribute('aria-pressed', val ? 'true' : 'false');
    btn.setAttribute('aria-label', (val === 2 ? 'Soft ' : val ? 'Loud ' : '') + 'step');
  }

  function syncLaneState(lane, pat) {
    lane.classList.toggle('has-notes', patternActive(pat));
  }

  function hasSolo() {
    var solos = Sound.params.trackSolos || {};
    return Object.keys(solos).some(function(k) { return solos[k]; });
  }

  function rowAudible(id) {
    if (Sound.params.trackMutes && Sound.params.trackMutes[id]) return false;
    if (hasSolo()) return !!(Sound.params.trackSolos && Sound.params.trackSolos[id]);
    return true;
  }

  function syncLaneMuteSolo(lane, id) {
    var muted = !!(Sound.params.trackMutes && Sound.params.trackMutes[id]);
    var solo = !!(Sound.params.trackSolos && Sound.params.trackSolos[id]);
    var locked = !!(Sound.params.trackLocks && Sound.params.trackLocks[id]);
    lane.classList.toggle('is-muted', muted);
    lane.classList.toggle('is-solo', solo);
    lane.classList.toggle('is-locked', locked);
    var muteBtn = lane.querySelector('.track-mute');
    var soloBtn = lane.querySelector('.track-solo');
    var lockBtn = lane.querySelector('.track-lock');
    if (muteBtn) {
      muteBtn.classList.toggle('active', muted);
      muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    }
    if (soloBtn) {
      soloBtn.classList.toggle('active', solo);
      soloBtn.setAttribute('aria-pressed', solo ? 'true' : 'false');
    }
    if (lockBtn) {
      lockBtn.classList.toggle('active', locked);
      lockBtn.setAttribute('aria-pressed', locked ? 'true' : 'false');
    }
  }

  function paintStep(pat, stepIdx, soft) {
    var cur = pat[stepIdx] || 0;
    if (soft) {
      pat[stepIdx] = cur === 2 ? 0 : cur === 1 ? 2 : 2;
    } else {
      pat[stepIdx] = cur === 1 ? 0 : cur === 2 ? 1 : 1;
    }
    return pat[stepIdx];
  }

  function clearRow(lane, grid, pat) {
    pat.fill(0);
    grid.querySelectorAll('.track-step').forEach(function(btn) {
      syncStepButton(btn, 0);
    });
    syncLaneState(lane, pat);
    ECAudio.saveSoundPrefs();
  }

  function flashStep(lane, stepIndex) {
    var btn = lane.querySelector('.track-step[data-step="' + stepIndex + '"]');
    if (!btn || !btn.classList.contains('on')) return;
    btn.classList.add('hit');
    setTimeout(function() { btn.classList.remove('hit'); }, 100);
  }

  function closeModuleMenus() {
    document.querySelectorAll('.track-module-menu').forEach(function(el) { el.remove(); });
  }

  function syncLaneTypeUI(lane, type) {
    lane.dataset.trackType = type;
    lane.className = 'track-lane track-' + type +
      (lane.classList.contains('is-muted') ? ' is-muted' : '') +
      (lane.classList.contains('is-solo') ? ' is-solo' : '') +
      (lane.classList.contains('is-locked') ? ' is-locked' : '') +
      (lane.classList.contains('has-notes') ? ' has-notes' : '');
    var lbl = lane.querySelector('.track-label');
    if (lbl) lbl.textContent = TYPE_LABEL[type];
  }

  function setTrackType(id, row, lane, type) {
    if (Sound.params.trackLocks && Sound.params.trackLocks[id]) return;
    Sound.params.trackTypes[id] = type;
    row.dataset.trackType = type;
    syncLaneTypeUI(lane, type);
    ECAudio.saveSoundPrefs();
  }

  function openModuleMenu(id, row, lane, labelEl) {
    if (Sound.params.trackLocks && Sound.params.trackLocks[id]) return;
    closeModuleMenus();
    var menu = document.createElement('div');
    menu.className = 'track-module-menu';
    menu.setAttribute('role', 'menu');
    TYPES.forEach(function(t) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'track-module-opt' + (t === getType(id, rowIndex(row)) ? ' active' : '');
      item.textContent = TYPE_LABEL[t];
      item.setAttribute('role', 'menuitem');
      item.addEventListener('click', function(e) {
        e.stopPropagation();
        setTrackType(id, row, lane, t);
        closeModuleMenus();
        if (soundEnabled) Sound.previewTrack(t, row);
      });
      menu.appendChild(item);
    });
    labelEl.appendChild(menu);
  }

  function buildLane(row) {
    if (row.querySelector('.track-lane')) return;
    var id = trackId(row);
    var idx = rowIndex(row);
    var type = getType(id, idx);
    var pat = ensurePattern(id);
    var lane = document.createElement('div');
    lane.className = 'track-lane track-' + type;
    lane.dataset.trackId = id;
    lane.dataset.trackType = type;

    var head = document.createElement('div');
    head.className = 'track-head';

    var label = document.createElement('button');
    label.type = 'button';
    label.className = 'track-label';
    label.textContent = TYPE_LABEL[type];
    label.title = 'Click: module menu · Double-click: clear row';

    label.addEventListener('click', function(e) {
      e.stopPropagation();
      if (e.target.closest('.track-module-menu')) return;
      openModuleMenu(id, row, lane, label);
    });
    label.addEventListener('dblclick', function(e) {
      e.preventDefault();
      e.stopPropagation();
      closeModuleMenus();
      clearRow(lane, grid, pat);
    });

    var controls = document.createElement('div');
    controls.className = 'track-controls';

    var muteBtn = document.createElement('button');
    muteBtn.type = 'button';
    muteBtn.className = 'track-mute';
    muteBtn.textContent = 'M';
    muteBtn.title = 'Mute row';
    muteBtn.setAttribute('aria-label', 'Mute row');
    muteBtn.setAttribute('aria-pressed', 'false');
    muteBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!Sound.params.trackMutes) Sound.params.trackMutes = {};
      Sound.params.trackMutes[id] = !Sound.params.trackMutes[id];
      syncLaneMuteSolo(lane, id);
      ECAudio.saveSoundPrefs();
    });

    var soloBtn = document.createElement('button');
    soloBtn.type = 'button';
    soloBtn.className = 'track-solo';
    soloBtn.textContent = 'S';
    soloBtn.title = 'Solo row';
    soloBtn.setAttribute('aria-label', 'Solo row');
    soloBtn.setAttribute('aria-pressed', 'false');
    soloBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!Sound.params.trackSolos) Sound.params.trackSolos = {};
      Sound.params.trackSolos[id] = !Sound.params.trackSolos[id];
      syncLaneMuteSolo(lane, id);
      ECAudio.saveSoundPrefs();
    });

    var lockBtn = document.createElement('button');
    lockBtn.type = 'button';
    lockBtn.className = 'track-lock';
    lockBtn.textContent = 'L';
    lockBtn.title = 'Lock module';
    lockBtn.setAttribute('aria-label', 'Lock module');
    lockBtn.setAttribute('aria-pressed', 'false');
    lockBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      closeModuleMenus();
      if (!Sound.params.trackLocks) Sound.params.trackLocks = {};
      Sound.params.trackLocks[id] = !Sound.params.trackLocks[id];
      syncLaneMuteSolo(lane, id);
      ECAudio.saveSoundPrefs();
    });

    controls.appendChild(muteBtn);
    controls.appendChild(soloBtn);
    controls.appendChild(lockBtn);
    head.appendChild(label);
    head.appendChild(controls);

    var vibeKey = 'lane-' + id;
    lane.addEventListener('mouseenter', function() {
      if (!soundEnabled) return;
      clearTimeout(previewTimer);
      var type = lane.dataset.trackType;
      NavVibe.noteOn(vibeKey, Sound.navFreqForTrack(type, row));
      previewTimer = setTimeout(function() {
        Sound.previewTrack(type, row, null, false);
      }, 70);
    });
    lane.addEventListener('mouseleave', function() {
      clearTimeout(previewTimer);
      NavVibe.noteOff(vibeKey);
    });

    var grid = document.createElement('div');
    grid.className = 'track-grid steps-' + stepCount();
    for (var i = 0; i < pat.length; i++) {
      var step = document.createElement('button');
      step.type = 'button';
      step.className = 'track-step';
      step.dataset.step = String(i);
      syncStepButton(step, pat[i]);
      step.setAttribute('aria-label', TYPE_LABEL[type] + ' step ' + (i + 1));
      grid.appendChild(step);
    }

    function handleStepInput(btn, soft) {
      clearTimeout(previewTimer);
      var s = Number(btn.dataset.step);
      var val = paintStep(pat, s, soft);
      syncStepButton(btn, val);
      syncLaneState(lane, pat);
      ECAudio.saveSoundPrefs();
      if (soundEnabled) {
        Sound.bootAudio();
        if (val) Sound.previewTrack(lane.dataset.trackType, row, val);
        syncPlayback();
      }
    }

    grid.addEventListener('click', function(e) {
      var btn = e.target.closest('.track-step');
      if (!btn) return;
      handleStepInput(btn, e.altKey);
    });

    grid.addEventListener('contextmenu', function(e) {
      var btn = e.target.closest('.track-step');
      if (!btn) return;
      e.preventDefault();
      handleStepInput(btn, true);
    });

    lane.appendChild(head);
    lane.appendChild(grid);
    row.appendChild(lane);
    row.classList.add('has-track-lane');
    row.dataset.trackType = type;
    syncLaneState(lane, pat);
    syncLaneMuteSolo(lane, id);
  }

  function updatePlayheadUI() {
    document.querySelectorAll('.track-step.playhead').forEach(function(el) {
      el.classList.remove('playhead');
    });
    document.querySelectorAll('.track-grid').forEach(function(grid) {
      var btn = grid.querySelector('.track-step[data-step="' + playhead + '"]');
      if (btn) btn.classList.add('playhead');
    });
  }

  function fireStep(step) {
    document.querySelectorAll('.track-lane').forEach(function(lane) {
      var id = lane.dataset.trackId;
      if (!rowAudible(id)) return;
      var type = lane.dataset.trackType;
      var pat = Sound.params.patterns[id];
      if (!pat || !pat[step]) return;
      flashStep(lane, step);
      var row = lane.closest('tr');
      if (row) Sound.playTrackStep(type, row, pat[step]);
    });
  }

  function stopSeq() {
    seqRunning = false;
    if (seqTimer) { clearTimeout(seqTimer); seqTimer = null; }
    playhead = 0;
    updatePlayheadUI();
    document.documentElement.classList.remove('sound-loop');
    NavVibe.reset();
  }

  function startSeq() {
    if (seqRunning || !soundEnabled) return;
    seqRunning = true;
    Sound.bootAudio();
    document.documentElement.classList.add('sound-loop');
    function loop() {
      if (!seqRunning) return;
      fireStep(playhead);
      updatePlayheadUI();
      var delay = Math.max(12, Sound.stepDelayMs(playhead) + Sound.humanizeJitter());
      playhead = (playhead + 1) % stepCount();
      seqTimer = setTimeout(loop, delay);
    }
    loop();
  }

  function restartSeq() {
    stopSeq();
    startSeq();
  }

  function syncPlayback() {
    if (soundEnabled) startSeq();
    else stopSeq();
  }

  function mount() {
    if (mounted) unmount();
    document.querySelectorAll('.cv-section.midi-bank .cv-table tbody tr').forEach(buildLane);
    mounted = true;
  }

  function unmount() {
    stopSeq();
    document.querySelectorAll('.track-lane').forEach(function(el) { el.remove(); });
    document.querySelectorAll('.has-track-lane').forEach(function(row) {
      row.classList.remove('has-track-lane');
      delete row.dataset.trackType;
    });
    mounted = false;
  }

  function remount() {
    if (!soundEnabled) return;
    unmount();
    mount();
    syncPlayback();
  }

  document.addEventListener('click', function(e) {
    if (!e.target.closest('.track-label') && !e.target.closest('.track-module-menu')) {
      closeModuleMenus();
    }
  });

  return {
    mount: mount, unmount: unmount, remount: remount,
    syncPlayback: syncPlayback, restartSeq: restartSeq,
    stopSeq: stopSeq, closeModuleMenus: closeModuleMenus
  };
})();
