/* eslint-disable no-var */
// Beat pad — Kaoss-style continuous X/Y with soft grid magnetism + dot influence.
window.ECAudio = window.ECAudio || {};

var BEAT_STEPS = 16;
var SNAP_PHASE = 0.44;
var SNAP_PHASE_DRAG = 0.22;
var SNAP_Y = 0.05;
var PHASE_NEAR = 0.52;
var PHASE_NEAR_PERC = 0.36;
var TIME_PULL = 0.36;
var PITCH_PULL = 0.55;
var CROSS_PITCH_PULL = 0.3;
var HARM_INTERVALS = [0, 3, 4, 5, 7, -7, 12, -12, -5, -4, -3];

function beatPhaseFromX(normX) {
  var x = Math.max(0, Math.min(1, normX != null ? normX : 0.5));
  return x * BEAT_STEPS;
}

function beatXFromPhase(phase) {
  return Math.max(0.01, Math.min(0.99, phase / BEAT_STEPS));
}

function softSnapBeatX(normX, snapWidth) {
  var x = Math.max(0.01, Math.min(0.99, normX != null ? normX : 0.5));
  var phase = x * BEAT_STEPS;
  var nearest = Math.round(phase);
  var sw = snapWidth != null ? snapWidth : SNAP_PHASE;
  if (Math.abs(phase - nearest) < sw) return nearest / BEAT_STEPS;
  return x;
}

function softSnapBeatY(normY) {
  var y = Math.max(0.02, Math.min(0.98, normY != null ? normY : 0.5));
  if (!ECAudio.Theory || !ECAudio.Theory.padSnapRowNormY) return y;
  var snapped = ECAudio.Theory.padSnapRowNormY(y);
  if (Math.abs(y - snapped) < SNAP_Y) return snapped;
  return y;
}

function markerPhaseFromMarker(m) {
  if (!m) return 0;
  if (m.beatPhase != null) return m.beatPhase;
  return beatPhaseFromX(m.normX);
}

function envIsMelodic(envId) {
  if (!envId) return false;
  var type = envId.replace(/^env-/, '');
  return type === 'bass' || type === 'bright' || type === 'minimal';
}

function envIsPercussion(envId) {
  if (!envId) return false;
  var type = envId.replace(/^env-/, '');
  return type === 'kick' || type === 'hat' || type === 'clap';
}

function markerById(id) {
  var markers = ECAudio.State.markers || [];
  var i;
  for (i = 0; i < markers.length; i++) {
    if (markers[i].id === id) return markers[i];
  }
  return null;
}

function peerCoupling(self, peer) {
  if (!self || !peer || !ECAudio.BeatPresence || !ECAudio.BeatPresence.couplingMul) return 1;
  return ECAudio.BeatPresence.couplingMul(self, peer);
}

function peersNearPhase(envId, excludeId, phase, opts) {
  opts = opts || {};
  var self = excludeId ? markerById(excludeId) : null;
  var isPerc = envIsPercussion(envId);
  var phaseNear = isPerc
    ? PHASE_NEAR_PERC
    : (opts.dragging ? 0.42 : PHASE_NEAR);
  if (self && ECAudio.BeatSpatial && ECAudio.BeatSpatial.peers) {
    var min = ECAudio.BeatInfluence && ECAudio.BeatInfluence.peerMinCoupling
      ? ECAudio.BeatInfluence.peerMinCoupling(self || envId) : 0.1;
    var spatial = ECAudio.BeatSpatial.peers(self, min);
    var out = [];
    var i;
    for (i = 0; i < spatial.length; i++) {
      var m = spatial[i].marker;
      if (!m || m.id === excludeId) continue;
      if (isPerc && envIsMelodic(m.envId)) continue;
      if (Math.abs(markerPhaseFromMarker(m) - phase) < phaseNear) out.push(m);
    }
    return out;
  }
  return (ECAudio.State.markers || []).filter(function(m) {
    if (!m || m.id === excludeId || !m.envId) return false;
    if (isPerc && envIsMelodic(m.envId)) return false;
    return Math.abs(markerPhaseFromMarker(m) - phase) < phaseNear;
  });
}

function influencePull(marker) {
  if (marker && ECAudio.BeatInfluence && ECAudio.BeatInfluence.markerPullMul) {
    return ECAudio.BeatInfluence.markerPullMul(marker);
  }
  return ECAudio.BeatInfluence && ECAudio.BeatInfluence.pullMul
    ? ECAudio.BeatInfluence.pullMul(marker || null) : 1;
}

