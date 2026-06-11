/* eslint-disable no-var */
// CV table hover settings drawer (#hover-panel).

function syncHoverPanelUI() {
  syncPanelParamUI(getHoverPanel());
}

function openHoverPanel() {
  var panel = getHoverPanel();
  if (!panel || panel.classList.contains('open')) return;
  toggleHoverPanel();
}

function closeHoverPanel() {
  var panel = getHoverPanel();
  if (!panel || !panel.classList.contains('open')) return;
  toggleHoverPanel();
}

function toggleHoverPanel() {
  if (typeof isBeatStudioActive === 'function' && isBeatStudioActive()) return;
  var panel = getHoverPanel();
  var btn = document.getElementById('btn-hover-settings');
  if (!panel) return;
  var open = setPanelOpen(panel, !panel.classList.contains('open'), 'hover-panel-open', btn);
  if (open) {
    syncHoverPanelUI();
    if (ECAudio.Knobs && ECAudio.Knobs.init) ECAudio.Knobs.init(panel);
  }
}

function bindHoverPanelActions(panel) {
  panel.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-val]');
    var action = e.target.closest('[data-action]');
    if (action && action.getAttribute('data-action') === 'close-hover') {
      closeHoverPanel();
      return;
    }
    if (!btn) return;
    handlePanelSegClick(btn, false);
  });

  panel.addEventListener('input', function(e) {
    var el = e.target;
    if (el.tagName !== 'INPUT') return;
    handlePanelInput(el, false);
  });
}

function initHoverPanel() {
  var panel = getHoverPanel();
  if (panel) bindHoverPanelActions(panel);
}
