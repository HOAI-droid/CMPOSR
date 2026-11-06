// Audio engine: master bus, send effects, sidechain ducking and shared resources.
// Works with a realtime AudioContext or an OfflineAudioContext (used for tests/renders).

export function makeDriveCurve(amount, size = 2048) {
  // amount 0..1 -> soft tanh saturation that gets harder with amount
  const k = 1 + amount * 18;
  const curve = new Float32Array(size);
  const norm = Math.tanh(k);
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / norm;
  }
  return curve;
}

export function makeCrushCurve(bits, size = 4096) {
  // quantising curve for a lo-fi / industrial grit
  const steps = Math.pow(2, bits);
  const curve = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    curve[i] = Math.round(x * steps) / steps;
  }
  return curve;
}

function makeImpulse(ctx, seconds, decay, darken = 0.6) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      // one-pole lowpass that closes over time -> darker tail
      const coef = 0.85 - darken * 0.8 * t;
      const n = Math.random() * 2 - 1;
      lp = lp + (n - lp) * Math.max(0.03, coef);
      // short pre-delay + early reflections
      const early = i < rate * 0.012 ? 0 : 1;
      d[i] = lp * Math.pow(1 - t, decay) * early;
    }
  }
  return buf;
}

export class Engine {
  constructor(ctx) {
    this.ctx = ctx;
    const c = ctx;
    this.sampleRate = c.sampleRate;

    // shared white noise (2s)
    const nLen = c.sampleRate * 2;
    this.noise = c.createBuffer(1, nLen, c.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nLen; i++) nd[i] = Math.random() * 2 - 1;

    // ---------- master chain ----------
    this.input = c.createGain();              // everything ends here
    this.duckBus = c.createGain();            // bass, stabs, fx returns: ducked by the kick
    this.duckBus.connect(this.input);
    this.dryBus = c.createGain();             // voices that are not ducked (kick, hats, ...)
    this.dryBus.connect(this.input);
    this.duckVoices = c.createGain();         // voices that are ducked
    this.duckVoices.connect(this.duckBus);

    this.drivePre = c.createGain();
    this.driveShaper = c.createWaveShaper();
    this.driveShaper.oversample = '4x';
    this.drivePost = c.createGain();
    this.djLP = c.createBiquadFilter();
    this.djLP.type = 'lowpass';
    this.djLP.frequency.value = 20000;
    this.djLP.Q.value = 0.7;
    this.djHP = c.createBiquadFilter();
    this.djHP.type = 'highpass';
    this.djHP.frequency.value = 18;
    this.djHP.Q.value = 0.7;
    this.gate = c.createGain();               // stutter gate
    this.glue = c.createDynamicsCompressor();
    this.glue.threshold.value = -16;
    this.glue.knee.value = 8;
    this.glue.ratio.value = 3;
    this.glue.attack.value = 0.012;
    this.glue.release.value = 0.14;
    this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = -3;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.06;
    this.master = c.createGain();
    this.master.gain.value = 0.9;
    this.analyser = c.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.75;

    this.input.connect(this.drivePre);
    this.drivePre.connect(this.driveShaper);
    this.driveShaper.connect(this.drivePost);
    this.drivePost.connect(this.djLP);
    this.djLP.connect(this.djHP);
    this.djHP.connect(this.gate);
    this.gate.connect(this.glue);
    this.glue.connect(this.limiter);
    this.limiter.connect(this.master);
    this.master.connect(this.analyser);
    this.master.connect(c.destination);

    // ---------- reverb send ----------
    this.reverbSend = c.createGain();
    const revHP = c.createBiquadFilter();
    revHP.type = 'highpass';
    revHP.frequency.value = 280;
    this.convolver = c.createConvolver();
    this.convolver.buffer = makeImpulse(c, 3.6, 2.4, 0.7);
    const revLP = c.createBiquadFilter();
    revLP.type = 'lowpass';
    revLP.frequency.value = 7000;
    this.reverbReturn = c.createGain();
    this.reverbReturn.gain.value = 0.55;
    this.reverbSend.connect(revHP);
    revHP.connect(this.convolver);
    this.convolver.connect(revLP);
    revLP.connect(this.reverbReturn);
    this.reverbReturn.connect(this.duckBus);
    // wash: taps all voices (not the returns, so there is no feedback loop) into the sends
    this.washSend = c.createGain();
    this.washSend.gain.value = 0;
    this.dryBus.connect(this.washSend);
    this.duckVoices.connect(this.washSend);
    this.washSend.connect(this.reverbSend);

    // ---------- ping-pong delay send ----------
    this.delaySend = c.createGain();
    this.delayL = c.createDelay(2);
    this.delayR = c.createDelay(2);
    const fbHP = c.createBiquadFilter();
    fbHP.type = 'highpass';
    fbHP.frequency.value = 350;
    const fbLP = c.createBiquadFilter();
    fbLP.type = 'lowpass';
    fbLP.frequency.value = 3200;
    this.delayFb = c.createGain();
    this.delayFb.gain.value = 0.48;
    const merger = c.createChannelMerger(2);
    this.delayReturn = c.createGain();
    this.delayReturn.gain.value = 0.5;
    // L -> R -> filters -> fb -> L
    this.delaySend.connect(this.delayL);
    this.delayL.connect(this.delayR);
    this.delayR.connect(fbHP);
    fbHP.connect(fbLP);
    fbLP.connect(this.delayFb);
    this.delayFb.connect(this.delayL);
    this.delayL.connect(merger, 0, 0);
    this.delayR.connect(merger, 0, 1);
    merger.connect(this.delayReturn);
    this.delayReturn.connect(this.reverbSend); // a little delay into reverb = depth
    this.delayReturn.connect(this.duckBus);
    this.washSend.connect(this.delaySend);

    // ---------- kick rumble (classic Berlin "reverb rumble") ----------
    this.rumbleSend = c.createGain();
    this.rumbleSend.gain.value = 0;
    const rumConv = c.createConvolver();
    rumConv.buffer = makeImpulse(c, 1.6, 3, 0.9);
    const rumLP = c.createBiquadFilter();
    rumLP.type = 'lowpass';
    rumLP.frequency.value = 170;
    rumLP.Q.value = 1.4;
    this.rumbleShaper = c.createWaveShaper();
    this.rumbleShaper.curve = makeDriveCurve(0.7);
    this.rumbleShaper.oversample = '2x';
    const rumHP = c.createBiquadFilter();
    rumHP.type = 'highpass';
    rumHP.frequency.value = 32;
    this.rumbleOut = c.createGain();
    this.rumbleOut.gain.value = 0.9;
    this.rumbleSend.connect(rumConv);
    rumConv.connect(rumLP);
    rumLP.connect(this.rumbleShaper);
    this.rumbleShaper.connect(rumHP);
    rumHP.connect(this.rumbleOut);
    this.rumbleOut.connect(this.duckBus);

    // FX-only nodes for perform mode
    this.riserNodes = null;

    this.setDrive(0.25);
    this.setSpace(0.5);
    this.setDelayTime(120);
    this.duckAmount = 0.75;
  }

