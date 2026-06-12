/* eslint-disable no-var */
window.ECAudio = window.ECAudio || {};

function getSectionId(source) {
  if (!source) return null;
  if (typeof source === 'string') return canonicalSectionId(source);
  var sec = source.closest && source.closest('.cv-section');
  return sec ? canonicalSectionId(sec.id) : null;
}


function getScaleTypeForSource(source) {
  var secId = ECAudio.Theory.getSectionId(source);
  if (secId && ECAudio.params.sectionScales && ECAudio.params.sectionScales[secId]) {
    return ECAudio.params.sectionScales[secId];
  }
  if (secId && ECAudio.SECTION_HARMONY[secId]) return ECAudio.SECTION_HARMONY[secId].scale;
  return ECAudio.params.scaleType || 'major';
}

function scaleDegreeCount(scaleKey) {
  return scaleKey === 'pent' ? 5 : 7;
}

function getScaleDegrees(scaleKey) {
  var full = ECAudio.State.SCALE_DEFS[scaleKey] || ECAudio.State.SCALE_DEFS.major;
  return full.slice(0, scaleDegreeCount(scaleKey));
}

function getScale(source) {
  return ECAudio.Theory.getScaleDegrees(ECAudio.Theory.getScaleTypeForSource(source));
}


function getRoot(source) {
  var id = ECAudio.Theory.getSectionId(source);
  if (!id) return 110;
  var spec = ECAudio.SECTION_HARMONY[id];
  return ECAudio.params.roots[id] || (spec && spec.root) || 110;
}


function getPartialIndex(row) {
  var rows = Array.from(row.closest('tbody').querySelectorAll('tr'));
  return rows.indexOf(row) % ECAudio.State.PARTIALS.length;
}


function rowFreq(row, partialIdx) {
  var idx = partialIdx != null ? partialIdx : ECAudio.Theory.getPartialIndex(row);
  return ECAudio.Theory.getRoot(row) * ECAudio.State.PARTIALS[idx % ECAudio.State.PARTIALS.length];
}


function noteFreq(row, partialIdx) {
  if (!ECAudio.params.quantizeNotes) return ECAudio.Theory.rowFreq(row, partialIdx);
  var secId = ECAudio.Theory.getSectionId(row);
  var idx = partialIdx != null ? partialIdx : ECAudio.Theory.getPartialIndex(row);
  if (ECAudio.Theory.getScaleTypeForSource(row) === 'pent' && secId) {
    return ECAudio.Theory.browsePadPitch(idx, 0.5);
  }
  var rootMidi = Math.round(ECAudio.Engine.midiFromFreq(ECAudio.Theory.getRoot(row)));
  var scale = ECAudio.Theory.getScale(row);
  var semitone = scale[idx % scale.length];
  return ECAudio.Engine.freqFromMidi(rootMidi + semitone);
}


function stepMs() {
  return (60000 / ECAudio.params.bpm) / 2;
}


function beatMs() {
  return 60000 / ECAudio.params.bpm;
}

function loopStepMs() {
  return beatMs() / 4;
}

function beatStepCount() {
  return ECAudio.LOOP_BEAT_STEPS || 16;
}

function stepFromNormX(normX) {
  var n = beatStepCount();
  var x = Math.max(0, Math.min(1, normX != null ? normX : 0.5));
  return Math.max(0, Math.min(n - 1, Math.round(x * (n - 1))));
}

function normXFromStep(step) {
  var n = beatStepCount();
  var s = Math.max(0, Math.min(n - 1, step | 0));
  return (s + 0.5) / n;
}

function normalizeMarkerDensity(density) {
  var opts = ECAudio.LOOP_DENSITY_OPTIONS || [2, 4, 8];
  var d = density | 0;
  if (opts.indexOf(d) >= 0) return d;
  return 4;
}

function defaultDensityForRole(role) {
  var defs = ECAudio.LOOP_DEFAULT_DENSITY || { kick: 4, chord: 8, lead: 4, hat: 2 };
  var r = normalizeLoopRole(role);
  return defs[r] != null ? defs[r] : 4;
}

