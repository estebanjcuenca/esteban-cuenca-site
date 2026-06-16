/* eslint-disable no-var */
// Beat studio — frequency-aware compound mix: sidechain, collision resolve, viz data.
window.ECAudio = window.ECAudio || {};

var ROLE_BAND = {
  kick: { lo: 28, hi: 150, mask: 'sub' },
  bass: { lo: 40, hi: 420, mask: 'low' },
  hat: { lo: 3200, hi: 18000, mask: 'air' },
  clap: { lo: 700, hi: 7000, mask: 'mid' },
  bright: { lo: 260, hi: 10000, mask: 'lead' },
  minimal: { lo: 160, hi: 4800, mask: 'warm' },
  synth: { lo: 200, hi: 9000, mask: 'synth' },
  arpeggio: { lo: 280, hi: 7200, mask: 'arp' }
};

var ROLE_PRIO = { kick: 6, clap: 5, hat: 4, bass: 3, bright: 2, minimal: 2, synth: 2, arpeggio: 2 };
var MUTE_GROUPS = [['hat', 'clap']];

var _stepCache = { step: -1, hits: [], pairs: [] };
var _duckMeter = { depth: 0, until: 0 };

function beatMarkers() {
  var beatSec = ECAudio.BEAT_STUDIO_SEC_ID || 'beat-studio';
  return (ECAudio.State.markers || []).filter(function(m) {
    return m && m.secId === beatSec;
  });
}

function markerType(marker) {
  if (!marker) return 'kick';
  if (ECAudio.BeatSeq && ECAudio.BeatSeq.markerType) return ECAudio.BeatSeq.markerType(marker);
  return marker.presetId || (marker.envId ? marker.envId.replace(/^env-/, '') : 'kick');
}

function isMelodic(marker) {
  var t = markerType(marker);
  return t === 'bass' || t === 'bright' || t === 'minimal' || t === 'synth' || t === 'arpeggio';
}

function isPerc(marker) {
  var t = markerType(marker);
  return t === 'kick' || t === 'hat' || t === 'clap';
}

function bandFor(marker, freq) {
  var type = markerType(marker);
  var b = ROLE_BAND[type] || ROLE_BAND.bright;
  var f = freq != null ? freq : 440;
  return {
    type: type,
    lo: b.lo,
    hi: b.hi,
    center: f,
    mask: b.mask,
    prio: ROLE_PRIO[type] != null ? ROLE_PRIO[type] : 1
  };
}

function midiFromFreq(freq) {
  if (!freq || !ECAudio.Engine || !ECAudio.Engine.midiFromFreq) return 60;
  return ECAudio.Engine.midiFromFreq(freq);
}

function freqOverlap(aBand, bBand) {
  if (!aBand || !bBand) return 0;
  if (aBand.mask === 'sub' && bBand.mask === 'air') return 0;
  if (aBand.mask === 'air' && bBand.mask === 'sub') return 0;
  var lo = Math.max(aBand.lo, bBand.lo);
  var hi = Math.min(aBand.hi, bBand.hi);
  if (hi <= lo) {
    if (isMelodic({ presetId: aBand.type }) && isMelodic({ presetId: bBand.type })) {
      var semi = Math.abs(midiFromFreq(aBand.center) - midiFromFreq(bBand.center));
      if (semi <= 1.2) return 0.82;
      if (semi <= 2.2) return 0.42;
    }
    return 0;
  }
  var span = Math.max(40, Math.min(aBand.hi - aBand.lo, bBand.hi - bBand.lo));
  return Math.min(1, (hi - lo) / span);
}

function coupling(a, b) {
  if (!ECAudio.BeatSpatial || !ECAudio.BeatSpatial.coupling) return 0;
  return ECAudio.BeatSpatial.coupling(a, b);
}

function loopStep() {
  if (ECAudio.Browse && ECAudio.Browse.getLoopBeatStep) {
    return ECAudio.Browse.getLoopBeatStep();
  }
  return 0;
}

function collectStepHits(globalStep) {
  var g = globalStep | 0;
  var hits = [];
  if (!ECAudio.Theory || !ECAudio.Theory.markerBeatStepCore) return hits;
  beatMarkers().forEach(function(m) {
    if (ECAudio.Markers && ECAudio.Markers.shouldPlayInMix && !ECAudio.Markers.shouldPlayInMix(m)) return;
    var sd = ECAudio.Theory.markerBeatStepCore(m, g);
    if (!sd || !sd.hit) return;
    hits.push({
      marker: m,
      stepData: sd,
      band: bandFor(m, sd.freq),
      type: markerType(m)
    });
  });
  return hits;
}

