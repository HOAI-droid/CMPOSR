// All sounds are synthesised in real time — no samples needed.
import { makeDriveCurve, makeCrushCurve } from './engine.js';

const COMMON = [
  { key: 'vol', label: 'LEVEL', min: 0, max: 1, def: 0.8 },
  { key: 'rev', label: 'REVERB', min: 0, max: 1, def: 0 },
  { key: 'dly', label: 'DELAY', min: 0, max: 1, def: 0 },
];

export const VOICE_DEFS = [
  {
    id: 'kick', name: 'KICK', color: '#ff5a1f', ducked: false, melodic: false, pan: 0,
    params: [
      { key: 'tune', label: 'TUNE', min: 36, max: 68, def: 47, unit: 'Hz' },
      { key: 'punch', label: 'PUNCH', min: 0, max: 1, def: 0.6 },
      { key: 'decay', label: 'DECAY', min: 0.12, max: 1.2, def: 0.42 },
      { key: 'drive', label: 'DRIVE', min: 0, max: 1, def: 0.35 },
      { key: 'rumble', label: 'RUMBLE', min: 0, max: 1, def: 0.45 },
      { key: 'click', label: 'CLICK', min: 0, max: 1, def: 0.5 },
    ],
    overrides: { vol: 0.85 },
  },
  {
    id: 'bass', name: 'BASS', color: '#ffb000', ducked: true, melodic: true, pan: 0,
    params: [
      { key: 'mode', label: 'MODE', min: 0, max: 2, def: 0, step: 1, labels: ['SUB', 'ACID', 'REESE'] },
      { key: 'cutoff', label: 'CUTOFF', min: 0, max: 1, def: 0.35 },
      { key: 'reso', label: 'RESO', min: 0, max: 1, def: 0.45 },
      { key: 'env', label: 'ENV', min: 0, max: 1, def: 0.5 },
      { key: 'decay', label: 'DECAY', min: 0.04, max: 1, def: 0.22 },
      { key: 'drive', label: 'DRIVE', min: 0, max: 1, def: 0.4 },
      { key: 'gate', label: 'GATE', min: 0.1, max: 1, def: 0.55 },
    ],
    overrides: { vol: 0.75, dly: 0.05 },
  },
  {
    id: 'clap', name: 'CLAP', color: '#f4f1ea', ducked: false, melodic: false, pan: 0,
    params: [
      { key: 'tone', label: 'TONE', min: 0, max: 1, def: 0.45 },
      { key: 'decay', label: 'DECAY', min: 0.08, max: 1, def: 0.28 },
      { key: 'spread', label: 'SPREAD', min: 0, max: 1, def: 0.5 },
    ],
    overrides: { vol: 0.62, rev: 0.32 },
  },
  {
    id: 'hat', name: 'HAT', color: '#7ee0ff', ducked: false, melodic: false, pan: 0.12,
    params: [
      { key: 'tone', label: 'TONE', min: 0, max: 1, def: 0.55 },
      { key: 'decay', label: 'DECAY', min: 0.015, max: 0.25, def: 0.05 },
      { key: 'metal', label: 'METAL', min: 0, max: 1, def: 0.6 },
    ],
    overrides: { vol: 0.5 },
  },
  {
    id: 'open', name: 'OPEN', color: '#3fb6ff', ducked: false, melodic: false, pan: -0.1,
    params: [
      { key: 'tone', label: 'TONE', min: 0, max: 1, def: 0.5 },
      { key: 'decay', label: 'DECAY', min: 0.08, max: 1.2, def: 0.32 },
      { key: 'metal', label: 'METAL', min: 0, max: 1, def: 0.65 },
    ],
    overrides: { vol: 0.45, rev: 0.1 },
  },
  {
    id: 'perc', name: 'PERC', color: '#b6ff3b', ducked: false, melodic: true, pan: 0.25,
    params: [
      { key: 'pitch', label: 'PITCH', min: 0, max: 1, def: 0.4 },
      { key: 'ratio', label: 'RATIO', min: 0, max: 5, def: 3, step: 1, labels: ['1.0', '1.41', '2.0', '2.76', '3.5', '5.19'] },
      { key: 'fm', label: 'FM', min: 0, max: 1, def: 0.45 },
      { key: 'decay', label: 'DECAY', min: 0.02, max: 0.8, def: 0.12 },
      { key: 'drive', label: 'DRIVE', min: 0, max: 1, def: 0.3 },
    ],
    overrides: { vol: 0.55, dly: 0.2, rev: 0.1 },
  },
  {
    id: 'metal', name: 'METAL', color: '#d14bff', ducked: false, melodic: false, pan: -0.28,
    params: [
      { key: 'pitch', label: 'PITCH', min: 0, max: 1, def: 0.35 },
      { key: 'decay', label: 'RING', min: 0, max: 1, def: 0.45 },
      { key: 'crush', label: 'CRUSH', min: 0, max: 1, def: 0.4 },
      { key: 'noise', label: 'NOISE', min: 0, max: 1, def: 0.5 },
    ],
    overrides: { vol: 0.5, rev: 0.25, dly: 0.1 },
  },
  {
    id: 'stab', name: 'STAB', color: '#ff2d6f', ducked: true, melodic: true, pan: 0,
    params: [
      { key: 'chord', label: 'CHORD', min: 0, max: 4, def: 0, step: 1, labels: ['MIN7', 'MIN', 'SUS4', 'MIN9', 'FIFTH'] },
      { key: 'tone', label: 'TONE', min: 0, max: 1, def: 0.4 },
      { key: 'decay', label: 'DECAY', min: 0.05, max: 1.5, def: 0.25 },
      { key: 'detune', label: 'DETUNE', min: 0, max: 1, def: 0.4 },
    ],
    overrides: { vol: 0.42, rev: 0.4, dly: 0.55 },
  },
];

