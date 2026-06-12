/* eslint-disable no-var */
// CV table hover settings drawer (#hover-panel).

function syncHoverModeSections() {
  var panel = getHoverPanel();
  if (!panel) return;
  var isMusic = document.documentElement.classList.contains('sound-on');
  var browse = panel.querySelector('.sl-block-browse');
  var music = document.getElementById('hover-music-seq');
  if (browse) browse.hidden = isMusic;
  if (music) music.hidden = !isMusic;
  var title = panel.querySelector('.sl-title');
  if (title) title.textContent = isMusic ? 'Music sequencer' : 'Table hover';
  var btn = document.getElementById('btn-sound-mode');
  if (btn) {
    btn.textContent = isMusic ? 'Music' : 'Sound';
    btn.classList.toggle('active', isMusic);
  }
  var seqOn = document.getElementById('music-seq-enabled');
  if (seqOn) {
    seqOn.classList.toggle('active', Sound.params.musicSeqEnabled !== false);
    seqOn.setAttribute('aria-pressed', Sound.params.musicSeqEnabled !== false ? 'true' : 'false');
  }
}

function syncHoverPanelUI() {
  syncHoverModeSections();
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
    if (action) {
      var act = action.getAttribute('data-action');
      if (act === 'close-hover') {
        closeHoverPanel();
        return;
      }
      if (act === 'music-seq-toggle') {
        Sound.params.musicSeqEnabled = !Sound.params.musicSeqEnabled;
        syncHoverModeSections();
        if (typeof syncMusicSequencer === 'function') syncMusicSequencer();
        ECAudio.saveSoundPrefs();
        return;
      }
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
  if (panel) {
    bindHoverPanelActions(panel);
    syncHoverModeSections();
  }
}
