/* eslint-disable no-var */
// Sound mode — each CV table row is a horizontal pad (row = pitch, X = tone).
window.ECAudio = window.ECAudio || {};

var PAD_WARP_X = 14;
var PAD_WARP_Y = 10;
var STICKY_WARP_X = 18;
var STICKY_WARP_Y = 14;
var ZONE_LEAVE_MS = 220;
var _loopTransport = null;
var _loopBeatStep = 0;
var _beatPreviewKey = '';
var _beatPreviewAt = 0;
var FREQ_GLIDE = 0.055;
var KAOSS_GLIDE = 0.052;
var MIN_ATTACK = 0.02;
var MIN_RELEASE = 0.09;

function browseAttack() {
  return Math.max(MIN_ATTACK, ECAudio.params.attack || 0.18);
}

function browseRelease() {
  return Math.max(MIN_RELEASE, Math.min(ECAudio.params.decay || 1.6, 0.35));
}

function vibeKey(secId) {
  return 'zone-' + secId;
}

function rowVisible(row) {
  if (!row || !row.classList.contains('row-pad')) return false;
  var sec = row.closest('.cv-section');
  if (!sec) return false;
  if (sec.classList.contains('sec-hidden') && !document.documentElement.classList.contains('beat-overlay')) {
    return false;
  }
  var r = row.getBoundingClientRect();
  return r.width > 1 && r.height > 1;
}

function rowIndexFor(row) {
  if (ECAudio.Zones && ECAudio.Zones.rowIndexInSection) {
    return ECAudio.Zones.rowIndexInSection(row);
  }
  var tbody = row.parentNode;
  var i;
  for (i = 0; i < tbody.children.length; i++) {
    if (tbody.children[i] === row) return i;
  }
  return 0;
}

function pointInRow(row, clientX, clientY) {
  var r = row.getBoundingClientRect();
  return clientX >= r.left - PAD_WARP_X && clientX <= r.right + PAD_WARP_X &&
    clientY >= r.top - PAD_WARP_Y && clientY <= r.bottom + PAD_WARP_Y;
}

function pitchRowIndex(row, sectionRowIndex) {
  if (isBeatMode() && ECAudio.Zones && ECAudio.Zones.globalRowIndex) {
    return ECAudio.Zones.globalRowIndex(row);
  }
  return sectionRowIndex != null ? sectionRowIndex : rowIndexFor(row);
}

function zoneHitFromRow(row, clientX, clientY) {
  if (!row || !rowVisible(row) || !pointInRow(row, clientX, clientY)) return null;
  var sec = row.closest('.cv-section');
  if (!sec || !sec.id) return null;
  var rowIndex = rowIndexFor(row);
  return {
    zone: row,
    secId: canonicalSectionId(sec.id),
    rowIndex: rowIndex,
    laneIndex: pitchRowIndex(row, rowIndex)
  };
}

function stickyZoneHit(clientX, clientY) {
  var zone = ECAudio.State.hoverZone;
  var secId = ECAudio.State.hoverSecId;
  var rowIndex = ECAudio.State.hoverRowIndex;
  if (!zone || !secId || !zone.isConnected) return null;
  var r = zone.getBoundingClientRect();
  if (clientX < r.left - STICKY_WARP_X || clientX > r.right + STICKY_WARP_X ||
    clientY < r.top - STICKY_WARP_Y || clientY > r.bottom + STICKY_WARP_Y) return null;
  return {
    zone: zone,
    secId: secId,
    rowIndex: rowIndex,
    laneIndex: pitchRowIndex(zone, rowIndex)
  };
}

function findZoneAt(clientX, clientY) {
  if (ECAudio.BeatStudio && ECAudio.BeatStudio.isActive && ECAudio.BeatStudio.isActive()) {
    return ECAudio.BeatStudio.findLaneAt(clientX, clientY);
  }
  var nodes = document.elementsFromPoint(clientX, clientY);
  var i;
  for (i = 0; i < nodes.length; i++) {
    var row = nodes[i].closest && nodes[i].closest('tr.row-pad');
    var hit = zoneHitFromRow(row, clientX, clientY);
    if (hit) return hit;
  }
  return stickyZoneHit(clientX, clientY);
}

function zoneNorm(zone, clientX, clientY, hit) {
  var r = zone.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return { x: 0.5, y: 0.5 };
  var x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  var y = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
  return { x: x, y: y };
}

function clearKaossDots() {
  document.querySelectorAll('.kaoss-dot').forEach(function(el) {
    el.remove();
  });
}

function syncKaossVisual(zone, normX, normY) {
  document.querySelectorAll('.influence-zone.influence-active').forEach(function(el) {
    el.classList.remove('influence-active');
  });
  clearKaossDots();
  if (!zone) return;
  zone.classList.add('influence-active');
  var overlay = null;
  var pt = null;
  if (zone.classList && zone.classList.contains('beat-lane') && ECAudio.BeatStudio) {
    overlay = ECAudio.BeatStudio.overlayForLane(zone);
    pt = ECAudio.BeatStudio.laneOverlayPoint(zone, normX, normY);
  } else if (zone.tagName === 'TR' && ECAudio.Zones && ECAudio.Zones.overlayForRow) {
    overlay = ECAudio.Zones.overlayForRow(zone);
    pt = ECAudio.Zones.rowOverlayPoint(zone, normX, normY);
  }
  if (!overlay || !pt) return;
  var dot = document.createElement('div');
  dot.className = 'kaoss-dot';
  dot.style.left = pt.left + 'px';
  dot.style.top = pt.top + 'px';
  overlay.appendChild(dot);
}

function clearKaossVisual() {
  document.querySelectorAll('.influence-zone.influence-active').forEach(function(el) {
    el.classList.remove('influence-active');
  });
  clearKaossDots();
}

function stopVoiceOscs(voice, t, rel) {
  ['osc1', 'subOsc', 'unisonOsc', 'harm2', 'harm3', 'harm4', 'lfoOsc', 'filterBase'].forEach(function(key) {
    if (!voice[key]) return;
    try { voice[key].stop(t + rel + 0.04); } catch (e) { /* ignore */ }
  });
}

function glideVoiceFreq(osc, hz, t, g) {
  if (!osc) return;
  osc.frequency.cancelScheduledValues(t);
  osc.frequency.setValueAtTime(osc.frequency.value, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, hz), t + g);
}

