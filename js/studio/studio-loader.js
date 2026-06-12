/* eslint-disable no-var */
// Lazy-load beat studio bundle (Three.js + studio modules) on first Studio open.
window.ECAudio = window.ECAudio || {};

var STUDIO_SCRIPTS = [
  'js/studio/marker-drums.js',
  'js/studio/environments.js',
  'js/studio/beat-kaoss.js',
  'js/studio/beat-presence.js',
  'js/studio/beat-influence.js',
  'js/studio/beat-scale.js',
  'js/studio/beat-spatial.js',
  'js/studio/beat-mix.js',
  'js/studio/beat-bonds.js',
  'js/vendor/three.min.js',
  'js/studio/beat-view3d.js',
  'js/studio/beat-seq.js',
  'js/studio/beat-studio.js',
  'js/studio/beat-guide.js',
  'js/studio/markers.js',
  'js/studio/sound-visual.js',
  'js/studio/sound-lab.js',
  'js/studio/panel-studio.js',
  'js/studio/studio-input.js'
];

function loadScript(src) {
  return new Promise(function(resolve, reject) {
    var el = document.createElement('script');
    el.src = src;
    el.async = false;
    el.onload = function() { resolve(src); };
    el.onerror = function() { reject(new Error('Failed to load ' + src)); };
    document.head.appendChild(el);
  });
}

function loadStudioBundle() {
  if (loadStudioBundle._promise) return loadStudioBundle._promise;
  var end = ECAudio.perf && ECAudio.perf.mark
    ? ECAudio.perf.mark('studio-bundle') : null;
  var chain = Promise.resolve();
  var i;
  for (i = 0; i < STUDIO_SCRIPTS.length; i++) {
    (function(src) {
      chain = chain.then(function() { return loadScript(src); });
    })(STUDIO_SCRIPTS[i]);
  }
  loadStudioBundle._promise = chain.then(function() {
    if (end) end();
    if (ECAudio.debugLog) ECAudio.debugLog('studio bundle ready', STUDIO_SCRIPTS.length, 'scripts');
    return true;
  }).catch(function(err) {
    loadStudioBundle._promise = null;
    if (ECAudio.debugError) ECAudio.debugError('studio bundle failed', err);
    throw err;
  });
  return loadStudioBundle._promise;
}

function studioBundleReady() {
  return !!(ECAudio.BeatStudio && ECAudio.Markers);
}

ECAudio.StudioLoader = {
  load: loadStudioBundle,
  ready: studioBundleReady,
  scripts: STUDIO_SCRIPTS
};
