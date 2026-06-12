/* eslint-disable no-var */
// Beat studio — auto pattern density from spatial coupling (gravity).
window.ECAudio = window.ECAudio || {};

var _cache = {};
var _lastPlayhead = -1;

function stepCount() {
  return ECAudio.LOOP_BEAT_STEPS || 16;
}

function normVel(val) {
  if (!val) return 0;
  return val === 2 ? 2 : 1;
}

function markerPhase(marker) {
  if (ECAudio.BeatSpatial && ECAudio.BeatSpatial.markerPhase) {
    return ECAudio.BeatSpatial.markerPhase(marker);
  }
  if (marker.beatPhase != null) return marker.beatPhase;
  if (ECAudio.BeatKaoss && ECAudio.BeatKaoss.beatPhaseFromX) {
    return ECAudio.BeatKaoss.beatPhaseFromX(marker.normX);
  }
  return (marker.normX != null ? marker.normX : 0.5) * stepCount();
}

function peerMin(marker) {
  return ECAudio.BeatInfluence && ECAudio.BeatInfluence.peerMinCoupling
    ? ECAudio.BeatInfluence.peerMinCoupling(marker) : 0.1;
}

var MELODIC_TYPES = { bass: 1, bright: 1, minimal: 1 };
var PERC_TYPES = { kick: 1, hat: 1, clap: 1 };

function isMelodicType(type) {
  return !!MELODIC_TYPES[type];
}

function isPercType(type) {
  return !!PERC_TYPES[type];
}

function peerClusterWeight(marker, entry) {
  if (!marker || !entry || !entry.marker) return 0;
  var peer = entry.marker;
  var weight = entry.coupling;
  if (marker.envId && peer.envId && marker.envId === peer.envId) {
    return weight * 1.18;
  }
  var mt = markerType(marker);
  var pt = markerType(peer);
  if ((isPercType(mt) && isPercType(pt)) || (isMelodicType(mt) && isMelodicType(pt))) {
    return weight * 0.86;
  }
  return weight * 0.52;
}

function clusterPeers(marker) {
  if (!ECAudio.BeatSpatial || !ECAudio.BeatSpatial.peers) return [];
  var near = ECAudio.BeatSpatial.peers(marker, peerMin(marker));
  var out = [];
  var i;
  for (i = 0; i < near.length; i++) {
    out.push({
      marker: near[i].marker,
      coupling: peerClusterWeight(marker, near[i]),
      dist: near[i].dist
    });
  }
  out.sort(function(a, b) { return b.coupling - a.coupling; });
  return out;
}

function clusterStrength(marker) {
  var peers = clusterPeers(marker);
  if (!peers.length) return 0;
  var max = 0;
  var sum = 0;
  var i;
  for (i = 0; i < peers.length; i++) {
    if (peers[i].coupling > max) max = peers[i].coupling;
    sum += peers[i].coupling;
  }
  return Math.min(1, max * 0.74 + sum * 0.14);
}

function clusterTier(pull) {
  if (pull < 0.14) return 'solo';
  if (pull < 0.38) return 'pulse';
  return 'groove';
}

function phaseNearStep(step, phase) {
  var n = stepCount();
  var s = ((step % n) + n) % n;
  var ph = ((phase % n) + n) % n;
  return Math.abs(s - ph) < 0.52 || Math.abs(s - ph - n) < 0.52 || Math.abs(s - ph + n) < 0.52;
}

function gravityMode(marker) {
  var mode = marker && marker.gravityMode;
  if (mode === 'solo' || mode === 'pulse' || mode === 'groove') return mode;
  return 'auto';
}

function gravityDensityNorm(marker) {
  var d = marker && marker.gravityDensity;
  if (d == null) return 0.28;
  return Math.max(0, Math.min(1, d / 100));
}

var ROLE_CORE = {
  kick: [0, 8],
  hat: [2, 6, 10, 14],
  clap: [4, 12],
  bass: [0, 8],
  bright: [0, 8],
  minimal: [0, 8]
};