function setVoicePitch(voice, freq, t, glide) {
  var g = glide != null ? glide : KAOSS_GLIDE;
  glideVoiceFreq(voice.osc1, freq, t, g);
  glideVoiceFreq(voice.unisonOsc, freq, t, g);
  glideVoiceFreq(voice.harm2, freq * 2, t, g);
  glideVoiceFreq(voice.harm3, freq * 3, t, g);
  glideVoiceFreq(voice.harm4, freq * 4, t, g);
  if (voice.subOsc) glideVoiceFreq(voice.subOsc, Math.max(44, freq * 0.5), t, g);
}

function applyHarmonicLevels(voice, spec, t) {
  if (!voice || !spec || !spec.harmLevels) return;
  var h = spec.harmLevels;
  if (voice.h2Gain) voice.h2Gain.gain.setTargetAtTime(h.h2, t, 0.02);
  if (voice.h3Gain) voice.h3Gain.gain.setTargetAtTime(h.h3, t, 0.02);
  if (voice.h4Gain) voice.h4Gain.gain.setTargetAtTime(h.h4, t, 0.02);
  if (voice.unisonGain) voice.unisonGain.gain.setTargetAtTime(h.unison, t, 0.02);
}

function setupVoiceLfo(voice, spec, t) {
  if (!voice || !ECAudio.State.ctx) return;
  var ctx = ECAudio.State.ctx;
  var rate = spec.lfoRate;
  var hasLfo = rate > 0.04 && (
    spec.lfoDepthFilter > 1 || spec.lfoDepthGain > 0.001 || spec.lfoDepthPitch > 0.2
  );

  if (!hasLfo) {
    if (voice.lfoOsc) {
      try { voice.lfoOsc.stop(t); } catch (e) { /* ignore */ }
      voice.lfoOsc.disconnect();
      voice.lfoOsc = null;
    }
    if (voice.lfoDepth) { voice.lfoDepth.disconnect(); voice.lfoDepth = null; }
    voice.lfoTarget = null;
    return;
  }

  if (!voice.lfoOsc) {
    voice.lfoOsc = ctx.createOscillator();
    voice.lfoOsc.type = 'sine';
    voice.lfoDepth = ctx.createGain();
    voice.lfoOsc.connect(voice.lfoDepth);
    voice.lfoOsc.start(t);
  }

  voice.lfoOsc.frequency.setTargetAtTime(rate, t, 0.04);
  var target = spec.lfoTarget || 'filter';
  if (voice.lfoTarget !== target) {
    if (voice.lfoDepth) voice.lfoDepth.disconnect();
    if (target === 'filter' && voice.filter) {
      voice.lfoDepth.connect(voice.filter.frequency);
    } else if (target === 'gain' && voice.padGain) {
      voice.lfoDepth.connect(voice.padGain.gain);
    } else if (target === 'pitch' && voice.osc1) {
      voice.lfoDepth.connect(voice.osc1.detune);
    }
    voice.lfoTarget = target;
  }

  var depth = target === 'filter' ? spec.lfoDepthFilter :
    target === 'gain' ? spec.lfoDepthGain : spec.lfoDepthPitch;
  voice.lfoDepth.gain.setTargetAtTime(depth, t, 0.04);
}

function applyVoiceSpec(voice, spec, touchGain) {
  if (!voice || !spec || !ECAudio.State.ctx) return spec;
  var t = ECAudio.State.ctx.currentTime;
  if (voice.filterBase) {
    voice.filterBase.offset.cancelScheduledValues(t);
    voice.filterBase.offset.setTargetAtTime(spec.filterHz, t, 0.012);
  } else if (voice.filter) {
    voice.filter.frequency.cancelScheduledValues(t);
    voice.filter.frequency.setTargetAtTime(spec.filterHz, t, 0.012);
  }
  if (voice.filter) {
    voice.filter.Q.cancelScheduledValues(t);
    voice.filter.Q.setTargetAtTime(spec.filterQ, t, 0.012);
  }
  if (voice.drive && ECAudio.BrowseSound.driveCurve) {
    voice.drive.curve = ECAudio.BrowseSound.driveCurve(spec.drive || 0);
  }
  applyHarmonicLevels(voice, spec, t);
  if (voice.subGain) voice.subGain.gain.setTargetAtTime(spec.subMix, t, 0.02);
  if (voice.reverbSend) voice.reverbSend.gain.setTargetAtTime(spec.space, t, 0.03);
  if (voice.osc1) voice.osc1.detune.setTargetAtTime(spec.detune, t, 0.03);
  if (spec.wave && voice.osc1) {
    voice.osc1.type = spec.wave;
    if (voice.unisonOsc) voice.unisonOsc.type = spec.wave;
  }
  setupVoiceLfo(voice, spec, t);
  if (touchGain && voice.padGain) {
    voice.padGain.gain.setTargetAtTime(spec.peakGain, t, 0.02);
  }
  return spec;
}

function stopHold() {
  var voice = ECAudio.State.holdVoice;
  if (!voice || !ECAudio.State.ctx) {
    ECAudio.State.holdVoice = null;
    return;
  }
  if (voice.timer) {
    clearInterval(voice.timer);
    voice.timer = null;
  }
  var t = ECAudio.State.ctx.currentTime;
  var rel = browseRelease();
  try {
    voice.envGain.gain.cancelScheduledValues(t);
    voice.envGain.gain.setValueAtTime(Math.max(voice.envGain.gain.value, 0.0001), t);
    voice.envGain.gain.exponentialRampToValueAtTime(0.001, t + rel);
    stopVoiceOscs(voice, t, rel);
  } catch (e) { /* ignore */ }
  if (voice.secId) {
    NavVibe.noteOff(vibeKey(voice.secId));
    ECAudio.State.activeNodes.delete(voice.secId);
  }
  ECAudio.State.holdVoice = null;
}

function kaossVoiceFreq(voice, secId, normX, normY) {
  if (voice.arpeggio && voice.stepBase != null) return Math.max(88, voice.stepBase);
  if (ECAudio.Theory.resolveBrowsePitch) {
    return ECAudio.Theory.resolveBrowsePitch(secId, normX, normY, voice.rowIndex);
  }
  return ECAudio.Theory.zonePitch(secId, normX, normY);
}

function liveBrowseSpec(normX, normY, sizeNorm) {
  var markerCount = isBeatMode() ? (ECAudio.State.markers || []).length : 0;
  return ECAudio.BrowseSound.resolve({
    normX: normX,
    normY: normY,
    sizeNorm: sizeNorm,
    count: markerCount
  });
}

