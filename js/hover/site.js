/* eslint-disable no-var */
// CV site browse mode — table row hover, music mode, pointer tracking.

var soundEnabled = false;

var _pointer = { x: -1, y: -1, active: false };
var _reconcileQueued = false;
function unlockBrowseAudio() {
  Sound.bootAudio();
}

function enterSoundMode() {
  exitBeatStudio(false);
  document.documentElement.classList.remove('sound-on');
  document.documentElement.classList.add('browse-mode');
  if (ECAudio.Zones && ECAudio.Zones.teardown) ECAudio.Zones.teardown();
  if (TrackSeq.unmount) TrackSeq.unmount();
  if (ECAudio.Zones && ECAudio.Zones.init) ECAudio.Zones.init();
  document.documentElement.dataset.steps = String(Sound.params.steps || 16);
  syncPanelSections();
  TrackSeq.closeModuleMenus();
  if (typeof TrackSeq.stopSeq === 'function') TrackSeq.stopSeq();
  if (ECAudio.Browse.hardZoneLeave) ECAudio.Browse.hardZoneLeave();
  if (ECAudio.Engine.resetMusicBus) ECAudio.Engine.resetMusicBus();
  if (ECAudio.Engine.resetBrowseBus) ECAudio.Engine.resetBrowseBus();
  NavVibe.reset();
}

function enterMusicMode() {
  exitBeatStudio(false);
  if (ECAudio.Zones && ECAudio.Zones.teardown) ECAudio.Zones.teardown();
  document.documentElement.classList.remove('browse-mode');
  document.documentElement.classList.add('sound-on');
  document.documentElement.dataset.steps = String(Sound.params.steps || 16);
  syncPanelSections();
  if (ECAudio.Markers && ECAudio.Markers.clearAll) ECAudio.Markers.clearAll();
  if (ECAudio.Browse.hardZoneLeave) ECAudio.Browse.hardZoneLeave();
  if (ECAudio.Engine.resetBrowseBus) ECAudio.Engine.resetBrowseBus();
  if (ECAudio.Engine.resetMusicBus) ECAudio.Engine.resetMusicBus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  Sound.bootAudio();
  if (document.querySelector('.cv-section.midi-bank')) {
    TrackSeq.mount();
    TrackSeq.syncPlayback();
  }
}

function applySoundMode() {
  if (soundEnabled) enterMusicMode();
  else enterSoundMode();
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  applySoundMode();
  if (typeof syncSoundPanelUI === 'function') syncSoundPanelUI();
}

function reconcileCurrentHover() {
  if (_pointer.x < 0 || soundEnabled || isBeatStudioActive()) return;
  ECAudio.Browse.reconcileHover(_pointer.x, _pointer.y);
}

function scheduleHoverReconcile() {
  if (_reconcileQueued || soundEnabled || isBeatStudioActive()) return;
  _reconcileQueued = true;
  requestAnimationFrame(function() {
    _reconcileQueued = false;
    if (_pointer.x < 0) return;
    ECAudio.Browse.reconcileHover(_pointer.x, _pointer.y);
  });
}

function trackPointer(e) {
  _pointer.x = e.clientX;
  _pointer.y = e.clientY;
  _pointer.active = true;
}

function initInfluenceZones() {
  if (ECAudio.Zones && ECAudio.Zones.init) ECAudio.Zones.init();
}

function initHoverTracking() {
  if (initHoverTracking.bound) return;
  initHoverTracking.bound = true;

  document.addEventListener('pointerdown', function(e) {
    unlockBrowseAudio();
    trackPointer(e);
    if (!soundEnabled && !isBeatStudioActive() && _pointer.x >= 0) {
      ECAudio.Browse.reconcileHover(_pointer.x, _pointer.y);
    }
  }, { passive: true, capture: true });

  document.addEventListener('pointermove', function(e) {
    unlockBrowseAudio();
    trackPointer(e);
    if (!soundEnabled && !isBeatStudioActive() && _pointer.x >= 0) {
      ECAudio.Browse.reconcileHover(_pointer.x, _pointer.y);
    }
  }, { passive: true });

  document.addEventListener('pointerup', function(e) {
    trackPointer(e);
    if (!isBeatStudioActive()) scheduleHoverReconcile();
  }, { passive: true });

  document.addEventListener('pointercancel', function() {
    if (!soundEnabled && !isBeatStudioActive()) ECAudio.Browse.hardZoneLeave();
  });

  document.addEventListener('pointerleave', function() {
    _pointer.active = false;
    _pointer.x = -1;
    _pointer.y = -1;
  });

  window.addEventListener('scroll', scheduleHoverReconcile, { passive: true, capture: true });
  window.addEventListener('wheel', scheduleHoverReconcile, { passive: true, capture: true });
  window.addEventListener('blur', function() {
    _pointer.active = false;
    _pointer.x = -1;
    _pointer.y = -1;
    if (!soundEnabled && !isBeatStudioActive()) ECAudio.Browse.hardZoneLeave();
  });
  document.addEventListener('visibilitychange', function() {
    if (document.hidden && !soundEnabled && !isBeatStudioActive()) ECAudio.Browse.hardTableLeave();
  });
}

function initSiteAudio() {
  initInfluenceZones();
  initHoverTracking();
  soundEnabled = false;
  document.documentElement.classList.add('browse-mode');
}