var ROLE_GROOVE = {
  kick: [4, 12, 2, 10],
  hat: [0, 4, 8, 12, 1, 3, 5, 7, 9, 11, 13, 15],
  clap: [8, 0],
  bass: [4, 12, 6, 14, 2],
  bright: [4, 12, 2, 6, 10, 14],
  minimal: [3, 11, 6, 14]
};

function applyRoleTemplate(pat, type, anchor, strength, densityBias, modeOverride) {
  if (modeOverride === 'solo') return;
  if (strength < 0.14 && modeOverride === 'auto') return;
  var n = pat.length;
  var core = ROLE_CORE[type] || ROLE_CORE.kick;
  var groove = ROLE_GROOVE[type] || ROLE_GROOVE.kick;
  var ci;
  var coreOn = strength >= 0.1 || densityBias >= 0.32 || modeOverride === 'pulse' || modeOverride === 'groove';
  if (coreOn) {
    for (ci = 0; ci < core.length; ci++) {
      var cs = ((anchor + core[ci]) % n + n) % n;
      if (!pat[cs]) pat[cs] = densityBias > 0.62 || modeOverride === 'groove' ? 1 : 2;
      else if (pat[cs] === 2 && (strength > 0.45 || densityBias > 0.7)) pat[cs] = 1;
    }
  }
  if (strength < 0.26 && modeOverride !== 'groove') return;
  if (densityBias < 0.38 && modeOverride === 'auto') return;
  var gi;
  for (gi = 0; gi < groove.length; gi++) {
    var gs = ((anchor + groove[gi]) % n + n) % n;
    if (pat[gs]) continue;
    if (strength > 0.48 || densityBias > 0.68 || modeOverride === 'groove') {
      pat[gs] = densityBias > 0.55 ? 1 : 2;
    } else if (strength > 0.22 || densityBias > 0.42) {
      pat[gs] = 2;
    }
  }
}

function mergePeerPhases(pat, marker, anchor, strength, densityBias, opts) {
  opts = opts || {};
  var mel = ECAudio.BeatInfluence && ECAudio.BeatInfluence.melodicBlendMul
    ? ECAudio.BeatInfluence.melodicBlendMul(marker) : 1;
  if (strength < 0.12 / mel && (densityBias == null || densityBias < 0.32 / mel)) return;
  var near = clusterPeers(marker);
  if (!near.length) return;
  var n = pat.length;
  var tier = opts.tier || 'pulse';
  var soloMirror = tier === 'solo' ? 0.42 : 0.22;
  var i;
  for (i = 0; i < near.length; i++) {
    var peer = near[i].marker;
    var phase = markerPhase(peer);
    var ps = Math.round(phase);
    ps = ((ps % n) + n) % n;
    var c = near[i].coupling;
    if (tier === 'solo' && c < soloMirror) continue;
    var cThresh = tier === 'groove' ? 0.16 / mel : 0.24 / mel;
    if (!pat[ps]) {
      pat[ps] = c > cThresh ? 1 : 2;
    } else if (c > 0.34 / mel && pat[ps] === 2) {
      pat[ps] = 1;
    }
    if (tier === 'groove' && strength > 0.28 / mel &&
        (densityBias == null || densityBias > 0.38 / mel) && c > cThresh) {
      var off = ((ps + 2) % n + n) % n;
      if (!pat[off]) pat[off] = 2;
      if (densityBias > 0.62 && c > 0.38 / mel) {
        var off8 = ((ps + 8) % n + n) % n;
        if (!pat[off8]) pat[off8] = 2;
      }
    }
  }
}

