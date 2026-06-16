/* eslint-disable no-var */
// Beat studio — SVG bond lines between related dots (time + harmony).
window.ECAudio = window.ECAudio || {};

var TIME_BOND_PHASE = 0.52;
var HARMONY_INTERVALS = [0, 3, 4, 5, 7, 12];
var HARMONY_TOL = 1.15;
function beatMarkers() {
  var beatSec = ECAudio.BEAT_STUDIO_SEC_ID || 'beat-studio';
  return (ECAudio.State.markers || []).filter(function(m) {
    return m && m.secId === beatSec && m.normX != null && m.normY != null;
  });
}

function markerPhase(m) {
  if (!m) return 0;
  if (m.beatPhase != null) return m.beatPhase;
  if (ECAudio.BeatKaoss && ECAudio.BeatKaoss.beatPhaseFromX) {
    return ECAudio.BeatKaoss.beatPhaseFromX(m.normX);
  }
  return (m.normX != null ? m.normX : 0.5) * 16;
}

function markerMidi(m) {
  if (!m || !ECAudio.Theory || !ECAudio.Theory.browsePadMidi) return 60;
  var row = ECAudio.Theory.markerPitchRow
    ? ECAudio.Theory.markerPitchRow(m) : (m.rowIndex | 0);
  return ECAudio.Theory.browsePadMidi(row, m.normY != null ? m.normY : 0.5);
}

function isMelodicMarker(m) {
  if (!m) return false;
  if (ECAudio.MarkerDrums && ECAudio.MarkerDrums.isSynthLayer) {
    return ECAudio.MarkerDrums.isSynthLayer(m.presetId);
  }
  var t = m.presetId || (m.envId ? m.envId.replace(/^env-/, '') : '');
  return t === 'bass' || t === 'bright' || t === 'minimal' || t === 'synth' || t === 'arpeggio';
}

function consonantMidi(a, b) {
  var diff = Math.abs(a - b);
  diff = diff % 12;
  if (diff > 6) diff = 12 - diff;
  var i;
  for (i = 0; i < HARMONY_INTERVALS.length; i++) {
    var iv = HARMONY_INTERVALS[i];
    var d = iv > 6 ? 12 - iv : iv;
    if (Math.abs(diff - d) <= HARMONY_TOL) return true;
  }
  return Math.abs((a | 0) - (b | 0)) <= HARMONY_TOL;
}

function presenceZ(marker) {
  return ECAudio.BeatPresence && ECAudio.BeatPresence.normZ
    ? ECAudio.BeatPresence.normZ(marker) : 0.55;
}

function bondBetween(a, b) {
  var time = Math.abs(markerPhase(a) - markerPhase(b)) < TIME_BOND_PHASE;
  var harm = isMelodicMarker(a) && isMelodicMarker(b) && consonantMidi(markerMidi(a), markerMidi(b));
  var zNear = Math.abs(presenceZ(a) - presenceZ(b)) < 0.22;
  var spatialNear = ECAudio.BeatSpatial && ECAudio.BeatSpatial.spatialNear
    ? ECAudio.BeatSpatial.spatialNear(a, b) : false;
  var clash = ECAudio.BeatMix && ECAudio.BeatMix.freqClash
    ? ECAudio.BeatMix.freqClash(a, b) : false;
  if (!time && !harm && !zNear && !spatialNear && !clash) return null;
  var strength = clash ? 0.92 : ((time && harm) ? 1 : (time ? 0.55 : (harm ? 0.72 : (spatialNear ? 0.48 : 0.4))));
  if (ECAudio.BeatSpatial && ECAudio.BeatSpatial.bondStrength) {
    strength = ECAudio.BeatSpatial.bondStrength(a, b, {
      time: time, harm: harm, zNear: zNear, strength: strength
    });
  } else if (ECAudio.BeatPresence && ECAudio.BeatPresence.couplingMul) {
    strength *= ECAudio.BeatPresence.couplingMul(a, b);
  }
  return {
    time: time,
    harm: harm,
    zNear: zNear,
    spatial: spatialNear,
    clash: clash,
    cross: a.envId !== b.envId,
    strength: strength
  };
}

