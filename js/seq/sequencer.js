// Lookahead scheduler with per-track polymeter, probability, accents, slides,
// scene switching on the bar and performance "roll" (beat repeat) / gate.
import { degreeToSemi } from './theory.js';

export const STEPS = 16;
export const SCENES = 4;

export function newStep() {
  return { on: false, vel: 0.8, prob: 1, note: 0, slide: false };
}

export function emptyTrack() {
  return { length: STEPS, steps: Array.from({ length: STEPS }, newStep) };
}

export function emptyPattern(trackIds) {
  const p = {};
  for (const id of trackIds) p[id] = emptyTrack();
  return p;
}

export class Sequencer {
  constructor(engine, voices, state) {
    this.engine = engine;
    this.ctx = engine.ctx;
    this.voices = voices;
    this.state = state;
    this.playing = false;
    this.tick = 0;
    this.nextTime = 0;
    this.lookahead = 0.12;
    this.visualQueue = [];
    this.roll = null;        // { start, len }
    this.gate = 0;           // 0 = off, else gate division in steps
    this.kill = { low: false, kick: false };
    this.recSkip = new Set();
    this.listeners = {};
  }

  on(evt, fn) {
    (this.listeners[evt] = this.listeners[evt] || []).push(fn);
  }
  emit(evt, data) {
    for (const fn of this.listeners[evt] || []) fn(data);
  }

  get stepDur() {
    return 60 / this.state.bpm / 4;
  }

  get pattern() {
    return this.state.scenes[this.state.scene];
  }

  start() {
    if (this.playing) return;
    this.playing = true;
    this.tick = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
    this.emit('play', true);
  }

  stop() {
    this.playing = false;
    clearInterval(this.timer);
    this.visualQueue.length = 0;
    const g = this.engine.gate.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setValueAtTime(1, this.ctx.currentTime);
    this.emit('play', false);
  }

  schedule() {
    const horizon = this.ctx.currentTime + this.lookahead;
    // if the tab was throttled we may be far behind: skip instead of bursting
    if (this.nextTime < this.ctx.currentTime - 0.2) this.nextTime = this.ctx.currentTime + 0.02;
    while (this.nextTime < horizon) {
      this.playTick(this.tick, this.nextTime);
      this.nextTime += this.stepDur;
      this.tick++;
    }
  }

  isAudible(id) {
    const tr = this.state.tracks[id];
    const anySolo = Object.values(this.state.tracks).some((t) => t.solo);
    if (anySolo) return tr.solo;
    if (tr.mute) return false;
    if (this.kill.kick && id === 'kick') return false;
    if (this.kill.low && (id === 'kick' || id === 'bass')) return false;
    return true;
  }

  stepInfo(id, step) {
    const semi = degreeToSemi(step.note || 0, this.state.scale);
    return { semi, midi: this.state.root + semi, slide: !!step.slide };
  }

  effectiveProb(id, prob) {
    if (prob >= 1) return 1;
    const d = this.state.density; // 0..1, 0.5 neutral
    return Math.max(0, Math.min(1, prob + (d - 0.5) * 1.2));
  }

  playTick(tick, time) {
    const st = this.state;
    if (tick % STEPS === 0 && st.queuedScene != null) {
      st.scene = st.queuedScene;
      st.queuedScene = null;
      this.emit('scene', st.scene);
    }
    const sd = this.stepDur;
    const t = time + (tick % 2 ? st.swing * sd * 0.36 : 0);
    let eff = tick;
    if (this.roll) eff = this.roll.start + ((tick - this.roll.start) % this.roll.len);

    const pat = this.pattern;
    const positions = {};
    for (const v of this.voices) {
      const id = v.def.id;
      const trk = pat[id];
      const idx = ((eff % trk.length) + trk.length) % trk.length;
      positions[id] = idx;
      const step = trk.steps[idx];
      if (!step.on || !this.isAudible(id)) continue;
      const key = id + ':' + tick;
      if (this.recSkip.has(key)) {
        this.recSkip.delete(key);
        continue;
      }
      if (Math.random() > this.effectiveProb(id, step.prob)) continue;
      v.trigger(t, step.vel, st.tracks[id].params, this.stepInfo(id, step), sd);
      this.emit('hit', { id, time: t, vel: step.vel });
    }

    if (this.gate) {
      const g = this.engine.gate.gain;
      const on = Math.floor(tick / this.gate) % 2 === 0 || this.gate === 1;
      g.setTargetAtTime(1, t, 0.002);
      if (this.gate === 1) g.setTargetAtTime(0, t + sd * 0.45, 0.003);
      else if (!on) g.setTargetAtTime(0, t, 0.003);
    }

    this.visualQueue.push({ time: t, tick, positions });
    this.lastTick = { tick, time };
  }

  // quantise a live hit to the closest 16th: returns { tick, idx } for recording
  quantize(id, now) {
    if (!this.playing || !this.lastTick) return null;
    const sd = this.stepDur;
    // ticks are scheduled ahead; compute the tick closest to `now`
    const diff = (now - this.lastTick.time) / sd;
    const tick = this.lastTick.tick + Math.round(diff);
    let eff = tick;
    if (this.roll) eff = this.roll.start + ((tick - this.roll.start) % this.roll.len);
    const trk = this.pattern[id];
    const idx = ((eff % trk.length) + trk.length) % trk.length;
    if (tick > this.lastTick.tick) this.recSkip.add(id + ':' + tick); // not played yet -> avoid double hit
    return { tick, idx };
  }

  setRoll(len) {
    if (!len) {
      this.roll = null;
      return;
    }
    // start the loop on the next tick that has not been scheduled, aligned to the roll length
    const base = this.tick - (this.tick % len);
    this.roll = { start: base, len };
  }

  setGate(div) {
    this.gate = div;
    if (!div) {
      const g = this.engine.gate.gain;
      g.cancelScheduledValues(this.ctx.currentTime);
      g.setTargetAtTime(1, this.ctx.currentTime, 0.005);
    }
  }
}