function rolePatternWithDensity(role, density) {
  var d = normalizeMarkerDensity(density);
  var steps = beatStepCount();
  var pat = new Array(steps);
  var i;
  role = normalizeLoopRole(role);
  if (role === 'hat') {
    var off = Math.max(1, Math.floor(d / 2));
    for (i = 0; i < steps; i++) pat[i] = ((i + off) % d) === 0 ? 1 : 0;
  } else if (role === 'lead') {
    var leadOff = Math.max(1, Math.floor(d / 2));
    for (i = 0; i < steps; i++) pat[i] = ((i + leadOff) % d) === 0 ? 1 : 0;
  } else {
    for (i = 0; i < steps; i++) pat[i] = (i % d) === 0 ? 1 : 0;
  }
  return pat;
}

function normalizeLoopRole(role) {
  var legacy = ECAudio.LOOP_ROLE_LEGACY || {};
  return legacy[role] || role || 'kick';
}

function markerBeatEnvelope(marker) {
  var s = marker && marker.sizeNorm != null ? marker.sizeNorm : 0.35;
  s = Math.max(0, Math.min(1, s));
  return {
    beatPeak: 0.58 + s * 1.05,
    beatDecay: 0.25 + s * 1.9,
    beatAttack: Math.max(0.002, 0.022 - s * 0.012),
    beatPunch: 0.4 + s * 0.95
  };
}

function markerDensityForBeat(marker) {
  if (!marker) return 4;
  if (marker.density != null) return normalizeMarkerDensity(marker.density);
  if (ECAudio.Markers && ECAudio.Markers.markerDensity) {
    return normalizeMarkerDensity(ECAudio.Markers.markerDensity(marker));
  }
  return 4;
}

function markerUsesStepGrid(marker) {
  if (!marker || !marker.presetId) return false;
  return ECAudio.MarkerDrums && ECAudio.MarkerDrums.isPercussion
    ? ECAudio.MarkerDrums.isPercussion(marker.presetId)
    : (marker.presetId === 'kick' || marker.presetId === 'hat' || marker.presetId === 'clap');
}

function markerUsesSynthVoice(marker) {
  if (!marker || !marker.presetId) return true;
  return ECAudio.MarkerDrums && ECAudio.MarkerDrums.isSynthLayer
    ? ECAudio.MarkerDrums.isSynthLayer(marker.presetId)
    : (marker.presetId === 'bass' || marker.presetId === 'bright' || marker.presetId === 'minimal');
}

function markerPitchRow(marker) {
  if (marker && marker.envId && ECAudio.Environments && ECAudio.Environments.pitchRow) {
    return ECAudio.Environments.pitchRow(marker.envId);
  }
  return marker.laneIndex != null ? marker.laneIndex : (marker.rowIndex != null ? marker.rowIndex : 0);
}

function markerEnvPitchMul(marker) {
  if (marker && marker.envId && ECAudio.Environments && ECAudio.Environments.get) {
    var env = ECAudio.Environments.get(marker.envId);
    if (env && env.pitchMul != null) return env.pitchMul;
  }
  return marker.pitchMul != null ? marker.pitchMul : 1;
}

function normYForMidi(rowIndex, targetMidi) {
  var best = 0.5;
  var bestD = Infinity;
  var k;
  for (k = 0; k <= 24; k++) {
    var ny = k / 24;
    var d = Math.abs(browsePadMidi(rowIndex, ny) - targetMidi);
    if (d < bestD) {
      bestD = d;
      best = ny;
    }
  }
  return padSnapRowNormY(best);
}

