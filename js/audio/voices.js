/* eslint-disable no-var */
window.ECAudio = window.ECAudio || {};

function velMult(velocity) {
  return velocity === 2 ? 0.45 : 1;
}


function playKickBody(peakGain, minimal, velocity) {
  ECAudio.Engine.boot();
  var t = ECAudio.State.ctx.currentTime;
  var min = !!minimal;
  var peak = peakGain * (min ? 0.88 : 1) * ECAudio.Voices.velMult(velocity);
  var tail = min ? 0.09 : 0.15;
  var bus = ECAudio.Engine.out();

  var clickLen = Math.max(2, Math.floor(ECAudio.State.ctx.sampleRate * 0.0025));
  var clickBuf = ECAudio.State.ctx.createBuffer(1, clickLen, ECAudio.State.ctx.sampleRate);
  var cd = clickBuf.getChannelData(0);
  for (var ci = 0; ci < clickLen; ci++) cd[ci] = Math.random() * 2 - 1;
  var click = ECAudio.State.ctx.createBufferSource();
  click.buffer = clickBuf;
  var clickHp = ECAudio.State.ctx.createBiquadFilter();
  clickHp.type = 'highpass';
  clickHp.frequency.value = 1800;
  var clickG = ECAudio.State.ctx.createGain();
  clickG.gain.setValueAtTime(peak * 0.42, t);
  clickG.gain.exponentialRampToValueAtTime(0.001, t + 0.003);
  click.connect(clickHp);
  clickHp.connect(clickG);
  clickG.connect(bus);
  click.start(t);
  click.stop(t + 0.004);

  var osc = ECAudio.State.ctx.createOscillator();
  var gain = ECAudio.State.ctx.createGain();
  var f0 = min ? 68 : 56;
  var fMid = min ? 54 : 44;
  var fEnd = min ? 46 : 36;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(fMid, t + 0.028);
  osc.frequency.exponentialRampToValueAtTime(fEnd, t + tail);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + 0.001);
  gain.gain.setValueAtTime(peak * 0.9, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, t + tail);
  osc.connect(gain);
  gain.connect(bus);
  osc.start(t);
  osc.stop(t + tail + 0.02);
  ECAudio.Engine.triggerSidechain(t);
}

function playSeqKick(velocity) {
  if (!soundEnabled) return;
  playKickBody(ECAudio.params.kickGain, false, velocity);
}

function playKick(force, velocity) {
  if (!soundEnabled) return;
  playSeqKick(velocity);
}


function ensureClapBursts() {
  if (ECAudio.State.clapBursts) return;
  ECAudio.State.clapBursts = [
    { dur: 0.028, decay: 0.26 },
    { dur: 0.022, decay: 0.32 },
    { dur: 0.048, decay: 0.2 }
  ].map(function(spec) {
    var len = Math.floor(ECAudio.State.ctx.sampleRate * spec.dur);
    var buf = ECAudio.State.ctx.createBuffer(1, len, ECAudio.State.ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * spec.decay));
    }
    return buf;
  });
}


function playClap(velocity) {
  if (!soundEnabled) return;
  ECAudio.Engine.boot();
  ECAudio.Voices.ensureClapBursts();
  var t = ECAudio.State.ctx.currentTime;
  var bus = ECAudio.Engine.out();
  var peak = ECAudio.params.clapGain * ECAudio.Voices.velMult(velocity);
  var offsets = [0, 0.009, 0.022];
  var levels = [1, 0.68, 0.48];

  offsets.forEach(function(off, i) {
    var src = ECAudio.State.ctx.createBufferSource();
    src.buffer = ECAudio.State.clapBursts[i];
    var hp = ECAudio.State.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 420;
    var bp = ECAudio.State.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1450;
    bp.Q.value = 0.75;
    var gain = ECAudio.State.ctx.createGain();
    var st = t + off;
    gain.gain.setValueAtTime(0, st);
    gain.gain.linearRampToValueAtTime(peak * levels[i], st + 0.0015);
    gain.gain.exponentialRampToValueAtTime(0.001, st + 0.07);
    src.connect(hp);
    hp.connect(bp);
    bp.connect(gain);
    gain.connect(bus);
    ECAudio.Engine.wetSend(gain, ECAudio.params.reverbAmt * 0.85);
    src.start(st);
    src.stop(st + 0.08);
  });
}


