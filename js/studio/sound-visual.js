/* eslint-disable no-var */
// Sound lab visuals — live scope/spectrum + wave & filter previews tied to panel params.
window.ECAudio = window.ECAudio || {};

var _vizId = null;
var _vizAnalyser = null;
var _vizFft = null;

var WAVE_COLORS = { sine: 1, triangle: 0.55, sawtooth: 0.85, square: 0.7 };
var LAYER_HUE = {
  kick: 14, hat: 192, clap: 38, bass: 268, bright: 88, minimal: 215
};
var CLASH_COLOR = '#c45a2a';

function vizInk() {
  return getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#111';
}

function vizMid() {
  return getComputedStyle(document.documentElement).getPropertyValue('--mid').trim() || '#888';
}

function vizLine() {
  return getComputedStyle(document.documentElement).getPropertyValue('--line').trim() || '#ddd';
}

function activeMarkerForViz() {
  if (typeof slGetMarkerTarget === 'function' && slGetMarkerTarget()) {
    return slGetMarkerTarget();
  }
  if (ECAudio.Markers && ECAudio.Markers.layerSettingsOpen && ECAudio.Markers.getSelected) {
    var layerId = ECAudio.Markers.layerSettingsOpen();
    var sel = layerId ? ECAudio.Markers.getSelected() : null;
    if (sel && sel.id === layerId) return sel;
  }
  return null;
}

function liveSpec() {
  if (ECAudio.BrowseSound && ECAudio.BrowseSound.resolve) {
    var nx = 0.5;
    var ny = 0.5;
    var mp = null;
    var marker = activeMarkerForViz();
    if (marker) {
      nx = marker.toneNorm != null ? marker.toneNorm : (marker.normX != null ? marker.normX : 0.5);
      ny = marker.normY != null ? marker.normY : 0.5;
      if (marker.params) mp = marker.params;
      else if (ECAudio.Markers && ECAudio.Markers.ensureMarkerParams) {
        mp = ECAudio.Markers.ensureMarkerParams(marker);
      }
    } else if (ECAudio.State && ECAudio.State.holdVoice) {
      var h = ECAudio.State.holdVoice;
      if (h.normX != null) nx = h.normX;
      if (h.normY != null) ny = h.normY;
    }
    return ECAudio.BrowseSound.resolve({
      normX: nx, normY: ny,
      count: (ECAudio.State.markers || []).length || 1,
      markerParams: mp
    });
  }
  return null;
}

function waveSample(phase, type) {
  var p = phase % (Math.PI * 2);
  if (type === 'sine') return Math.sin(p);
  if (type === 'triangle') return (2 / Math.PI) * Math.asin(Math.sin(p));
  if (type === 'sawtooth') return 2 * (p / (Math.PI * 2) - Math.floor(p / (Math.PI * 2) + 0.5));
  if (type === 'square') return Math.sin(p) >= 0 ? 1 : -1;
  return Math.sin(p);
}

function layerWaveParams(layer) {
  var m = layer.marker;
  var mp = m && ECAudio.Markers && ECAudio.Markers.ensureMarkerParams
    ? ECAudio.Markers.ensureMarkerParams(m) : null;
  var wave = (mp && mp.wave) || (ECAudio.params && ECAudio.params.wave) || 'sawtooth';
  if (layer.type === 'kick' || layer.type === 'bass') wave = 'sine';
  if (layer.type === 'hat' || layer.type === 'clap') wave = 'square';
  var harm = mp && mp.browseHarmonics != null ? mp.browseHarmonics : 0.45;
  var hLv = ECAudio.BrowseSound && ECAudio.BrowseSound.harmonicLevels
    ? ECAudio.BrowseSound.harmonicLevels(wave, mp) : { h2: 0.1, h3: 0.05, h4: 0.02 };
  var freq = layer.freq || 220;
  var phaseMul = Math.max(0.5, Math.min(6, freq / 110));
  return { wave: wave, harm: harm, hLv: hLv, phaseMul: phaseMul };
}

function sampleLayerAt(t, layer) {
  var p = layerWaveParams(layer);
  var phase = t * Math.PI * 2 * p.phaseMul;
  var y = waveSample(phase, p.wave);
  y += p.hLv.h2 * waveSample(phase * 2, 'sine');
  y += p.hLv.h3 * waveSample(phase * 3, 'sine');
  y += p.hLv.h4 * waveSample(phase * 4, 'sine');
  var amp = 0.38 * (0.65 + p.harm * (WAVE_COLORS[p.wave] || 0.5));
  amp *= layer.alpha != null ? layer.alpha : 1;
  if (layer.vel === 2) amp *= 0.52;
  return y * amp;
}