function applyKaossTone(voice, normX, normY, touchGain) {
  if (!voice || !ECAudio.State.ctx) return;
  var spec = liveBrowseSpec(normX, normY, voice.sizeNorm);
  voice.normX = normX;
  voice.normY = normY;
  applyVoiceSpec(voice, spec, touchGain);
}

function applyKaossPitch(voice, secId, normX, normY, glide) {
  if (!voice || !ECAudio.State.ctx) return;
  var t = ECAudio.State.ctx.currentTime;
  var freq = kaossVoiceFreq(voice, secId, normX, normY);
  voice.freq = freq;
  setVoicePitch(voice, freq, t, glide);
}

function applyKaoss(voice, secId, normX, normY, glide) {
  if (!voice || !ECAudio.State.ctx) return;
  applyKaossPitch(voice, secId, normX, normY, glide);
  applyKaossTone(voice, normX, normY, !voice.arpeggio);
  NavVibe.noteOn(vibeKey(secId), voice.freq);
}

function musicalNormY(secId, normY) {
  if (ECAudio.Theory.zoneSnapY) return ECAudio.Theory.zoneSnapY(secId, normY);
  return normY;
}

function modulateZone(secId, normX, normY, rowIndex) {
  var voice = ECAudio.State.holdVoice;
  if (!voice || voice.secId !== secId) return;
  if (rowIndex != null) voice.rowIndex = rowIndex;
  normY = musicalNormY(secId, normY);
  var midi = ECAudio.Theory.resolveBrowseMidi
    ? ECAudio.Theory.resolveBrowseMidi(secId, normY, voice.rowIndex)
    : ECAudio.Theory.zoneDegreeMidi(secId, normY);
  var moved = Math.abs(voice.normX - normX) > 0.006 ||
    Math.abs(voice.normY - normY) > 0.006 ||
    voice.targetMidi !== midi;
  if (!moved) return;
  voice.targetMidi = midi;
  applyKaoss(voice, secId, normX, normY, KAOSS_GLIDE);
}

function glideZone(secId, normX, normY, rowIndex) {
  var voice = ECAudio.State.holdVoice;
  if (!voice || !voice.osc1 || voice.arpeggio || !ECAudio.State.ctx) return false;
  var prevId = voice.secId;
  voice.secId = secId;
  if (rowIndex != null) voice.rowIndex = rowIndex;
  voice.targetMidi = ECAudio.Theory.resolveBrowseMidi
    ? ECAudio.Theory.resolveBrowseMidi(secId, normY, voice.rowIndex)
    : ECAudio.Theory.zoneDegreeMidi(secId, normY);
  applyKaoss(voice, secId, normX, normY, FREQ_GLIDE);
  if (prevId !== secId) {
    if (prevId) NavVibe.noteOff(vibeKey(prevId));
    ECAudio.State.activeNodes.clear();
    ECAudio.State.activeNodes.set(secId, voice);
  }
  return true;
}

function createHoldVoice(secId, normX, normY, forArp, zone, rowIndex) {
  ECAudio.Engine.bootAudio();
  ECAudio.Engine.boot();
  var t = ECAudio.State.ctx.currentTime;
  var spec = liveBrowseSpec(normX, normY);
  var atk = Math.max(MIN_ATTACK, spec.attack);
  var wave = spec.wave || ECAudio.params.wave || 'sine';
  var freq = ECAudio.Theory.resolveBrowsePitch
    ? ECAudio.Theory.resolveBrowsePitch(secId, normX, normY, rowIndex)
    : ECAudio.Theory.zonePitch(secId, normX, normY);
  var targetMidi = ECAudio.Theory.resolveBrowseMidi
    ? ECAudio.Theory.resolveBrowseMidi(secId, normY, rowIndex)
    : ECAudio.Theory.zoneDegreeMidi(secId, normY);
  var peak = spec.peakGain;
  var ctx = ECAudio.State.ctx;

  var osc1 = ctx.createOscillator();
  var unisonOsc = ctx.createOscillator();
  var harm2 = ctx.createOscillator();
  var harm3 = ctx.createOscillator();
  var harm4 = ctx.createOscillator();
  var subOsc = ctx.createOscillator();
  var unisonGain = ctx.createGain();
  var h2Gain = ctx.createGain();
  var h3Gain = ctx.createGain();
  var h4Gain = ctx.createGain();
  var subGain = ctx.createGain();
  var toneMix = ctx.createGain();
  var drive = ctx.createWaveShaper();
  var filter = ctx.createBiquadFilter();
  var filterBase = ctx.createConstantSource();
  var padGain = ctx.createGain();
  var envGain = ctx.createGain();
  var harm = spec.harmLevels || { h2: 0, h3: 0, h4: 0, unison: 0, drive: 0 };

  osc1.type = wave;
  unisonOsc.type = wave;
  harm2.type = 'sine';
  harm3.type = 'sine';
  harm4.type = 'sine';
  subOsc.type = 'sine';
  osc1.frequency.value = freq;
  unisonOsc.frequency.value = freq;
  unisonOsc.detune.value = 7;
  harm2.frequency.value = freq * 2;
  harm3.frequency.value = freq * 3;
  harm4.frequency.value = freq * 4;
  subOsc.frequency.value = Math.max(44, freq * 0.5);
  osc1.detune.setValueAtTime(spec.detune, t);
  unisonGain.gain.value = harm.unison;
  h2Gain.gain.value = harm.h2;
  h3Gain.gain.value = harm.h3;
  h4Gain.gain.value = harm.h4;
  subGain.gain.value = spec.subMix;
  toneMix.gain.value = 1;
  drive.curve = ECAudio.BrowseSound.driveCurve(spec.drive || 0);
  drive.oversample = '2x';
  filter.type = 'lowpass';
  filter.Q.value = spec.filterQ;
  filterBase.offset.value = spec.filterHz;
  filterBase.connect(filter.frequency);
  filterBase.start(t);
  if (forArp) {
    padGain.gain.setValueAtTime(0, t);
    envGain.gain.setValueAtTime(1, t);
  } else {
    padGain.gain.setValueAtTime(peak, t);
    envGain.gain.setValueAtTime(0, t);
    envGain.gain.linearRampToValueAtTime(1, t + atk);
  }

  osc1.connect(toneMix);
  unisonOsc.connect(unisonGain);
  unisonGain.connect(toneMix);
  harm2.connect(h2Gain);
  h2Gain.connect(toneMix);
  harm3.connect(h3Gain);
  h3Gain.connect(toneMix);
  harm4.connect(h4Gain);
  h4Gain.connect(toneMix);
  toneMix.connect(drive);
  drive.connect(filter);
  subOsc.connect(subGain);
  subGain.connect(filter);
  filter.connect(padGain);
  padGain.connect(envGain);
  envGain.connect(ECAudio.Engine.browseOut());
  var reverbSend = ECAudio.Engine.browseWetSend(padGain, spec.space);
  osc1.start(t);
  unisonOsc.start(t);
  harm2.start(t);
  harm3.start(t);
  harm4.start(t);
  subOsc.start(t);

  var voice = {
    osc1: osc1, unisonOsc: unisonOsc, harm2: harm2, harm3: harm3, harm4: harm4,
    unisonGain: unisonGain, h2Gain: h2Gain, h3Gain: h3Gain, h4Gain: h4Gain,
    subOsc: subOsc, subGain: subGain, toneMix: toneMix, drive: drive,
    filter: filter, filterBase: filterBase, padGain: padGain, envGain: envGain,
    reverbSend: reverbSend,
    secId: secId, zone: zone, freq: freq, targetMidi: targetMidi,
    normX: normX, normY: normY, rowIndex: rowIndex, sizeNorm: null,
    arpeggio: !!forArp, arpStep: 0, timer: null,
    lfoOsc: null, lfoDepth: null, lfoTarget: null
  };
  setupVoiceLfo(voice, spec, t);
  return voice;
}

