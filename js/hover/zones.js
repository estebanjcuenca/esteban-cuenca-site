/* eslint-disable no-var */
// Sound mode — row classes only; overlays live outside the table (never inside <tr>).
window.ECAudio = window.ECAudio || {};

function removeLegacyPads(secBodyInner) {
  var legacy = secBodyInner.querySelector(':scope > .zone-content');
  if (legacy) {
    while (legacy.firstChild) {
      secBodyInner.insertBefore(legacy.firstChild, legacy);
    }
    legacy.remove();
  }
  var pad = secBodyInner.querySelector(':scope > .zone-pad');
  if (pad) pad.remove();
}

function sanitizeTableRows() {
  document.querySelectorAll('.cv-table tbody tr').forEach(function(row) {
    Array.from(row.children).forEach(function(child) {
      if (child.tagName !== 'TD' && child.tagName !== 'TH') {
        child.remove();
      }
    });
    row.classList.remove('has-track-lane');
    if (row.dataset.trackType) delete row.dataset.trackType;
  });
}

function ensureTableOverlay(wrap) {
  if (!wrap) return null;
  var overlay = wrap.querySelector(':scope > .table-sound-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'table-sound-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    wrap.appendChild(overlay);
  }
  return overlay;
}

function overlayForRow(row) {
  if (!row) return null;
  return ensureTableOverlay(row.closest('.table-wrap'));
}

function rowOverlayPoint(row, normX, normY) {
  var wrap = row.closest('.table-wrap');
  if (!wrap) return null;
  var rowR = row.getBoundingClientRect();
  var wrapR = wrap.getBoundingClientRect();
  var y = normY != null ? normY : 0.5;
  return {
    left: rowR.left - wrapR.left + normX * rowR.width,
    top: rowR.top - wrapR.top + y * rowR.height
  };
}

function rowIndexInSection(row) {
  var sec = row.closest('.cv-section');
  if (!sec) return 0;
  var rows = sec.querySelectorAll('.cv-table tbody tr.row-pad');
  var i;
  for (i = 0; i < rows.length; i++) {
    if (rows[i] === row) return i;
  }
  return 0;
}

function allRowPads() {
  return document.querySelectorAll('#cv-sections .cv-table tbody tr.row-pad');
}

function globalRowIndex(row) {
  var rows = allRowPads();
  var i;
  for (i = 0; i < rows.length; i++) {
    if (rows[i] === row) return i;
  }
  return 0;
}

function laneCount() {
  return allRowPads().length;
}

function annotateRowPad(row) {
  if (!row || !ECAudio.Theory) return;
  var beat = document.documentElement.classList.contains('beat-overlay');
  var rowIndex = beat ? globalRowIndex(row) : rowIndexInSection(row);
  var keys = ECAudio.Theory.browseRowKeyCount ? ECAudio.Theory.browseRowKeyCount() : 5;
  var names = ECAudio.Theory.pentNoteNames ? ECAudio.Theory.pentNoteNames(keys).join(' · ') : '';
  var oct = rowIndex + 1;
  var label;
  var activeLane = beat && ECAudio.MarkerDrums && ECAudio.MarkerDrums.isActiveBeatLane
    ? ECAudio.MarkerDrums.isActiveBeatLane(rowIndex) : false;
  row.classList.toggle('beat-layer-active', !!activeLane);
  row.classList.toggle('beat-layer-extra', beat && !activeLane);
  if (beat) {
    label = ECAudio.MarkerDrums && ECAudio.MarkerDrums.laneLabel
      ? ECAudio.MarkerDrums.laneLabel(rowIndex) : '';
    var desc = ECAudio.MarkerDrums && ECAudio.MarkerDrums.laneDescription
      ? ECAudio.MarkerDrums.laneDescription(rowIndex) : '';
    if (label) {
      row.setAttribute('data-beat-layer', label);
      row.title = label + ' layer — ' + desc + ' · tap step to add · tap dot = cycle sound · dbl-click dot = remove';
    } else {
      row.removeAttribute('data-beat-layer');
      row.title = 'Extra row (hidden in beat mode)';
    }
    var firstTd = row.querySelector('td');
    if (firstTd && label) firstTd.setAttribute('data-layer-label', label);
    else if (firstTd) firstTd.removeAttribute('data-layer-label');
  } else {
    label = 'Octave ' + oct;
    row.title = label + ' — ' + names + ' (up/down) · tone left/right';
    row.removeAttribute('data-beat-layer');
    row.classList.remove('beat-layer-active', 'beat-layer-extra');
    var td = row.querySelector('td');
    if (td) td.removeAttribute('data-layer-label');
  }
  row.setAttribute('data-octave', String(oct));
  row.setAttribute('data-lane', String(rowIndex));
  row.removeAttribute('data-note');
}

function refreshBeatRowLabels() {
  allRowPads().forEach(annotateRowPad);
}

function teardownBrowseZones() {
  document.querySelectorAll('tr.row-pad').forEach(function(row) {
    row.classList.remove('row-pad', 'influence-zone', 'influence-active', 'has-markers');
    row.removeAttribute('title');
    row.removeAttribute('data-note');
  });
  document.querySelectorAll('.table-sound-overlay, .table-marker-layer').forEach(function(layer) {
    layer.remove();
  });
}

function initBrowseZones() {
  if (typeof TrackSeq !== 'undefined' && TrackSeq.unmount) TrackSeq.unmount();
  document.querySelectorAll('.cv-section .sec-body-inner').forEach(removeLegacyPads);
  sanitizeTableRows();
  document.querySelectorAll('.cv-section .cv-table tbody tr').forEach(function(row) {
    row.classList.add('row-pad', 'influence-zone');
    annotateRowPad(row);
  });
  document.querySelectorAll('.cv-section .table-wrap').forEach(ensureTableOverlay);
}

function refreshRowPads() {
  document.querySelectorAll('.cv-section .cv-table tbody tr.row-pad').forEach(annotateRowPad);
}

ECAudio.Zones = {
  init: initBrowseZones,
  teardown: teardownBrowseZones,
  sanitize: sanitizeTableRows,
  ensureTableOverlay: ensureTableOverlay,
  overlayForRow: overlayForRow,
  rowOverlayPoint: rowOverlayPoint,
  refreshLadders: refreshRowPads,
  refreshRowPads: refreshRowPads,
  rowIndexInSection: rowIndexInSection,
  globalRowIndex: globalRowIndex,
  laneCount: laneCount,
  refreshBeatRowLabels: refreshBeatRowLabels
};