function playShortBlip(freq, role, velocity) {
  var t = ECAudio.State.ctx.currentTime;
  var stepLen = ECAudio.Voices.stepDur();
  var isBass = role === 'bass';
  var lenMult = isBass ? 0.78 : (ECAudio.params.noteLength != null ? ECAudio.params.noteLength : 0.72);
  var dur = stepLen * lenMult;
  var peak = (isBass ? ECAudio.params.bassGain : ECAudio.params.noteGain) * ECAudio.Voices.velMult(velocity);
  var osc = ECAudio.State.ctx.createOscillator();
  var gain = ECAudio.State.ctx.createGain();
  var tail = ECAudio.State.ctx.createGain();
  osc.type = ECAudio.params.wave;
  osc.frequency.setValueAtTime(freq, t);
  osc.detune.setValueAtTime(ECAudio.params.detune, t);
  var atk = isBass
    ? Math.min(0.012, dur * 0.22)
    : Math.min(ECAudio.params.attack, dur * 0.35);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + atk);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.92);
  if (isBass) {
    var lp = ECAudio.State.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.65;
    lp.frequency.setValueAtTime(Math.min(520, freq * 2.8), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(72, freq * 0.55), t + dur * 0.85);
    osc.connect(lp);
    lp.connect(gain);
  } else {
    osc.connect(gain);
  }
  gain.connect(tail);
  tail.connect(ECAudio.Engine.musicOut());
  if (!isBass) ECAudio.Engine.wetSend(tail, ECAudio.params.reverbAmt);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}


function navPulseTrack(type, row, ms) {
  NavVibe.pulse(ECAudio.Theory.navFreqForTrack(type, row), ms || ECAudio.Voices.stepDur() * 1000 * 0.9);
}


function triggerTrack(type, row, preview, velocity) {
  if (!soundEnabled) return;
  var vel = velocity || 1;
  if (type === 'kick') {
    ECAudio.Voices.playSeqKick(vel);
    return;
  }
  if (type === 'clap') {
    ECAudio.Voices.playClap(vel);
    return;
  }
  if (type === 'drums') {
    var rack = ECAudio.params.drumRack || 'kickClap';
    if (rack === 'kickClap' || rack === 'kick') {
      ECAudio.Voices.playSeqKick(vel);
    }
    if (rack === 'kickClap' || rack === 'clap') ECAudio.Voices.playClap(vel);
    return;
  }
  if (type === 'bass') {
    ECAudio.Voices.playShortBlip(ECAudio.Theory.bassFreq(row), 'bass', vel);
    return;
  }
  ECAudio.Voices.playShortBlip(ECAudio.Theory.noteFreq(row), 'note', vel);
}


function playTrackStep(type, row, velocity) {
  if (!soundEnabled) return;
  ECAudio.Engine.boot();
  function go() { ECAudio.Voices.triggerTrack(type, row, false, velocity); }
  ECAudio.State.ctx.state === 'suspended' ? ECAudio.State.ctx.resume().then(go) : go();
}


function previewTrack(type, row, velocity, navPulse) {
  if (!soundEnabled) return;
  ECAudio.Engine.bootAudio();
  ECAudio.Engine.boot();
  function go() {
    if (navPulse !== false) ECAudio.Voices.navPulseTrack(type, row);
    ECAudio.Voices.triggerTrack(type, row, true, velocity || 1);
  }
  ECAudio.State.ctx.state === 'suspended' ? ECAudio.State.ctx.resume().then(go) : go();
}


function stepDur() {
  return (60 / ECAudio.params.bpm) / 4;
}


function stepDelayMs(stepIndex) {
  var base = ECAudio.Voices.stepDur() * 1000;
  var s = ECAudio.params.swing != null ? ECAudio.params.swing : 0.5;
  var off = (s - 0.5) * 1.2;
  return stepIndex % 2 === 0 ? base * (1 - off) : base * (1 + off);
}


function humanizeJitter() {
  if (!ECAudio.params.humanize) return 0;
  return (Math.random() * 6 + 2) * (Math.random() < 0.5 ? -1 : 1);
}


function test() {
  NavVibe.pulse(ECAudio.params.filmRoot, (ECAudio.params.attack + ECAudio.params.decay) * 1000);
  ECAudio.Engine.boot();
  function go() {
    var osc  = ECAudio.State.ctx.createOscillator();
    var gain = ECAudio.State.ctx.createGain();
    var t = ECAudio.State.ctx.currentTime;
    osc.type = ECAudio.params.wave;
    osc.frequency.setValueAtTime(ECAudio.params.filmRoot, t);
    osc.detune.setValueAtTime(ECAudio.params.detune, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(ECAudio.params.gain, t + ECAudio.params.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + ECAudio.params.attack + ECAudio.params.decay);
    osc.connect(gain);
    gain.connect(ECAudio.Engine.out());
    osc.start();
    osc.stop(t + ECAudio.params.attack + ECAudio.params.decay + 0.1);
  }
  ECAudio.State.ctx.state === 'suspended' ? ECAudio.State.ctx.resume().then(go) : go();
}

ECAudio.Voices = { velMult: velMult, playKick: playKick, playSeqKick: playSeqKick, ensureClapBursts: ensureClapBursts, playClap: playClap, playShortBlip: playShortBlip, navPulseTrack: navPulseTrack, triggerTrack: triggerTrack, playTrackStep: playTrackStep, previewTrack: previewTrack, stepDur: stepDur, stepDelayMs: stepDelayMs, humanizeJitter: humanizeJitter, test: test };
