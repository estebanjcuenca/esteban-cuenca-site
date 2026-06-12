/* eslint-disable no-var */
// Beat studio full-page mode — enter/exit via navbar Studio button.

function isBeatStudioActive() {
  return document.documentElement.classList.contains('beat-studio');
}

function syncStudioNav() {
  var btn = document.getElementById('btn-studio');
  if (!btn) return;
  btn.classList.toggle('panel-open', isBeatStudioActive());
  btn.classList.toggle('is-loading', document.documentElement.classList.contains('beat-studio-loading'));
}

function bootBeatStudio() {
  if (ECAudio.BeatStudio && ECAudio.BeatStudio.show) ECAudio.BeatStudio.show();
  if (ECAudio.BeatStudio && ECAudio.BeatStudio.init) ECAudio.BeatStudio.init();
  if (typeof initStudioPanel === 'function') initStudioPanel();
  if (typeof initStudioInput === 'function') initStudioInput();
  if (typeof initSoundLab === 'function') initSoundLab();
  if (ECAudio.Markers && ECAudio.Markers.onBeatStudioChange) {
    ECAudio.Markers.onBeatStudioChange(true);
  }
  if (ECAudio.BeatView3d && ECAudio.BeatView3d.resume) ECAudio.BeatView3d.resume();
  syncStudioNav();
  openStudioPanel();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (ECAudio.BeatGuide) ECAudio.BeatGuide.fire('welcome');
}

function enterBeatStudio() {
  if (soundEnabled) {
    soundEnabled = false;
    enterSoundMode();
  }
  closeHoverPanel();
  if (typeof unlockBrowseAudio === 'function') unlockBrowseAudio();
  document.documentElement.classList.remove('sound-on');
  document.documentElement.classList.add('browse-mode');
  document.documentElement.classList.add('beat-studio');

  if (ECAudio.StudioLoader && ECAudio.StudioLoader.ready && ECAudio.StudioLoader.ready()) {
    bootBeatStudio();
    return;
  }

  document.documentElement.classList.add('beat-studio-loading');
  syncStudioNav();
  var load = ECAudio.StudioLoader && ECAudio.StudioLoader.load
    ? ECAudio.StudioLoader.load() : Promise.reject(new Error('Studio loader missing'));
  load.then(function() {
    document.documentElement.classList.remove('beat-studio-loading');
    bootBeatStudio();
  }).catch(function() {
    document.documentElement.classList.remove('beat-studio-loading');
    document.documentElement.classList.remove('beat-studio');
    syncStudioNav();
    if (ECAudio.debugError) ECAudio.debugError('Beat studio failed to load');
  });
}

function exitBeatStudio(closePanel) {
  if (closePanel !== false) closeStudioPanel();
  document.documentElement.classList.remove('beat-studio', 'beat-studio-loading');
  if (ECAudio.BeatView3d && ECAudio.BeatView3d.pause) ECAudio.BeatView3d.pause();
  if (ECAudio.BeatStudio && ECAudio.BeatStudio.hide) ECAudio.BeatStudio.hide();
  syncStudioNav();
  if (ECAudio.Markers && ECAudio.Markers.onBeatStudioChange) {
    ECAudio.Markers.onBeatStudioChange(false);
  }
  if (!soundEnabled && ECAudio.Zones && ECAudio.Zones.init) {
    ECAudio.Zones.init();
  }
}

function toggleBeatStudio() {
  if (isBeatStudioActive()) {
    exitBeatStudio(true);
    return;
  }
  enterBeatStudio();
}

function toggleStudio() {
  toggleBeatStudio();
}