function fillClusterGrid(pat, marker, anchor, strength, densityBias, stepGap, phases) {
  var n = pat.length;
  var i;
  var pi;
  for (i = 0; i < n; i++) {
    var phaseHit = false;
    for (pi = 0; pi < phases.length; pi++) {
      if (phaseNearStep(i, phases[pi])) {
        phaseHit = true;
        break;
      }
    }
    var gridHit = ((i - anchor + n) % n) % stepGap === 0;
    if (!phaseHit && !gridHit) continue;
    var isPrimary = phaseNearStep(i, anchor);
    if (isPrimary) pat[i] = 1;
    else if (strength >= 0.42 || densityBias > 0.72) pat[i] = 1;
    else if (strength >= 0.2 || densityBias > 0.48) pat[i] = 2;
  }
}

function buildAutoPattern(marker) {
  var n = stepCount();
  var pat = new Array(n).fill(0);
  var anchor = Math.round(markerPhase(marker));
  anchor = ((anchor % n) + n) % n;
  var modeOverride = gravityMode(marker);
  var densityBias = gravityDensityNorm(marker);
  var pull = clusterStrength(marker);
  var peers = clusterPeers(marker);
  var build = ECAudio.BeatInfluence && ECAudio.BeatInfluence.beatBuildMul
    ? ECAudio.BeatInfluence.beatBuildMul(marker) : 1;
  var tier = clusterTier(pull);
  var strength = pull;
  var type = markerType(marker);
  var phases = [markerPhase(marker)];
  var i;

  for (i = 0; i < peers.length; i++) {
    phases.push(markerPhase(peers[i].marker));
  }

  if (modeOverride === 'auto') {
    strength = Math.min(1, pull * (0.34 + densityBias * 0.54) * build);
  } else if (modeOverride === 'solo') {
    tier = 'solo';
    strength = 0.02;
  } else if (modeOverride === 'pulse') {
    tier = 'pulse';
    strength = Math.min(1, (0.12 + densityBias * 0.22 + pull * 0.24) * build);
  } else if (modeOverride === 'groove') {
    tier = 'groove';
    strength = Math.min(1, (0.24 + densityBias * 0.42 + pull * 0.3) * build);
  }

  pat[anchor] = 1;

  if (modeOverride === 'solo') {
    return {
      pattern: pat, strength: pull, mode: 'solo', tier: 'solo', hits: 1,
      peerCount: peers.length, modeOverride: modeOverride, densityBias: densityBias
    };
  }

  if (modeOverride === 'auto' && tier === 'solo') {
    mergePeerPhases(pat, marker, anchor, strength, densityBias, { tier: 'solo' });
    if (!pat.some(function(v, idx) { return v && idx !== anchor; })) {
      return {
        pattern: pat, strength: pull, mode: 'solo', tier: 'solo', hits: 1,
        peerCount: peers.length, modeOverride: modeOverride, densityBias: densityBias
      };
    }
  } else {
    mergePeerPhases(pat, marker, anchor, strength, densityBias, { tier: tier });
  }

  if (modeOverride === 'auto' && tier === 'pulse') {
    if (densityBias > 0.5 && pull > 0.18) {
      applyRoleTemplate(pat, type, anchor, strength * 0.42, densityBias, 'pulse');
    }
  } else if (modeOverride === 'pulse') {
    applyRoleTemplate(pat, type, anchor, strength, densityBias, 'pulse');
  } else if (modeOverride === 'groove' || tier === 'groove') {
    var stepGap = modeOverride === 'groove'
      ? (densityBias > 0.72 ? 1 : 2)
      : (densityBias > 0.68 ? 1 : 2);
    fillClusterGrid(pat, marker, anchor, strength, densityBias, stepGap, phases);
    applyRoleTemplate(pat, type, anchor, strength, densityBias,
      modeOverride === 'auto' ? 'groove' : modeOverride);
    mergePeerPhases(pat, marker, anchor, strength, densityBias, { tier: 'groove' });
  }

  if (!pat.some(function(v) { return v; })) pat[anchor] = 1;

  var hits = 0;
  for (i = 0; i < pat.length; i++) {
    if (pat[i]) hits++;
  }
  var mode = modeOverride === 'auto'
    ? tier
    : (hits <= 1 ? 'solo' : (hits <= 4 ? 'pulse' : 'groove'));
  return {
    pattern: pat, strength: pull, mode: mode, tier: tier, hits: hits,
    peerCount: peers.length, modeOverride: modeOverride, densityBias: densityBias
  };
}

