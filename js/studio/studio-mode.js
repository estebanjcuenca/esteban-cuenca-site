/* eslint-disable no-var */
// Beat studio full-page mode — enter/exit via navbar Studio button.

function isBeatStudioActive() {
  return !!(ECAudio.BeatStudio && ECAudio.BeatStudio.isActive && ECAudio.BeatStudio.isActive());
}

function syncStudioNav() {
  var btn = document.getElementById('btn-studio');
  if (btn) btn.classList.toggle('panel-open', isBeatStudioActive());
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
  if (ECAudio.BeatStudio && ECAudio.BeatStudio.init) ECAudio.BeatStudio.init();
  if (ECAudio.BeatStudio && ECAudio.BeatStudio.show) ECAudio.BeatStudio.show();
  if (ECAudio.Markers && ECAudio.Markers.onBeatStudioChange) {
    ECAudio.Markers.onBeatStudioChange(true);
  }
  syncStudioNav();
  openStudioPanel();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (ECAudio.BeatGuide) ECAudio.BeatGuide.fire('welcome');
}

function exitBeatStudio(closePanel) {
  if (closePanel !== false) closeStudioPanel();
  document.documentElement.classList.remove('beat-studio');
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