for (const d of VOICE_DEFS) {
  d.allParams = [...d.params, ...COMMON];
}

export function defaultParams(def) {
  const p = {};
  for (const prm of def.allParams) p[prm.key] = prm.def;
  Object.assign(p, def.overrides || {});
  return p;
}

const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

class Channel {
  constructor(engine, def) {
    const c = engine.ctx;
    this.in = c.createGain();
    this.vol = c.createGain();
    this.pan = c.createStereoPanner();
    this.pan.pan.value = def.pan || 0;
    this.rev = c.createGain();
    this.dly = c.createGain();
    this.meter = 0; // simple trigger level for UI
    this.in.connect(this.vol);
    this.vol.connect(this.pan);
    this.pan.connect(def.ducked ? engine.duckVoices : engine.dryBus);
    this.pan.connect(this.rev);
    this.pan.connect(this.dly);
    this.rev.connect(engine.reverbSend);
    this.dly.connect(engine.delaySend);
  }
  apply(p, t) {
    this.vol.gain.setTargetAtTime(p.vol * p.vol * 1.3, t, 0.01);
    this.rev.gain.setTargetAtTime(p.rev * p.rev, t, 0.01);
    this.dly.gain.setTargetAtTime(p.dly * p.dly, t, 0.01);
  }
}

// small helper: cached waveshaper whose curve only changes when the amount changes
class Shaper {
  constructor(c, fn) {
    this.node = c.createWaveShaper();
    this.node.oversample = '2x';
    this.fn = fn;
    this.last = -1;
  }
  set(v) {
    const r = Math.round(v * 50) / 50;
    if (r !== this.last) {
      this.last = r;
      this.node.curve = this.fn(r);
    }
  }
}

class Voice {
  constructor(engine, def) {
    this.engine = engine;
    this.c = engine.ctx;
    this.def = def;
    this.ch = new Channel(engine, def);
  }
  apply(p) {
    this.ch.apply(p, this.c.currentTime);
  }
}