function harmonizeBeatX(normX, envId, excludeId, opts) {
  opts = opts || {};
  var snapOn = !ECAudio.BeatInfluence || !ECAudio.BeatInfluence.snapBeatOn ||
    ECAudio.BeatInfluence.snapBeatOn(self || envId);
  var self = excludeId ? markerById(excludeId) : null;
  var pull = influencePull(self);
  var isPerc = envIsPercussion(envId);
  var snapW = opts.dragging ? SNAP_PHASE_DRAG : SNAP_PHASE;
  var x = snapOn
    ? softSnapBeatX(normX, snapW)
    : Math.max(0.01, Math.min(0.99, normX != null ? normX : 0.5));
  if (!envId || !snapOn || pull < 0.02) return x;
  var phase = beatPhaseFromX(x);
  var peers = peersNearPhase(envId, excludeId, phase, opts);
  if (!peers.length) return x;

  var pullX = 0;
  var weight = 0;
  var pullScale = opts.dragging ? 0.28 : (isPerc ? 0.55 : 1);
  var i;
  for (i = 0; i < peers.length; i++) {
    var m = peers[i];
    if (isPerc && envIsMelodic(m.envId)) continue;
    var dp = Math.abs(markerPhaseFromMarker(m) - phase);
    if (dp > (isPerc ? 0.72 : 1.25)) continue;
    var spatial = ECAudio.BeatSpatial && ECAudio.BeatSpatial.proximity && self
      ? ECAudio.BeatSpatial.proximity(self, m) : 1;
    var sameRole = m.envId === envId ? 1 : (isPerc ? 0.35 : 0.45);
    var w = (1 - dp / (isPerc ? 0.72 : 1.25)) * sameRole * peerCoupling(self, m) * spatial;
    if (w <= 0) continue;
    var tx = m.beatPhase != null
      ? beatXFromPhase(m.beatPhase)
      : (m.normX != null ? m.normX : 0.5);
    pullX += tx * w;
    weight += w;
  }
  if (weight > 0.12) {
    var target = pullX / weight;
    var reach = ECAudio.BeatInfluence && ECAudio.BeatInfluence.reachMul
      ? ECAudio.BeatInfluence.reachMul(self || envId) : 1;
    var reachAmt = isPerc ? (0.25 + reach * 0.28) : (0.55 + reach * 0.45);
    x = x + (target - x) * TIME_PULL * Math.min(1, weight) * pull * pullScale * reachAmt;
  }
  return Math.max(0.01, Math.min(0.99, x));
}

function pullYTowardMidi(row, y, targetMidi, amount) {
  if (!ECAudio.Theory || !ECAudio.Theory.browsePadMidi) return y;
  var cur = ECAudio.Theory.browsePadMidi(row, y);
  var bestY = y;
  var bestDist = Math.abs(targetMidi - cur);
  if (ECAudio.Theory.normYForMidi) {
    bestY = ECAudio.Theory.normYForMidi(row, targetMidi);
  } else {
    var k;
    for (k = 0; k <= 24; k++) {
      var ny = k / 24;
      var d = Math.abs(ECAudio.Theory.browsePadMidi(row, ny) - targetMidi);
      if (d < bestDist) {
        bestDist = d;
        bestY = ny;
      }
    }
  }
  return y + (bestY - y) * amount;
}

function harmonizeBeatY(normY, envId, excludeId, phase) {
  var snapOn = !ECAudio.BeatInfluence || !ECAudio.BeatInfluence.snapPitchOn ||
    ECAudio.BeatInfluence.snapPitchOn(self || envId);
  var self = excludeId ? markerById(excludeId) : null;
  var pull = influencePull(self);
  var y = snapOn
    ? softSnapBeatY(normY)
    : Math.max(0.02, Math.min(0.98, normY != null ? normY : 0.5));
  if (!envId || !ECAudio.Environments || !ECAudio.Environments.pitchRow) return y;
  if (!envIsMelodic(envId)) return y;
  if (!snapOn || pull < 0.02) return y;

  var row = ECAudio.Environments.pitchRow(envId);
  var peers = peersNearPhase(envId, excludeId, phase);
  if (!peers.length || !ECAudio.Theory.browsePadMidi) return y;

  var sameEnv = peers.filter(function(m) { return m.envId === envId; });
  var i;
  for (i = 0; i < sameEnv.length; i++) {
    if (Math.abs(sameEnv[i].normY - y) < 0.04) return sameEnv[i].normY;
  }

  var midi = ECAudio.Theory.browsePadMidi(row, y);
  var bestDist = 2.2;
  var bestY = y;

  for (i = 0; i < peers.length; i++) {
    var m = peers[i];
    if (!envIsMelodic(m.envId)) continue;
    var mRow = ECAudio.Environments.pitchRow(m.envId);
    var om = ECAudio.Theory.browsePadMidi(mRow, m.normY);
    var couple = peerCoupling(self, m);
    var spatial = ECAudio.BeatSpatial && ECAudio.BeatSpatial.proximity && self
      ? ECAudio.BeatSpatial.proximity(self, m) : 1;
    var reach = ECAudio.BeatInfluence && ECAudio.BeatInfluence.reachMul
      ? ECAudio.BeatInfluence.reachMul(self || envId) : 1;
    var pullAmt = (m.envId === envId ? PITCH_PULL : CROSS_PITCH_PULL) *
      couple * spatial * pull * (0.55 + reach * 0.45);
    var j;
    for (j = 0; j < HARM_INTERVALS.length; j++) {
      var dist = Math.abs((om + HARM_INTERVALS[j]) - midi);
      if (dist < bestDist) {
        bestDist = dist;
        bestY = pullYTowardMidi(row, y, om + HARM_INTERVALS[j], pullAmt);
      }
    }
  }

  return Math.max(0.02, Math.min(0.98, bestY));
}