function startHold(secId, normX, normY, zone, rowIndex) {
  if (glideZone(secId, normX, normY, rowIndex)) return;
  stopHold();
  var voice = createHoldVoice(secId, normX, normY, false, zone, rowIndex);
  ECAudio.State.holdVoice = voice;
  ECAudio.State.activeNodes.set(secId, voice);
  NavVibe.noteOn(vibeKey(secId), voice.freq);
}

function arpPeak(normX, normY) {
  return liveBrowseSpec(normX, normY).peakGain * 0.34;
}

function loopTickMs() {
  return ECAudio.Theory.loopStepMs ? ECAudio.Theory.loopStepMs() : ECAudio.Theory.beatMs() / 4;
}

function playArpStep(voice, secId, stepData, normX, normY, peakMul, spec) {
  var t = ECAudio.State.ctx.currentTime;
  var tickMs = loopTickMs();
  var stepSec = tickMs / 1000;
  var dur = stepSec;
  var decayMul = spec && spec.beatDecay != null ? spec.beatDecay : 1;
  var peakMulRole = spec && spec.beatPeak != null ? spec.beatPeak : 1;
  var punch = spec && spec.beatPunch != null ? spec.beatPunch : 1;
  dur *= decayMul;
  if (spec && spec.synthLayer) {
    dur = Math.min(spec.decay != null ? spec.decay : 1.4, stepSec * decayMul);
    dur = Math.max(stepSec * 1.6, dur);
  }
  var peak = arpPeak(normX, normY) * (peakMul != null ? peakMul : 1) * peakMulRole * punch;
  var atk = spec && spec.beatAttack != null ? spec.beatAttack : Math.min(0.07, dur * 0.32);
  if (spec && spec.attack != null && !spec.synthLayer) atk = Math.min(atk, spec.attack);
  var g = spec && spec.synthLayer ? Math.min(0.14, FREQ_GLIDE * 1.4) : Math.min(FREQ_GLIDE, dur * 0.4);
  var freq = stepData.freq;
  var sustain = spec && spec.synthLayer ? 0.42 : 0.18;

  voice.stepBase = stepData.base;
  voice.freq = freq;
  setVoicePitch(voice, freq, t, g);
  voice.padGain.gain.cancelScheduledValues(t);
  var cur = spec && spec.synthLayer
    ? Math.max(voice.padGain.gain.value * 0.55, 0)
    : Math.min(voice.padGain.gain.value, peak);
  voice.padGain.gain.setValueAtTime(cur, t);
  voice.padGain.gain.linearRampToValueAtTime(peak, t + atk);
  voice.padGain.gain.linearRampToValueAtTime(peak * sustain, t + dur * 0.72);
  voice.padGain.gain.linearRampToValueAtTime(0.0001, t + dur);
}

function pulseMarkerBeat(marker) {
  if (!marker || !marker.el) return;
  marker.el.classList.add('is-beat');
  setTimeout(function() {
    if (marker.el) marker.el.classList.remove('is-beat');
  }, Math.min(120, loopTickMs() * 0.55));
}

function clearArpTimer(voice) {
  if (voice && voice.timer) {
    clearInterval(voice.timer);
    voice.timer = null;
  }
}

function softArpDuck(voice) {
  if (!voice || !ECAudio.State.ctx) return;
  var t = ECAudio.State.ctx.currentTime;
  voice.padGain.gain.cancelScheduledValues(t);
  voice.padGain.gain.setValueAtTime(voice.padGain.gain.value, t);
  var rel = voice.synthLayer ? 0.28 : 0.035;
  var floor = voice.synthLayer ? 0.0004 : 0.0001;
  voice.padGain.gain.linearRampToValueAtTime(floor, t + rel);
}

function runArpTick(secId, token) {
  if (ECAudio.State.hoverSecId !== secId || token !== ECAudio.State.hoverToken) return;
  var voice = ECAudio.State.holdVoice;
  if (!voice || !voice.arpeggio || voice.secId !== secId) return;

  var nx = ECAudio.State.kaossX;
  var ny = ECAudio.State.kaossY;
  var step = voice.arpStep;
  var key = vibeKey(secId);
  var stepData = ECAudio.Theory.zoneArpStep(secId, step, nx, ny, voice.rowIndex);

  NavVibe.noteOn(key + '-s' + step, stepData.freq);
  setTimeout(function() { NavVibe.noteOff(key + '-s' + step); }, ECAudio.Theory.stepMs() * 0.75);

  ECAudio.Engine.bootAudio();
  ECAudio.Engine.boot();
  function go() {
    if (ECAudio.State.hoverSecId !== secId || token !== ECAudio.State.hoverToken) return;
    var v = ECAudio.State.holdVoice;
    if (!v || !v.arpeggio || v.secId !== secId) return;
    playArpStep(v, secId, stepData, nx, ny);
    applyKaossTone(v, nx, ny, false);
  }
  if (ECAudio.State.ctx.state === 'suspended') {
    ECAudio.State.ctx.resume().then(go);
  } else {
    go();
  }
  voice.arpStep = step + 1;
}

