/* eslint-disable no-var */
// Beat studio — 3D distance + presence actively shape harmony, timing, and mix.
window.ECAudio = window.ECAudio || {};

var POS_SCALE = { x: 9.2, y: 6.4, z: 9.8 };
var HARM_INTERVALS = [0, 3, 4, 5, 7, -7, 12, -12, -5, -4, -3];
var PHASE_NEAR = 0.85;
var MELODIC_TYPES = { bass: 1, bright: 1, minimal: 1 };

function beatMarkers() {
  var beatSec = ECAudio.BEAT_STUDIO_SEC_ID || 'beat-studio';
  return (ECAudio.State.markers || []).filter(function(m) {
    return m && m.secId === beatSec;
  });
}

function markerZ(m) {
  return ECAudio.BeatPresence && ECAudio.BeatPresence.normZ
    ? ECAudio.BeatPresence.normZ(m) : 0.55;
}

function markerType(m) {
  if (!m) return 'kick';
  return m.presetId || (m.envId ? m.envId.replace(/^env-/, '') : m.role || 'kick');
}

function isMelodic(m) {
  return !!MELODIC_TYPES[markerType(m)];
}

function markerPhase(m) {
  if (!m) return 0;
  if (m.beatPhase != null) return m.beatPhase;
  if (ECAudio.BeatKaoss && ECAudio.BeatKaoss.beatPhaseFromX) {
    return ECAudio.BeatKaoss.beatPhaseFromX(m.normX);
  }
  return (m.normX != null ? m.normX : 0.5) * (ECAudio.LOOP_BEAT_STEPS || 16);
}

function worldPos(m) {
  var nx = m.normX != null ? m.normX : 0.5;
  var ny = m.normY != null ? m.normY : 0.5;
  var nz = markerZ(m);
  return {
    x: (nx - 0.5) * POS_SCALE.x,
    y: (0.5 - ny) * POS_SCALE.y,
    z: (nz - 0.5) * POS_SCALE.z
  };
}

function normDist3(a, b) {
  var pa = worldPos(a);
  var pb = worldPos(b);
  var dx = (pa.x - pb.x) / POS_SCALE.x;
  var dy = (pa.y - pb.y) / POS_SCALE.y;
  var dz = (pa.z - pb.z) / POS_SCALE.z;
  return Math.sqrt(dx * dx * 1.35 + dy * dy * 1.05 + dz * dz * 0.95);
}

function proximity(a, b) {
  var d = normDist3(a, b);
  var falloff = Math.exp(-d * 3.8);
  var zd = Math.abs(markerZ(a) - markerZ(b));
  return falloff * Math.max(0.22, 1 - zd * 0.42);
}

function presenceMul(a, b) {
  if (!ECAudio.BeatPresence || !ECAudio.BeatPresence.presenceInfluence) return 1;
  return Math.sqrt(
    ECAudio.BeatPresence.presenceInfluence(markerZ(a)) *
    ECAudio.BeatPresence.presenceInfluence(markerZ(b))
  );
}

function coupling(a, b) {
  if (!a || !b || a.id === b.id) return 0;
  var gain = ECAudio.BeatInfluence && ECAudio.BeatInfluence.couplingGainMulPair
    ? ECAudio.BeatInfluence.couplingGainMulPair(a, b) : 1;
  return Math.min(1.2, proximity(a, b) * presenceMul(a, b) * gain);
}

function peers(marker, minCoupling) {
  var min = minCoupling != null ? minCoupling : (
    ECAudio.BeatInfluence && ECAudio.BeatInfluence.peerMinCoupling
      ? ECAudio.BeatInfluence.peerMinCoupling(marker) : 0.1
  );
  var list = [];
  beatMarkers().forEach(function(m) {
    if (!m || m.id === marker.id) return;
    var c = coupling(marker, m);
    if (c < min) return;
    list.push({ marker: m, coupling: c, dist: normDist3(marker, m) });
  });
  list.sort(function(a, b) { return b.coupling - a.coupling; });
  return list;
}

function markerMidi(m) {
  if (!m || !ECAudio.Theory || !ECAudio.Theory.browsePadMidi) return 60;
  var row = ECAudio.Theory.markerPitchRow
    ? ECAudio.Theory.markerPitchRow(m) : (m.rowIndex | 0);
  return ECAudio.Theory.browsePadMidi(row, m.normY != null ? m.normY : 0.5);
}