function buildCollisions(hits) {
  var pairs = [];
  var i;
  var j;
  for (i = 0; i < hits.length; i++) {
    for (j = i + 1; j < hits.length; j++) {
      var ha = hits[i];
      var hb = hits[j];
      var ov = freqOverlap(ha.band, hb.band);
      if (ov < 0.18) continue;
      var c = coupling(ha.marker, hb.marker);
      var severity = ov * (0.55 + c * 0.65);
      if (severity < 0.14) continue;
      var winner = ha.band.prio >= hb.band.prio ? ha : hb;
      var loser = winner === ha ? hb : ha;
      pairs.push({
        a: ha.marker,
        b: hb.marker,
        overlap: ov,
        severity: severity,
        coupling: c,
        winner: winner.marker,
        loser: loser.marker
      });
    }
  }
  return pairs;
}

function refreshStepMix(globalStep) {
  var g = globalStep | null;
  if (g == null) g = loopStep();
  if (_stepCache.step === g && _stepCache.hits.length) return _stepCache;
  var hits = collectStepHits(g);
  _stepCache = {
    step: g,
    hits: hits,
    pairs: buildCollisions(hits)
  };
  return _stepCache;
}

function collisionsFor(markerId, globalStep) {
  var mix = refreshStepMix(globalStep);
  return mix.pairs.filter(function(p) {
    return p.a.id === markerId || p.b.id === markerId;
  });
}

function isLoser(marker, pair) {
  return pair.loser && pair.loser.id === marker.id;
}

function nudgeFreq(marker, freq, dir) {
  if (!freq || !isMelodic(marker)) return freq;
  var t = markerType(marker);
  var ratio = t === 'bass' ? 0.943 : 1.059;
  if (dir < 0) ratio = 1 / ratio;
  return Math.max(40, freq * ratio);
}

function loopTickMs() {
  return ECAudio.Theory && ECAudio.Theory.loopStepMs
    ? ECAudio.Theory.loopStepMs() : 120;
}

function estimateStepFreq(marker, step) {
  if (!marker || !ECAudio.Theory || !ECAudio.Theory.markerBeatStepCore) return 220;
  var sd = ECAudio.Theory.markerBeatStepCore(marker, step | 0);
  return sd && sd.freq ? sd.freq : 220;
}

function isPercType(type) {
  return type === 'kick' || type === 'hat' || type === 'clap';
}

function stepWouldClash(a, b, step) {
  if (!a || !b || a.id === b.id) return false;
  var c = coupling(a, b);
  if (c < 0.08) return false;
  var typeA = markerType(a);
  var typeB = markerType(b);
  if (isPercType(typeA) && isPercType(typeB)) return false;
  if (isPercType(typeA) && typeB === 'bass') return false;
  if (typeA === 'bass' && isPercType(typeB)) return false;
  var fa = bandFor(a, estimateStepFreq(a, step));
  var fb = bandFor(b, estimateStepFreq(b, step));
  return freqOverlap(fa, fb) >= 0.2;
}

function placementShouldNudge(stub, peer, step) {
  if (!stepWouldClash(stub, peer, step)) return false;
  var ta = markerType(stub);
  var tb = markerType(peer);
  if (isPercType(ta) || isPercType(tb)) return false;
  return true;
}

function stubFromPlacement(placement, envId, excludeId) {
  var type = envId ? envId.replace(/^env-/, '') : 'kick';
  var nx = placement.normX != null ? placement.normX : 0.5;
  var ny = placement.normY != null ? placement.normY : 0.5;
  return {
    id: excludeId || '__place__',
    envId: envId,
    presetId: type,
    normX: nx,
    normY: ny,
    normZ: 0.55,
    beatPhase: placement.beatPhase != null ? placement.beatPhase : nx * (ECAudio.LOOP_BEAT_STEPS || 16),
    step: placement.step != null ? placement.step : Math.max(0, Math.min(15, Math.round(nx * 16))),
    toneNorm: placement.toneNorm != null ? placement.toneNorm : nx,
    secId: ECAudio.BEAT_STUDIO_SEC_ID || 'beat-studio'
  };
}