function armArpTimer(secId, token) {
  var voice = ECAudio.State.holdVoice;
  if (!voice) return;
  clearArpTimer(voice);
  runArpTick(secId, token);
  voice.timer = setInterval(function() {
    runArpTick(secId, token);
  }, ECAudio.Theory.stepMs());
}

function retargetArpZone(secId, normX, normY, rowIndex) {
  var voice = ECAudio.State.holdVoice;
  if (!voice || !voice.arpeggio || !ECAudio.State.ctx) return false;

  clearArpTimer(voice);
  var prevId = voice.secId;
  voice.secId = secId;
  voice.arpStep = 0;
  voice.normX = normX;
  voice.normY = normY;
  if (rowIndex != null) voice.rowIndex = rowIndex;
  voice.targetMidi = ECAudio.Theory.resolveBrowseMidi
    ? ECAudio.Theory.resolveBrowseMidi(secId, normY, voice.rowIndex)
    : ECAudio.Theory.zoneDegreeMidi(secId, normY);

  if (prevId && prevId !== secId) {
    NavVibe.noteOff(vibeKey(prevId));
    ECAudio.State.activeNodes.delete(prevId);
  }
  ECAudio.State.activeNodes.set(secId, voice);

  softArpDuck(voice);
  applyKaossTone(voice, normX, normY, false);
  armArpTimer(secId, ECAudio.State.hoverToken);
  return true;
}

function startArpeggio(secId, normX, normY, zone, rowIndex) {
  stopHold();
  ECAudio.Engine.bootAudio();
  ECAudio.Engine.boot();
  var token = ECAudio.State.hoverToken;

  function begin() {
    var voice = createHoldVoice(secId, normX, normY, true, zone, rowIndex);
    ECAudio.State.holdVoice = voice;
    ECAudio.State.activeNodes.set(secId, voice);
    armArpTimer(secId, token);
  }

  if (ECAudio.State.ctx.state === 'suspended') {
    ECAudio.State.ctx.resume().then(begin);
  } else {
    begin();
  }
}

function playZone(zone, secId, normX, normY, rowIndex) {
  if (soundEnabled || !secId) return;
  if (ECAudio.BeatGuide) ECAudio.BeatGuide.fire('row_hover');
  var nx = normX != null ? normX : ECAudio.State.kaossX;
  var ny = normY != null ? normY : ECAudio.State.kaossY;
  ny = musicalNormY(secId, ny);
  ECAudio.State.kaossX = nx;
  ECAudio.State.kaossY = ny;
  ECAudio.State.hoverZone = zone;
  ECAudio.State.hoverSecId = secId;
  ECAudio.State.hoverRowIndex = rowIndex;
  var token = ++ECAudio.State.hoverToken;

  function go() {
    if (ECAudio.State.hoverToken !== token || ECAudio.State.hoverSecId !== secId) return;
    if (ECAudio.params.mode === 'arpeggio') {
      var arp = ECAudio.State.holdVoice;
      if (arp && arp.arpeggio && arp.secId === secId && arp.rowIndex === rowIndex) return;
      if (arp && arp.arpeggio && arp.secId === secId && arp.rowIndex !== rowIndex) {
        stopHold();
        startArpeggio(secId, nx, ny, zone, rowIndex);
        return;
      }
      if (arp && arp.arpeggio && arp.secId !== secId && retargetArpZone(secId, nx, ny, rowIndex)) return;
      stopHold();
      startArpeggio(secId, nx, ny, zone, rowIndex);
      return;
    }
    var hold = ECAudio.State.holdVoice;
    if (hold && !hold.arpeggio && hold.secId === secId) {
      if (zone) hold.zone = zone;
      modulateZone(secId, nx, ny, rowIndex);
      return;
    }
    if (hold && !hold.arpeggio && hold.secId !== secId && glideZone(secId, nx, ny, rowIndex)) {
      if (zone) hold.zone = zone;
      return;
    }
    startHold(secId, nx, ny, zone, rowIndex);
  }

  ECAudio.Engine.bootAudio().then(go);
}

function stopAll() {
  ECAudio.State.hoverToken++;
  ECAudio.State.hoverZone = null;
  ECAudio.State.hoverSecId = null;
  ECAudio.State.lastZone = null;
  stopHold();
  ECAudio.State.activeNodes.clear();
  clearKaossVisual();
  NavVibe.reset();
}

function hardZoneLeave() {
  ECAudio.State.inTableZone = false;
  ECAudio.State.lastZone = null;
  stopAll();
}

function scheduleZoneLeave() {
  if (ECAudio.State.tableLeaveTimer) clearTimeout(ECAudio.State.tableLeaveTimer);
  ECAudio.State.tableLeaveTimer = setTimeout(function() {
    ECAudio.State.tableLeaveTimer = null;
    if (soundEnabled) return;
    var x = ECAudio.State.ptrX;
    var y = ECAudio.State.ptrY;
    if (x >= 0 && findZoneAt(x, y)) return;
    if (isBeatMode()) {
      stopHold();
      ECAudio.State.hoverSecId = null;
      clearKaossVisual();
      return;
    }
    ECAudio.Browse.hardZoneLeave();
  }, ZONE_LEAVE_MS);
}

function zoneEnter() {
  if (ECAudio.State.tableLeaveTimer) {
    clearTimeout(ECAudio.State.tableLeaveTimer);
    ECAudio.State.tableLeaveTimer = null;
  }
  ECAudio.State.inTableZone = true;
}

function isBeatMode() {
  return !!(ECAudio.BeatStudio && ECAudio.BeatStudio.isActive && ECAudio.BeatStudio.isActive());
}

function hoverPreviewPreset(rowIndex) {
  if (ECAudio.Markers && ECAudio.Markers.getSelected) {
    var sel = ECAudio.Markers.getSelected();
    if (sel && sel.presetId) return sel.presetId;
  }
  if (ECAudio.MarkerDrums && ECAudio.MarkerDrums.defaultPresetForLane) {
    return ECAudio.MarkerDrums.defaultPresetForLane(rowIndex);
  }
  return 'kick';
}

var _synthPreviewVoice = null;