// ---------------------------------------------------------------- KICK
class Kick extends Voice {
  constructor(engine, def) {
    super(engine, def);
    const c = this.c;
    this.shaper = new Shaper(c, (v) => makeDriveCurve(v));
    this.pre = c.createGain();
    this.post = c.createGain();
    this.rumbleTap = c.createGain();
    this.pre.connect(this.shaper.node);
    this.shaper.node.connect(this.post);
    this.post.connect(this.ch.in);
    this.post.connect(this.rumbleTap);
    this.rumbleTap.connect(engine.rumbleSend);
    engine.rumbleSend.gain.value = 1;
  }
  apply(p) {
    super.apply(p);
    const t = this.c.currentTime;
    this.shaper.set(p.drive * 0.85);
    this.pre.gain.setTargetAtTime(0.8 + p.drive * 1.8, t, 0.01);
    this.post.gain.setTargetAtTime(1 / (1 + p.drive * 0.6), t, 0.01);
    this.rumbleTap.gain.setTargetAtTime(p.rumble * 1.6, t, 0.01);
  }
  trigger(t, vel, p, step) {
    const c = this.c;
    const f = p.tune * Math.pow(2, (step.semi || 0) / 12);
    const decay = p.decay;
    const o = c.createOscillator();
    o.type = 'sine';
    const top = f * (3 + p.punch * 9);
    o.frequency.setValueAtTime(top, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.012 + (1 - p.punch) * 0.012);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.085);
    o.frequency.linearRampToValueAtTime(f * 0.9, t + decay);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.0015);
    g.gain.setValueAtTime(vel, t + 0.012 + decay * 0.18);
    g.gain.exponentialRampToValueAtTime(0.0006, t + decay);
    o.connect(g);
    g.connect(this.pre);
    o.start(t);
    o.stop(t + decay + 0.05);

    if (p.click > 0.01) {
      const n = this.engine.noiseSource(t, 0.03);
      const hp = c.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = 3500;
      hp.Q.value = 0.8;
      const ng = c.createGain();
      ng.gain.setValueAtTime(vel * p.click * 0.9, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
      n.connect(hp);
      hp.connect(ng);
      ng.connect(this.pre);
    }
    this.engine.duck(t, this.engine.duckAmount * Math.min(1, vel + 0.2));
  }
}