function placementClashScore(stub, excludeId) {
  var count = 0;
  var severity = 0;
  var markers = beatMarkers();
  var i;
  for (i = 0; i < markers.length; i++) {
    var peer = markers[i];
    if (!peer || peer.id === excludeId || peer.id === stub.id) continue;
    var step = stub.step != null ? stub.step : Math.round(stub.normX * 16);
    if (!stepWouldClash(stub, peer, step)) continue;
    count++;
    severity += coupling(stub, peer);
    if (!placementShouldNudge(stub, peer, step)) severity *= 0.35;
  }
  return { count: count, severity: severity };
}

function placementWouldClash(placement, envId, excludeId) {
  if (!placement || !envId) return { clash: false, count: 0, severity: 0 };
  var stub = stubFromPlacement(placement, envId, excludeId);
  var score = placementClashScore(stub, excludeId);
  return {
    clash: score.count > 0,
    count: score.count,
    severity: score.severity
  };
}

function resolvePlacementClash(placement, envId, excludeId) {
  if (!placement || !envId) return placement;
  var out = Object.assign({}, placement);
  var baseStub = stubFromPlacement(out, envId, excludeId);
  var baseScore = placementClashScore(baseStub, excludeId);
  if (!baseScore.count) return out;
  if (isPercType(envId ? envId.replace(/^env-/, '') : '')) {
    var onlyMelodic = beatMarkers().some(function(peer) {
      if (!peer || peer.id === excludeId) return false;
      var step = out.step != null ? out.step : Math.round(out.normX * 16);
      return placementShouldNudge(baseStub, peer, step);
    });
    if (!onlyMelodic) return Object.assign({}, out, { _placementClash: baseScore.count > 0 });
  }

  var best = out;
  var bestTotal = baseScore.severity + baseScore.count * 2;
  var tries = [];
  var di;
  for (di = 1; di <= 7; di++) {
    tries.push({ dx: di / 16, dy: 0 });
    tries.push({ dx: -di / 16, dy: 0 });
    tries.push({ dx: 0, dy: 0.045 * di });
    tries.push({ dx: 0, dy: -0.045 * di });
    tries.push({ dx: di / 16, dy: 0.04 });
    tries.push({ dx: -di / 16, dy: -0.04 });
  }

  for (di = 0; di < tries.length; di++) {
    var t = tries[di];
    var nx = Math.max(0.02, Math.min(0.98, out.normX + t.dx));
    var ny = Math.max(0.02, Math.min(0.98, out.normY + t.dy));
    var cand;
    if (ECAudio.BeatKaoss && ECAudio.BeatKaoss.mapPlacement) {
      cand = ECAudio.BeatKaoss.mapPlacement(nx, ny, envId, excludeId, { skipMixResolve: true });
    } else {
      cand = {
        normX: nx, normY: ny,
        beatPhase: nx * 16,
        step: Math.round(nx * 16),
        toneNorm: nx
      };
    }
    var stub = stubFromPlacement(cand, envId, excludeId);
    var sc = placementClashScore(stub, excludeId);
    var total = sc.severity + sc.count * 2;
    if (total < bestTotal) {
      bestTotal = total;
      best = cand;
    }
  }

  if (bestTotal < baseScore.severity + baseScore.count * 2) {
    return Object.assign({}, best, { _placementDeClashed: true });
  }
  return Object.assign({}, out, { _placementClash: true });
}

function refinePattern(pat, marker) {
  if (!pat || !marker || !marker.id) return pat;
  var n = pat.length;
  var peers = ECAudio.BeatSpatial && ECAudio.BeatSpatial.peers
    ? ECAudio.BeatSpatial.peers(marker, peerMin(marker)) : [];
  if (!peers.length) return pat;
  var i;
  var pi;
  for (i = 0; i < n; i++) {
    if (!pat[i]) continue;
    for (pi = 0; pi < peers.length; pi++) {
      var peer = peers[pi].marker;
      if (!peer || !ECAudio.BeatSeq || !ECAudio.BeatSeq.patternForMarker) continue;
      var peerPat = ECAudio.BeatSeq.patternForMarker(peer);
      if (!peerPat || !peerPat.pattern || !peerPat.pattern[i]) continue;
      if (!stepWouldClash(marker, peer, i)) continue;
      var myPrio = ROLE_PRIO[markerType(marker)] || 1;
      var peerPrio = ROLE_PRIO[markerType(peer)] || 1;
      if (myPrio > peerPrio) continue;
      if (myPrio < peerPrio) {
        if (pat[i] === 1) pat[i] = 2;
        else pat[i] = 0;
        var alt = ((i + 1) % n + n) % n;
        if (!pat[alt] && peers[pi].coupling > 0.22) pat[alt] = 2;
        continue;
      }
      if (pat[i] === 1) pat[i] = 2;
    }
  }
  return pat;
}

