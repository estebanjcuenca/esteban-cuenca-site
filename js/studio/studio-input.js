/* eslint-disable no-var */
// Beat studio pointer input — dots, lane hover (only active in html.beat-studio).

function initStudioInput() {
  if (initStudioInput.bound) return;
  initStudioInput.bound = true;

  document.addEventListener('pointerdown', function(e) {
    if (soundEnabled || !isBeatStudioActive()) return;
    if (e.target.closest('#beat-view3d, #beat-view3d-canvas')) return;
    if (e.button !== 0 || !ECAudio.Markers || !ECAudio.Markers.onPointerDown) return;
    ECAudio.Markers.onPointerDown(e.clientX, e.clientY, e.pointerId);
  }, { passive: true, capture: true });

  document.addEventListener('pointermove', function(e) {
    if (!isBeatStudioActive()) return;
    if (!soundEnabled && ECAudio.Markers && ECAudio.Markers.onPointerMove) {
      ECAudio.Markers.onPointerMove(e.clientX, e.clientY, e.pointerId);
    }
    if (ECAudio.Browse && ECAudio.Browse.reconcileBeatHover) {
      ECAudio.Browse.reconcileBeatHover(e.clientX, e.clientY);
    }
  }, { passive: true });

  document.addEventListener('pointerup', function(e) {
    if (soundEnabled || !isBeatStudioActive()) return;
    if (e.button !== 0 || !ECAudio.Markers || !ECAudio.Markers.onPointerUp) return;
    ECAudio.Markers.onPointerUp(e.clientX, e.clientY, e.pointerId);
    if (ECAudio.Browse && ECAudio.Browse.reconcileBeatHover) {
      ECAudio.Browse.reconcileBeatHover(e.clientX, e.clientY);
    }
  }, { passive: true });

  window.addEventListener('scroll', function() {
    if (!soundEnabled && isBeatStudioActive() && ECAudio.Markers && ECAudio.Markers.syncPositions) {
      ECAudio.Markers.syncPositions();
    }
  }, { passive: true, capture: true });

  window.addEventListener('resize', function() {
    if (!soundEnabled && isBeatStudioActive() && ECAudio.Markers && ECAudio.Markers.syncPositions) {
      ECAudio.Markers.syncPositions();
    }
  }, { passive: true });

  document.addEventListener('keydown', function(e) {
    if (soundEnabled || !isBeatStudioActive()) return;
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    var sel = ECAudio.Markers && ECAudio.Markers.getSelected
      ? ECAudio.Markers.getSelected() : null;
    if (!sel || !ECAudio.Markers.remove) return;
    e.preventDefault();
    ECAudio.Markers.remove(sel.id);
    if (ECAudio.Markers.closeLayerSettings) ECAudio.Markers.closeLayerSettings();
  });
}