  // ---------- macros ----------
  setDrive(v) {
    this.drive = v;
    this.driveShaper.curve = makeDriveCurve(v * 0.8);
    const t = this.ctx.currentTime;
    this.drivePre.gain.setTargetAtTime(0.75 + v * 1.6, t, 0.02);
    this.drivePost.gain.setTargetAtTime(1 / (1 + v * 0.9), t, 0.02);
  }

  setSpace(v) {
    this.space = v;
    const t = this.ctx.currentTime;
    this.reverbReturn.gain.setTargetAtTime(0.15 + v * 1.0, t, 0.05);
    this.delayReturn.gain.setTargetAtTime(0.1 + v * 0.8, t, 0.05);
    this.delayFb.gain.setTargetAtTime(0.3 + v * 0.32, t, 0.05);
  }

  setDelayTime(bpm) {
    const beat = 60 / bpm;
    const t = this.ctx.currentTime;
    this.delayL.delayTime.setTargetAtTime(beat * 0.75, t, 0.05); // dotted 1/8
    this.delayR.delayTime.setTargetAtTime(beat * 0.75, t, 0.05);
  }

  // DJ style filter: x in -1..1. Negative = lowpass, positive = highpass.
  setDJFilter(x, reso = 0.7) {
    const t = this.ctx.currentTime;
    const q = 0.7 + reso * 9;
    if (x < -0.02) {
      const f = 20000 * Math.pow(60 / 20000, -x);
      this.djLP.frequency.setTargetAtTime(f, t, 0.015);
      this.djHP.frequency.setTargetAtTime(18, t, 0.015);
      this.djLP.Q.setTargetAtTime(q, t, 0.02);
      this.djHP.Q.setTargetAtTime(0.7, t, 0.02);
    } else if (x > 0.02) {
      const f = 18 * Math.pow(9000 / 18, x);
      this.djHP.frequency.setTargetAtTime(f, t, 0.015);
      this.djLP.frequency.setTargetAtTime(20000, t, 0.015);
      this.djHP.Q.setTargetAtTime(q, t, 0.02);
      this.djLP.Q.setTargetAtTime(0.7, t, 0.02);
    } else {
      this.djLP.frequency.setTargetAtTime(20000, t, 0.015);
      this.djHP.frequency.setTargetAtTime(18, t, 0.015);
      this.djLP.Q.setTargetAtTime(0.7, t, 0.02);
      this.djHP.Q.setTargetAtTime(0.7, t, 0.02);
    }
  }