function deClashAllPatterns() {
  var markers = beatMarkers();
  var i;
  for (i = 0; i < markers.length; i++) {
    var m = markers[i];
    if (!m || !ECAudio.BeatSeq || !ECAudio.BeatSeq.patternForMarker) continue;
    var info = ECAudio.BeatSeq.patternForMarker(m);
    if (!info || !info.pattern) continue;
    refinePattern(info.pattern, m);
  }
}

function peerMin(marker) {
  return ECAudio.BeatInfluence && ECAudio.BeatInfluence.peerMinCoupling
    ? ECAudio.BeatInfluence.peerMinCoupling(marker) : 0.1;
}

function inMuteGroup(typeA, typeB) {
  var i;
  for (i = 0; i < MUTE_GROUPS.length; i++) {
    var g = MUTE_GROUPS[i];
    if ((g[0] === typeA && g[1] === typeB) || (g[1] === typeA && g[0] === typeB)) return true;
  }
  return false;
}

function applyMuteGroups(marker, globalStep, stepData) {
  if (!marker || !stepData || !stepData.hit) return stepData;
  var g = globalStep | 0;
  var myType = markerType(marker);
  var hits = collectStepHits(g);
  var out = Object.assign({}, stepData);
  var i;
  for (i = 0; i < hits.length; i++) {
    var h = hits[i];
    if (!h.marker || h.marker.id === marker.id) continue;
    if (!inMuteGroup(myType, h.type)) continue;
    var c = coupling(marker, h.marker);
    var myPrio = ROLE_PRIO[myType] || 1;
    var otherPrio = ROLE_PRIO[h.type] || 1;
    if (myPrio > otherPrio) continue;
    var otherC = coupling(h.marker, marker);
    if (myPrio < otherPrio || (myPrio === otherPrio && c <= otherC)) {
      out.vel = 2;
      if (out._mixDuck == null) out._mixDuck = 0.68;
      else out._mixDuck = Math.min(out._mixDuck, 0.68);
    } else if (c >= 0.18 && otherC >= 0.18) {
      out.vel = 2;
    }
  }
  return out;
}

function stepTimingOffset(marker, globalStep, stepData) {
  if (!marker || !stepData || !stepData.hit) return 0;
  var swing = ECAudio.params && ECAudio.params.swing != null ? ECAudio.params.swing : 0.54;
  var nx = marker.normX != null ? marker.normX : 0.5;
  var phase = marker.beatPhase != null
    ? marker.beatPhase
    : nx * (ECAudio.LOOP_BEAT_STEPS || 16);
  var frac = phase - Math.floor(phase);
  if (frac > 0.5) frac = 1 - frac;
  var stepSec = loopTickMs() / 1000;
  var off = stepSec * 0.18 * (swing - 0.5) * (frac - 0.25);
  if ((globalStep | 0) % 2 === 1) off += stepSec * 0.04 * (swing - 0.5);
  if (stepData._mixClash || (stepData._mixDuck != null && stepData._mixDuck < 0.85)) {
    off += stepSec * 0.08 * (markerType(marker) === 'hat' ? 1 : 0.65);
  }
  return Math.max(-0.04, Math.min(0.06, off));
}

function stereoSpreadWidth(marker) {
  var pan = stereoPan(marker);
  return Math.abs(pan);
}

function stereoPan(marker) {
  if (!marker) return 0;
  var nx = marker.normX != null ? marker.normX : 0.5;
  var pan = (nx - 0.5) * 1.15;
  var peers = ECAudio.BeatSpatial && ECAudio.BeatSpatial.peers
    ? ECAudio.BeatSpatial.peers(marker, peerMin(marker)) : [];
  if (peers.length) {
    var cx = 0;
    var w = 0;
    var i;
    for (i = 0; i < peers.length; i++) {
      var px = peers[i].marker.normX != null ? peers[i].marker.normX : 0.5;
      cx += px * peers[i].coupling;
      w += peers[i].coupling;
    }
    if (w > 0.08) {
      var cluster = cx / w;
      pan = pan + (cluster - nx) * Math.min(0.55, w * 0.42);
    }
  }
  return Math.max(-0.92, Math.min(0.92, pan));
}

