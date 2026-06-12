/* eslint-disable no-var */
// Beat studio — single XY pad; environments hold dots per element type.
window.ECAudio = window.ECAudio || {};

ECAudio.BEAT_STUDIO_SEC_ID = 'beat-studio';

function beatStudioRoot() {
  return document.getElementById('beat-studio');
}

function padZone() {
  return document.getElementById('beat-pad');
}

function studioOverlay() {
  var root = beatStudioRoot();
  if (!root) return null;
  var stack = root.querySelector('.beat-pad-stack');
  var overlay = stack
    ? stack.querySelector('.beat-studio-overlay')
    : root.querySelector('.beat-studio-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'beat-studio-overlay table-sound-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    if (stack) stack.appendChild(overlay);
    else {
      var inner = root.querySelector('.beat-studio-inner');
      if (inner) inner.appendChild(overlay);
    }
  }
  return overlay;
}

function padNorm(clientX, clientY) {
  var pad = padZone();
  if (!pad) return { x: 0.5, y: 0.5 };
  var r = pad.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return { x: 0.5, y: 0.5 };
  return {
    x: Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
    y: Math.max(0, Math.min(1, (clientY - r.top) / r.height))
  };
}

function pointInPad(clientX, clientY) {
  var pad = padZone();
  if (!pad) return false;
  var r = pad.getBoundingClientRect();
  return clientX >= r.left - 8 && clientX <= r.right + 8 &&
    clientY >= r.top - 8 && clientY <= r.bottom + 8;
}

function padOverlayPoint(normX, normY) {
  var pad = padZone();
  var stack = beatStudioRoot() && beatStudioRoot().querySelector('.beat-pad-stack');
  var inner = stack || (beatStudioRoot() && beatStudioRoot().querySelector('.beat-studio-inner'));
  if (!pad || !inner) return null;
  var padR = pad.getBoundingClientRect();
  var innerR = inner.getBoundingClientRect();
  var y = normY != null ? normY : 0.5;
  var x = normX != null ? normX : 0.5;
  return {
    left: padR.left - innerR.left + x * padR.width,
    top: padR.top - innerR.top + y * padR.height
  };
}

function findPadAt(clientX, clientY) {
  if (!document.documentElement.classList.contains('beat-studio')) return null;
  if (!pointInPad(clientX, clientY)) return null;
  var norm = padNorm(clientX, clientY);
  var env = ECAudio.Environments && ECAudio.Environments.getActive
    ? ECAudio.Environments.getActive() : null;
  var rowIndex = env && ECAudio.Environments.pitchRowForType
    ? ECAudio.Environments.pitchRowForType(env.type) : 0;
  return {
    zone: padZone(),
    secId: ECAudio.BEAT_STUDIO_SEC_ID,
    rowIndex: rowIndex,
    laneIndex: rowIndex,
    normX: norm.x,
    normY: norm.y
  };
}

function ensurePadStereoLanes() {
  var pad = padZone();
  if (!pad || pad.querySelector('.beat-pad-stereo')) return;
  var lanes = document.createElement('div');
  lanes.className = 'beat-pad-stereo';
  lanes.setAttribute('aria-hidden', 'true');
  lanes.innerHTML =
    '<span class="beat-pad-stereo-l">L</span>' +
    '<span class="beat-pad-stereo-c">beat · pitch</span>' +
    '<span class="beat-pad-stereo-r">R</span>';
  pad.appendChild(lanes);
}

function annotatePad() {
  var pad = padZone();
  if (!pad) return;
  pad.classList.add('beat-pad', 'row-pad', 'influence-zone', 'beat-layer-active');
  pad.dataset.secId = ECAudio.BEAT_STUDIO_SEC_ID;
  pad.title = 'Layer 0 beat space — tap dot to open layer · tap empty for all layers · hold to place';
  ensurePadStereoLanes();
}

function showStudio() {
  var root = beatStudioRoot();
  if (!root) return;
  root.hidden = false;
  root.setAttribute('aria-hidden', 'false');
}

function hideStudio() {
  var root = beatStudioRoot();
  if (!root) return;
  root.hidden = true;
  root.setAttribute('aria-hidden', 'true');
  if (ECAudio.BeatView3d && ECAudio.BeatView3d.pause) ECAudio.BeatView3d.pause();
}

function initBeatStudio() {
  annotatePad();
  studioOverlay();
  try {
    if (ECAudio.Environments && ECAudio.Environments.init) ECAudio.Environments.init();
  } catch (err) { /* keep pad usable */ }
  try {
    if (ECAudio.BeatView3d && ECAudio.BeatView3d.init) ECAudio.BeatView3d.init();
  } catch (err) { /* 2D pad still works */ }
  try {
    if (ECAudio.BeatSeq && ECAudio.BeatSeq.init) ECAudio.BeatSeq.init();
  } catch (err) { /* pad still works */ }
  try {
    if (ECAudio.BeatInfluence && ECAudio.BeatInfluence.init) ECAudio.BeatInfluence.init();
  } catch (err) { /* influence UI optional */ }
  try {
    if (ECAudio.BeatScale && ECAudio.BeatScale.init) ECAudio.BeatScale.init();
  } catch (err) { /* scale UI optional */ }
}

function isActive() {
  return document.documentElement.classList.contains('beat-studio');
}

// Legacy lane API stubs (markers.js still references some paths)
function overlayForLane() {
  return studioOverlay();
}

function laneOverlayPoint(lane, normX, normY) {
  return padOverlayPoint(normX, normY);
}

function findLaneAt(clientX, clientY) {
  return findPadAt(clientX, clientY);
}

ECAudio.BeatStudio = {
  SEC_ID: ECAudio.BEAT_STUDIO_SEC_ID,
  init: initBeatStudio,
  show: showStudio,
  hide: hideStudio,
  isActive: isActive,
  padZone: padZone,
  studioOverlay: studioOverlay,
  findPadAt: findPadAt,
  findLaneAt: findLaneAt,
  padNorm: padNorm,
  padOverlayPoint: padOverlayPoint,
  overlayForLane: overlayForLane,
  laneOverlayPoint: laneOverlayPoint,
  annotatePad: annotatePad
};
