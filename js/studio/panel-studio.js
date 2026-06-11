/* eslint-disable no-var */
// Beat studio side drawer (#studio-panel).

function syncStudioModeUI() {
  var panel = getStudioPanel();
  if (!panel) return;
  panel.setAttribute('data-active-mode', 'studio');
  var title = document.getElementById('sl-title');
  if (title) title.textContent = 'Beat Studio';
  panel.classList.toggle('sl-has-layer', !!(panelParamMarker()));
  if (typeof syncSoundLabMode === 'function') syncSoundLabMode();
}

function syncStudioPanelUI() {
  var panel = getStudioPanel();
  if (!panel) return;
  syncStudioModeUI();
  syncPanelParamUI(panel);
  if (ECAudio.Markers && ECAudio.Markers.syncInstructions) ECAudio.Markers.syncInstructions();
  if (ECAudio.Knobs && ECAudio.Knobs.sync) ECAudio.Knobs.sync(panel);
}

function openStudioPanel() {
  var panel = getStudioPanel();
  if (!panel || panel.classList.contains('open')) return;
  setPanelOpen(panel, true, 'studio-panel-open', null);
  if (ECAudio.Knobs && ECAudio.Knobs.init) ECAudio.Knobs.init(panel);
  syncStudioPanelUI();
  if (typeof onStudioPanelOpen === 'function') onStudioPanelOpen();
}

function closeStudioPanel() {
  var panel = getStudioPanel();
  if (!panel) return;
  setPanelOpen(panel, false, 'studio-panel-open', null);
  if (ECAudio.Markers && ECAudio.Markers.clearDotSolo) ECAudio.Markers.clearDotSolo();
  if (typeof onStudioPanelClose === 'function') onStudioPanelClose();
}

function bindStudioPanelActions(panel) {
  var soloHold = panel.querySelector('[data-action="solo-hold"]');
  if (soloHold && !soloHold.dataset.bound) {
    soloHold.dataset.bound = '1';
    var endSolo = function() {
      if (ECAudio.Markers && ECAudio.Markers.clearDotSolo) ECAudio.Markers.clearDotSolo();
    };
    soloHold.addEventListener('pointerdown', function(e) {
      if (soundEnabled) return;
      var sel = panelParamMarker();
      if (!sel || !ECAudio.Markers.setDotSolo) return;
      e.preventDefault();
      soloHold.setPointerCapture(e.pointerId);
      ECAudio.Markers.setDotSolo(sel.id);
    });
    soloHold.addEventListener('pointerup', function(e) {
      if (soloHold.hasPointerCapture(e.pointerId)) soloHold.releasePointerCapture(e.pointerId);
      endSolo();
    });
    soloHold.addEventListener('pointercancel', endSolo);
  }

  panel.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-val]');
    var action = e.target.closest('[data-action]');
    if (action) {
      var act = action.getAttribute('data-action');
      if (act === 'close-studio') {
        if (typeof exitBeatStudio === 'function') exitBeatStudio(true);
        return;
      }
      if (act === 'test' && !soundEnabled) {
        var previewMk = panelParamMarker();
        if (previewMk && ECAudio.Browse && ECAudio.Browse.previewMarkerSound) {
          ECAudio.Browse.previewMarkerSound(previewMk);
        } else {
          Sound.test();
        }
        return;
      }
      if (act === 'clear-markers' && !soundEnabled && ECAudio.Markers) {
        ECAudio.Markers.clearAll();
        return;
      }
      if (act === 'remove-loop' && !soundEnabled && ECAudio.Markers) {
        var sel = ECAudio.Markers.getSelected && ECAudio.Markers.getSelected();
        if (sel) {
          ECAudio.Markers.remove(sel.id);
          if (ECAudio.Markers.closeLayerSettings) ECAudio.Markers.closeLayerSettings();
        }
        return;
      }
      if (act === 'reset-browse' && !soundEnabled && ECAudio.Markers) {
        var m = panelParamMarker();
        if (m && ECAudio.Markers.defaultMarkerParams && ECAudio.Markers.setMarkerParam) {
          var defs = ECAudio.Markers.defaultMarkerParams();
          Object.keys(defs).forEach(function(k) {
            ECAudio.Markers.setMarkerParam(m, k, defs[k]);
          });
        } else if (ECAudio.BrowseSound) {
          ECAudio.BrowseSound.resetPanelDefaults();
        }
        syncSoundPanelUI();
        if (typeof slRefreshLivePad === 'function') slRefreshLivePad();
        return;
      }
      if (act === 'preset' && !soundEnabled) {
        var presetId = action.getAttribute('data-preset');
        var scope = action.getAttribute('data-scope') || action.closest('[data-scope]')
          ? action.closest('[data-scope]').getAttribute('data-scope') : 'dot';
        var mk = panelParamMarker();
        if (scope === 'dot' && mk && ECAudio.Markers.applyPresetToMarker) {
          ECAudio.Markers.applyPresetToMarker(mk, presetId);
        } else if (ECAudio.applySoundPreset) {
          var applied = ECAudio.applySoundPreset(presetId);
          if (applied && ECAudio.syncPresetUI) ECAudio.syncPresetUI(presetId);
          syncSoundPanelUI();
        }
        return;
      }
    }
    if (!btn) return;
    handlePanelSegClick(btn, true);
  });

  panel.addEventListener('input', function(e) {
    var el = e.target;
    if (el.tagName !== 'INPUT') return;
    handlePanelInput(el, true);
  });
}

function initStudioPanel() {
  var panel = getStudioPanel();
  if (panel) bindStudioPanelActions(panel);
}

function syncPanelSections() {
  syncStudioModeUI();
}