function applyEqCarve(marker, spec) {
  if (!marker || !spec) return spec;
  var peers = ECAudio.BeatSpatial && ECAudio.BeatSpatial.peers
    ? ECAudio.BeatSpatial.peers(marker, peerMin(marker)) : [];
  if (!peers.length) return spec;
  var out = Object.assign({}, spec);
  var myBand = bandFor(marker, out.filterHz || 800);
  var notches = [];
  var i;
  for (i = 0; i < peers.length; i++) {
    var p = peers[i];
    var pf = estimateStepFreq(p.marker, loopStep());
    var pb = bandFor(p.marker, pf);
    var ov = freqOverlap(myBand, pb);
    if (ov < 0.15) continue;
    notches.push({
      freq: pb.center || ((pb.lo + pb.hi) * 0.5),
      depth: ov * p.coupling * 0.42,
      q: 1.2 + ov * 2
    });
    if (out.filterHz != null && isMelodic(marker) && isMelodic(p.marker)) {
      if (markerType(marker) === 'bass') {
        out.filterHz = Math.max(80, out.filterHz * (1 - ov * p.coupling * 0.12));
      } else {
        out.filterHz = Math.min(14000, out.filterHz * (1 + ov * p.coupling * 0.08));
      }
    }
  }
  if (notches.length) out._eqNotches = notches;
  return out;
}

function recordDuck(depth, holdSec) {
  if (!ECAudio.State.ctx) return;
  _duckMeter.depth = Math.max(_duckMeter.depth, depth != null ? depth : 0.28);
  _duckMeter.until = ECAudio.State.ctx.currentTime + (holdSec != null ? holdSec : 0.14);
}

function duckMeter() {
  if (!ECAudio.State.ctx) return 0;
  var t = ECAudio.State.ctx.currentTime;
  if (t > _duckMeter.until) {
    _duckMeter.depth = Math.max(0, _duckMeter.depth * 0.88);
    if (_duckMeter.depth < 0.02) _duckMeter.depth = 0;
    return 0;
  }
  var left = (_duckMeter.until - t) / 0.14;
  return _duckMeter.depth * Math.max(0, Math.min(1, left));
}

function applyToStep(marker, globalStep, stepData) {
  if (!marker || !stepData || !stepData.hit) return stepData;
  var out = applyMuteGroups(marker, globalStep, stepData);
  var pairs = collisionsFor(marker.id, globalStep);
  if (!pairs.length) {
    out._timingOff = stepTimingOffset(marker, globalStep, out);
    return out;
  }

  out = Object.assign({}, out);
  var freq = out.freq;
  var vel = out.vel;
  var duck = 1;
  var i;
  for (i = 0; i < pairs.length; i++) {
    if (!isLoser(marker, pairs[i])) continue;
    var p = pairs[i];
    var wType = markerType(p.winner);
    var lType = markerType(marker);
    if (wType === 'kick' && (lType === 'bass' || lType === 'bright' || lType === 'minimal'
        || lType === 'synth' || lType === 'arpeggio')) {
      duck = Math.min(duck, 0.58 - p.coupling * 0.12);
      freq = nudgeFreq(marker, freq, 1);
    } else if (wType === 'bass' && lType === 'bright') {
      duck = Math.min(duck, 0.72);
      freq = nudgeFreq(marker, freq, 1);
    } else if (wType === 'bright' && lType === 'minimal') {
      duck = Math.min(duck, 0.78);
      freq = nudgeFreq(marker, freq, 1);
    } else {
      duck = Math.min(duck, 0.82 - p.overlap * 0.2);
      if (lType === 'bass') freq = nudgeFreq(marker, freq, -1);
      else if (isMelodic(marker)) freq = nudgeFreq(marker, freq, 1);
    }
    if (vel !== 2) vel = 2;
  }
  out.freq = freq;
  out.vel = vel;
  out._mixDuck = duck;
  out._mixClash = pairs.length;
  out._timingOff = stepTimingOffset(marker, globalStep, out);
  return out;
}