function beatKaossPitch(rowIndex, normY) {
  if (!ECAudio.Theory || !ECAudio.Theory.browsePadMidi || !ECAudio.Engine.freqFromMidi) {
    return 110;
  }
  var keys = ECAudio.Theory.browseRowKeyCount
    ? ECAudio.Theory.browseRowKeyCount() : 5;
  if (keys <= 1) return ECAudio.Theory.browsePadPitch(rowIndex, normY);

  var keyNorm = ECAudio.Theory.keyNormFromRowNorm(normY);
  var keyPos = keyNorm * (keys - 1);
  var lo = Math.floor(keyPos);
  var hi = Math.min(keys - 1, lo + 1);
  var frac = keyPos - lo;
  var rowNormLo = ECAudio.Theory.rowNormFromKeyNorm(lo / (keys - 1));
  var rowNormHi = ECAudio.Theory.rowNormFromKeyNorm(hi / (keys - 1));
  var midiLo = ECAudio.Theory.browsePadMidi(rowIndex, rowNormLo);
  var midiHi = ECAudio.Theory.browsePadMidi(rowIndex, rowNormHi);
  var midi = midiLo + (midiHi - midiLo) * frac;
  return Math.max(40, ECAudio.Engine.freqFromMidi(midi));
}

function mapPlacement(normX, normY, envId, excludeId, opts) {
  opts = opts || {};
  var x = harmonizeBeatX(normX, envId, excludeId, opts);
  var phase = beatPhaseFromX(x);
  var y = harmonizeBeatY(normY, envId, excludeId, phase);
  var result = {
    normX: x,
    normY: y,
    beatPhase: phase,
    toneNorm: x,
    step: Math.max(0, Math.min(BEAT_STEPS - 1, Math.round(phase)))
  };
  if (!opts.skipMixResolve && !opts.dragging && ECAudio.BeatMix &&
      ECAudio.BeatMix.resolvePlacementClash) {
    result = ECAudio.BeatMix.resolvePlacementClash(result, envId, excludeId);
  }
  return result;
}

function markerHitsStep(marker, globalStep) {
  if (!marker) return false;
  var g = globalStep | 0;
  if (ECAudio.BeatSeq && ECAudio.BeatSeq.patternForMarker) {
    var info = ECAudio.BeatSeq.patternForMarker(marker);
    if (info && info.pattern) return !!(info.pattern[g] || 0);
  }
  var phase = marker.beatPhase != null
    ? marker.beatPhase
    : beatPhaseFromX(marker.normX);
  return Math.abs(g - phase) < 0.52;
}

function noteLabel(rowIndex, normY) {
  if (!ECAudio.Theory || !ECAudio.Theory.browsePadNoteLabel) return '—';
  var snapped = ECAudio.Theory.padSnapRowNormY
    ? ECAudio.Theory.padSnapRowNormY(normY) : normY;
  return ECAudio.Theory.browsePadNoteLabel(rowIndex, snapped).split(' · ')[0];
}

ECAudio.BeatKaoss = {
  STEPS: BEAT_STEPS,
  beatPhaseFromX: beatPhaseFromX,
  beatXFromPhase: beatXFromPhase,
  softSnapBeatX: softSnapBeatX,
  softSnapBeatY: softSnapBeatY,
  beatKaossPitch: beatKaossPitch,
  mapPlacement: mapPlacement,
  markerHitsStep: markerHitsStep,
  noteLabel: noteLabel
};
