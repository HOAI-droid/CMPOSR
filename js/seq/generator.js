// Style-aware pattern generators. Each call gives a fresh variation.
import { STEPS, emptyTrack } from './sequencer.js';

const R = Math.random;
const pick = (a) => a[Math.floor(R() * a.length)];
const range = (a, b) => a + R() * (b - a);
const chance = (p) => R() < p;

export function euclid(k, n, rot = 0) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(((i * k) % n) < k);
  // classic Bresenham-style distribution; rotate
  const r = ((rot % n) + n) % n;
  return out.slice(n - r).concat(out.slice(0, n - r));
}

function track(length = STEPS) {
  const t = emptyTrack();
  t.length = length;
  return t;
}

function set(t, i, vel = 0.8, extra = {}) {
  Object.assign(t.steps[i], { on: true, vel, prob: 1, note: 0, slide: false }, extra);
}

function fourOnFloor(extraProb = 0) {
  const t = track();
  for (let i = 0; i < 16; i += 4) set(t, i, 1);
  if (extraProb && chance(0.5)) set(t, pick([14, 15, 7]), 0.7, { prob: extraProb });
  return t;
}

function hats16(base = 0.75, ghostProb = 0.6) {
  const t = track();
  for (let i = 0; i < 16; i++) {
    const off = i % 4 === 2;
    set(t, i, off ? 0.95 : i % 2 ? 0.55 : 0.7, { prob: off ? 1 : ghostProb + R() * 0.3 });
  }
  if (base < 0.5) for (let i = 0; i < 16; i += 2) t.steps[i].on = false;
  return t;
}

function offbeats(vel = 0.8) {
  const t = track();
  for (let i = 2; i < 16; i += 4) set(t, i, vel);
  return t;
}

function fromEuclid(k, n, opts = {}) {
  const t = track(n);
  euclid(k, n, opts.rot || 0).forEach((on, i) => {
    if (on) set(t, i, opts.vel ?? 0.8, { prob: opts.prob ?? 1, note: opts.notes ? pick(opts.notes) : 0 });
  });
  return t;
}

function backbeat(vel = 0.85) {
  const t = track();
  set(t, 4, vel);
  set(t, 12, vel);
  return t;
}