function applyToSpec(marker, globalStep, spec, stepData) {
  if (!marker || !spec) return spec;
  var out = applyEqCarve(marker, spec);
  var pairs = collisionsFor(marker.id, globalStep);
  if (!pairs.length) {
    out._stereoPan = stereoPan(marker);
    return out;
  }
  out = Object.assign({}, out);
  var duck = stepData && stepData._mixDuck != null ? stepData._mixDuck : 1;
  var clash = false;
  var i;
  for (i = 0; i < pairs.length; i++) {
    if (!isLoser(marker, pairs[i])) continue;
    clash = true;
    var p = pairs[i];
    if (out.beatPeak != null) out.beatPeak *= duck;
    if (out.peakGain != null) out.peakGain *= duck;
    if (out.filterHz != null) {
      var lift = markerType(marker) === 'bass' ? 0.88 : 1.12;
      out.filterHz = Math.max(80, Math.min(14000, out.filterHz * lift));
    }
    if (out.filterEndHz != null) {
      out.filterEndHz = Math.max(60, out.filterEndHz * (0.78 + p.coupling * 0.08));
    }
    if (out.beatPunch != null) out.beatPunch *= 0.86;
    if (out.space != null) out.space = Math.min(0.9, out.space + p.coupling * 0.06);
  }
  if (clash) out._mixClash = true;
  out._stereoPan = stereoPan(marker);
  return out;
}

function avoidBlendFreq(marker, freq, globalStep) {
  if (!marker || !freq) return freq;
  var pairs = collisionsFor(marker.id, globalStep);
  if (!pairs.length) return freq;
  var target = freq;
  var i;
  for (i = 0; i < pairs.length; i++) {
    var p = pairs[i];
    var other = p.a.id === marker.id ? p.b : p.a;
    if (!other || !ECAudio.Theory || !ECAudio.Theory.markerBeatStepCore) continue;
    var sd = ECAudio.Theory.markerBeatStepCore(other, globalStep | 0);
    if (!sd || !sd.hit || !sd.freq) continue;
    var ov = freqOverlap(bandFor(marker, freq), bandFor(other, sd.freq));
    if (ov < 0.2) continue;
    if (isLoser(marker, p)) {
      target = nudgeFreq(marker, target, markerType(marker) === 'bass' ? -1 : 1);
    }
  }
  return target + (target - freq) * 0.35;
}

function duckVoice(marker, amount, t) {
  if (!marker || !marker.voice || !marker.voice.padGain || !ECAudio.State.ctx) return;
  var g = marker.voice.padGain.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(Math.max(g.value, 0.0002), t);
  g.linearRampToValueAtTime(Math.max(0.0003, g.value * amount), t + 0.008);
  g.linearRampToValueAtTime(Math.max(g.value, 0.0004), t + 0.11 + (1 - amount) * 0.08);
}

function triggerSpatialSidechain(sourceMarker, t) {
  if (!sourceMarker || !ECAudio.State.ctx) return;
  if (t == null) t = ECAudio.State.ctx.currentTime;
  var type = markerType(sourceMarker);
  if (type !== 'kick' && type !== 'clap') return;

  var min = peerMin(sourceMarker);
  var peers = ECAudio.BeatSpatial && ECAudio.BeatSpatial.peers
    ? ECAudio.BeatSpatial.peers(sourceMarker, min) : [];
  var maxCouple = 0;
  var i;
  for (i = 0; i < peers.length; i++) {
    if (peers[i].coupling > maxCouple) maxCouple = peers[i].coupling;
  }
  var busAmt = type === 'kick'
    ? Math.max(0.58, 0.78 - maxCouple * 0.22)
    : Math.max(0.72, 0.9 - maxCouple * 0.14);

  if (ECAudio.Engine && ECAudio.Engine.triggerBrowseSidechain) {
    ECAudio.Engine.triggerBrowseSidechain(t, busAmt, type, maxCouple);
  }
  recordDuck(1 - busAmt, type === 'kick' ? 0.14 : 0.1);

  for (i = 0; i < peers.length; i++) {
    var peer = peers[i].marker;
    if (!peer || !isMelodic(peer)) continue;
    var amt = type === 'kick'
      ? Math.max(0.32, 0.62 - peers[i].coupling * 0.28)
      : Math.max(0.55, 0.82 - peers[i].coupling * 0.2);
    duckVoice(peer, amt, t);
  }
}

