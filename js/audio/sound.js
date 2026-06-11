/* eslint-disable no-var */
window.ECAudio = window.ECAudio || {};
window.Sound = {
  params: ECAudio.params,
  playZone: ECAudio.Browse.playZone,
  stopAll: ECAudio.Browse.stopAll,
  test: function() {
    if (soundEnabled) return;
    ECAudio.Browse.test();
  },
  zoneEnter: ECAudio.Browse.zoneEnter,
  hardZoneLeave: ECAudio.Browse.hardZoneLeave,
  reconcileHover: ECAudio.Browse.reconcileHover,
  playTrackStep: ECAudio.Voices.playTrackStep,
  previewTrack: ECAudio.Voices.previewTrack,
  stepDur: ECAudio.Voices.stepDur,
  stepDelayMs: ECAudio.Voices.stepDelayMs,
  humanizeJitter: ECAudio.Voices.humanizeJitter,
  navFreqForTrack: ECAudio.Theory.navFreqForTrack,
  setReverbAmt: ECAudio.Engine.setReverbAmt,
  resetMusicBus: ECAudio.Engine.resetMusicBus,
  resetBrowseBus: ECAudio.Engine.resetBrowseBus,
  bootAudio: ECAudio.Engine.bootAudio
};