// ---------------------------------------------------------------- BASS
class Bass extends Voice {
  constructor(engine, def) {
    super(engine, def);
    const c = this.c;
    this.shaper = new Shaper(c, (v) => makeDriveCurve(v));
    this.pre = c.createGain();
    this.post = c.createGain();
    this.hp = c.createBiquadFilter();
    this.hp.type = 'highpass';
    this.hp.frequency.value = 28;
    this.pre.connect(this.shaper.node);
    this.shaper.node.connect(this.hp);
    this.hp.connect(this.post);
    this.post.connect(this.ch.in);
    this.live = null; // currently sounding voice for slides
  }
  apply(p) {
    super.apply(p);
    const t = this.c.currentTime;
    this.shaper.set(p.drive * (p.mode === 2 ? 1 : 0.7));
    this.pre.gain.setTargetAtTime(0.7 + p.drive * 1.5, t, 0.01);
    this.post.gain.setTargetAtTime(1 / (1 + p.drive * 0.7), t, 0.01);
  }
  trigger(t, vel, p, step, stepDur) {
    const c = this.c;
    const mode = Math.round(p.mode);
    const octave = mode === 1 ? 36 : 24;
    const freq = midiToHz(octave + step.midi);
    const accent = vel > 0.85;
    const gateLen = step.slide ? stepDur * 1.04 : Math.max(0.03, stepDur * p.gate * (mode === 0 ? 1.4 : 1));

    // legato: previous note asked to slide into this one
    const lv = this.live;
    if (lv && lv.open && lv.mode === mode && t < lv.stopAt - stepDur - 0.05) {
      for (const o of lv.oscs) {
        o.osc.frequency.cancelScheduledValues(t);
        o.osc.frequency.setTargetAtTime(freq * o.ratio, t, 0.035);
      }
      lv.amp.gain.cancelScheduledValues(t + 0.001);
      lv.amp.gain.setValueAtTime(lv.level, t + 0.001);
      lv.amp.gain.setValueAtTime(lv.level, t + gateLen);
      lv.amp.gain.setTargetAtTime(0, t + gateLen, 0.012);
      lv.open = !!step.slide;
      return;
    }

    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    const amp = c.createGain();
    const oscs = [];
    const add = (type, ratio, detuneCents, level) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq * ratio, t);
      o.detune.value = detuneCents;
      const g = c.createGain();
      g.gain.value = level;
      o.connect(g);
      g.connect(filt);
      oscs.push({ osc: o, ratio });
    };

    const cutBase = 60 * Math.pow(2, p.cutoff * 7.2);
    let level = vel * 0.9;
    if (mode === 0) {
      // SUB / rolling: sine body + a little filtered saw for definition
      add('sine', 1, 0, 1.0);
      add('sawtooth', 1, 0, 0.35);
      filt.Q.value = p.reso * 8;
      const peak = Math.min(16000, cutBase * Math.pow(2, p.env * 3));
      filt.frequency.setValueAtTime(peak, t);
      filt.frequency.setTargetAtTime(cutBase, t + 0.002, p.decay / 3);
    } else if (mode === 1) {
      // ACID: 303-ish resonant saw
      add('sawtooth', 1, 0, 0.8);
      filt.Q.value = 2 + p.reso * 24 + (accent ? 3 : 0);
      const peak = Math.min(16000, cutBase * Math.pow(2, p.env * (accent ? 5.2 : 3.8)));
      filt.frequency.setValueAtTime(peak, t);
      filt.frequency.setTargetAtTime(cutBase, t + 0.002, (accent ? 0.6 : 1) * p.decay / 3);
      level = vel * (accent ? 0.85 : 0.6);
    } else {
      // REESE / industrial: detuned saws + sub, very driven
      const dt = 6 + p.reso * 22;
      add('sawtooth', 1, -dt, 0.5);
      add('sawtooth', 1, dt, 0.5);
      add('square', 0.5, 0, 0.35);
      add('sine', 0.5, 0, 0.6);
      filt.Q.value = 1 + p.reso * 4;
      const peak = Math.min(16000, cutBase * Math.pow(2, p.env * 3.5));
      filt.frequency.setValueAtTime(peak, t);
      filt.frequency.setTargetAtTime(cutBase, t + 0.002, p.decay / 3);
      level = vel * 0.6;
    }

    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(level, t + 0.003);
    amp.gain.setValueAtTime(level, t + gateLen);
    amp.gain.setTargetAtTime(0, t + gateLen, mode === 0 ? 0.02 : 0.012);
    filt.connect(amp);
    amp.connect(this.pre);

    const stopAt = t + (step.slide ? 4 : gateLen + 0.2);
    for (const o of oscs) {
      o.osc.start(t);
      o.osc.stop(stopAt);
    }
    this.live = { oscs, amp, level, open: !!step.slide, stopAt, mode };
  }
}

// ---------------------------------------------------------------- CLAP
class Clap extends Voice {
  trigger(t, vel, p) {
    const c = this.c;
    const decay = p.decay;
    const n = this.engine.noiseSource(t, decay + 0.15);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 600;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 800 + p.tone * 1800;
    bp.Q.value = 1.6;
    const g = c.createGain();
    const sp = 0.006 + p.spread * 0.012;
    const v = vel * 1.6;
    g.gain.setValueAtTime(0, t);
    for (let k = 0; k < 3; k++) {
      const tk = t + k * sp;
      g.gain.setValueAtTime(v, tk);
      g.gain.exponentialRampToValueAtTime(v * 0.12, tk + sp * 0.95);
    }
    const tl = t + 3 * sp;
    g.gain.setValueAtTime(v, tl);
    g.gain.exponentialRampToValueAtTime(v * 0.25, tl + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, tl + decay);
    n.connect(hp);
    hp.connect(bp);
    bp.connect(g);
    g.connect(this.ch.in);
  }
}