function ensureSynthPreviewVoice() {
  if (_synthPreviewVoice) return _synthPreviewVoice;
  _synthPreviewVoice = createHoldVoice('synth-preview', 0.5, 0.5, true, null, 0);
  _synthPreviewVoice.synthLayer = true;
  return _synthPreviewVoice;
}

function disposeSynthPreviewVoice() {
  if (!_synthPreviewVoice) return;
  stopPinnedVoice(_synthPreviewVoice);
  _synthPreviewVoice = null;
}

function playSynthLayerPreview(marker, stepData, normX, normY) {
  if (!marker || !stepData || !ECAudio.State.ctx) return;
  var voice = ensureSynthPreviewVoice();
  var spec = ECAudio.Theory.composeMarkerVoice(marker);
  applyVoiceSpec(voice, spec, false);
  voice.rowIndex = marker.rowIndex;
  playArpStep(voice, marker.secId || 'preview', stepData, normX, normY, 0.72, spec);
}

function previewBeatHit(zone, secId, normX, normY, rowIndex) {
  var now = Date.now();
  var step = ECAudio.Theory.stepFromNormX ? ECAudio.Theory.stepFromNormX(normX) : 0;
  var key = rowIndex + ':' + step;
  if (key === _beatPreviewKey && now - _beatPreviewAt < 180) return;
  _beatPreviewKey = key;
  _beatPreviewAt = now;

  var presetId = hoverPreviewPreset(rowIndex);
  var melodicLane = ECAudio.MarkerDrums && ECAudio.MarkerDrums.isMelodicLane
    ? ECAudio.MarkerDrums.isMelodicLane(rowIndex) : false;
  var previewY = melodicLane ? normY : 0.5;
  var fake = {
    secId: secId,
    normX: ECAudio.Theory.normXFromStep ? ECAudio.Theory.normXFromStep(step) : normX,
    normY: previewY,
    step: step,
    laneIndex: rowIndex,
    rowIndex: rowIndex,
    toneNorm: melodicLane ? normX : 0.5,
    presetId: presetId,
    sizeNorm: 0.32,
    levelMul: 0.62,
    params: ECAudio.Markers && ECAudio.Markers.defaultMarkerParams
      ? ECAudio.Markers.defaultMarkerParams() : {},
    pitchMul: 1
  };
  if (ECAudio.Markers && ECAudio.Markers.applyPresetToMarker && ECAudio.SoundPresets[presetId]) {
    var keys = ECAudio.MARKER_PRESET_KEYS || [];
    var preset = ECAudio.SoundPresets[presetId];
    keys.forEach(function(k) {
      if (preset[k] != null) fake.params[k] = preset[k];
    });
    if (preset.pitchMul != null) fake.pitchMul = preset.pitchMul;
  }

  var stepData = ECAudio.Theory.markerBeatStep
    ? ECAudio.Theory.markerBeatStep(fake, step)
    : null;
  if (!stepData || !stepData.hit) {
    var rootPitch = ECAudio.Theory.browsePadPitch
      ? ECAudio.Theory.browsePadPitch(rowIndex, previewY) : 220;
    stepData = {
      hit: true,
      freq: Math.max(40, rootPitch * (fake.pitchMul != null ? fake.pitchMul : 1)),
      base: rootPitch
    };
  }

  ECAudio.Engine.bootAudio();
  ECAudio.Engine.boot();
  function go() {
    if (ECAudio.MarkerDrums && ECAudio.MarkerDrums.isPercussion &&
        ECAudio.MarkerDrums.isPercussion(presetId)) {
      ECAudio.MarkerDrums.play(fake, stepData);
    } else {
      playSynthLayerPreview(fake, stepData, fake.normX, previewY);
    }
    NavVibe.pulse(stepData.freq, loopTickMs() * 0.55);
  }
  if (ECAudio.State.ctx.state === 'suspended') {
    ECAudio.State.ctx.resume().then(go);
  } else {
    go();
  }
}

function reconcileBeatHover(clientX, clientY) {
  ECAudio.State.ptrX = clientX;
  ECAudio.State.ptrY = clientY;

  var hit = findZoneAt(clientX, clientY);
  if (hit) {
    var lane = hit.laneIndex != null ? hit.laneIndex : hit.rowIndex;
    if (ECAudio.MarkerDrums && ECAudio.MarkerDrums.isActiveBeatLane &&
        !ECAudio.MarkerDrums.isActiveBeatLane(lane)) {
      ECAudio.State.lastZone = null;
      clearKaossVisual();
      scheduleZoneLeave();
      return;
    }
    zoneEnter();
    var norm = zoneNorm(hit.zone, clientX, clientY, hit);
    if (ECAudio.Theory.padSnapRowNormY) norm.y = ECAudio.Theory.padSnapRowNormY(norm.y);
    ECAudio.State.kaossX = norm.x;
    ECAudio.State.kaossY = norm.y;
    ECAudio.State.hoverZone = hit.zone;
    ECAudio.State.hoverSecId = hit.secId;
    ECAudio.State.hoverRowIndex = hit.rowIndex;
    syncKaossVisual(hit.zone, norm.x, norm.y);
    previewBeatHit(hit.zone, hit.secId, norm.x, norm.y, hit.laneIndex != null ? hit.laneIndex : hit.rowIndex);
    return;
  }

  ECAudio.State.lastZone = null;
  clearKaossVisual();
  scheduleZoneLeave();
}

function enterBeatMode() {
  stopHold();
  ECAudio.State.hoverSecId = null;
  _beatPreviewKey = '';
}

function leaveBeatMode() {
  stopHold();
  clearKaossVisual();
  disposeSynthPreviewVoice();
  _beatPreviewKey = '';
}

function reconcileHover(clientX, clientY) {
  if (soundEnabled || clientX < 0 || isBeatMode()) return;
  ECAudio.State.ptrX = clientX;
  ECAudio.State.ptrY = clientY;

  var hit = findZoneAt(clientX, clientY);
  if (hit) {
    zoneEnter();
    var norm = zoneNorm(hit.zone, clientX, clientY, hit);
    norm.y = musicalNormY(hit.secId, norm.y);
    ECAudio.State.kaossX = norm.x;
    ECAudio.State.kaossY = norm.y;
    syncKaossVisual(hit.zone, norm.x, norm.y);
    var sameCell = ECAudio.State.hoverSecId === hit.secId &&
      ECAudio.State.hoverRowIndex === hit.rowIndex;
    if (!sameCell) {
      playZone(hit.zone, hit.secId, norm.x, norm.y, hit.rowIndex);
    } else {
      modulateZone(hit.secId, norm.x, norm.y, hit.rowIndex);
    }
    return;
  }

  ECAudio.State.lastZone = null;
  clearKaossVisual();
  scheduleZoneLeave();
}