function harmonizeBeatNormY(normY, envId, excludeId) {
  var y = padSnapRowNormY(normY);
  if (!envId || !ECAudio.Environments || !ECAudio.Environments.markersIn) return y;
  var others = ECAudio.Environments.markersIn(envId).filter(function(m) {
    return m.id !== excludeId;
  });
  if (!others.length) return y;
  var row = ECAudio.Environments.pitchRow(envId);
  var midi = browsePadMidi(row, y);
  var i;
  for (i = 0; i < others.length; i++) {
    if (Math.abs(others[i].normY - y) < 0.06) return others[i].normY;
  }
  var bestY = y;
  var bestDist = 2.5;
  for (i = 0; i < others.length; i++) {
    var om = browsePadMidi(row, others[i].normY);
    var intervals = [0, 7, -7, 12, -12, 5, -5, 4, -4];
    var j;
    for (j = 0; j < intervals.length; j++) {
      var dist = Math.abs((om + intervals[j]) - midi);
      if (dist < bestDist) {
        bestDist = dist;
        bestY = normYForMidi(row, om + intervals[j]);
      }
    }
  }
  return padSnapRowNormY(bestY);
}

function markerBeatStepCore(marker, globalStep) {
  if (!marker) return { hit: false };
  var steps = beatStepCount();
  var g = ((globalStep % steps) + steps) % steps;
  var phase;

  if (marker.envId && ECAudio.BeatKaoss && ECAudio.BeatKaoss.markerHitsStep) {
    if (!ECAudio.BeatKaoss.markerHitsStep(marker, g)) return { hit: false };
    phase = marker.beatPhase != null
      ? marker.beatPhase
      : ECAudio.BeatKaoss.beatPhaseFromX(marker.normX);
  } else {
    phase = marker.step != null ? marker.step : stepFromNormX(marker.normX);
    if (g !== phase) return { hit: false };
  }

  var rowIndex = markerPitchRow(marker);
  var normY = marker.normY != null ? marker.normY : 0.5;
  var toneX = marker.toneNorm != null ? marker.toneNorm : marker.normX;
  var pitchMul = markerEnvPitchMul(marker);
  var freq;
  var base;

  if (marker.envId && ECAudio.BeatKaoss && ECAudio.BeatKaoss.beatKaossPitch) {
    freq = Math.max(40, ECAudio.BeatKaoss.beatKaossPitch(rowIndex, normY) * pitchMul);
    base = freq;
  } else {
    freq = Math.max(40, browsePadPitch(rowIndex, normY) * pitchMul);
    base = browsePadPitch(rowIndex, normY);
  }

  if (marker.envId && ECAudio.Markers && ECAudio.Markers.getMarkerParam) {
    var det = ECAudio.Markers.getMarkerParam(marker, 'detune');
    if (det) freq = Math.max(40, freq * Math.pow(2, det / 1200));
  } else if (markerUsesSynthVoice(marker)) {
    var tone = kaossTone(toneX, normY);
    freq = Math.max(40, freq * (0.9 + tone.filterHz / 14000));
  }

  var seqVel = 1;
  if (ECAudio.BeatSeq && ECAudio.BeatSeq.patternForMarker) {
    var seqInfo = ECAudio.BeatSeq.patternForMarker(marker);
    if (seqInfo && seqInfo.pattern && seqInfo.pattern[g]) {
      seqVel = seqInfo.pattern[g] === 2 ? 2 : 1;
    }
  }

  return {
    hit: true,
    freq: freq,
    base: base,
    vel: seqVel,
    step: g,
    phase: phase,
    toneX: toneX
  };
}

function markerBeatStep(marker, globalStep) {
  var steps = beatStepCount();
  var g = ((globalStep % steps) + steps) % steps;
  var out = markerBeatStepCore(marker, g);
  if (!out.hit) return out;
  if (ECAudio.BeatSpatial && ECAudio.BeatSpatial.modulateStep) {
    out = ECAudio.BeatSpatial.modulateStep(marker, g, out);
  }
  if (ECAudio.BeatMix && ECAudio.BeatMix.applyToStep) {
    out = ECAudio.BeatMix.applyToStep(marker, g, out);
  }
  return out;
}