function patternForMarker(marker) {
  if (!marker || !marker.id) {
    return { pattern: new Array(stepCount()).fill(0), strength: 0, mode: 'solo', hits: 0 };
  }
  if (_cache[marker.id]) return _cache[marker.id];
  var built = buildAutoPattern(marker);
  _cache[marker.id] = built;
  return built;
}

function patternActive(pat) {
  return pat && pat.some(function(v) { return v; });
}

function invalidatePattern(markerId) {
  if (markerId && _cache[markerId]) delete _cache[markerId];
}

var _refreshTimer = 0;
var REFRESH_DEBOUNCE_MS = 72;

function refreshAllPatternsNow() {
  var end = ECAudio.perf && ECAudio.perf.mark ? ECAudio.perf.mark('patterns-refresh') : null;
  _cache = {};
  if (ECAudio.BeatMix && ECAudio.BeatMix.invalidate) ECAudio.BeatMix.invalidate();
  var markers = ECAudio.State.markers || [];
  var i;
  for (i = 0; i < markers.length; i++) {
    if (markers[i] && markers[i].id) patternForMarker(markers[i]);
  }
  if (ECAudio.BeatMix && ECAudio.BeatMix.deClashAllPatterns) {
    ECAudio.BeatMix.deClashAllPatterns();
  }
  if (ECAudio.BeatView3d && ECAudio.BeatView3d.schedule) ECAudio.BeatView3d.schedule();
  if (ECAudio.Markers && ECAudio.Markers.refreshVisuals) ECAudio.Markers.refreshVisuals();
  if (end) end();
}

function refreshAllPatterns() {
  refreshAllPatternsNow();
}

function scheduleRefreshAllPatterns(ms) {
  var wait = ms != null ? ms : REFRESH_DEBOUNCE_MS;
  if (_refreshTimer) clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(function() {
    _refreshTimer = 0;
    refreshAllPatternsNow();
  }, wait);
}

function cancelScheduledRefresh() {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  _refreshTimer = 0;
}

function markerType(marker) {
  if (!marker) return 'kick';
  if (marker.presetId) return marker.presetId.replace(/^env-/, '');
  if (marker.envId) return marker.envId.replace(/^env-/, '');
  return marker.role || 'kick';
}

function modeLabel(mode, tier) {
  if (mode === 'groove') return 'Groove cluster';
  if (mode === 'pulse') return 'Pulse cluster';
  if (tier === 'pulse') return 'Pulse cluster';
  if (tier === 'groove') return 'Groove cluster';
  return 'Solo hit';
}

function overrideLabel(mode) {
  if (mode === 'auto') return 'Cluster';
  if (mode === 'groove') return 'Groove';
  if (mode === 'pulse') return 'Pulse';
  return 'Solo';
}

function syncGravityControls(marker) {
  var modeSeg = document.getElementById('sl-gravity-mode-seg');
  var densityEl = document.getElementById('sl-gravity-density');
  var densityVal = document.getElementById('sl-gravity-density-val');
  if (!marker) {
    if (modeSeg) {
      modeSeg.querySelectorAll('.sp-seg-btn').forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-val') === 'auto');
      });
    }
    if (densityEl && document.activeElement !== densityEl) densityEl.value = '28';
    if (densityVal) densityVal.textContent = '28%';
    return;
  }
  var mode = gravityMode(marker);
  if (modeSeg) {
    modeSeg.querySelectorAll('.sp-seg-btn').forEach(function(b) {
      b.classList.toggle('active', b.getAttribute('data-val') === mode);
    });
  }
  var dens = marker.gravityDensity != null ? marker.gravityDensity : 28;
  if (densityEl && document.activeElement !== densityEl) densityEl.value = String(dens);
  if (densityVal) densityVal.textContent = Math.round(dens) + '%';
}