function restartHoldVoice() {
  var hold = ECAudio.State.holdVoice;
  if (!hold || hold.secId == null || hold.normX == null || hold.normY == null) return;
  var secId = hold.secId;
  var normX = hold.normX;
  var normY = hold.normY;
  var rowIndex = hold.rowIndex;
  var zone = hold.zone;
  stopHold();
  if (ECAudio.params.mode === 'arpeggio') {
    startArpeggio(secId, normX, normY, zone, rowIndex);
  } else {
    startHold(secId, normX, normY, zone, rowIndex);
  }
}

function test() {
  var secId = 'sec-film-and-immersive-work';
  var zone = document.querySelector('#' + secId + ' tr.row-pad');
  var freq = ECAudio.Theory.browsePadPitch
    ? ECAudio.Theory.browsePadPitch(0, 0.5)
    : ECAudio.Theory.zonePitch(secId, 0.5, 0.5);
  NavVibe.pulse(freq, (ECAudio.params.attack + ECAudio.params.decay) * 1000);
  ECAudio.Engine.bootAudio();
  ECAudio.Engine.boot();
  function go() {
    var t = ECAudio.State.ctx.currentTime;
    var atk = browseAttack();
    var dec = ECAudio.params.decay || 1.6;
    var osc = ECAudio.State.ctx.createOscillator();
    var gain = ECAudio.State.ctx.createGain();
    osc.type = ECAudio.params.wave || 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    osc.detune.setValueAtTime(ECAudio.params.detune || 0, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(ECAudio.params.gain || 0.12, t + atk);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + atk + dec);
    osc.connect(gain);
    gain.connect(ECAudio.Engine.browseOut());
    osc.start(t);
    osc.stop(t + atk + dec + 0.1);
  }
  if (ECAudio.State.ctx.state === 'suspended') {
    ECAudio.State.ctx.resume().then(go);
  } else {
    go();
  }
}

function markerPolyLevel(count) {
  return ECAudio.Theory.markerPolyLevel(count);
}

function applyMarkerTone(voice, marker) {
  if (!voice || !marker || !ECAudio.State.ctx) return;
  voice.sizeNorm = marker.sizeNorm;
  var spec = ECAudio.Theory.composeMarkerVoice(marker);
  applyVoiceSpec(voice, spec, false);
  voice.markerLevel = spec.mixLevel;
  return spec;
}

function applyPinnedMarkerLevel(voice, marker) {
  if (!voice || !marker) return;
  var spec = applyMarkerTone(voice, marker);
  if (!spec || !voice.padGain || !ECAudio.State.ctx) return;
  var mul = marker.levelMul != null ? marker.levelMul : 1;
  if (!voice.arpeggio) {
    voice.padGain.gain.setTargetAtTime(spec.peakGain * mul, ECAudio.State.ctx.currentTime, 0.05);
  }
}

function createPinnedVoice(marker) {
  if (ECAudio.MarkerDrums && ECAudio.MarkerDrums.isPercussion &&
      ECAudio.MarkerDrums.isPercussion(marker.presetId)) {
    return ECAudio.MarkerDrums.stubVoice(marker);
  }
  var voice = createHoldVoice(marker.secId, marker.normX, marker.normY, true, null, marker.rowIndex);
  var spec = ECAudio.Theory.composeMarkerVoice(marker);
  var t = ECAudio.State.ctx.currentTime;
  var atk = Math.max(MIN_ATTACK, spec.attack);
  voice.padGain.gain.cancelScheduledValues(t);
  voice.envGain.gain.cancelScheduledValues(t);
  voice.padGain.gain.setValueAtTime(0, t);
  voice.envGain.gain.setValueAtTime(1, t);
  applyMarkerTone(voice, marker);
  if (marker.params && marker.params.wave && voice.osc1) {
    voice.osc1.type = marker.params.wave;
    if (voice.unisonOsc) voice.unisonOsc.type = marker.params.wave;
  }
  voice.pinned = true;
  voice.synthLayer = ECAudio.Theory && ECAudio.Theory.markerUsesSynthVoice
    ? ECAudio.Theory.markerUsesSynthVoice(marker) : false;
  return voice;
}

function previewMarkerSound(marker) {
  if (!marker || soundEnabled) return;
  ECAudio.Engine.bootAudio();
  ECAudio.Engine.boot();
  function go() {
    if (!marker.voice) {
      marker.voice = createPinnedVoice(marker);
      if (marker.voice && marker.voice.arpeggio) armPinnedArp(marker);
      if (marker.el) marker.el.classList.add('is-playing');
    }
    runPinnedArpTick(marker, marker.step != null ? marker.step : 0);
    if (ECAudio.SoundVisual && ECAudio.SoundVisual.ensureAnalyser) ECAudio.SoundVisual.ensureAnalyser();
  }
  if (ECAudio.State.ctx.state === 'suspended') {
    ECAudio.State.ctx.resume().then(go);
  } else {
    go();
  }
}

function runPinnedArpTick(marker, globalStep) {
  var voice = marker && marker.voice;
  if (!voice || !voice.pinned || !voice.arpeggio || !ECAudio.State.ctx) return;
  if ((ECAudio.State.markers || []).indexOf(marker) < 0) return;
  if (ECAudio.Markers && ECAudio.Markers.shouldPlayInMix && !ECAudio.Markers.shouldPlayInMix(marker)) {
    if (!voice.isDrum) softArpDuck(voice);
    return;
  }

  var step = globalStep != null ? globalStep : voice.arpStep;
  var stepData = ECAudio.Theory.markerBeatStep
    ? ECAudio.Theory.markerBeatStep(marker, step)
    : ECAudio.Theory.zoneArpStep(marker.secId, step, marker.normX, marker.normY, marker.rowIndex);

  if (stepData.hit === false) {
    if (!voice.isDrum) softArpDuck(voice);
    return;
  }

  if (voice.isDrum && ECAudio.MarkerDrums && ECAudio.MarkerDrums.isPercussion &&
      marker.presetId && ECAudio.MarkerDrums.isPercussion(marker.presetId) &&
      ECAudio.MarkerDrums.play) {
    ECAudio.MarkerDrums.play(marker, stepData);
    pulseMarkerBeat(marker);
    if (globalStep == null) voice.arpStep += 1;
    return;
  }

  var spec = ECAudio.Theory.composeMarkerVoice(marker);
  var toneX = marker.toneNorm != null ? marker.toneNorm : marker.normX;
  applyMarkerTone(voice, marker);
  playArpStep(
    voice, marker.secId, stepData, toneX, marker.normY,
    voice.markerLevel || 1, spec
  );
  pulseMarkerBeat(marker);
  if (globalStep == null) voice.arpStep += 1;
}