function bassFreq(row) {
  var idx = ECAudio.Theory.getPartialIndex(row);
  if (ECAudio.Theory.getScaleTypeForSource(row) === 'pent') {
    var midi = ECAudio.Theory.browsePadMidi(idx, 0.5) - 12;
    if (ECAudio.params.bassFifth && idx % 2 === 1) midi += 7;
    return ECAudio.Engine.freqFromMidi(midi);
  }
  var rootMidi = Math.round(ECAudio.Engine.midiFromFreq(ECAudio.Theory.getRoot(row)));
  if (ECAudio.params.bassFifth) {
    var pidx = idx % 2;
    return ECAudio.Engine.freqFromMidi(rootMidi - 12 + (pidx === 0 ? 0 : 7));
  }
  return ECAudio.Engine.freqFromMidi(rootMidi - 12);
}


function navFreqForTrack(type, row) {
  if (type === 'clap') return 420;
  if (type === 'kick') return 58;
  if (type === 'bass') return ECAudio.Theory.bassFreq(row);
  if (type === 'drums') return ECAudio.Theory.getRoot(row) * 0.5;
  return ECAudio.Theory.noteFreq(row);
}


function getScaleType(secId) {
  if (secId && ECAudio.params.sectionScales && ECAudio.params.sectionScales[secId]) {
    return ECAudio.params.sectionScales[secId];
  }
  if (secId && ECAudio.SECTION_HARMONY[secId]) return ECAudio.SECTION_HARMONY[secId].scale;
  return ECAudio.params.scaleType || 'major';
}

var ARP_PATTERNS = {
  major: [0, 2, 4, 2, 0, 4, 2, 0],
  minor: [0, 2, 3, 2, 0, 3, 2, 0],
  pent:  [0, 1, 2, 1, 0, 2, 1, 0]
};

function zoneRegisterShift(normY) {
  if (normY <= 0.22) return -12;
  if (normY >= 0.78) return 12;
  return 0;
}


function zoneDegreeSpan(secId) {
  var type = ECAudio.Theory.getScaleType(secId);
  if (type === 'pent') return 5;
  return 7;
}


function zoneDegreeIndex(secId, normY) {
  var span = ECAudio.Theory.zoneDegreeSpan(secId);
  var idx = Math.round(normY * Math.max(1, span - 1));
  return Math.max(0, Math.min(span - 1, idx));
}

function browseDegreeCount() {
  return ECAudio.BROWSE_DEGREES || 5;
}

function browseRowKeyCount() {
  return Math.max(2, ECAudio.BROWSE_ROW_KEYS || ECAudio.BROWSE_DEGREES || 5);
}

function isSoundBrowseMode() {
  return typeof soundEnabled === 'undefined' || !soundEnabled;
}

function browseRootMidi() {
  var hz = ECAudio.BROWSE_ROOT_HZ || 110;
  return Math.round(ECAudio.Engine.midiFromFreq(hz));
}

function pentNoteNames(count) {
  var names = (ECAudio.Harmony && ECAudio.Harmony.PENT_NAMES) || ['A', 'B', 'C#', 'E', 'F#'];
  var n = count || browseRowKeyCount();
  return names.slice(0, Math.min(n, names.length));
}

function keyNormFromRowNorm(rowNormY) {
  return 1 - Math.max(0, Math.min(1, rowNormY != null ? rowNormY : 0.5));
}

function rowNormFromKeyNorm(keyNorm) {
  return 1 - Math.max(0, Math.min(1, keyNorm != null ? keyNorm : 0.5));
}

function padDegreeIndex(keyNorm) {
  var keys = browseRowKeyCount();
  if (keys <= 1) return 0;
  var k = Math.max(0, Math.min(1, keyNorm != null ? keyNorm : 0.5));
  return Math.max(0, Math.min(keys - 1, Math.round(k * (keys - 1))));
}

function padSnapKeyNorm(keyNorm) {
  var keys = browseRowKeyCount();
  if (keys <= 1) return 0.5;
  return padDegreeIndex(keyNorm) / (keys - 1);
}

function padSnapRowNormY(rowNormY) {
  return rowNormFromKeyNorm(padSnapKeyNorm(keyNormFromRowNorm(rowNormY)));
}

