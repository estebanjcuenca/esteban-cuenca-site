/* eslint-disable no-var */
// Dedicated 6-lane beat maker — separate from CV table hover.
window.ECAudio = window.ECAudio || {};

ECAudio.BEAT_STUDIO_SEC_ID = 'beat-studio';

var LANE_IDS = ['kick', 'hat', 'bass', 'clap', 'bright', 'minimal'];

function beatStudioRoot() {
  return document.getElementById('beat-studio');
}

function lanesWrap() {
  var root = beatStudioRoot();
  return root ? root.querySelector('.beat-lanes') : null;
}

function studioOverlay() {
  var root = beatStudioRoot();
  if (!root) return null;
  var overlay = root.querySelector('.beat-studio-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'beat-studio-overlay table-sound-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    var inner = root.querySelector('.beat-studio-inner');
    if (inner) inner.appendChild(overlay);
  }
  return overlay;
}

function laneLabel(index) {
  return ECAudio.MarkerDrums && ECAudio.MarkerDrums.laneLabel
    ? ECAudio.MarkerDrums.laneLabel(index) : '';
}

function laneDescription(index) {
  return ECAudio.MarkerDrums && ECAudio.MarkerDrums.laneDescription
    ? ECAudio.MarkerDrums.laneDescription(index) : '';
}

function annotateLane(lane, index) {
  if (!lane) return;
  var label = laneLabel(index);
  var desc = laneDescription(index);
  lane.classList.add('beat-lane', 'row-pad', 'influence-zone', 'beat-layer-active');
  lane.dataset.laneIndex = String(index);
  lane.dataset.beatLayer = label;
  lane.setAttribute('data-lane-index', String(index));
  if (label) lane.setAttribute('data-beat-layer', label);
  lane.setAttribute('data-layer-label', label);
  lane.title = label + ' — ' + desc + ' · tap step · tap dot = cycle · dbl-click = remove';
}

function buildLanes() {
  var wrap = lanesWrap();
  if (!wrap || wrap.children.length >= LANE_IDS.length) return;
  wrap.innerHTML = '';
  var i;
  for (i = 0; i < LANE_IDS.length; i++) {
    var lane = document.createElement('div');
    lane.className = 'beat-lane';
    lane.setAttribute('role', 'button');
    lane.setAttribute('tabindex', '-1');
    var label = document.createElement('span');
    label.className = 'beat-lane-label';
    label.textContent = laneLabel(i);
    lane.appendChild(label);
    annotateLane(lane, i);
    wrap.appendChild(lane);
  }
}

function allLanes() {
  var wrap = lanesWrap();
  return wrap ? wrap.querySelectorAll('.beat-lane') : [];
}

function laneByIndex(index) {
  var lanes = allLanes();
  var i = index != null ? (index | 0) : 0;
  if (i < 0 || i >= lanes.length) return lanes[0] || null;
  return lanes[i];
}

function overlayForLane(lane) {
  return studioOverlay();
}

function laneOverlayPoint(lane, normX, normY) {
  var inner = lane && lane.closest('.beat-studio-inner');
  if (!lane || !inner) return null;
  var laneR = lane.getBoundingClientRect();
  var innerR = inner.getBoundingClientRect();
  var y = normY != null ? normY : 0.5;
  return {
    left: laneR.left - innerR.left + normX * laneR.width,
    top: laneR.top - innerR.top + y * laneR.height
  };
}

function pointInLane(lane, clientX, clientY) {
  var r = lane.getBoundingClientRect();
  return clientX >= r.left - 6 && clientX <= r.right + 6 &&
    clientY >= r.top - 4 && clientY <= r.bottom + 4;
}

function findLaneAt(clientX, clientY) {
  if (!document.documentElement.classList.contains('beat-studio')) return null;
  var lanes = allLanes();
  var i;
  for (i = 0; i < lanes.length; i++) {
    var lane = lanes[i];
    if (!pointInLane(lane, clientX, clientY)) continue;
    var idx = lane.dataset.laneIndex != null ? parseInt(lane.dataset.laneIndex, 10) : i;
    return {
      zone: lane,
      secId: ECAudio.BEAT_STUDIO_SEC_ID,
      rowIndex: idx,
      laneIndex: idx
    };
  }
  return null;
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
}

function initBeatStudio() {
  buildLanes();
  studioOverlay();
  allLanes().forEach(function(lane, i) {
    annotateLane(lane, i);
  });
}

function isActive() {
  return document.documentElement.classList.contains('beat-studio');
}

ECAudio.BeatStudio = {
  SEC_ID: ECAudio.BEAT_STUDIO_SEC_ID,
  init: initBeatStudio,
  show: showStudio,
  hide: hideStudio,
  isActive: isActive,
  findLaneAt: findLaneAt,
  laneByIndex: laneByIndex,
  allLanes: allLanes,
  overlayForLane: overlayForLane,
  laneOverlayPoint: laneOverlayPoint,
  annotateLane: annotateLane
};