function drawWaveLayer(ctx, w, h, layer, color, dashed) {
  var n = Math.max(64, Math.floor(w));
  var i;
  ctx.beginPath();
  for (i = 0; i <= n; i++) {
    var t = i / n;
    var y = sampleLayerAt(t, layer);
    var py = h * 0.5 - y * h;
    if (i === 0) ctx.moveTo(0, py);
    else ctx.lineTo(t * w, py);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = layer.alpha >= 0.9 ? 1.6 : 1.1;
  if (dashed) ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawWaveShape(canvas) {
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var dpr = window.devicePixelRatio || 1;
  var w = canvas.clientWidth;
  var h = canvas.clientHeight;
  if (w < 8 || h < 8) return;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  var mk = activeMarkerForViz();
  var ink = vizInk();
  var mid = vizMid();
  var step = ECAudio.Browse && ECAudio.Browse.getLoopBeatStep
    ? ECAudio.Browse.getLoopBeatStep() : 0;
  var layers = mk && ECAudio.BeatMix && ECAudio.BeatMix.compoundLayers
    ? ECAudio.BeatMix.compoundLayers(mk, step) : [];

  ctx.strokeStyle = vizLine();
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.5);
  ctx.lineTo(w, h * 0.5);
  ctx.stroke();

  if (!layers.length && mk) {
    var spec = liveSpec();
    var mp = ECAudio.Markers && ECAudio.Markers.ensureMarkerParams
      ? ECAudio.Markers.ensureMarkerParams(mk) : null;
    layers = [{
      marker: mk,
      type: ECAudio.BeatMix && ECAudio.BeatMix.markerType
        ? ECAudio.BeatMix.markerType(mk) : 'bright',
      freq: spec && spec.filterHz ? spec.filterHz : 220,
      vel: 1,
      alpha: 1,
      clash: false
    }];
  }

  var n = Math.max(64, Math.floor(w));
  var sum = new Array(n + 1);
  var clashMask = new Array(n + 1);
  var i;
  var li;
  for (i = 0; i <= n; i++) sum[i] = 0;

  for (li = 0; li < layers.length; li++) {
    var layer = layers[li];
    var hue = LAYER_HUE[layer.type] != null ? LAYER_HUE[layer.type] : 210;
    var col = layer.clash
      ? CLASH_COLOR
      : 'hsl(' + hue + ' 48% 42% / ' + Math.round((layer.alpha || 1) * 100) + '%)';
    drawWaveLayer(ctx, w, h, layer, col, layer.alpha < 0.85);
    for (i = 0; i <= n; i++) {
      var y = sampleLayerAt(i / n, layer);
      sum[i] += y;
      if (layer.clash) clashMask[i] = 1;
    }
  }

  if (layers.length > 1) {
    ctx.beginPath();
    for (i = 0; i <= n; i++) {
      var py = h * 0.5 - sum[i] * h * 0.55;
      if (i === 0) ctx.moveTo(0, py);
      else ctx.lineTo((i / n) * w, py);
    }
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (clashMask.some(function(v) { return v; })) {
      ctx.fillStyle = 'color-mix(in srgb, ' + CLASH_COLOR + ' 18%, transparent)';
      for (i = 0; i < n; i++) {
        if (!clashMask[i] && !clashMask[i + 1]) continue;
        ctx.fillRect((i / n) * w, 2, w / n + 1, h - 4);
      }
    }
  } else if (layers.length === 1) {
    var p0 = layerWaveParams(layers[0]);
    ctx.fillStyle = mid;
    ctx.font = '8px sans-serif';
    ctx.fillText(p0.wave, 6, 12);
    return;
  }

  ctx.fillStyle = mid;
  ctx.font = '8px sans-serif';
  var label = layers.length + ' layers · step ' + (step + 1);
  if (clashMask.some(function(v) { return v; })) label += ' · clash';
  ctx.fillText(label, 6, 12);
}

function lpMag(f, fc, q) {
  var w = f / Math.max(20, fc);
  var w2 = w * w;
  var qv = Math.max(0.2, q || 0.7);
  return 1 / Math.sqrt(Math.pow(1 - w2, 2) + Math.pow(w / qv, 2));
}

function drawFilterCurve(canvas) {
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var dpr = window.devicePixelRatio || 1;
  var w = canvas.clientWidth;
  var h = canvas.clientHeight;
  if (w < 8 || h < 8) return;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  var mk = activeMarkerForViz();
  var mp = mk && ECAudio.Markers && ECAudio.Markers.ensureMarkerParams
    ? ECAudio.Markers.ensureMarkerParams(mk) : null;
  var fMin = mp && mp.browseFilterMin != null ? mp.browseFilterMin : (ECAudio.params.browseFilterMin || 320);
  var fMax = mp && mp.browseFilterMax != null ? mp.browseFilterMax : (ECAudio.params.browseFilterMax || 7200);
  var q = mp && mp.browseFilterQ != null ? mp.browseFilterQ : (ECAudio.params.browseFilterQ || 0.72);
  var spec = liveSpec();
  var fCut = spec ? spec.filterHz : (fMin + fMax) * 0.5;
  var logMin = Math.log10(Math.max(40, fMin));
  var logMax = Math.log10(Math.min(20000, fMax * 1.2));
  var ink = vizInk();
  var mid = vizMid();

  ctx.strokeStyle = vizLine();
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, h - 4);
  ctx.lineTo(w, h - 4);
  ctx.stroke();

  var pts = 80;
  var i;
  ctx.beginPath();
  for (i = 0; i <= pts; i++) {
    var t = i / pts;
    var logF = logMin + t * (logMax - logMin);
    var f = Math.pow(10, logF);
    var mag = lpMag(f, fCut, q);
    var db = 20 * Math.log10(Math.max(0.001, mag));
    var norm = Math.max(0, Math.min(1, (db + 24) / 24));
    var py = 4 + (1 - norm) * (h - 12);
    if (i === 0) ctx.moveTo(t * w, py);
    else ctx.lineTo(t * w, py);
  }
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  var cutT = (Math.log10(Math.max(40, fCut)) - logMin) / (logMax - logMin);
  var cx = Math.max(0, Math.min(w, cutT * w));
  ctx.strokeStyle = mid;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, h);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = mid;
  ctx.font = '8px sans-serif';
  var label = fCut >= 1000 ? (fCut / 1000).toFixed(1) + 'k' : Math.round(fCut) + ' Hz';
  ctx.fillText('cut ' + label, 6, 12);
}

