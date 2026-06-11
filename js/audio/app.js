/* eslint-disable no-var */
// Thin bootstrap — wires shared audio, CV hover, and beat studio modules.

function initAudioKeyboard() {
  var hover = getHoverPanel();
  var studio = getStudioPanel();

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (ECAudio.Markers && ECAudio.Markers.closeLayerSettings && ECAudio.Markers.layerSettingsOpen &&
          ECAudio.Markers.layerSettingsOpen()) {
        ECAudio.Markers.closeLayerSettings();
        e.preventDefault();
        return;
      }
      if (isBeatStudioActive()) {
        exitBeatStudio(true);
        e.preventDefault();
        return;
      }
      if (hover && hover.classList.contains('open')) {
        toggleHoverPanel();
        e.preventDefault();
        return;
      }
      if (studio && studio.classList.contains('open')) {
        exitBeatStudio(true);
        e.preventDefault();
      }
      return;
    }
    if ((e.key === 'x' || e.key === 'X') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (document.activeElement && document.activeElement.closest('input, textarea')) return;
      if (isBeatStudioActive()) return;
      toggleHoverPanel();
      e.preventDefault();
    }
  });
}

initSoundLab();
initHoverPanel();
initStudioPanel();
initSiteAudio();
initStudioInput();
initAudioKeyboard();