function pullNormY(row, y, targetMidi, amount) {
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

function harmonizeMarker(marker, opts) {
  if (!marker) return null;
  opts = opts || {};
  var strength = opts.strength != null ? opts.strength : 0.48;
  var beatLock = !!opts.beatLock;
  var harmMin = ECAudio.BeatInfluence && ECAudio.BeatInfluence.peerThreshold
    ? ECAudio.BeatInfluence.peerThreshold(0.02, marker) : 0.12;
  var near = peers(marker, harmMin);
  if (!near.length) return null;

  var nx = marker.normX != null ? marker.normX : 0.5;
  var ny = marker.normY != null ? marker.normY : 0.5;
  var phase = markerPhase(marker);
  var pullX = 0;
  var pullW = 0;
  var i;

  if (!beatLock) {
    for (i = 0; i < near.length; i++) {
      var peer = near[i];
      var m = peer.marker;
      var w = peer.coupling;
      if (Math.abs(markerPhase(m) - phase) > PHASE_NEAR) continue;
      var tx = m.beatPhase != null && ECAudio.BeatKaoss && ECAudio.BeatKaoss.beatXFromPhase
        ? ECAudio.BeatKaoss.beatXFromPhase(m.beatPhase)
        : (m.normX != null ? m.normX : 0.5);
      pullX += tx * w;
      pullW += w;
    }
    if (pullW > 0.08) {
      nx = nx + ((pullX / pullW) - nx) * strength * Math.min(1, pullW * 1.4);
    }
  }

  if (isMelodic(marker) && marker.envId && ECAudio.Environments && ECAudio.Environments.pitchRow) {
    var row = ECAudio.Environments.pitchRow(marker.envId);
    var midi = markerMidi(marker);
    var bestDist = 2.4;
    var bestY = ny;
    for (i = 0; i < near.length; i++) {
      var p = near[i];
      if (!isMelodic(p.marker)) continue;
      var pRow = ECAudio.Environments.pitchRow(p.marker.envId);
      var om = markerMidi(p.marker);
      var j;
      for (j = 0; j < HARM_INTERVALS.length; j++) {
        var dist = Math.abs((om + HARM_INTERVALS[j]) - midi);
        if (dist < bestDist) {
          bestDist = dist;
          bestY = pullNormY(row, ny, om + HARM_INTERVALS[j], p.coupling * strength * 0.95);
        }
      }
    }
    ny = bestY;
  }

  nx = Math.max(0.01, Math.min(0.99, nx));
  ny = Math.max(0.02, Math.min(0.98, ny));
  return { normX: nx, normY: ny };
}

function syncMarkerBeatFromX(m, nx) {
  m.normX = nx;
  if (ECAudio.BeatKaoss && ECAudio.BeatKaoss.beatPhaseFromX) {
    m.beatPhase = ECAudio.BeatKaoss.beatPhaseFromX(nx);
    m.step = Math.max(0, Math.min((ECAudio.LOOP_BEAT_STEPS || 16) - 1, Math.round(m.beatPhase)));
    m.toneNorm = nx;
  } else if (ECAudio.Theory && ECAudio.Theory.stepFromNormX) {
    m.step = ECAudio.Theory.stepFromNormX(nx);
  }
}

function applyField(anchorId, opts) {
  opts = opts || {};
  var markers = beatMarkers();
  if (markers.length < 2) {
    if (ECAudio.BeatSeq && ECAudio.BeatSeq.refreshAllPatterns) {
      ECAudio.BeatSeq.refreshAllPatterns();
    }
    return;
  }
  var anchor = anchorId ? markers.filter(function(m) { return m.id === anchorId; })[0] : null;
  var changed = [];
  var beatLock = !!opts.beatLock;
  var pullScale = opts.pullScale != null ? opts.pullScale : 1;

  function applyOne(m, strength) {
    var h = harmonizeMarker(m, { strength: strength * pullScale, beatLock: beatLock });
    if (!h) return;
    var touched = false;
    if (Math.abs(h.normX - m.normX) > 0.002) {
      syncMarkerBeatFromX(m, h.normX);
      touched = true;
    }
    if (Math.abs(h.normY - m.normY) > 0.002) {
      m.normY = h.normY;
      touched = true;
    }
    if (touched) changed.push(m.id);
  }

  function pullFor(m) {
    return ECAudio.BeatInfluence && ECAudio.BeatInfluence.markerPullMul
      ? ECAudio.BeatInfluence.markerPullMul(m) : (
        ECAudio.BeatInfluence && ECAudio.BeatInfluence.pullMul
          ? ECAudio.BeatInfluence.pullMul(m) : 1
      );
  }
  var mel = ECAudio.BeatInfluence && ECAudio.BeatInfluence.melodicBlendMul
    ? ECAudio.BeatInfluence.melodicBlendMul(anchor || markers[0]) : 1;
  if (anchor) {
    applyOne(anchor, 0.58 * pullFor(anchor) * mel);
    var peerMin = ECAudio.BeatInfluence && ECAudio.BeatInfluence.peerThreshold
      ? ECAudio.BeatInfluence.peerThreshold(0.03, anchor) : 0.14;
    peers(anchor, peerMin).forEach(function(p) {
      applyOne(p.marker, 0.32 * p.coupling * pullFor(p.marker) * mel);
    });
  } else {
    markers.forEach(function(m) { applyOne(m, 0.22 * pullFor(m)); });
  }

  if (changed.length) {
    if (ECAudio.Markers && ECAudio.Markers.syncMarkerDataFromLive) {
      ECAudio.Markers.syncMarkerDataFromLive();
    }
    if (ECAudio.Markers && ECAudio.Markers.syncPositions) {
      ECAudio.Markers.syncPositions();
    }
    changed.forEach(function(id) {
      var m = markers.filter(function(x) { return x.id === id; })[0];
      if (m && ECAudio.Markers && ECAudio.Markers.refreshMarkerVoice) {
        ECAudio.Markers.refreshMarkerVoice(m);
      }
    });
    if (ECAudio.BeatBonds && ECAudio.BeatBonds.schedule) ECAudio.BeatBonds.schedule();
    if (ECAudio.BeatView3d && ECAudio.BeatView3d.schedule) ECAudio.BeatView3d.schedule();
  }
  if (ECAudio.BeatSeq && ECAudio.BeatSeq.refreshAllPatterns) {
    ECAudio.BeatSeq.refreshAllPatterns();
  }
}

function peerStepRaw(peer, globalStep) {
  if (!ECAudio.Theory || !ECAudio.Theory.markerBeatStepCore) return { hit: false };
  return ECAudio.Theory.markerBeatStepCore(peer, globalStep);
}

function peersOnStep(marker, globalStep, minCoupling) {
  var g = globalStep | 0;
  var baseMin = ECAudio.BeatInfluence && ECAudio.BeatInfluence.peerMinCoupling
    ? ECAudio.BeatInfluence.peerMinCoupling(marker) : 0.1;
  return peers(marker, minCoupling != null ? minCoupling : baseMin).filter(function(p) {
    var sd = peerStepRaw(p.marker, g);
    return sd && sd.hit;
  });
}

function modulateStep(marker, globalStep, stepData) {
  if (!marker || !stepData || !stepData.hit) return stepData;
  var stepMin = ECAudio.BeatInfluence && ECAudio.BeatInfluence.peerThreshold
    ? ECAudio.BeatInfluence.peerThreshold(0.04, marker) : 0.14;
  var active = peersOnStep(marker, globalStep, stepMin);
  if (!active.length) return stepData;

  var freq = stepData.freq;
  var blend = 0;
  var weight = 0;
  var i;
  for (i = 0; i < active.length; i++) {
    var p = active[i];
    var sd = peerStepRaw(p.marker, globalStep);
    if (!sd || !sd.hit || !sd.freq) continue;
    var w = p.coupling;
    blend += sd.freq * w;
    weight += w;
  }
  if (weight > 0.1) {
    var target = blend / weight;
    var mel = ECAudio.BeatInfluence && ECAudio.BeatInfluence.melodicBlendMul
      ? ECAudio.BeatInfluence.melodicBlendMul(marker) : 1;
    var pull = Math.min(0.38, (0.12 + weight * 0.22) * mel);
    freq = freq + (target - freq) * pull;
  }
  if (ECAudio.BeatMix && ECAudio.BeatMix.avoidBlendFreq) {
    freq = ECAudio.BeatMix.avoidBlendFreq(marker, freq, globalStep);
  }

  return Object.assign({}, stepData, {
    freq: Math.max(40, freq),
    vel: stepData.vel === 2 ? 2 : 1
  });
}

function modulateSpec(marker, spec) {
  if (!marker || !spec) return spec;
  var specMin = ECAudio.BeatInfluence && ECAudio.BeatInfluence.peerMinCoupling
    ? ECAudio.BeatInfluence.peerMinCoupling(marker) : 0.1;
  var near = peers(marker, specMin);
  if (!near.length) return spec;

  var space = spec.space != null ? spec.space : 0.2;
  var filterHz = spec.filterHz != null ? spec.filterHz : 8000;
  var peak = spec.beatPeak != null ? spec.beatPeak : (spec.peakGain != null ? spec.peakGain : 1);
  var wSum = 0;
  var i;

  for (i = 0; i < near.length; i++) {
    var p = near[i];
    wSum += p.coupling;
    space += p.coupling * 0.08;
    if (isMelodic(p.marker) && isMelodic(marker)) {
      filterHz += p.coupling * 180;
    }
    peak += p.coupling * 0.06;
  }

  var out = Object.assign({}, spec, {
    space: Math.min(0.92, space),
    filterHz: Math.min(14000, filterHz),
    beatPeak: peak,
    peakGain: spec.peakGain != null ? Math.min(1.2, spec.peakGain * (1 + wSum * 0.05)) : spec.peakGain
  });
  if (out.beatPunch != null) out.beatPunch = Math.min(1.25, out.beatPunch * (1 + wSum * 0.04));
  return out;
}

function bondStrength(a, b, meta) {
  var prox = proximity(a, b);
  var c = coupling(a, b);
  var strength = meta && meta.strength != null ? meta.strength : 0.4;
  strength = strength * (0.45 + prox * 0.95) * (0.7 + c * 0.55);
  return Math.max(0.08, Math.min(1.2, strength));
}

function spatialNear(a, b) {
  return normDist3(a, b) < 0.48;
}

ECAudio.BeatSpatial = {
  POS_SCALE: POS_SCALE,
  markerPhase: markerPhase,
  worldPos: worldPos,
  normDist3: normDist3,
  proximity: proximity,
  coupling: coupling,
  peers: peers,
  harmonizeMarker: harmonizeMarker,
  applyField: applyField,
  modulateStep: modulateStep,
  modulateSpec: modulateSpec,
  bondStrength: bondStrength,
  spatialNear: spatialNear
};
