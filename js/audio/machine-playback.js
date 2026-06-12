/* eslint-disable no-var */
// Per-machine Web Audio playback (drums + one-shot bass preview).
window.ECAudio = window.ECAudio || {};

function clamp01(v) {
  return Math.max(0, Math.min(1, v != null ? v : 0));
}

function drumBus() {
  return ECAudio.Engine.drumOut ? ECAudio.Engine.drumOut() : ECAudio.Engine.out();
}

function velScale(stepData, full, ghost) {
  var vel = stepData && stepData.vel;
  if (vel === 2) return ghost != null ? ghost : full * 0.52;
  return full;
}

function paramsFromMarker(marker) {
  var mp = marker && marker.params ? marker.params : {};
  if (marker && marker.envId && ECAudio.Environments && ECAudio.Environments.envParams) {
    mp = ECAudio.Environments.envParams(marker.envId) || mp;
  }
  if (ECAudio.Machines && ECAudio.Machines.normalizeParams && marker) {
    var t = marker.presetId || (marker.envId ? marker.envId.replace(/^env-/, '') : 'kick');
    mp = ECAudio.Machines.normalizeParams(t, mp);
  }
  return mp;
}

function peakFromMarker(marker, stepData) {
  var mp = paramsFromMarker(marker);
  var g = mp.gain != null ? mp.gain : 0.14;
  var mul = ECAudio.BeatPresence && ECAudio.BeatPresence.gainMul
    ? ECAudio.BeatPresence.gainMul(marker) : (marker.levelMul != null ? marker.levelMul : 1);
  return velScale(stepData, g * mul, g * mul * 0.5);
}

function playKick(peak, mp, stepData) {
  ECAudio.Engine.bootAudio();
  ECAudio.Engine.boot();
  var ctx = ECAudio.State.ctx;
  var t = ctx.currentTime;
  var bus = drumBus();
  var tone = clamp01(mp.browseTone != null ? mp.browseTone : 0.1);
  var click = clamp01(mp.browseHarmonics != null ? mp.browseHarmonics : 0.22);
  var drive = clamp01(mp.browseDrive != null ? mp.browseDrive : 0.4);
  var ghost = stepData && stepData.vel === 2;
  var tail = mp.decay != null ? Math.max(0.12, Math.min(0.42, mp.decay)) : 0.26;
  if (ghost) tail *= 0.55;
  var bodyHi = 92 + tone * 28;
  var bodyLo = 52 + tone * 22;
  var bodyEnd = 38 + tone * 14;
  var clickAmt = peak * (0.18 + click * 0.62) * (ghost ? 0.45 : 1);
  var subAmt = peak * (mp.browseSubMix != null ? mp.browseSubMix * 5.2 : 0.32);
  var rev = Math.min(0.08, (mp.browseSpace != null ? mp.browseSpace : 0.02) + 0.02);

  var clickLen = Math.max(2, Math.floor(ctx.sampleRate * 0.003));
  var clickBuf = ctx.createBuffer(1, clickLen, ctx.sampleRate);
  var cd = clickBuf.getChannelData(0);
  var ci;
  for (ci = 0; ci < clickLen; ci++) cd[ci] = Math.random() * 2 - 1;
  var clickSrc = ctx.createBufferSource();
  clickSrc.buffer = clickBuf;
  var clickHp = ctx.createBiquadFilter();
  clickHp.type = 'highpass';
  clickHp.frequency.value = 2200 + click * 5000;
  var clickG = ctx.createGain();
  clickG.gain.setValueAtTime(clickAmt * (1 + drive * 0.35), t);
  clickG.gain.exponentialRampToValueAtTime(0.001, t + 0.0035);
  clickSrc.connect(clickHp);
  clickHp.connect(clickG);
  clickG.connect(bus);
  clickSrc.start(t);
  clickSrc.stop(t + 0.005);

  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  var bodyLp = ctx.createBiquadFilter();
  bodyLp.type = 'lowpass';
  bodyLp.frequency.value = 95 + tone * 140;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(bodyHi, t);
  osc.frequency.exponentialRampToValueAtTime(bodyLo, t + 0.028);
  osc.frequency.exponentialRampToValueAtTime(bodyEnd, t + tail * 0.65);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak * (1 + drive * 0.2), t + 0.0008);
  gain.gain.exponentialRampToValueAtTime(0.001, t + tail);
  osc.connect(bodyLp);
  bodyLp.connect(gain);
  gain.connect(bus);
  ECAudio.Engine.wetSend(gain, rev * 0.35);
  osc.start(t);
  osc.stop(t + tail + 0.02);

  if (subAmt > 0.008 && !ghost) {
    var sub = ctx.createOscillator();
    var subG = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(bodyEnd * 0.5, t);
    subG.gain.setValueAtTime(0, t);
    subG.gain.linearRampToValueAtTime(subAmt, t + 0.003);
    subG.gain.exponentialRampToValueAtTime(0.001, t + tail * 0.9);
    sub.connect(subG);
    subG.connect(bus);
    sub.start(t);
    sub.stop(t + tail);
  }
}