function collectBeatHitRoles(globalStep) {
  var roles = [];
  if (!ECAudio.Theory || !ECAudio.Theory.markerBeatStep) return roles;
  (ECAudio.State.markers || []).forEach(function(m) {
    if (ECAudio.Markers && ECAudio.Markers.shouldPlayInMix && !ECAudio.Markers.shouldPlayInMix(m)) return;
    var stepData = ECAudio.Theory.markerBeatStep(m, globalStep);
    if (!stepData || !stepData.hit) return;
    var role = ECAudio.Theory.normalizeLoopRole
      ? ECAudio.Theory.normalizeLoopRole(m.role)
      : (m.role || 'kick');
    if (roles.indexOf(role) < 0) roles.push(role);
  });
  return roles;
}

function tickLoopTransport() {
  var markers = ECAudio.State.markers || [];
  if (!markers.length) {
    stopLoopTransport();
    return;
  }
  var hitRoles = collectBeatHitRoles(_loopBeatStep);
  markers.forEach(function(m) {
    runPinnedArpTick(m, _loopBeatStep);
  });
  if (ECAudio.Markers && ECAudio.Markers.updateBeatRuler) {
    ECAudio.Markers.updateBeatRuler(_loopBeatStep, hitRoles);
  }
  if (hitRoles.length && ECAudio.BeatGuide) {
    ECAudio.BeatGuide.fire('ruler_hit');
  }
  var steps = ECAudio.LOOP_BEAT_STEPS || 16;
  _loopBeatStep = (_loopBeatStep + 1) % steps;
}

function ensureLoopTransport() {
  if (_loopTransport) return;
  _loopBeatStep = 0;
  tickLoopTransport();
  _loopTransport = setInterval(tickLoopTransport, loopTickMs());
}

function stopLoopTransport() {
  if (_loopTransport) {
    clearInterval(_loopTransport);
    _loopTransport = null;
  }
  _loopBeatStep = 0;
  if (ECAudio.Markers && ECAudio.Markers.updateBeatRuler) ECAudio.Markers.updateBeatRuler(-1);
}

function restartLoopTransport() {
  stopLoopTransport();
  if ((ECAudio.State.markers || []).length) ensureLoopTransport();
}

function armPinnedArp(marker) {
  if (!marker || !marker.voice || !marker.voice.arpeggio) return;
  clearArpTimer(marker.voice);
  ensureLoopTransport();
}

function stopPreview() {
  stopHold();
  clearKaossVisual();
}

function stopPinnedVoice(voice) {
  if (!voice || !ECAudio.State.ctx) return;
  if (voice.isDrum) {
    clearArpTimer(voice);
    return;
  }
  clearArpTimer(voice);
  var t = ECAudio.State.ctx.currentTime;
  var rel = browseRelease();
  try {
    voice.envGain.gain.cancelScheduledValues(t);
    voice.envGain.gain.setValueAtTime(Math.max(voice.envGain.gain.value, 0.0001), t);
    voice.envGain.gain.exponentialRampToValueAtTime(0.001, t + rel);
    stopVoiceOscs(voice, t, rel);
  } catch (e) { /* ignore */ }
}

function applyPinnedTone(voice, normX, normY, polyLevel) {
  if (!voice) return;
  applyKaossTone(voice, normX, normY, true);
  if (polyLevel != null && voice.padGain && ECAudio.State.ctx) {
    var spec = liveBrowseSpec(normX, normY);
    voice.padGain.gain.setTargetAtTime(spec.peakGain * polyLevel / ECAudio.BrowseSound.polyLevel(1), ECAudio.State.ctx.currentTime, 0.05);
    voice.markerLevel = polyLevel;
  }
}

function rebalancePinnedVoices() {
  var markers = ECAudio.State.markers || [];
  markers.forEach(function(m) {
    if (!m.voice) return;
    applyPinnedMarkerLevel(m.voice, m);
  });
}

function refreshLiveBrowseAudio() {
  rebalancePinnedVoices();
  var hold = ECAudio.State.holdVoice;
  if (hold && hold.normX != null) {
    applyKaossTone(hold, hold.normX, hold.normY, !hold.arpeggio);
  }
}

ECAudio.Browse = {
  playZone: playZone, stopAll: stopAll, modulateZone: modulateZone,
  findZoneAt: findZoneAt, zoneNorm: zoneNorm, zoneEnter: zoneEnter, hardZoneLeave: hardZoneLeave,
  scheduleZoneLeave: scheduleZoneLeave, reconcileHover: reconcileHover,
  createPinnedVoice: createPinnedVoice, stopPinnedVoice: stopPinnedVoice,
  applyPinnedTone: applyPinnedTone, applyMarkerTone: applyMarkerTone,
  applyPinnedMarkerLevel: applyPinnedMarkerLevel, rebalancePinnedVoices: rebalancePinnedVoices,
  refreshLiveBrowseAudio: refreshLiveBrowseAudio, applyVoiceSpec: applyVoiceSpec,
  setVoicePitch: setVoicePitch,
  armPinnedArp: armPinnedArp, stopLoopTransport: stopLoopTransport,
  restartLoopTransport: restartLoopTransport, stopPreview: stopPreview,
  isBeatMode: isBeatMode, enterBeatMode: enterBeatMode, leaveBeatMode: leaveBeatMode,
  getLoopBeatStep: function() { return _loopBeatStep; },
  pitchRowIndex: pitchRowIndex,
  markerPolyLevel: markerPolyLevel,
  restartHoldVoice: restartHoldVoice,
  previewMarkerSound: previewMarkerSound,
  test: test,
  play: function() { /* legacy */ },
  stop: function() { stopAll(); },
  hardTableLeave: function() { hardZoneLeave(); },
  tableEnter: zoneEnter,
  scheduleTableLeave: scheduleZoneLeave
};
