/* eslint-disable no-var */
// Beat studio — Z axis = presence (velocity + influence on other dots).
window.ECAudio = window.ECAudio || {};

var DEFAULT_PRESENCE = 0.55;

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function normZ(marker) {
  if (!marker) return DEFAULT_PRESENCE;
  if (marker.normZ != null) return clamp01(marker.normZ);
  return DEFAULT_PRESENCE;
}

function presenceGain(z) {
  z = clamp01(z != null ? z : DEFAULT_PRESENCE);
  return 0.2 + z * 0.9;
}

function presenceInfluence(z) {
  z = clamp01(z != null ? z : DEFAULT_PRESENCE);
  return 0.14 + z * 0.86;
}

function gainMul(marker) {
  if (!marker) return 1;
  var level = marker.levelMul != null ? marker.levelMul : 1;
  return presenceGain(normZ(marker)) * level;
}

function couplingMul(a, b) {
  if (ECAudio.BeatSpatial && ECAudio.BeatSpatial.coupling) {
    return ECAudio.BeatSpatial.coupling(a, b);
  }
  return Math.sqrt(presenceInfluence(normZ(a)) * presenceInfluence(normZ(b)));
}

function normZFromHold(holdMs) {
  var linear = Math.max(0, Math.min(1, (holdMs - 24) / (520 - 24)));
  return clamp01(0.34 + Math.pow(linear, 0.55) * 0.58);
}

function depthScale(z) {
  z = clamp01(z != null ? z : DEFAULT_PRESENCE);
  return 0.78 + z * 0.34;
}

ECAudio.BeatPresence = {
  DEFAULT: DEFAULT_PRESENCE,
  normZ: normZ,
  presenceGain: presenceGain,
  presenceInfluence: presenceInfluence,
  gainMul: gainMul,
  couplingMul: couplingMul,
  normZFromHold: normZFromHold,
  depthScale: depthScale
};