function browsePadMidi(rowIndex, rowNormY) {
  var scale = ECAudio.Theory.getScaleDegrees(ECAudio.BROWSE_SCALE || 'pent');
  var deg = padDegreeIndex(keyNormFromRowNorm(rowNormY));
  var oct = Math.max(0, rowIndex | 0);
  return browseRootMidi() + scale[Math.min(deg, scale.length - 1)] + oct * 12;
}

function browsePadPitch(rowIndex, rowNormY) {
  var midi = ECAudio.Theory.browsePadMidi(rowIndex, rowNormY);
  var detune = ECAudio.params.detune || 0;
  var minHz = ECAudio.BrowseSound ? ECAudio.BrowseSound.MIN_FREQ : 120;
  return Math.max(minHz, ECAudio.Engine.freqFromMidi(midi) * Math.pow(2, detune / 1200));
}

function rowPadNormY(secId, rowIndex) {
  var span = ECAudio.Theory.zoneDegreeSpan(secId);
  if (span <= 1) return 0.5;
  var idx = ((rowIndex % span) + span) % span;
  return idx / (span - 1);
}

function resolveBrowseMidi(secId, normY, rowIndex) {
  if (rowIndex != null && isSoundBrowseMode()) {
    return ECAudio.Theory.browsePadMidi(rowIndex, normY);
  }
  return ECAudio.Theory.zoneDegreeMidi(secId, normY);
}

function resolveBrowsePitch(secId, normX, normY, rowIndex) {
  if (rowIndex != null && isSoundBrowseMode()) {
    return ECAudio.Theory.browsePadPitch(rowIndex, normY);
  }
  return ECAudio.Theory.zonePitch(secId, normX, normY);
}

function zoneSnapY(secId, normY) {
  if (isSoundBrowseMode()) return ECAudio.Theory.padSnapRowNormY(normY);
  var span = ECAudio.Theory.zoneDegreeSpan(secId);
  if (span <= 1) return 0.5;
  var idx = ECAudio.Theory.zoneDegreeIndex(secId, normY);
  return idx / (span - 1);
}


function zoneUseScalePitch() {
  return typeof soundEnabled === 'undefined' || !soundEnabled || !!ECAudio.params.quantizeNotes;
}

function zoneDegreeMidi(secId, normY, rowIndex) {
  if (rowIndex != null && isSoundBrowseMode()) {
    return ECAudio.Theory.browsePadMidi(rowIndex, normY);
  }
  var scale = ECAudio.Theory.getScale(secId);
  var idx = ECAudio.Theory.zoneDegreeIndex(secId, normY);
  var rootMidi = Math.round(ECAudio.Engine.midiFromFreq(ECAudio.Theory.getRoot(secId)));

  if (!ECAudio.Theory.zoneUseScalePitch()) {
    var partial = ECAudio.State.PARTIALS[idx % ECAudio.State.PARTIALS.length];
    return ECAudio.Engine.midiFromFreq(ECAudio.Theory.getRoot(secId) * partial);
  }

  var semi = scale[Math.min(idx, scale.length - 1)];
  return rootMidi + semi + zoneRegisterShift(normY);
}


function zonePitch(secId, normX, normY, rowIndex) {
  if (rowIndex != null && isSoundBrowseMode()) {
    return ECAudio.Theory.browsePadPitch(rowIndex, normY);
  }
  var midi = ECAudio.Theory.zoneDegreeMidi(secId, normY);
  var detune = ECAudio.params.detune || 0;
  var minHz = ECAudio.BrowseSound ? ECAudio.BrowseSound.MIN_FREQ : 120;
  return Math.max(minHz, ECAudio.Engine.freqFromMidi(midi) * Math.pow(2, detune / 1200));
}