function playHat(peak, mp, stepData) {
  ECAudio.Engine.bootAudio();
  ECAudio.Engine.boot();
  var ctx = ECAudio.State.ctx;
  var t = ctx.currentTime;
  var bus = drumBus();
  var tone = clamp01(mp.browseTone != null ? mp.browseTone : 0.72);
  var crisp = clamp01(mp.browseHarmonics != null ? mp.browseHarmonics : 0.55);
  var open = stepData && stepData.vel === 2;
  var baseTail = mp.decay != null ? Math.max(0.025, Math.min(0.16, mp.decay)) : 0.055;
  var tail = open ? Math.min(0.22, baseTail * 2.8) : baseTail;
  peak *= velScale(stepData, 0.75 + crisp * 0.55, 0.42 + crisp * 0.28);
  var len = Math.floor(ctx.sampleRate * tail);
  var buf = ctx.createBuffer(1, len, ctx.sampleRate);
  var d = buf.getChannelData(0);
  var i;
  for (i = 0; i < len; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * (open ? 0.22 : 0.14)));
  }
  var src = ctx.createBufferSource();
  src.buffer = buf;
  var hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 3800 + tone * 4800;
  var bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  var fMin = mp.browseFilterMin != null ? mp.browseFilterMin : 6800;
  var fMax = mp.browseFilterMax != null ? mp.browseFilterMax : 13000;
  bp.frequency.value = fMin + (fMax - fMin) * tone;
  bp.Q.value = open
    ? (mp.browseFilterQ != null ? mp.browseFilterQ : 0.35) * 0.65
    : (mp.browseFilterQ != null ? mp.browseFilterQ : 0.35);
  var gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + 0.0008);
  gain.gain.exponentialRampToValueAtTime(0.001, t + tail);
  src.connect(hp);
  hp.connect(bp);
  bp.connect(gain);
  gain.connect(bus);
  var rev = Math.min(0.1, (mp.browseSpace != null ? mp.browseSpace : 0.03) + 0.02);
  ECAudio.Engine.wetSend(gain, rev);
  src.start(t);
  src.stop(t + tail + 0.01);
}