function freqClash(a, b, globalStep) {
  var g = globalStep != null ? (globalStep | 0) : loopStep();
  if (!ECAudio.Theory || !ECAudio.Theory.markerBeatStepCore) return false;
  var sa = ECAudio.Theory.markerBeatStepCore(a, g);
  var sb = ECAudio.Theory.markerBeatStepCore(b, g);
  if (!sa || !sa.hit || !sb || !sb.hit) return false;
  return freqOverlap(bandFor(a, sa.freq), bandFor(b, sb.freq)) >= 0.22;
}

function resolvedStep(marker, globalStep) {
  if (!marker || !ECAudio.Theory) return null;
  if (ECAudio.Theory.markerBeatStep) return ECAudio.Theory.markerBeatStep(marker, globalStep | 0);
  if (ECAudio.Theory.markerBeatStepCore) return ECAudio.Theory.markerBeatStepCore(marker, globalStep | 0);
  return null;
}

function compoundLayers(marker, globalStep) {
  if (!marker) return [];
  var g = globalStep | 0;
  var mix = refreshStepMix(g);
  var layers = [];
  var seen = {};
  var i;

  function pushFromMarker(m, alpha, forceClash) {
    if (!m || seen[m.id]) return;
    var sd = resolvedStep(m, g);
    if (!sd || !sd.hit) return;
    seen[m.id] = true;
    var type = markerType(m);
    var clash = !!forceClash || mix.pairs.some(function(p) {
      return (p.a.id === marker.id && p.b.id === m.id) ||
        (p.b.id === marker.id && p.a.id === m.id);
    });
    layers.push({
      marker: m,
      type: type,
      freq: sd.freq,
      vel: sd.vel,
      alpha: alpha,
      clash: clash,
      band: bandFor(m, sd.freq)
    });
  }

  pushFromMarker(marker, 1, collisionsFor(marker.id, g).length > 0);

  var peers = ECAudio.BeatSpatial && ECAudio.BeatSpatial.peers
    ? ECAudio.BeatSpatial.peers(marker, peerMin(marker)) : [];

  for (i = 0; i < peers.length; i++) {
    pushFromMarker(peers[i].marker, 0.28 + peers[i].coupling * 0.42, false);
  }
  return layers;
}

function describeCollisions(marker) {
  if (!marker) return '';
  var step = loopStep();
  var pairs = collisionsFor(marker.id, step);
  var pan = Math.round(stereoPan(marker) * 100);
  if (!pairs.length) {
    return 'Step ' + (step + 1) + ' clean · pan ' + (pan > 0 ? '+' : '') + pan + '%';
  }
  var parts = [];
  var i;
  for (i = 0; i < pairs.length && i < 2; i++) {
    var p = pairs[i];
    var other = p.a.id === marker.id ? p.b : p.a;
    var label = markerType(other);
    var role = isLoser(marker, p) ? 'yields' : 'leads';
    parts.push(label + ' ' + Math.round(p.overlap * 100) + '% · ' + role);
  }
  return 'Step ' + (step + 1) + ' · pan ' + (pan > 0 ? '+' : '') + pan + '% — ' +
    parts.join(' · ') + (pairs.length > 2 ? ' +' + (pairs.length - 2) : '');
}

function invalidate() {
  _stepCache = { step: -1, hits: [], pairs: [] };
}

ECAudio.BeatMix = {
  bandFor: bandFor,
  freqOverlap: freqOverlap,
  collectStepHits: collectStepHits,
  refreshStepMix: refreshStepMix,
  collisionsFor: collisionsFor,
  refinePattern: refinePattern,
  deClashAllPatterns: deClashAllPatterns,
  stepWouldClash: stepWouldClash,
  stubFromPlacement: stubFromPlacement,
  placementWouldClash: placementWouldClash,
  resolvePlacementClash: resolvePlacementClash,
  applyMuteGroups: applyMuteGroups,
  stepTimingOffset: stepTimingOffset,
  stereoPan: stereoPan,
  stereoSpreadWidth: stereoSpreadWidth,
  applyEqCarve: applyEqCarve,
  recordDuck: recordDuck,
  duckMeter: duckMeter,
  applyToStep: applyToStep,
  applyToSpec: applyToSpec,
  avoidBlendFreq: avoidBlendFreq,
  triggerSpatialSidechain: triggerSpatialSidechain,
  freqClash: freqClash,
  compoundLayers: compoundLayers,
  describeCollisions: describeCollisions,
  invalidate: invalidate,
  markerType: markerType
};
