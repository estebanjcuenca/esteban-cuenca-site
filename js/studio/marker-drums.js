/* eslint-disable no-var */
window.ECAudio = window.ECAudio || {};

var BEAT_LAYER_COUNT = 6;
var DRUM_PRESET_IDS = ['kick', 'hat', 'clap'];
var SYNTH_LAYER_PRESETS = ['bass', 'bright', 'minimal'];
var LANE_DEFAULT_PRESETS = ['kick', 'hat', 'bass', 'clap', 'bright', 'minimal'];
var LANE_DESCRIPTIONS = [
  'Drum — one hit per step',
  'Drum — one hit per step',
  'Synth bass — ↕ pitch · pulse repeats',
  'Drum — one hit per step',
  'Lead synth — ↕ melody · ↔ tone · pulse',
  'Soft synth — ↕ melody · pulse'
];
var PRESET_CYCLE = ['kick', 'hat', 'bass', 'clap', 'bright', 'minimal'];

function isDrumPreset(id) {
  return DRUM_PRESET_IDS.indexOf(id) >= 0;
}

function isPercussionPreset(id) {
  return isDrumPreset(id);
}

function isSynthLayerPreset(id) {
  return SYNTH_LAYER_PRESETS.indexOf(id) >= 0;
}

function isMelodicPreset(id) {
  return isSynthLayerPreset(id);
}

function defaultPresetForLane(rowIndex) {
  var i = rowIndex != null ? (rowIndex | 0) : 0;
  return LANE_DEFAULT_PRESETS[((i % LANE_DEFAULT_PRESETS.length) + LANE_DEFAULT_PRESETS.length) %
    LANE_DEFAULT_PRESETS.length];
}

function presetsForLane(rowIndex) {
  var def = defaultPresetForLane(rowIndex);
  if (def === 'bright' || def === 'minimal') return ['bright', 'minimal'];
  return [def];
}

function nextPresetInCycle(presetId, rowIndex) {
  if (rowIndex != null && isActiveBeatLane(rowIndex)) {
    var opts = presetsForLane(rowIndex);
    if (opts.length <= 1) return opts[0];
    var j = opts.indexOf(presetId);
    if (j < 0) return opts[0];
    return opts[(j + 1) % opts.length];
  }
  var idx = PRESET_CYCLE.indexOf(presetId);
  if (idx < 0) return PRESET_CYCLE[0];
  return PRESET_CYCLE[(idx + 1) % PRESET_CYCLE.length];
}

function laneLabel(rowIndex) {
  var labels = ['Kick', 'Hat', 'Bass', 'Clap', 'Lead', 'Soft'];
  var i = rowIndex != null ? (rowIndex | 0) : 0;
  if (i < 0 || i >= BEAT_LAYER_COUNT) return '';
  return labels[i];
}

function laneDescription(rowIndex) {
  var i = rowIndex != null ? (rowIndex | 0) : 0;
  if (i < 0 || i >= BEAT_LAYER_COUNT) return '';
  return LANE_DESCRIPTIONS[i] || '';
}

function isMelodicLane(rowIndex) {
  var p = defaultPresetForLane(rowIndex);
  return p === 'bass' || p === 'bright' || p === 'minimal';
}

function isActiveBeatLane(rowIndex) {
  return rowIndex != null && (rowIndex | 0) >= 0 && (rowIndex | 0) < BEAT_LAYER_COUNT;
}

function markerDrumGain(marker) {
  if (!marker) return 0.12;
  var mp = marker.params || {};
  var g = mp.gain != null ? mp.gain : 0.12;
  var mul = marker.levelMul != null ? marker.levelMul : 1;
  return g * mul;
}

function playBrowseKick(peak) {
  ECAudio.Engine.bootAudio();
  ECAudio.Engine.boot();
  var t = ECAudio.State.ctx.currentTime;
  var bus = ECAudio.Engine.out();
  var tail = 0.16;

  var clickLen = Math.max(2, Math.floor(ECAudio.State.ctx.sampleRate * 0.0025));
  var clickBuf = ECAudio.State.ctx.createBuffer(1, clickLen, ECAudio.State.ctx.sampleRate);
  var cd = clickBuf.getChannelData(0);
  var ci;
  for (ci = 0; ci < clickLen; ci++) cd[ci] = Math.random() * 2 - 1;
  var click = ECAudio.State.ctx.createBufferSource();
  click.buffer = clickBuf;
  var clickHp = ECAudio.State.ctx.createBiquadFilter();
  clickHp.type = 'highpass';
  clickHp.frequency.value = 2000;
  var clickG = ECAudio.State.ctx.createGain();
  clickG.gain.setValueAtTime(peak * 0.38, t);
  clickG.gain.exponentialRampToValueAtTime(0.001, t + 0.003);
  click.connect(clickHp);
  clickHp.connect(clickG);
  clickG.connect(bus);
  click.start(t);
  click.stop(t + 0.004);

  var osc = ECAudio.State.ctx.createOscillator();
  var gain = ECAudio.State.ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(58, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.03);
  osc.frequency.exponentialRampToValueAtTime(34, t + tail);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + 0.001);
  gain.gain.setValueAtTime(peak * 0.88, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + tail);
  osc.connect(gain);
  gain.connect(bus);
  osc.start(t);
  osc.stop(t + tail + 0.02);
}