  // ---------- sidechain ----------
  duck(time, amount = this.duckAmount, release = 0.18) {
    const g = this.duckBus.gain;
    g.cancelScheduledValues(time);
    g.setTargetAtTime(1 - amount, time, 0.004);
    g.setTargetAtTime(1, time + 0.03, release / 3);
  }

  // ---------- helpers for voices ----------
  noiseSource(time, dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const off = Math.random() * 1.5;
    s.start(time, off);
    s.stop(time + dur);
    return s;
  }

  // ---------- perform FX ----------
  startRiser() {
    if (this.riserNodes) return;
    const c = this.ctx;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 6;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(9000, t + 8);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 6);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.input);
    g.connect(this.reverbSend);
    src.start(t);
    // the whole mix opens a highpass while the riser builds
    this.djHP.frequency.cancelScheduledValues(t);
    this.djHP.frequency.setValueAtTime(this.djHP.frequency.value, t);
    this.djHP.frequency.exponentialRampToValueAtTime(900, t + 8);
    this.riserNodes = { src, g, bp };
  }

  stopRiser() {
    if (!this.riserNodes) return;
    const c = this.ctx;
    const t = c.currentTime;
    const { src, g } = this.riserNodes;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.05);
    src.stop(t + 0.1);
    this.djHP.frequency.cancelScheduledValues(t);
    this.djHP.frequency.setValueAtTime(18, t);
    this.riserNodes = null;
    this.impact(t);
  }

  impact(t) {
    // downlifter / impact when a build is released
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 1.2);
    const g = c.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    o.connect(g);
    g.connect(this.input);
    g.connect(this.reverbSend);
    o.start(t);
    o.stop(t + 1.7);
    const n = this.noiseSource(t, 2.5);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(8000, t);
    lp.frequency.exponentialRampToValueAtTime(200, t + 2.4);
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.35, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 2.4);
    n.connect(lp);
    lp.connect(ng);
    ng.connect(this.reverbSend);
    ng.connect(this.input);
  }

  setWash(on) {
    const t = this.ctx.currentTime;
    this.washSend.gain.setTargetAtTime(on ? 0.9 : 0, t, on ? 0.05 : 0.3);
    if (on) {
      this.reverbReturn.gain.setTargetAtTime(2.2, t, 0.08);
      this.delayFb.gain.setTargetAtTime(0.82, t, 0.08);
      this.delayReturn.gain.setTargetAtTime(1.1, t, 0.08);
    } else {
      this.setSpace(this.space);
    }
  }
}