// ---------------------------------------------------------------------------
const STYLE_GENS = {
  HYPNOTIC() {
    const tr = {};
    tr.kick = fourOnFloor(0.4);
    tr.bass = track();
    const roll = pick(['roll', 'off', 'gallop']);
    for (let i = 0; i < 16; i++) {
      const p = i % 4;
      const on = roll === 'roll' ? p !== 0 : roll === 'off' ? p === 2 : p === 2 || p === 3;
      if (on) set(tr.bass, i, p === 2 ? 0.9 : 0.7, { note: chance(0.85) ? 0 : pick([4, 7, 2]) });
    }
    tr.hat = hats16(0.8, 0.5);
    tr.open = offbeats(0.75);
    tr.clap = chance(0.5) ? backbeat(0.6) : track();
    tr.perc = fromEuclid(pick([3, 4, 5]), pick([5, 7, 10, 12]), { notes: [0, 2, 4, 7], vel: 0.7, rot: 1 });
    tr.metal = track(pick([12, 16]));
    set(tr.metal, pick([3, 6, 11, 14]), 0.7, { prob: 0.6 });
    tr.stab = track(pick([12, 16]));
    set(tr.stab, pick([3, 6, 10]), 0.8, { prob: 0.7 });
    return {
      tracks: tr,
      bpm: Math.round(range(129, 134)),
      swing: range(0, 0.12),
      scale: pick(['MINOR', 'DORIAN']),
      params: {
        kick: { tune: range(44, 50), rumble: range(0.55, 0.75), drive: range(0.25, 0.45), decay: range(0.38, 0.5), punch: range(0.5, 0.7) },
        bass: { mode: 0, cutoff: range(0.25, 0.4), env: range(0.3, 0.6), gate: range(0.35, 0.55), drive: 0.35 },
        stab: { chord: pick([0, 3]), tone: range(0.3, 0.5), dly: 0.65, rev: 0.45 },
        perc: { pitch: range(0.3, 0.6), ratio: pick([2, 3, 4]), fm: range(0.3, 0.6), dly: 0.4 },
      },
      macros: { drive: 0.25, space: 0.55, pump: 0.7 },
    };
  },

  INDUSTRIAL() {
    const tr = {};
    tr.kick = fourOnFloor(0.6);
    tr.bass = track();
    for (let i = 0; i < 16; i++) {
      if (i % 4 === 0) continue;
      if (i % 4 === 2 || chance(0.3)) set(tr.bass, i, chance(0.3) ? 1 : 0.75, { note: chance(0.75) ? 0 : pick([1, 1, -1, 4]) });
    }
    tr.hat = fromEuclid(pick([7, 9, 11]), 16, { vel: 0.75, prob: 0.85 });
    tr.open = offbeats(0.7);
    tr.clap = backbeat(0.9);
    if (chance(0.5)) set(tr.clap, 15, 0.5, { prob: 0.5 });
    tr.perc = fromEuclid(pick([5, 7]), pick([12, 16, 11]), { notes: [0, 1, 5], vel: 0.85, rot: 2 });
    tr.metal = fromEuclid(pick([3, 5]), pick([16, 12, 7]), { vel: 0.85, prob: 0.85, rot: pick([1, 3]) });
    tr.stab = track();
    return {
      tracks: tr,
      bpm: Math.round(range(138, 145)),
      swing: 0,
      scale: 'PHRYG',
      params: {
        kick: { tune: range(46, 52), drive: range(0.7, 0.9), punch: range(0.75, 0.95), rumble: range(0.6, 0.8), decay: range(0.4, 0.55), click: 0.7 },
        bass: { mode: 2, cutoff: range(0.3, 0.45), reso: range(0.3, 0.6), drive: range(0.7, 0.9), gate: range(0.4, 0.7), env: 0.4 },
        clap: { tone: range(0.2, 0.4), decay: range(0.35, 0.6), rev: 0.5 },
        hat: { metal: 0.9, tone: range(0.4, 0.7) },
        perc: { ratio: 5, fm: range(0.6, 0.9), drive: range(0.6, 0.9), pitch: range(0.2, 0.5), decay: range(0.08, 0.2) },
        metal: { crush: range(0.5, 0.85), decay: range(0.4, 0.7), noise: range(0.4, 0.8), pitch: range(0.2, 0.5) },
      },
      macros: { drive: 0.55, space: 0.45, pump: 0.6 },
    };
  },

  ACID() {
    const tr = {};
    tr.kick = fourOnFloor(0.3);
    tr.bass = track();
    const notes = [0, 0, 0, 0, 7, 2, 4, 5, -3, 9];
    for (let i = 0; i < 16; i++) {
      if (chance(0.72)) set(tr.bass, i, chance(0.3) ? 1 : 0.7, { note: pick(notes), slide: chance(0.22) });
    }
    tr.hat = hats16(0.7, 0.55);
    tr.open = offbeats(0.7);
    tr.clap = backbeat(0.75);
    tr.perc = fromEuclid(3, 8, { notes: [0, 4], vel: 0.6, prob: 0.8 });
    tr.metal = track();
    tr.stab = track();
    return {
      tracks: tr,
      bpm: Math.round(range(132, 138)),
      swing: range(0, 0.15),
      scale: pick(['MINOR', 'PHRYG', 'DORIAN']),
      params: {
        kick: { drive: range(0.35, 0.5), rumble: range(0.2, 0.4), decay: range(0.35, 0.45) },
        bass: { mode: 1, cutoff: range(0.22, 0.38), reso: range(0.7, 0.88), env: range(0.5, 0.75), decay: range(0.15, 0.35), drive: range(0.45, 0.65), gate: 0.6, dly: 0.15 },
      },
      macros: { drive: 0.35, space: 0.4, pump: 0.5 },
    };
  },

  HARD() {
    const tr = {};
    tr.kick = fourOnFloor(0);
    tr.bass = track();
    for (let i = 2; i < 16; i += 4) set(tr.bass, i, 0.9, { note: 0 });
    if (chance(0.6)) for (let i = 3; i < 16; i += 4) set(tr.bass, i, 0.65, { note: chance(0.5) ? 0 : 7 });
    tr.hat = hats16(0.9, 0.75);
    tr.open = offbeats(0.85);
    tr.clap = backbeat(0.85);
    tr.perc = fromEuclid(pick([5, 6]), 16, { notes: [0, 3], vel: 0.7, rot: 3 });
    tr.metal = fromEuclid(2, pick([16, 12]), { vel: 0.8, rot: 6 });
    tr.stab = track();
    return {
      tracks: tr,
      bpm: Math.round(range(148, 156)),
      swing: 0,
      scale: 'MINOR',
      params: {
        kick: { tune: range(50, 56), drive: range(0.8, 1), punch: range(0.85, 1), decay: range(0.3, 0.4), rumble: range(0.35, 0.55), click: 0.8 },
        bass: { mode: 0, gate: range(0.2, 0.32), cutoff: range(0.4, 0.55), env: range(0.6, 0.8), drive: range(0.7, 0.9) },
        hat: { decay: range(0.035, 0.06) },
        metal: { crush: range(0.3, 0.6) },
      },
      macros: { drive: 0.6, space: 0.35, pump: 0.8 },
    };
  },

  DUB() {
    const tr = {};
    tr.kick = fourOnFloor(0);
    tr.bass = offbeats(0.75);
    if (chance(0.5)) set(tr.bass, 7, 0.6, { note: pick([0, 4]) });
    tr.hat = hats16(0.4, 0.4);
    tr.open = offbeats(0.55);
    tr.clap = chance(0.4) ? backbeat(0.55) : track();
    tr.perc = fromEuclid(3, pick([7, 9]), { notes: [0, 4, 7], vel: 0.55, prob: 0.85 });
    tr.metal = track();
    tr.stab = track();
    const pos = pick([[3, 10], [2, 7, 10], [3, 6, 13], [6, 14]]);
    for (const p of pos) set(tr.stab, p, chance(0.4) ? 0.95 : 0.75, { note: chance(0.8) ? 0 : pick([-2, 3]) });
    return {
      tracks: tr,
      bpm: Math.round(range(120, 126)),
      swing: range(0.12, 0.3),
      scale: pick(['MINOR', 'DORIAN']),
      params: {
        kick: { drive: range(0.1, 0.25), rumble: range(0.25, 0.4), decay: range(0.45, 0.6), punch: 0.45 },
        bass: { mode: 0, cutoff: 0.25, gate: 0.6, drive: 0.25 },
        stab: { chord: pick([0, 3, 2]), tone: range(0.25, 0.45), decay: range(0.2, 0.4), detune: range(0.3, 0.6), dly: range(0.6, 0.8), rev: range(0.4, 0.6), vol: 0.5 },
        hat: { metal: 0.35, decay: 0.04 },
      },
      macros: { drive: 0.15, space: 0.75, pump: 0.6 },
    };
  },
};

export const STYLES = Object.keys(STYLE_GENS);

export function generate(style) {
  return STYLE_GENS[style]();
}

// small musical mutations — keeps the groove, changes details
export function mutate(pattern, amount = 0.12) {
  for (const [id, trk] of Object.entries(pattern)) {
    if (id === 'kick') continue;
    for (let i = 0; i < trk.length; i++) {
      const s = trk.steps[i];
      if (!chance(amount)) continue;
      const r = R();
      if (r < 0.35) {
        s.on = !s.on;
        if (s.on) s.vel = pick([0.6, 0.75, 0.9]);
      } else if (r < 0.6 && s.on) {
        s.note = pick([0, 0, 2, 4, 7, -3, 1]);
      } else if (r < 0.8 && s.on) {
        s.prob = pick([1, 0.75, 0.5]);
      } else if (s.on) {
        s.vel = pick([0.6, 0.8, 1]);
        if (id === 'bass') s.slide = chance(0.3);
      }
    }
  }
  return pattern;
}
