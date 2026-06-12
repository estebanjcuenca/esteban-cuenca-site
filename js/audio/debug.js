/* eslint-disable no-var */
// Opt-in diagnostics — add ?debug=1 to the URL or set localStorage ec-debug=1
window.ECAudio = window.ECAudio || {};

function debugEnabled() {
  if (ECAudio.DEBUG) return true;
  try {
    if (localStorage.getItem('ec-debug') === '1') return true;
    if (typeof location !== 'undefined' && /(?:\?|&)debug=1(?:&|$)/.test(location.search)) return true;
  } catch (e) { /* ignore */ }
  return false;
}

function debugLog() {
  if (!debugEnabled()) return;
  var args = Array.prototype.slice.call(arguments);
  args.unshift('[ec-sound]');
  console.log.apply(console, args);
}

function debugWarn() {
  if (!debugEnabled()) return;
  var args = Array.prototype.slice.call(arguments);
  args.unshift('[ec-sound]');
  console.warn.apply(console, args);
}

function debugError() {
  var args = Array.prototype.slice.call(arguments);
  args.unshift('[ec-sound]');
  console.error.apply(console, args);
}

function checkTableIntegrity() {
  var issues = [];
  document.querySelectorAll('.cv-table').forEach(function(table, ti) {
    var cols = table.querySelectorAll('colgroup col').length;
    var headCols = table.querySelectorAll('thead th').length;
    table.querySelectorAll('tbody tr').forEach(function(row, ri) {
      var cells = row.querySelectorAll(':scope > td, :scope > th').length;
      var bad = Array.from(row.children).filter(function(c) {
        return c.tagName !== 'TD' && c.tagName !== 'TH';
      });
      if (bad.length) {
        issues.push('table #' + ti + ' row ' + ri + ': invalid children ' +
          bad.map(function(n) { return n.tagName + '.' + n.className; }).join(', '));
      }
      if (headCols && cells && cells !== headCols) {
        issues.push('table #' + ti + ' row ' + ri + ': ' + cells + ' cells vs ' + headCols + ' headers');
      }
    });
    if (cols && headCols && cols !== headCols) {
      issues.push('table #' + ti + ': colgroup ' + cols + ' vs header ' + headCols);
    }
  });
  return issues;
}

function visibilityIssues() {
  var issues = [];
  document.querySelectorAll('.cv-section').forEach(function(sec, i) {
    var cs = getComputedStyle(sec);
    var r = sec.getBoundingClientRect();
    if (parseFloat(cs.opacity) < 0.85) {
      issues.push('section #' + i + ' (' + (sec.id || '?') + ') opacity ' + cs.opacity);
    }
    if (cs.display === 'none') issues.push('section #' + i + ' display:none');
    if (r.height < 4 && !sec.classList.contains('sec-hidden')) {
      issues.push('section #' + i + ' collapsed height ' + r.height.toFixed(1));
    }
  });
  document.querySelectorAll('.sound-marker').forEach(function(m, i) {
    var cs = getComputedStyle(m);
    var r = m.getBoundingClientRect();
    if (parseFloat(cs.opacity) < 0.85) issues.push('marker #' + i + ' opacity ' + cs.opacity);
    if (r.width < 4 || r.height < 4) {
      issues.push('marker #' + i + ' size ' + r.width.toFixed(1) + '×' + r.height.toFixed(1));
    }
  });
  if (!(ECAudio.State && ECAudio.State.markers && ECAudio.State.markers.length)) return issues;
  (ECAudio.State.markers || []).forEach(function(m, i) {
    if (!m.el || !m.el.isConnected) issues.push('marker ' + (m.id || i) + ' has no DOM element');
  });
  return issues;
}

function runSoundDiagnostics() {
  if (!debugEnabled()) return [];
  var issues = checkTableIntegrity().concat(visibilityIssues());
  var rowPads = document.querySelectorAll('tr.row-pad').length;
  var rows = document.querySelectorAll('.cv-table tbody tr').length;
  if (!rows) issues.push('no CV table rows rendered');
  else if (!rowPads) issues.push('no row-pad zones (initBrowseZones not run?)');
  else if (rowPads !== rows) issues.push('row-pad count ' + rowPads + ' != row count ' + rows);
  if (!ECAudio.applySoundPreset) issues.push('presets.js not loaded');
  if (!ECAudio.Zones || !ECAudio.Zones.init) issues.push('zones.js not loaded');
  if (!ECAudio.params || !ECAudio.params.wave) issues.push('ECAudio.params incomplete');
  var visibleSections = document.querySelectorAll('.cv-section.visible').length;
  var markerEls = document.querySelectorAll('.sound-marker').length;
  debugLog('diagnostics', {
    browseMode: document.documentElement.classList.contains('browse-mode'),
    beatOverlay: document.documentElement.classList.contains('beat-overlay'),
    soundEnabled: !!window.soundEnabled,
    activePreset: ECAudio._activePreset,
    wave: ECAudio.params && ECAudio.params.wave,
    rowPads: rowPads,
    rows: rows,
    sections: document.querySelectorAll('.cv-section').length,
    visibleSections: visibleSections,
    hiddenSections: document.querySelectorAll('.cv-section.sec-hidden').length,
    overlays: document.querySelectorAll('.table-sound-overlay').length,
    markers: (ECAudio.State && ECAudio.State.markers) ? ECAudio.State.markers.length : 0,
    markerEls: markerEls
  });
  issues.forEach(function(msg) { debugWarn(msg); });
  if (!issues.length) debugLog('table + sound zones OK');
  return issues;
}

function perfMark(label) {
  if (!debugEnabled() || typeof performance === 'undefined') {
    return function() { /* noop */ };
  }
  var t0 = performance.now();
  return function(extra) {
    var ms = performance.now() - t0;
    if (extra != null) debugLog('perf', label, ms.toFixed(2) + 'ms', extra);
    else debugLog('perf', label, ms.toFixed(2) + 'ms');
  };
}

ECAudio.DEBUG = debugEnabled();
ECAudio.debugLog = debugLog;
ECAudio.debugWarn = debugWarn;
ECAudio.debugError = debugError;
ECAudio.perf = { mark: perfMark };
ECAudio.runSoundDiagnostics = runSoundDiagnostics;
ECAudio.checkTableIntegrity = checkTableIntegrity;