function ensureAnalyser() {
  if (_vizAnalyser || !ECAudio.State.browseBus) return;
  ECAudio.Engine.boot();
  _vizAnalyser = ECAudio.State.ctx.createAnalyser();
  _vizAnalyser.fftSize = 2048;
  _vizAnalyser.smoothingTimeConstant = 0.72;
  _vizFft = new Uint8Array(_vizAnalyser.frequencyBinCount);
  ECAudio.State.browseBus.connect(_vizAnalyser);
}

function drawScope(canvas) {
  if (!canvas || !_vizAnalyser) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var dpr = window.devicePixelRatio || 1;
  var w = canvas.clientWidth;
  var h = canvas.clientHeight;
  if (w < 8) return;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  var duck = ECAudio.BeatMix && ECAudio.BeatMix.duckMeter
    ? ECAudio.BeatMix.duckMeter() : 0;
  if (duck > 0.03) {
    var bandH = h * (0.18 + duck * 0.38);
    ctx.fillStyle = 'color-mix(in srgb, ' + CLASH_COLOR + ' ' + Math.round(12 + duck * 38) + '%, transparent)';
    ctx.fillRect(0, h * 0.5 - bandH * 0.5, w, bandH);
    ctx.strokeStyle = 'color-mix(in srgb, ' + CLASH_COLOR + ' 55%, transparent)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5 - bandH * 0.5);
    ctx.lineTo(w, h * 0.5 - bandH * 0.5);
    ctx.moveTo(0, h * 0.5 + bandH * 0.5);
    ctx.lineTo(w, h * 0.5 + bandH * 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  var buf = new Uint8Array(_vizAnalyser.fftSize);
  _vizAnalyser.getByteTimeDomainData(buf);
  var ink = vizInk();
  var mid = vizMid();
  var ampScale = duck > 0.03 ? Math.max(0.55, 1 - duck * 0.35) : 0.42;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  var slice = w / buf.length;
  var j;
  for (j = 0; j < buf.length; j++) {
    var y = (buf[j] / 128) * h * ampScale + h * 0.5;
    if (j === 0) ctx.moveTo(0, y);
    else ctx.lineTo(slice * j, y);
  }
  ctx.stroke();

  if (duck > 0.03) {
    ctx.fillStyle = mid;
    ctx.font = '8px sans-serif';
    ctx.fillText('duck ' + Math.round(duck * 100) + '%', w - 58, 12);
  }
}

function drawSpectrum(canvas) {
  if (!canvas || !_vizAnalyser || !_vizFft) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var dpr = window.devicePixelRatio || 1;
  var w = canvas.clientWidth;
  var h = canvas.clientHeight;
  if (w < 8) return;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  _vizAnalyser.getByteFrequencyData(_vizFft);
  var sr = ECAudio.State.ctx.sampleRate;
  var nyq = sr / 2;
  var spec = liveSpec();
  var fCut = spec ? spec.filterHz : 2000;
  var ink = vizInk();
  var mid = vizMid();
  var bars = Math.min(64, _vizFft.length);
  var i;
  var bw = w / bars;

  for (i = 0; i < bars; i++) {
    var v = _vizFft[i] / 255;
    var bh = v * (h - 6);
    ctx.fillStyle = colorMix(ink, 0.12 + v * 0.55);
    ctx.fillRect(i * bw + 1, h - bh, Math.max(1, bw - 2), bh);
  }

  var mk = activeMarkerForViz();
  var step = ECAudio.Browse && ECAudio.Browse.getLoopBeatStep
    ? ECAudio.Browse.getLoopBeatStep() : 0;
  if (mk && ECAudio.BeatMix && ECAudio.BeatMix.compoundLayers) {
    var layers = ECAudio.BeatMix.compoundLayers(mk, step);
    layers.forEach(function(layer) {
      if (!layer.band) return;
      var x0 = (layer.band.lo / nyq) * w;
      var x1 = (layer.band.hi / nyq) * w;
      var hue = LAYER_HUE[layer.type] != null ? LAYER_HUE[layer.type] : 210;
      ctx.fillStyle = layer.clash
        ? 'color-mix(in srgb, ' + CLASH_COLOR + ' 22%, transparent)'
        : 'hsl(' + hue + ' 42% 48% / ' + Math.round((layer.alpha || 1) * 28) + '%)';
      ctx.fillRect(x0, 2, Math.max(2, x1 - x0), h - 4);
    });
  }

  var cutX = (fCut / nyq) * w;
  ctx.strokeStyle = mid;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(cutX, 0);
  ctx.lineTo(cutX, h);
  ctx.stroke();
  ctx.setLineDash([]);
}

function colorMix(ink, alpha) {
  return 'color-mix(in srgb, ' + ink + ' ' + Math.round(alpha * 100) + '%, transparent)';
}

function isLabOpen() {
  var lab = document.getElementById('studio-panel');
  return lab && lab.classList.contains('open');
}

function hasLiveAudio() {
  if (soundEnabled) return false;
  if (typeof slIsPadActive === 'function' && slIsPadActive()) return true;
  if (ECAudio.State && ECAudio.State.holdVoice) return true;
  if (ECAudio.State && ECAudio.State.markers && ECAudio.State.markers.some(function(m) {
    return m.voice;
  })) return true;
  return false;
}

function drawPredictedSpectrum(canvas) {
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var dpr = window.devicePixelRatio || 1;
  var w = canvas.clientWidth;
  var h = canvas.clientHeight;
  if (w < 8) return;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  var mk = activeMarkerForViz();
  if (!mk || !ECAudio.BeatMix || !ECAudio.BeatMix.compoundLayers) return;
  var step = ECAudio.Browse && ECAudio.Browse.getLoopBeatStep
    ? ECAudio.Browse.getLoopBeatStep() : 0;
  var layers = ECAudio.BeatMix.compoundLayers(mk, step);
  var nyq = 12000;
  var ink = vizInk();
  var i;
  for (i = 0; i < layers.length; i++) {
    var layer = layers[i];
    if (!layer.band) continue;
    var x0 = (layer.band.lo / nyq) * w;
    var x1 = (layer.band.hi / nyq) * w;
    var hue = LAYER_HUE[layer.type] != null ? LAYER_HUE[layer.type] : 210;
    var bh = (h - 8) * (layer.alpha || 1) * (layer.vel === 2 ? 0.45 : 0.72);
    ctx.fillStyle = layer.clash
      ? 'color-mix(in srgb, ' + CLASH_COLOR + ' 55%, transparent)'
      : 'hsl(' + hue + ' 46% 46% / ' + Math.round((layer.alpha || 1) * 55) + '%)';
    ctx.fillRect(x0, h - bh, Math.max(2, x1 - x0), bh);
  }
  ctx.fillStyle = vizMid();
  ctx.font = '8px sans-serif';
  ctx.fillText('predicted bands · step ' + (step + 1), 6, 12);
}

function vizTick() {
  _vizId = requestAnimationFrame(vizTick);
  var run = isLabOpen();
  if (!run) return;
  ensureAnalyser();
  drawScope(document.getElementById('sl-scope'));
  if (hasLiveAudio()) drawSpectrum(document.getElementById('sl-spectrum'));
  else drawPredictedSpectrum(document.getElementById('sl-spectrum'));
  if (document.documentElement.classList.contains('beat-studio')) {
    drawWaveShape(document.getElementById('sl-wave-shape'));
  }
}

function refreshStatic() {
  drawWaveShape(document.getElementById('sl-wave-shape'));
  drawFilterCurve(document.getElementById('sl-filter-curve'));
}

function initSoundVisual() {
  if (initSoundVisual.done) return;
  initSoundVisual.done = true;
  refreshStatic();
  if (!_vizId) _vizId = requestAnimationFrame(vizTick);
}

ECAudio.SoundVisual = {
  init: initSoundVisual,
  refreshStatic: refreshStatic,
  liveSpec: liveSpec,
  ensureAnalyser: ensureAnalyser
};