function playClap(peak, mp, stepData) {
  ECAudio.Engine.bootAudio();
  ECAudio.Engine.boot();
  if (!ECAudio.State.clapBursts && ECAudio.Voices && ECAudio.Voices.ensureClapBursts) {
    ECAudio.Voices.ensureClapBursts();
  }
  if (!ECAudio.State.clapBursts) return;
  var ctx = ECAudio.State.ctx;
  var t = ctx.currentTime;
  var bus = drumBus();
  var tone = clamp01(mp.browseTone != null ? mp.browseTone : 0.52);
  var layers = clamp01(mp.browseHarmonics != null ? mp.browseHarmonics : 0.62);
  var ghost = stepData && stepData.vel === 2;
  var fMin = mp.browseFilterMin != null ? mp.browseFilterMin : 480;
  var fMax = mp.browseFilterMax != null ? mp.browseFilterMax : 3800;
  var tail = mp.decay != null ? Math.max(0.05, Math.min(0.2, mp.decay)) : 0.095;
  if (ghost) tail *= 0.65;
  var bpFreq = fMin + (fMax - fMin) * tone;
  var space = Math.min(0.12, mp.browseSpace != null ? mp.browseSpace : 0.06);
  var offsets = ghost ? [0, 0.012] : [0, 0.008, 0.019, 0.031];
  var levels = ghost
    ? [1, 0.48 + layers * 0.15]
    : [1, 0.68 + layers * 0.18, 0.45 + layers * 0.14, 0.28 + layers * 0.1];
  peak *= velScale(stepData, 0.78 + layers * 0.38, 0.48);
  offsets.forEach(function(off, idx) {
    if (idx >= ECAudio.State.clapBursts.length) return;
    var src = ctx.createBufferSource();
    src.buffer = ECAudio.State.clapBursts[Math.min(idx, ECAudio.State.clapBursts.length - 1)];
    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = Math.max(160, fMin * 0.5);
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = bpFreq;
    bp.Q.value = mp.browseFilterQ != null ? mp.browseFilterQ : 0.62;
    var gain = ctx.createGain();
    var st = t + off;
    gain.gain.setValueAtTime(0, st);
    gain.gain.linearRampToValueAtTime(peak * levels[idx], st + 0.0012);
    gain.gain.exponentialRampToValueAtTime(0.001, st + tail);
    src.connect(hp);
    hp.connect(bp);
    bp.connect(gain);
    gain.connect(bus);
    ECAudio.Engine.wetSend(gain, space * 0.7);
    src.start(st);
    src.stop(st + 0.08);
  });
}

function playBassOneShot(freq, peak, mp, stepData) {
  ECAudio.Engine.bootAudio();
  ECAudio.Engine.boot();
  var ctx = ECAudio.State.ctx;
  var t = ctx.currentTime;
  var bus = ECAudio.Engine.browseOut ? ECAudio.Engine.browseOut() : ECAudio.Engine.out();
  var tone = clamp01(mp.browseTone != null ? mp.browseTone : 0.08);
  var subMix = mp.browseSubMix != null ? mp.browseSubMix : 0.2;
  var ghost = stepData && stepData.vel === 2;
  var f = Math.max(34, Math.min(200, freq));
  var dur = mp.decay != null ? Math.max(0.35, Math.min(3.2, mp.decay)) : 1.8;
  if (ghost) dur *= 0.62;
  peak = velScale(stepData, peak, peak * 0.55);
  var atk = mp.attack != null ? Math.max(0.003, Math.min(0.04, mp.attack)) : 0.012;
  var wave = mp.wave === 'triangle' ? 'triangle' : 'sine';
  var lpCut = 48 + tone * 260;

  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  var lp = ctx.createBiquadFilter();
  osc.type = wave;
  osc.frequency.setValueAtTime(f, t);
  lp.type = 'lowpass';
  lp.Q.value = 0.85;
  lp.frequency.setValueAtTime(lpCut, t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + atk);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(lp);
  lp.connect(gain);
  gain.connect(bus);
  osc.start(t);
  osc.stop(t + dur + 0.03);

  if (subMix > 0.01) {
    var sub = ctx.createOscillator();
    var subG = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(f * 0.5, t);
    subG.gain.setValueAtTime(0, t);
    subG.gain.linearRampToValueAtTime(peak * subMix * 1.8, t + atk * 1.2);
    subG.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.95);
    sub.connect(subG);
    subG.connect(bus);
    sub.start(t);
    sub.stop(t + dur);
  }
}

ECAudio.MachinePlayback = {
  playKick: playKick,
  playHat: playHat,
  playClap: playClap,
  playBassOneShot: playBassOneShot,
  peakFromMarker: peakFromMarker,
  paramsFromMarker: paramsFromMarker
};
