/* eslint-disable no-var */
window.ECAudio = window.ECAudio || {};

var BEAT_LAYER_COUNT = 6;
var DRUM_PRESET_IDS = ['kick', 'hat', 'clap'];
var SYNTH_LAYER_PRESETS = ['bass', 'bright', 'minimal'];
var LANE_DEFAULT_PRESETS = ['kick', 'hat', 'bass', 'clap', 'bright', 'minimal'];
var LANE_DESCRIPTIONS = [
  'Kick machine — punch drum',
  '909 hat — closed/open by velocity',
  'Synth bass — ↕ pitch · mono sub',
  'Layered clap — snap & room',
  'Dry stab lead — ↕ melody · ↔ tone',
  'Soft texture — ↕ melody · warm tail'
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
  if (ECAudio.MachinePlayback && ECAudio.MachinePlayback.peakFromMarker) {
    return ECAudio.MachinePlayback.peakFromMarker(marker, { vel: 1 });
  }
  return 0.12;
}

function playMarkerDrum(marker, stepData) {
  if (!marker || !isPercussionPreset(marker.presetId)) return false;
  if (ECAudio.Machines && ECAudio.Machines.playHit) {
    return ECAudio.Machines.playHit(marker, stepData);
  }
  return false;
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
  if (ECAudio.Machines && ECAudio.Machines.meta) {
    var m = ECAudio.Machines.meta(id);
    if (m) return m.label;
  }
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
