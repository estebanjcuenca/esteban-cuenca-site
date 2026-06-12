/* eslint-disable no-var */
window.ECAudio = window.ECAudio || {};

function ensureDrumBus() {
  ECAudio.Engine.boot();
  if (ECAudio.State.drumBus) return ECAudio.State.drumBus;
  var ctx = ECAudio.State.ctx;
  ECAudio.State.drumBus = ctx.createGain();
  ECAudio.State.drumBus.gain.value = 1;
  var hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 28;
  hp.Q.value = 0.7;
  var comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 6;
  comp.ratio.value = 2.8;
  comp.attack.value = 0.003;
  comp.release.value = 0.12;
  ECAudio.State.drumBus.connect(hp);
  hp.connect(comp);
  comp.connect(ECAudio.State.browseToneIn);
  return ECAudio.State.drumBus;
}

function drumOut() {
  return ensureDrumBus();
}

function ensureMelodicBus() {
  ECAudio.Engine.boot();
  if (ECAudio.State.melodicBus) return ECAudio.State.melodicBus;
  var ctx = ECAudio.State.ctx;
  ECAudio.State.melodicBus = ctx.createGain();
  ECAudio.State.melodicBus.gain.value = 1;
  var comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 5;
  comp.ratio.value = 2.6;
  comp.attack.value = 0.004;
  comp.release.value = 0.14;
  ECAudio.State.melodicComp = comp;
  ECAudio.State.melodicBus.connect(comp);
  comp.connect(ECAudio.State.browseToneIn);
  return ECAudio.State.melodicBus;
}

function melodicOut() {
  return ensureMelodicBus();
}

function boot() {
  if (ECAudio.State.ctx) return;
  ECAudio.State.ctx = new (window.AudioContext || window.webkitAudioContext)();
  ECAudio.State.masterBus = ECAudio.State.ctx.createGain();
  ECAudio.State.masterBus.gain.value = 0.95;
  ECAudio.State.browseBus = ECAudio.State.ctx.createGain();
  ECAudio.State.browseBus.gain.value = 1;
  ECAudio.State.browseToneIn = ECAudio.State.ctx.createGain();
  ECAudio.State.browseHp = ECAudio.State.ctx.createBiquadFilter();
  ECAudio.State.browseHp.type = 'highpass';
  ECAudio.State.browseHp.frequency.value = 110;
  ECAudio.State.browseHp.Q.value = 0.55;
  ECAudio.State.browseToneIn.connect(ECAudio.State.browseHp);
  ECAudio.State.browseHp.connect(ECAudio.State.browseBus);
  ECAudio.State.browseBus.connect(ECAudio.State.masterBus);
  ECAudio.State.musicBus = ECAudio.State.ctx.createGain();
  ECAudio.State.musicBus.gain.value = 1;
  ECAudio.State.musicBus.connect(ECAudio.State.masterBus);
  ECAudio.State.limiterNode = ECAudio.State.ctx.createDynamicsCompressor();
  ECAudio.State.limiterNode.threshold.value = -10;
  ECAudio.State.limiterNode.knee.value = 8;
  ECAudio.State.limiterNode.ratio.value = 10;
  ECAudio.State.limiterNode.attack.value = 0.002;
  ECAudio.State.limiterNode.release.value = 0.1;
  ECAudio.State.masterBus.connect(ECAudio.State.limiterNode);
  ECAudio.State.limiterNode.connect(ECAudio.State.ctx.destination);
}

function out() {
  ECAudio.Engine.boot();
  return ECAudio.State.masterBus;
}

function browseOut() {
  ECAudio.Engine.boot();
  return ECAudio.State.browseToneIn;
}

function musicOut() {
  ECAudio.Engine.boot();
  return ECAudio.State.musicBus;
}

function ensureReverb() {
  if (ECAudio.State.reverbSend) return;
  var len = Math.floor(ECAudio.State.ctx.sampleRate * 0.32);
  var ir = ECAudio.State.ctx.createBuffer(2, len, ECAudio.State.ctx.sampleRate);
  for (var ch = 0; ch < 2; ch++) {
    var d = ir.getChannelData(ch);
    for (var i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
    }
  }
  var conv = ECAudio.State.ctx.createConvolver();
  conv.buffer = ir;
  ECAudio.State.reverbSend = ECAudio.State.ctx.createGain();
  ECAudio.State.reverbSend.gain.value = 1;
  ECAudio.State.reverbGain = ECAudio.State.ctx.createGain();
  ECAudio.State.reverbGain.gain.value = ECAudio.params.reverbAmt;
  ECAudio.State.reverbSend.connect(conv);
  conv.connect(ECAudio.State.reverbGain);
  ECAudio.State.reverbGain.connect(ECAudio.State.masterBus);
}