function zoneArpStep(secId, step, normX, normY, rowIndex) {
  var scale = ECAudio.Theory.getScale(secId);
  var type = ECAudio.Theory.getScaleType(secId);
  var pattern = ARP_PATTERNS[type] || ARP_PATTERNS.major;
  var jump = pattern[step % pattern.length];
  var anchor = rowIndex != null && isSoundBrowseMode()
    ? padDegreeIndex(keyNormFromRowNorm(normY))
    : ECAudio.Theory.zoneDegreeIndex(secId, normY);
  var rootMidi = rowIndex != null && isSoundBrowseMode()
    ? browseRootMidi() + Math.max(0, rowIndex) * 12
    : Math.round(ECAudio.Engine.midiFromFreq(ECAudio.Theory.getRoot(secId)));

  if (!ECAudio.Theory.zoneUseScalePitch()) {
    var partial = ECAudio.State.PARTIALS[(anchor + jump) % ECAudio.State.PARTIALS.length];
    var base = ECAudio.Theory.getRoot(secId) * partial;
    return { base: base, freq: Math.max(88, base) };
  }

  var idx = (anchor + jump) % scale.length;
  var base = ECAudio.Engine.freqFromMidi(rootMidi + scale[idx] + (
    rowIndex != null && isSoundBrowseMode() ? 0 : zoneRegisterShift(normY)
  ));
  return { base: base, freq: Math.max(88, base) };
}


var NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function zoneNoteLabel(secId, normY, rowIndex) {
  if (rowIndex != null && isSoundBrowseMode()) {
    return ECAudio.Theory.browsePadNoteLabel(rowIndex, normY);
  }
  var midi = Math.round(ECAudio.Theory.zoneDegreeMidi(secId, normY));
  var name = NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
  return name;
}

function browsePadNoteLabel(rowIndex, rowNormY) {
  if (typeof rowIndex === 'number' && rowNormY == null && rowIndex <= 1) {
    rowNormY = rowIndex;
    rowIndex = 0;
  }
  var midi = Math.round(ECAudio.Theory.browsePadMidi(rowIndex, rowNormY));
  var name = NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
  var key = padDegreeIndex(keyNormFromRowNorm(rowNormY)) + 1;
  var oct = (rowIndex | 0) + 1;
  return name + ' · oct ' + oct + ' · key ' + key;
}

function sectionMelodyInfo(secId) {
  var names = pentNoteNames().join(' · ');
  return 'A pentatonic — up/down on a row = ' + names + ' · next row = higher octave';
}

function kaossPitch(secId, normX, normY) {
  return ECAudio.Theory.zonePitch(secId, normX, normY != null ? normY : 0.5);
}


function kaossRatio() {
  return 1;
}


function composeMarkerVoice(marker) {
  if (marker && markerUsesSynthVoice(marker) && ECAudio.Machines && ECAudio.Machines.composeSpec) {
    var machineSpec = ECAudio.Machines.composeSpec(marker);
    if (machineSpec) return machineSpec;
  }
  var mp = null;
  if (marker && marker.envId && ECAudio.Environments && ECAudio.Environments.envParams) {
    mp = ECAudio.Environments.envParams(marker.envId);
  } else if (marker && ECAudio.Markers && ECAudio.Markers.ensureMarkerParams) {
    mp = ECAudio.Markers.ensureMarkerParams(marker);
  } else if (marker && marker.params) {
    mp = marker.params;
  }
  var toneX = marker.toneNorm != null ? marker.toneNorm : marker.normX;
  var spec = ECAudio.BrowseSound.resolve({
    normX: toneX != null ? toneX : 0.5,
    normY: marker.normY,
    sizeNorm: marker.sizeNorm,
    count: (ECAudio.State.markers || []).length,
    markerParams: mp
  });
  if (markerUsesSynthVoice(marker)) {
    var stepSec = loopStepMs() / 1000;
    var atk = mp && mp.attack != null ? mp.attack : spec.attack;
    var dec = mp && mp.decay != null ? mp.decay : (spec.decay != null ? spec.decay : 1.1);
    spec.attack = atk;
    spec.decay = dec;
    spec.beatAttack = Math.max(0.003, Math.min(0.22, atk));
    spec.beatDecay = Math.max(0.4, Math.min(6.5, dec / Math.max(stepSec * 1.1, 0.04)));
    spec.beatPeak = 0.92 + (marker.sizeNorm != null ? marker.sizeNorm : 0.35) * 0.28;
    spec.beatPunch = 0.82 + (mp && mp.browseHarmonics != null ? mp.browseHarmonics : 0.45) * 0.35;
    spec.synthLayer = true;
  } else {
    spec = Object.assign({}, spec, markerBeatEnvelope(marker));
  }
  if (marker && ECAudio.BeatPresence && ECAudio.BeatPresence.presenceGain) {
    var zg = ECAudio.BeatPresence.presenceGain(ECAudio.BeatPresence.normZ(marker));
    if (spec.beatPeak != null) spec.beatPeak *= zg;
    if (spec.beatPunch != null) spec.beatPunch *= zg;
  }
  if (marker && ECAudio.BeatSpatial && ECAudio.BeatSpatial.modulateSpec) {
    spec = ECAudio.BeatSpatial.modulateSpec(marker, spec);
  }
  return spec;
}