function syncGravityUI(marker) {
  var modeEl = document.getElementById('sl-gravity-mode');
  var pullEl = document.getElementById('sl-gravity-pull');
  var hitsEl = document.getElementById('sl-gravity-hits');
  var strip = document.getElementById('sl-gravity-strip');
  if (!modeEl) return;

  syncGravityControls(marker);

  if (!marker) {
    modeEl.textContent = '—';
    if (pullEl) pullEl.textContent = '—';
    if (hitsEl) hitsEl.textContent = '—';
    if (strip) strip.innerHTML = '';
    return;
  }

  var info = patternForMarker(marker);
  var resultLabel = modeLabel(info.mode, info.tier);
  if (info.modeOverride && info.modeOverride !== 'auto') {
    resultLabel += ' · ' + overrideLabel(info.modeOverride) + ' lock';
  } else if (info.tier && info.tier !== info.mode) {
    resultLabel += ' · ' + overrideLabel(info.tier) + ' tier';
  }
  modeEl.textContent = resultLabel;
  if (pullEl) {
    var peerNote = info.peerCount != null && info.peerCount > 0
      ? ' · ' + info.peerCount + ' peer' + (info.peerCount === 1 ? '' : 's')
      : ' · isolated';
    pullEl.textContent = Math.round(info.strength * 100) + '%' + peerNote;
  }
  if (hitsEl) {
    hitsEl.textContent = info.hits <= 1
      ? '1 hit'
      : info.hits + ' hits';
  }
  if (strip) {
    strip.innerHTML = '';
    var type = markerType(marker);
    strip.className = 'sl-gravity-strip sl-gravity-' + type;
    var si;
    for (si = 0; si < info.pattern.length; si++) {
      var cell = document.createElement('span');
      cell.className = 'sl-gravity-cell';
      if (info.pattern[si] === 1) cell.classList.add('on');
      else if (info.pattern[si] === 2) cell.classList.add('on', 'soft');
      if (_lastPlayhead === si) cell.classList.add('playhead');
      strip.appendChild(cell);
    }
  }
}

function updatePlayhead(step) {
  document.querySelectorAll('.sl-gravity-cell.playhead').forEach(function(el) {
    el.classList.remove('playhead');
  });
  _lastPlayhead = step;
  if (step < 0) return;
  var strip = document.getElementById('sl-gravity-strip');
  if (!strip) return;
  var cells = strip.querySelectorAll('.sl-gravity-cell');
  if (cells[step]) cells[step].classList.add('playhead');
}

function onTransportStep(step) {
  if (step < 0) return;
  var openId = ECAudio.Markers && ECAudio.Markers.layerSettingsOpen
    ? ECAudio.Markers.layerSettingsOpen() : null;
  if (!openId) return;
  var marker = (ECAudio.State.markers || []).filter(function(m) { return m.id === openId; })[0];
  if (!marker) return;
  var info = patternForMarker(marker);
  if (!info.pattern[step]) return;
  syncGravityUI(marker);
}

function initBeatSeq() {
  refreshAllPatterns();
}

ECAudio.BeatSeq = {
  init: initBeatSeq,
  ensurePatterns: refreshAllPatterns,
  refreshAllPatterns: refreshAllPatterns,
  refreshAllPatternsNow: refreshAllPatternsNow,
  scheduleRefreshAllPatterns: scheduleRefreshAllPatterns,
  cancelScheduledRefresh: cancelScheduledRefresh,
  invalidatePattern: invalidatePattern,
  patternForMarker: patternForMarker,
  syncGravityUI: syncGravityUI,
  syncDotUI: syncGravityUI,
  updatePlayhead: updatePlayhead,
  onTransportStep: onTransportStep,
  patternActive: patternActive,
  markerType: markerType,
  normVel: normVel,
  clusterStrength: clusterStrength,
  clusterPeers: clusterPeers,
  clusterTier: clusterTier,
  gravityMode: gravityMode,
  gravityDensityNorm: gravityDensityNorm,
  syncGravityControls: syncGravityControls
};