function shouldShowBond(a, b, overview, activeEnvId) {
  if (overview) return true;
  if (!activeEnvId) return true;
  return a.envId === activeEnvId || b.envId === activeEnvId;
}

function computeBonds(markers, overview, activeEnvId) {
  var bonds = [];
  var i;
  var j;
  for (i = 0; i < markers.length; i++) {
    for (j = i + 1; j < markers.length; j++) {
      var a = markers[i];
      var b = markers[j];
      if (!shouldShowBond(a, b, overview, activeEnvId)) continue;
      var meta = bondBetween(a, b);
      if (!meta) continue;
      bonds.push({
        a: a,
        b: b,
        time: meta.time,
        harm: meta.harm,
        clash: meta.clash,
        cross: meta.cross,
        strength: meta.strength
      });
    }
  }
  return bonds;
}

function bondsSvg() {
  if (!ECAudio.BeatStudio || !ECAudio.BeatStudio.studioOverlay) return null;
  var overlay = ECAudio.BeatStudio.studioOverlay();
  if (!overlay) return null;
  var svg = overlay.querySelector('.beat-bonds-svg');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'beat-bonds-svg');
    svg.setAttribute('aria-hidden', 'true');
    overlay.insertBefore(svg, overlay.firstChild);
  }
  return svg;
}

function overlaySize() {
  var overlay = ECAudio.BeatStudio && ECAudio.BeatStudio.studioOverlay
    ? ECAudio.BeatStudio.studioOverlay() : null;
  if (!overlay) return { w: 0, h: 0 };
  return { w: overlay.clientWidth, h: overlay.clientHeight };
}

function markerPoint(m) {
  if (!ECAudio.BeatStudio || !ECAudio.BeatStudio.padOverlayPoint) return null;
  return ECAudio.BeatStudio.padOverlayPoint(m.normX, m.normY);
}

function clearBonds() {
  var svg = bondsSvg();
  if (!svg) return;
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

function syncBeatBonds() {
  if (!document.documentElement.classList.contains('beat-studio')) {
    clearBonds();
    return;
  }
  var markers = beatMarkers();
  var svg = bondsSvg();
  if (!svg) return;
  clearBonds();

  if (markers.length < 2) return;

  var size = overlaySize();
  if (size.w < 2 || size.h < 2) return;
  svg.setAttribute('viewBox', '0 0 ' + size.w + ' ' + size.h);
  svg.setAttribute('width', String(size.w));
  svg.setAttribute('height', String(size.h));

  var overview = ECAudio.Environments && ECAudio.Environments.isOverview
    ? ECAudio.Environments.isOverview() : false;
  var active = ECAudio.Environments && ECAudio.Environments.getActive
    ? ECAudio.Environments.getActive() : null;
  var activeId = active ? active.id : null;
  var bonds = computeBonds(markers, overview, activeId);
  var i;

  for (i = 0; i < bonds.length; i++) {
    var bond = bonds[i];
    var pa = markerPoint(bond.a);
    var pb = markerPoint(bond.b);
    if (!pa || !pb) continue;

    var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(pa.left));
    line.setAttribute('y1', String(pa.top));
    line.setAttribute('x2', String(pb.left));
    line.setAttribute('y2', String(pb.top));

    var cls = 'beat-bond';
    if (bond.clash) cls += ' beat-bond-clash';
    else if (bond.time && bond.harm) cls += ' beat-bond-both';
    else if (bond.time) cls += ' beat-bond-time';
    else if (bond.harm) cls += ' beat-bond-harm';
    else cls += ' beat-bond-z';
    if (bond.cross) cls += ' beat-bond-cross';
    line.setAttribute('class', cls);
    if (ECAudio.BeatColors && ECAudio.BeatColors.applyBondLine) {
      ECAudio.BeatColors.applyBondLine(line, bond);
    }
    svg.appendChild(line);
  }
}

function scheduleBondSync() {
  requestAnimationFrame(function() {
    requestAnimationFrame(syncBeatBonds);
  });
}

ECAudio.BeatBonds = {
  sync: syncBeatBonds,
  schedule: scheduleBondSync,
  compute: computeBonds,
  meta: bondBetween
};