// ---------------------------------------------------------------- HATS
// 808-style metallic bank (six detuned squares), shared and always running.
function metalBank(engine) {
  if (engine._metal) return engine._metal;
  const c = engine.ctx;
  const out = c.createGain();
  out.gain.value = 0.25;
  const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];
  for (const r of ratios) {
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = 40 * r * 1.9;
    o.connect(out);
    o.start();
  }
  engine._metal = out;
  return out;
}

class Hat extends Voice {
  constructor(engine, def) {
    super(engine, def);
    this.bank = metalBank(engine);
    this.lastGain = null;
    this.chokes = null;
  }
  trigger(t, vel, p) {
    const c = this.c;
    if (this.chokes && this.chokes.lastGain) {
      const lg = this.chokes.lastGain;
      lg.gain.cancelScheduledValues(t);
      lg.gain.setTargetAtTime(0, t, 0.008);
      this.chokes.lastGain = null;
    }
    const decay = p.decay;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5000 + p.tone * 6000;
    hp.Q.value = 0.9;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 9000 + p.tone * 3000;
    bp.Q.value = 0.6;
    const g = c.createGain();
    const mg = c.createGain();
    mg.gain.value = p.metal * 1.8;
    const n = this.engine.noiseSource(t, decay + 0.1);
    const ng = c.createGain();
    ng.gain.value = (1 - p.metal) * 0.9 + 0.15;
    this.bank.connect(mg);
    mg.connect(bp);
    n.connect(ng);
    ng.connect(bp);
    bp.connect(hp);
    hp.connect(g);
    g.connect(this.ch.in);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);
    g.gain.setValueAtTime(0, t + decay + 0.002);
    this.lastGain = g;
    // detach from the always-running bank once the hit has decayed
    const ms = (t - c.currentTime + decay + 0.1) * 1000;
    if (typeof window !== 'undefined' && c instanceof AudioContext) {
      setTimeout(() => { try { this.bank.disconnect(mg); } catch (e) { /* already gone */ } }, Math.max(0, ms));
    }
  }
}

// ---------------------------------------------------------------- PERC (FM)
const RATIOS = [1, 1.41, 2.0, 2.76, 3.5, 5.19];
class Perc extends Voice {
  constructor(engine, def) {
    super(engine, def);
    this.shaper = new Shaper(this.c, (v) => makeDriveCurve(v));
    this.pre = this.c.createGain();
    this.pre.connect(this.shaper.node);
    this.shaper.node.connect(this.ch.in);
  }
  apply(p) {
    super.apply(p);
    this.shaper.set(p.drive);
    this.pre.gain.setTargetAtTime(0.8 + p.drive * 1.5, this.c.currentTime, 0.01);
  }
  trigger(t, vel, p, step) {
    const c = this.c;
    const f = 70 * Math.pow(2, p.pitch * 3.5) * Math.pow(2, (step.semi || 0) / 12);
    const ratio = RATIOS[Math.round(p.ratio)] || 2;
    const decay = p.decay;
    const car = c.createOscillator();
    car.type = 'sine';
    const mod = c.createOscillator();
    mod.type = 'sine';
    mod.frequency.setValueAtTime(f * ratio, t);
    const mg = c.createGain();
    const idx = f * p.fm * 9;
    mg.gain.setValueAtTime(idx, t);
    mg.gain.exponentialRampToValueAtTime(Math.max(1, idx * 0.02), t + decay * 0.7);
    mod.connect(mg);
    mg.connect(car.frequency);
    car.frequency.setValueAtTime(f * 1.7, t);
    car.frequency.exponentialRampToValueAtTime(f, t + 0.018);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.8, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);
    car.connect(g);
    g.connect(this.pre);
    car.start(t);
    mod.start(t);
    car.stop(t + decay + 0.05);
    mod.stop(t + decay + 0.05);
  }
}