function markerPolyLevel(count) {
  return ECAudio.BrowseSound.polyLevel(count);
}

function kaossTone(normX, normY) {
  var s = ECAudio.BrowseSound.resolve({ normX: normX, normY: normY, count: 1 });
  return {
    gainMul: s.gainMul,
    filterHz: s.filterHz,
    subMix: s.subMix,
    filterQ: s.filterQ,
    space: s.space
  };
}


ECAudio.Theory = {
  getSectionId: getSectionId, getScale: getScale, getScaleDegrees: getScaleDegrees,
  getScaleTypeForSource: getScaleTypeForSource, getRoot: getRoot, getPartialIndex: getPartialIndex,
  rowFreq: rowFreq, noteFreq: noteFreq, stepMs: stepMs, beatMs: beatMs, loopStepMs: loopStepMs,
  beatStepCount: beatStepCount, stepFromNormX: stepFromNormX, normXFromStep: normXFromStep,
  markerBeatStep: markerBeatStep, markerBeatStepCore: markerBeatStepCore,
  markerBeatEnvelope: markerBeatEnvelope,
  normalizeLoopRole: normalizeLoopRole,
  normalizeMarkerDensity: normalizeMarkerDensity,
  defaultDensityForRole: defaultDensityForRole,
  rolePatternWithDensity: rolePatternWithDensity,
  bassFreq: bassFreq, navFreqForTrack: navFreqForTrack,
  getScaleType: getScaleType, zoneUseScalePitch: zoneUseScalePitch,
  zoneDegreeSpan: zoneDegreeSpan,
  zoneDegreeIndex: zoneDegreeIndex, rowPadNormY: rowPadNormY,
  browseRowKeyCount: browseRowKeyCount, pentNoteNames: pentNoteNames,
  keyNormFromRowNorm: keyNormFromRowNorm, rowNormFromKeyNorm: rowNormFromKeyNorm,
  padDegreeIndex: padDegreeIndex, padSnapKeyNorm: padSnapKeyNorm, padSnapRowNormY: padSnapRowNormY,
  browsePadMidi: browsePadMidi, browsePadPitch: browsePadPitch,
  browsePadNoteLabel: browsePadNoteLabel,
  browseRowMidi: browsePadMidi, browseRowPitch: browsePadPitch,
  browseRowNoteLabel: browsePadNoteLabel,
  resolveBrowsePitch: resolveBrowsePitch,
  resolveBrowseMidi: resolveBrowseMidi, zoneSnapY: zoneSnapY,
  zoneDegreeMidi: zoneDegreeMidi, zonePitch: zonePitch, zoneNoteLabel: zoneNoteLabel,
  sectionMelodyInfo: sectionMelodyInfo, zoneArpStep: zoneArpStep,
  kaossPitch: kaossPitch, kaossRatio: kaossRatio, kaossTone: kaossTone,
  markerPolyLevel: markerPolyLevel, composeMarkerVoice: composeMarkerVoice,
  markerPitchRow: markerPitchRow, harmonizeBeatNormY: harmonizeBeatNormY,
  normYForMidi: normYForMidi
};