function setReverbAmt(val) {
  ECAudio.params.reverbAmt = val;
  if (ECAudio.State.reverbGain) ECAudio.State.reverbGain.gain.value = val;
}

function setBrowseHp(hz) {
  ECAudio.Engine.boot();
  if (ECAudio.State.browseHp) ECAudio.State.browseHp.frequency.value = hz;
}

function browseWetSend(fromNode, amt) {
  if (!amt || amt <= 0.001) return;
  ECAudio.Engine.boot();
  ECAudio.Engine.ensureReverb();
  var send = ECAudio.State.ctx.createGain();
  send.gain.value = amt;
  fromNode.connect(send);
  send.connect(ECAudio.State.reverbSend);
  return send;
}

function wetSend(fromNode, amt) {
  if (!ECAudio.params.reverb) return;
  ECAudio.Engine.boot();
  ECAudio.Engine.ensureReverb();
  var send = ECAudio.State.ctx.createGain();
  send.gain.value = amt != null ? amt : ECAudio.params.reverbAmt;
  fromNode.connect(send);
  send.connect(ECAudio.State.reverbSend);
}

function midiFromFreq(freq) {
  return 69 + 12 * Math.log2(freq / 440);
}

function freqFromMidi(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function setBusLevel(bus, level) {
  ECAudio.Engine.boot();
  if (!bus || !ECAudio.State.ctx) return;
  var t = ECAudio.State.ctx.currentTime;
  bus.gain.cancelScheduledValues(t);
  bus.gain.setValueAtTime(level, t);
}

function resetMusicBus() {
  setBusLevel(ECAudio.State.musicBus, soundEnabled ? 1 : 0);
}

function resetBrowseBus() {
  setBusLevel(ECAudio.State.browseBus, soundEnabled ? 0 : 1);
}

function triggerSidechain(t) {
  if (!soundEnabled || !ECAudio.params.sidechain) return;
  ECAudio.Engine.boot();
  var amt = 0.42;
  var atk = 0.006;
  var hold = 0.055;
  var rel = 0.14;
  var g = ECAudio.State.musicBus.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(amt, t + atk);
  g.linearRampToValueAtTime(1, t + atk + hold + rel);
}

function triggerBrowseSidechain(t, amount, sourceType, coupling) {
  if (!ECAudio.State.browseBus || !ECAudio.State.ctx) return;
  var amt = amount != null ? amount : 0.78;
  var atk = sourceType === 'kick' ? 0.004 : 0.006;
  var hold = sourceType === 'kick' ? 0.048 : 0.036;
  var rel = sourceType === 'kick' ? 0.12 : 0.09;
  var g = ECAudio.State.browseBus.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(amt, t + atk);
  g.linearRampToValueAtTime(1, t + atk + hold + rel);
  if (sourceType === 'kick' && ECAudio.State.melodicComp && coupling > 0.08) {
    var comp = ECAudio.State.melodicComp;
    var dip = -20 - coupling * 16;
    comp.threshold.cancelScheduledValues(t);
    comp.threshold.setValueAtTime(comp.threshold.value, t);
    comp.threshold.linearRampToValueAtTime(dip, t + atk);
    comp.threshold.linearRampToValueAtTime(-20, t + atk + hold + rel);
  }
}

function bootAudio() {
  ECAudio.Engine.boot();
  if (!ECAudio.State.ctx) return Promise.resolve();
  if (ECAudio.State.ctx.state === 'suspended') return ECAudio.State.ctx.resume();
  return Promise.resolve();
}

ECAudio.Engine = {
  boot: boot, out: out, browseOut: browseOut, melodicOut: melodicOut, musicOut: musicOut,
  drumOut: drumOut, ensureDrumBus: ensureDrumBus, ensureMelodicBus: ensureMelodicBus,
  ensureReverb: ensureReverb, setReverbAmt: setReverbAmt, setBrowseHp: setBrowseHp, wetSend: wetSend,
  midiFromFreq: midiFromFreq, freqFromMidi: freqFromMidi,
  resetMusicBus: resetMusicBus,   resetBrowseBus: resetBrowseBus, browseWetSend: browseWetSend,
  triggerSidechain: triggerSidechain,
  triggerBrowseSidechain: triggerBrowseSidechain,
  bootAudio: bootAudio
};