// ---------------------------------------------------------------- METAL (modal industrial hit)
const MODES = [1, 1.593, 2.135, 2.295, 2.917, 3.598, 4.153];
class Metal extends Voice {
  constructor(engine, def) {
    super(engine, def);
    const c = this.c;
    this.crush = new Shaper(c, (v) => makeCrushCurve(Math.round(9 - v * 6.5)));
    this.crush.node.oversample = 'none';
    this.drive = new Shaper(c, (v) => makeDriveCurve(v));
    this.pre = c.createGain();
    this.mix = c.createGain();
    this.pre.connect(this.drive.node);
    this.drive.node.connect(this.crush.node);
    this.crush.node.connect(this.mix);
    this.mix.connect(this.ch.in);
  }
  apply(p) {
    super.apply(p);
    this.crush.set(p.crush);
    this.drive.set(0.3 + p.crush * 0.6);
    this.pre.gain.setTargetAtTime(1.2 + p.crush, this.c.currentTime, 0.01);
    this.mix.gain.setTargetAtTime(0.7, this.c.currentTime, 0.01);
  }
  trigger(t, vel, p, step) {
    const c = this.c;
    const f = 140 * Math.pow(2, p.pitch * 3) * Math.pow(2, (step.semi || 0) / 12);
    const q = 25 + p.decay * 240;
    const ring = Math.min(3, (q / (Math.PI * f)) * 5 + 0.1);
    const ex = this.engine.noiseSource(t, ring + 0.2);
    const eg = c.createGain();
    eg.gain.setValueAtTime(vel * 2.5, t);
    eg.gain.exponentialRampToValueAtTime(0.0005, t + 0.006);
    ex.connect(eg);
    const sum = c.createGain();
    sum.gain.value = Math.sqrt(q) * 0.55;
    MODES.forEach((m, i) => {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f * m;
      bp.Q.value = q * (1 - i * 0.06);
      const mg = c.createGain();
      mg.gain.value = 1 / (1 + i * 0.35);
      eg.connect(bp);
      bp.connect(mg);
      mg.connect(sum);
    });
    sum.connect(this.pre);
    // gritty noise layer
    if (p.noise > 0.02) {
      const nhp = c.createBiquadFilter();
      nhp.type = 'highpass';
      nhp.frequency.value = 1800;
      const ng = c.createGain();
      ng.gain.setValueAtTime(vel * p.noise * 0.7, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.04 + p.noise * 0.12);
      ex.connect(nhp);
      nhp.connect(ng);
      ng.connect(this.pre);
    }
  }
}

// ---------------------------------------------------------------- STAB (dub chord)
const CHORDS = [
  [0, 3, 7, 10],
  [0, 3, 7, 12],
  [0, 5, 7, 12],
  [0, 3, 10, 14],
  [0, 7, 12, 19],
];
class Stab extends Voice {
  trigger(t, vel, p, step) {
    const c = this.c;
    const chord = CHORDS[Math.round(p.chord)] || CHORDS[0];
    const decay = p.decay;
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = 3;
    const cut = 180 * Math.pow(2, p.tone * 5);
    filt.frequency.setValueAtTime(Math.min(16000, cut * 4), t);
    filt.frequency.setTargetAtTime(cut, t + 0.002, 0.03 + decay * 0.15);
    const amp = c.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(vel * 0.32, t + 0.004);
    amp.gain.setTargetAtTime(0, t + 0.01, decay / 3);
    filt.connect(amp);
    amp.connect(this.ch.in);
    const end = t + decay * 2 + 0.1;
    const dt = 4 + p.detune * 18;
    for (const iv of chord) {
      const fr = midiToHz(48 + step.midi + iv);
      for (const d of [-dt, dt]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = fr;
        o.detune.value = d;
        o.connect(filt);
        o.start(t);
        o.stop(end);
      }
    }
  }
}

const CLASSES = { kick: Kick, bass: Bass, clap: Clap, hat: Hat, open: Hat, perc: Perc, metal: Metal, stab: Stab };

export function createVoices(engine) {
  const voices = VOICE_DEFS.map((d) => new CLASSES[d.id](engine, d));
  const byId = Object.fromEntries(voices.map((v) => [v.def.id, v]));
  byId.hat.chokes = byId.open; // closed hat chokes the open hat
  return voices;
}