function playBrowseHat(peak) {
  ECAudio.Engine.bootAudio();
  ECAudio.Engine.boot();
  var ctx = ECAudio.State.ctx;
  var t = ctx.currentTime;
  var bus = ECAudio.Engine.out();
  var len = Math.floor(ctx.sampleRate * 0.045);
  var buf = ctx.createBuffer(1, len, ctx.sampleRate);
  var d = buf.getChannelData(0);
  var i;
  for (i = 0; i < len; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.14));
  }
  var src = ctx.createBufferSource();
  src.buffer = buf;
  var hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 6800;
  var bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 9800;
  bp.Q.value = 0.55;
  var gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
  src.connect(hp);
  hp.connect(bp);
  bp.connect(gain);
  gain.connect(bus);
  src.start(t);
  src.stop(t + 0.05);
}

function playBrowseClap(peak) {
  ECAudio.Engine.bootAudio();
  ECAudio.Engine.boot();
  if (!ECAudio.State.clapBursts && ECAudio.Voices && ECAudio.Voices.ensureClapBursts) {
    ECAudio.Voices.ensureClapBursts();
  }
  if (!ECAudio.State.clapBursts) return;
  var t = ECAudio.State.ctx.currentTime;
  var bus = ECAudio.Engine.out();
  var rev = ECAudio.params.reverbAmt != null ? ECAudio.params.reverbAmt : 0.14;
  var offsets = [0, 0.009, 0.02];
  var levels = [1, 0.7, 0.45];
  offsets.forEach(function(off, idx) {
    var src = ECAudio.State.ctx.createBufferSource();
    src.buffer = ECAudio.State.clapBursts[idx];
    var hp = ECAudio.State.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 420;
    var bp = ECAudio.State.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500;
    bp.Q.value = 0.7;
    var gain = ECAudio.State.ctx.createGain();
    var st = t + off;
    gain.gain.setValueAtTime(0, st);
    gain.gain.linearRampToValueAtTime(peak * levels[idx], st + 0.0015);
    gain.gain.exponentialRampToValueAtTime(0.001, st + 0.065);
    src.connect(hp);
    hp.connect(bp);
    bp.connect(gain);
    gain.connect(bus);
    ECAudio.Engine.wetSend(gain, rev * 0.7);
    src.start(st);
    src.stop(st + 0.07);
  });
}

function playBrowseBass(freq, peak) {
  ECAudio.Engine.bootAudio();
  ECAudio.Engine.boot();
  var t = ECAudio.State.ctx.currentTime;
  var bus = ECAudio.Engine.out();
  var f = Math.max(36, Math.min(220, freq));
  var dur = 0.22;
  var osc = ECAudio.State.ctx.createOscillator();
  var gain = ECAudio.State.ctx.createGain();
  var lp = ECAudio.State.ctx.createBiquadFilter();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(f, t);
  lp.type = 'lowpass';
  lp.Q.value = 0.8;
  lp.frequency.setValueAtTime(Math.min(480, f * 3.2), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(80, f * 0.7), t + dur * 0.82);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(lp);
  lp.connect(gain);
  gain.connect(bus);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function playMarkerDrum(marker, stepData) {
  if (!marker || !isPercussionPreset(marker.presetId)) return false;
  var peak = markerDrumGain(marker);
  if (marker.presetId === 'kick') playBrowseKick(peak);
  else if (marker.presetId === 'hat') playBrowseHat(peak);
  else if (marker.presetId === 'clap') playBrowseClap(peak);
  return true;
}

function createDrumStubVoice(marker) {
  return {
    pinned: true,
    arpeggio: true,
    isDrum: true,
    drumId: marker && marker.presetId,
    arpStep: 0
  };
}

function presetLabel(id) {
  var p = ECAudio.SoundPresets && ECAudio.SoundPresets[id];
  if (p && p.label) return p.label;
  if (id === 'kick') return 'Kick';
  if (id === 'hat') return 'Hat';
  if (id === 'bass') return 'Bass';
  if (id === 'clap') return 'Clap';
  return '';
}

ECAudio.MarkerDrums = {
  BEAT_LAYER_COUNT: BEAT_LAYER_COUNT,
  DRUM_PRESET_IDS: DRUM_PRESET_IDS,
  PRESET_CYCLE: PRESET_CYCLE,
  isDrum: isPercussionPreset,
  isPercussion: isPercussionPreset,
  isSynthLayer: isSynthLayerPreset,
  isMelodic: isMelodicPreset,
  isMelodicLane: isMelodicLane,
  isActiveBeatLane: isActiveBeatLane,
  play: playMarkerDrum,
  stubVoice: createDrumStubVoice,
  presetLabel: presetLabel,
  markerGain: markerDrumGain,
  defaultPresetForLane: defaultPresetForLane,
  nextPresetInCycle: nextPresetInCycle,
  presetsForLane: presetsForLane,
  laneLabel: laneLabel,
  laneDescription: laneDescription
};
