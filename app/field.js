/* CMPOSR FIELD-1
 * Generative techno instrument: a song engine (arrangement, 4-bar loops, song-to-song transitions,
 * smooth genre changes) plus a theremin-like field to play over it. Everything is synthesised live.
 */
(() => {
'use strict';

// ============================================================ helpers
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R = Math.random;
const pick = (a) => a[Math.floor(R() * a.length)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ACC = '#ff4f00';
const LOOP = 64;                 // 4 bars of 16ths
const LANES = 8;

// ============================================================ music theory (F minor based, songs may move the root)
const SCALE = [0, 2, 3, 5, 7, 8, 10];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const semi = (deg) => SCALE[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7);
const keyName = (root) => NOTE_NAMES[(((5 + root) % 12) + 12) % 12];
const degName = (deg, root) => NOTE_NAMES[(((5 + root + semi(deg)) % 12) + 12) % 12] + (deg >= 7 ? '+' : '');
const DRUM_LABELS = ['MIN', 'HAT', 'OPEN', 'PERC', 'RIDE', 'CLAP', 'METL', 'MAX'];

// ============================================================ worlds
const WORLDS = {
  HYPNO:  { id: 'W01', name: 'HYPNOTIC', dna: 'RUMBLE-KICK · ROLLENDER SUB · DUB-AKKORDE',   bpm: 132, bpmVar: 3, swing: 0.02, hat: 0.55, ride: 0, perc: [3, 5], percPitch: 1.6, clap: 0.4, metal: 0.15, bass: 'roll',  stab: 0.7,  noise: 0.35, sound: { DRUMS: 0, BASS: 0, SYNTH: 1, NOISE: 2 } },
  GROOVE: { id: 'W02', name: 'HARDGROOVE', dna: 'PERKUSSIVE LOOPS · RIDE · SWING · TOMS', bpm: 144, bpmVar: 3, swing: 0.13, hat: 0.8,  ride: 1, perc: [5, 7], percPitch: 1,   clap: 1,   metal: 0.3,  bass: 'off2',  stab: 0.25, noise: 0.25, sound: { DRUMS: 1, BASS: 0, SYNTH: 0, NOISE: 0 } },
  INDUS:  { id: 'W03', name: 'INDUSTRIAL', dna: 'CLIPPENDE KICK · METALL · VERZERRTER BASS', bpm: 150, bpmVar: 4, swing: 0,    hat: 0.75, ride: 0, perc: [3, 4], percPitch: 0.8, clap: 1,   metal: 0.85, bass: 'reese', stab: 0.1,  noise: 0.6,  sound: { DRUMS: 2, BASS: 2, SYNTH: 1, NOISE: 1 } },
  DUB:    { id: 'W04', name: 'DUB', dna: 'DUB-CHORDS · ECHO · TIEFER SUB · SWING',        bpm: 124, bpmVar: 3, swing: 0.2,  hat: 0.35, ride: 0, perc: [3, 3], percPitch: 1.3, clap: 0.3, metal: 0,    bass: 'off',   stab: 1,    noise: 0.35, sound: { DRUMS: 0, BASS: 0, SYNTH: 1, NOISE: 2 } },
  DETROIT: { id: 'W05', name: 'DETROIT', dna: 'GEBROCHENE BEATS · 808 · STRINGS · ELECTRO', bpm: 130, bpmVar: 4, swing: 0.06, hat: 0.75, ride: 0, perc: [4, 6], percPitch: 1.2, clap: 1, metal: 0.1, bass: 'electro', stab: 0.85, noise: 0.2, kick: 'broken', sound: { DRUMS: 1, BASS: 0, SYNTH: 2, NOISE: 1 } },
};
const WORLD_KEYS = Object.keys(WORLDS);

// ============================================================ sound settings
const VOICES = ['DRUMS', 'BASS', 'SYNTH', 'NOISE'];
const MODELS = { DRUMS: ['ROLLING', 'PUNCH', 'DIST'], BASS: ['SUB', 'ACID', 'REESE'], SYNTH: ['PLUCK', 'STAB', 'PAD'], NOISE: ['METAL', 'STATIC', 'WIND'] };
const KNOBS = ['weight', 'grit', 'motion', 'space'];
const KNOB_HELP = {
  DRUMS: ['Kick-Länge + Tiefe', 'Verzerrung', 'Swing + Ghost-Hats', 'Hall + Rumble'],
  BASS: ['Sub-Anteil', 'Sättigung', 'Filter-Hüllkurve', 'Echo + Hall'],
  SYNTH: ['Breite + Oktave', 'Verzerrung', 'Filter + Arp-Tempo', 'Echo + Hall'],
  NOISE: ['Tonhöhe', 'Bitcrush', 'Dichte', 'Hall'],
};
const DEFAULT_SOUND = {
  DRUMS: { model: 0, weight: 0.5, grit: 0.35, motion: 0.35, space: 0.35 },
  BASS: { model: 0, weight: 0.6, grit: 0.4, motion: 0.5, space: 0.15 },
  SYNTH: { model: 1, weight: 0.5, grit: 0.2, motion: 0.5, space: 0.6 },
  NOISE: { model: 0, weight: 0.5, grit: 0.4, motion: 0.5, space: 0.5 },
};
const sound = JSON.parse(JSON.stringify(DEFAULT_SOUND));
const locked = { DRUMS: false, BASS: false, SYNTH: false, NOISE: false };

// ============================================================ pattern generator
function euclid(k, n, rot = 0) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(((i * k) % n) < k);
  const r = ((rot % n) + n) % n;
  return out.slice(n - r).concat(out.slice(0, n - r));
}
const zeros = () => new Array(LOOP).fill(0);
const LAYERS = ['kick', 'hat', 'open', 'perc', 'ride', 'clap', 'metal', 'bass', 'stab', 'noise'];

function genSong(wk, prev) {
  const w = WORLDS[wk];
  const s = { world: wk, num: prev ? prev.num + 1 : 1 };
  s.bpm = Math.round(w.bpm + (R() * 2 - 1) * w.bpmVar);
  if (prev && prev.world === wk && s.bpm === prev.bpm) s.bpm += pick([-2, 2]);
  const moves = [2, -2, 3, -3, 5, -4];
  s.root = 0;
  if (prev) { for (let i = 0; i < 6 && (s.root === 0 || s.root === prev.root); i++) s.root = clamp(prev.root + pick(moves), -4, 5); }
  s.swing = Math.max(0, w.swing + (R() - 0.5) * 0.05);

  const P = {}; for (const l of LAYERS) P[l] = zeros();
  P.percN = zeros(); P.notes = zeros();

  for (let b = 0; b < 4; b++) for (let i = 0; i < 16; i++) {
    const x = b * 16 + i;
    if (i % 4 === 0) P.kick[x] = 1;
    if (i % 4 === 2) P.open[x] = 1;
    P.hat[x] = i % 2 === 1 ? w.hat : i % 4 === 0 ? w.hat * 0.5 : (w.hat > 0.7 ? w.hat * 0.7 : 0);
    if (w.ride && i % 2 === 0) P.ride[x] = i % 4 === 2 ? 1 : 0.8;
  }
  if (w.kick === 'broken') {
    const KP = [[0, 6, 10], [0, 7, 10], [0, 3, 10, 12], [0, 6, 9, 14]];
    const ka = pick(KP), kb = pick(KP);
    for (let b = 0; b < 4; b++) for (let i = 0; i < 16; i++) P.kick[b * 16 + i] = (b === 3 ? kb : ka).includes(i) ? 1 : 0;
  } else {
    if (wk === 'INDUS' || R() < 0.4) P.kick[63] = 0.5;
    if (R() < 0.3) P.kick[46] = 0.4;
  }

  const k = w.perc[0] + Math.floor(R() * (w.perc[1] - w.perc[0] + 1));
  const ea = euclid(k, 16, Math.floor(R() * 4));
  const eb = euclid(Math.min(k + 2, 9), 16, Math.floor(R() * 6));
  const tomSet = pick([[0, 2, 4], [0, 3, 1], [4, 2, 0, 1], [1, 1, 3]]);
  for (let b = 0; b < 4; b++) {
    const e = b === 3 ? eb : ea;
    for (let i = 0; i < 16; i++) if (e[i]) { P.perc[b * 16 + i] = 0.9; P.percN[b * 16 + i] = tomSet[(i + b) % tomSet.length]; }
  }
  if (R() < w.clap) for (let b = 0; b < 4; b++) { P.clap[b * 16 + 4] = 1; P.clap[b * 16 + 12] = 1; }
  else for (let b = 0; b < 4; b++) P.clap[b * 16 + 12] = 0.6;
  if (w.metal > 0) {
    const em = euclid(pick([2, 3, 5]), 16, pick([1, 3, 6]));
    for (let b = 0; b < 4; b++) for (let i = 0; i < 16; i++) if (em[i]) P.metal[b * 16 + i] = w.metal * (b % 2 ? 0.7 : 1);
  }
  // bass rhythm + a 4-bar progression
  const style = w.bass;
  s.electro = pick([[0, 3, 6, 10, 14], [0, 6, 8, 11, 14], [2, 3, 7, 10, 11, 14]]);
  const prog = pick([[0, 0, 0, 0], [0, 0, 0, -2], [0, 0, 3, 0], [0, 0, 0, 4], [0, -2, 0, 3], [0, 0, 5, 4], [0, 0, -3, -2]]);
  for (let b = 0; b < 4; b++) for (let i = 0; i < 16; i++) {
    const x = b * 16 + i, q = i % 4;
    let v = 0;
    if (style === 'roll') v = q !== 0 ? 1 : 0;
    else if (style === 'off') v = q === 2 ? 1 : 0;
    else if (style === 'off2') v = q === 2 || q === 3 ? 1 : 0;
    else if (style === 'reese') v = q === 2 ? 1 : (i % 8 === 7 ? 0.5 : 0);
    else if (style === 'electro') v = s.electro.includes(i) ? 1 : 0;
    P.bass[x] = v;
    P.notes[x] = prog[b] + (q !== 2 && R() < 0.12 ? pick([7, 2, -3, 4]) : 0);
  }
  // synth stabs
  const pos = pick([[3, 10], [6, 14], [3, 6, 13], [7], [10], [2, 7, 10]]);
  for (let b = 0; b < 4; b++) for (const p of pos) P.stab[b * 16 + ((p + (b === 3 ? 1 : 0)) % 16)] = w.stab * (b === 3 ? 0.6 : 1);
  // noise accents
  for (let b = 0; b < 4; b++) {
    if (R() < 0.7) P.noise[b * 16 + pick([7, 11, 15])] = w.noise;
    if (R() < w.noise) P.noise[b * 16 + pick([3, 9, 13])] = w.noise * 0.6;
  }
  s.P = P;
  s.live = JSON.parse(JSON.stringify(P));
  // sound models that suit the world (used where the player has not set a voice by hand)
  s.sound = { ...w.sound };
  if (wk === 'GROOVE' && R() < 0.35) s.sound.BASS = 1;
  if (wk === 'HYPNO' && R() < 0.25) s.sound.SYNTH = 2;
  if (wk === 'INDUS' && R() < 0.3) s.sound.NOISE = 0;
  if (R() < 0.15) s.sound.BASS = 1;
  s.knobs = {
    DRUMS: {
      weight: wk === 'DETROIT' ? 0.8 + R() * 0.2 : 0.4 + R() * 0.3,
      grit: wk === 'INDUS' ? 0.65 + R() * 0.3 : wk === 'DETROIT' ? 0.1 + R() * 0.15 : 0.2 + R() * 0.3,
      motion: wk === 'GROOVE' ? 0.5 + R() * 0.3 : 0.25 + R() * 0.3,
      space: wk === 'HYPNO' ? 0.6 + R() * 0.3 : wk === 'DETROIT' ? 0.1 + R() * 0.15 : 0.25 + R() * 0.3,
    },
    BASS: { weight: 0.5 + R() * 0.3, grit: wk === 'INDUS' ? 0.6 + R() * 0.3 : 0.25 + R() * 0.3, motion: 0.35 + R() * 0.35, space: 0.1 + R() * 0.15 },
    SYNTH: { weight: 0.3 + R() * 0.5, grit: R() * 0.3, motion: 0.3 + R() * 0.4, space: 0.5 + R() * 0.3 },
    NOISE: { weight: 0.3 + R() * 0.4, grit: wk === 'INDUS' ? 0.6 : 0.3 + R() * 0.3, motion: 0.4 + R() * 0.3, space: 0.4 + R() * 0.4 },
  };
  return s;
}

function applySongSound(song, voices = VOICES) {
  for (const v of voices) {
    if (locked[v]) continue;
    sound[v].model = song.sound[v];
    Object.assign(sound[v], song.knobs[v]);
  }
  if (ui.renderSound) ui.renderSound();
}

// small musical mutations once per loop; every 16 bars half of it falls back to the original
function mutate(song, amount) {
  const L = song.live, P = song.P;
  const flips = Math.round(amount * 5);
  for (let i = 0; i < flips; i++) {
    const layer = pick(['hat', 'perc', 'metal', 'bass', 'stab', 'noise', 'open']);
    const x = Math.floor(R() * LOOP);
    if (layer === 'bass' && x % 4 === 0) continue;
    if (layer === 'open' && x % 4 !== 2) continue;
    L[layer][x] = L[layer][x] > 0 ? 0 : pick([1, 0.6, 0.8]);
    if (layer === 'perc') L.percN[x] = Math.floor(R() * 5);
  }
  if (R() < amount * 0.7) {
    const x = Math.floor(R() * LOOP);
    if (x % 4 !== 0) L.notes[x] = L.notes[x - (x % 16)] + pick([0, 7, 2, -3, 4]);
  }
}
function relax(song) {
  for (const l of [...LAYERS, 'notes', 'percN']) for (let x = 0; x < LOOP; x++) if (R() < 0.5) song.live[l][x] = song.P[l][x];
}

// ============================================================ arrangement
function makePlan() {
  const T = pick([1, 2, 2, 3, 3]);
  let p;
  if (T === 1) p = [['INTRO', 16], ['GROOVE', pick([8, 16])], ['BUILD', 8], ['PEAK', pick([16, 24])], ['BREAK', pick([8, 16])], ['PEAK II', pick([24, 32])], ['OUTRO', 16]];
  else if (T === 2) p = [['INTRO', 16], ['GROOVE', 16], ['PEAK', 16], ['BASS SOLO', pick([4, 8])], ['REBUILD', 16], ['PEAK II', pick([16, 24])], ['OUTRO', 16]];
  else p = [['INTRO', 16], ['GROOVE', pick([8, 16])], ['HALFTIME', 8], ['BUILD', 8], ['PEAK', pick([16, 24])], ['BASS SOLO', 4], ['REBUILD', 8], ['PEAK II', 16], ['OUTRO', 16]];
  return p.map(([name, bars]) => ({ name, bars }));
}
const ALL = { kick: 1, hat: 1, open: 1, perc: 1, ride: 1, clap: 1, metal: 1, bass: 1, stab: 1, noise: 1, pad: 0, extra: 0 };
function sectionLayers(name, k) {
  switch (name) {
    case 'INTRO': return { ...ALL, hat: k < 0.25 ? 0.45 : 1, open: k < 0.5 ? 0 : 1, perc: k < 0.375 ? 0 : 1, ride: k < 0.75 ? 0 : 0.6, clap: 0, metal: 0, bass: k < 0.75 ? 0 : 1, stab: 0, noise: k < 0.5 ? 0.6 : 0.3 };
    case 'GROOVE': return { ...ALL, metal: 0.5, stab: 0.6, noise: 0.5 };
    case 'BUILD': return { ...ALL, bass: k < 0.75 ? 1 : 0 };
    case 'PEAK': return { ...ALL };
    case 'BREAK': return { ...ALL, kick: 0, hat: k < 0.5 ? 0 : 0.5, open: 0, perc: 0.5, ride: 0, clap: 0, metal: 0, bass: 0, stab: 0, pad: 1 };
    case 'PEAK II': return { ...ALL, extra: 1 };
    case 'BASS SOLO': return { kick: 0, hat: 0, open: 0, perc: 0, ride: 0, clap: 0, metal: 0, bass: 1, stab: 0, noise: 0.3, pad: 0, extra: 0, bassLong: 1 };
    case 'REBUILD': return { ...ALL, kick: k >= 0.125 ? 1 : 0, hat: k >= 0.25 ? 1 : 0, open: k >= 0.375 ? 1 : 0, perc: k >= 0.5 ? 1 : 0, ride: k >= 0.625 ? 1 : 0, clap: k >= 0.75 ? 1 : 0, metal: k >= 0.875 ? 1 : 0, stab: k >= 0.5 ? 0.6 : 0, noise: 0.4 };
    case 'HALFTIME': return { ...ALL, half: 1, open: 0, ride: 0, metal: 0, perc: 0.5, stab: 0, pad: 1, noise: 0.5 };
    case 'OUTRO': return { ...ALL, hat: k < 0.75 ? 1 : 0.5, open: k < 0.5 ? 1 : 0, perc: k < 0.625 ? 1 : 0, ride: k < 0.25 ? 1 : 0, clap: k < 0.375 ? 1 : 0, metal: k < 0.25 ? 0.5 : 0, bass: k < 0.5 ? 1 : 0, stab: k < 0.25 ? 0.5 : 0, noise: 0.4 };
    default: return { ...ALL };
  }
}
// master filter automation per section: lp/hp in 0..1
function sectionMaster(name, k) {
  if (name === 'INTRO') return { lp: 0.3 + 0.7 * Math.min(1, k * 1.15), hp: 0 };
  if (name === 'BUILD') return { lp: 1, hp: k * k * 0.62 };
  if (name === 'BREAK') return { lp: 0.72, hp: k > 0.5 ? (k - 0.5) * 2 * 0.5 : 0 };
  if (name === 'OUTRO') return { lp: 1 - k * 0.65, hp: 0 };
  if (name === 'BASS SOLO') return { lp: 0.42 + k * 0.4, hp: 0 };
  if (name === 'REBUILD') return { lp: 0.72 + 0.28 * k, hp: k > 0.75 ? (k - 0.75) * 4 * 0.35 : 0 };
  if (name === 'HALFTIME') return { lp: 0.8, hp: 0 };
  return { lp: 1, hp: 0 };
}
// genre change: 8-bar DJ-style blend
const SWITCH_AT = { hat: 0.125, open: 0.125, perc: 0.375, ride: 0.375, metal: 0.5, noise: 0.5, clap: 0.625, stab: 1, pad: 0.375, kick: 0.75, bass: 1 };
function transLayers(k) {
  return { ...ALL, kick: k < 0.875 ? 1 : 0, clap: k < 0.5 ? 1 : 0, bass: k < 0.375 ? 1 : 0, stab: 0, pad: k >= 0.375 && k < 0.875 ? 1 : 0, ride: 1 };
}

// ============================================================ state
const state = {
  voice: 'BASS', mode: 'PLAY', playing: false, evolve: 0.4,
  touch: null, home: 0,
  vals: { DRUMS: 0.4, BASS: 0.42, SYNTH: 0.45, NOISE: 0.3, AUTO: 0.5 },
  lastVoice: 'BASS',
  auto: { y: 0.5, ty: 0.5 },
};
const seq = {
  song: genSong('HYPNO', null), next: null, plan: makePlan(), sec: 0, secBar: -1, songBar: -1, step16: 0,
  bpm: 132, ramp: null, trans: null, pendingWorld: null, songTime: 0, totalBars: 0, worldKey: 'HYPNO',
  nextReq: false, skipNow: false, nextByUser: false,
};
seq.bpm = seq.song.bpm;
const ui = {};
applySongSound(seq.song);

// ============================================================ audio engine
let A = null;
function makeCurve(k, n = 2048) {
  const c = new Float32Array(n); const t = Math.tanh(k);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / t; }
  return c;
}
function makeCrush(bits, n = 4096) {
  const steps = Math.pow(2, bits); const c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.round(x * steps) / steps; }
  return c;
}
function makeIR(ac, sec, decay, dark) {
  const len = Math.floor(ac.sampleRate * sec);
  const b = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      lp += ((R() * 2 - 1) - lp) * Math.max(0.03, 0.85 - dark * 0.8 * t);
      d[i] = (i < ac.sampleRate * 0.012 ? 0 : 1) * lp * Math.pow(1 - t, decay);
    }
  }
  return b;
}

function createAudio() {
  const ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  const Gn = (v = 1) => { const n = ac.createGain(); n.gain.value = v; return n; };
  const F = (type, f, q = 0.7) => { const n = ac.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
  const shaper = (k, os = '4x') => { const s = ac.createWaveShaper(); s.curve = makeCurve(k); s.oversample = os; return s; };
  const comp = (th, ratio, att, rel, knee = 6) => { const c = ac.createDynamicsCompressor(); c.threshold.value = th; c.ratio.value = ratio; c.attack.value = att; c.release.value = rel; c.knee.value = knee; return c; };
  const noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1; }
  const noiseSrc = (t, dur) => { const s = ac.createBufferSource(); s.buffer = noise; s.loop = true; s.start(t, R() * 1.5); if (dur) s.stop(t + dur); return s; };
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const root = () => seq.song.root;

  // master: bus -> drive -> LP (arrangement) -> HP (arrangement) -> glue -> limiter
  // limiter -> recTap (what gets recorded) -> out (listening volume) -> speakers
  const out = Gn(0.92); out.connect(ac.destination);
  const analyser = ac.createAnalyser(); analyser.fftSize = 1024; out.connect(analyser);
  const recTap = Gn(0.82); recTap.connect(out);
  const limiter = comp(-2.5, 20, 0.001, 0.05, 0); limiter.connect(recTap);
  const glue = comp(-15, 3, 0.012, 0.14); glue.connect(limiter);
  const mHP = F('highpass', 18, 0.9); mHP.connect(glue);
  const mLP = F('lowpass', 20000, 0.9); mLP.connect(mHP);
  const mDrive = shaper(1.5); mDrive.connect(mLP);
  const bus = Gn(1); bus.connect(mDrive);
  const duck = Gn(1); duck.connect(bus);

  const revSend = Gn(1); const revRet = Gn(0.55);
  { const hp = F('highpass', 260), cv = ac.createConvolver(), lp = F('lowpass', 6500); cv.buffer = makeIR(ac, 3.8, 2.3, 0.7);
    revSend.connect(hp); hp.connect(cv); cv.connect(lp); lp.connect(revRet); revRet.connect(duck); }
  const dlySend = Gn(1); const dL = ac.createDelay(2), dR = ac.createDelay(2); const fb = Gn(0.45); const dlyRet = Gn(0.55);
  { const fHP = F('highpass', 350), fLP = F('lowpass', 3200), mg = ac.createChannelMerger(2);
    dlySend.connect(dL); dL.connect(dR); dR.connect(fHP); fHP.connect(fLP); fLP.connect(fb); fb.connect(dL);
    dL.connect(mg, 0, 0); dR.connect(mg, 0, 1); mg.connect(dlyRet); dlyRet.connect(duck); dlyRet.connect(revSend); }
  const rumSend = Gn(1);
  { const cv = ac.createConvolver(); cv.buffer = makeIR(ac, 1.5, 3, 0.95);
    const lp = F('lowpass', 150, 1.3), sh = shaper(4, '2x'), hp = F('highpass', 32), o = Gn(0.9);
    rumSend.connect(cv); cv.connect(lp); lp.connect(sh); sh.connect(hp); hp.connect(o); o.connect(duck); }
  // drums
  const kIn = Gn(1); const kSh = shaper(3); const kOut = Gn(0.95); const kRum = Gn(0.8);
  kIn.connect(kSh); kSh.connect(kOut); kOut.connect(bus); kOut.connect(kRum); kRum.connect(rumSend);
  const dIn = Gn(1); const dDrive = shaper(1.2); const dBus = Gn(1); dIn.connect(dDrive); dDrive.connect(dBus); dBus.connect(bus);
  const dRev = Gn(0.12); dBus.connect(dRev); dRev.connect(revSend);
  const metal = Gn(0.22);
  for (const r of [2, 3, 4.16, 5.43, 6.79, 8.21]) { const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = 76 * r; o.connect(metal); o.start(); }
  // bass
  const bIn = Gn(1); const bSh = shaper(2); const bHP = F('highpass', 28); const bOut = Gn(0.8); const bSub = Gn(0.9);
  bIn.connect(bSh); bSh.connect(bHP); bHP.connect(bOut); bOut.connect(duck); bSub.connect(duck);
  const bSend = Gn(0.05); bOut.connect(bSend); bSend.connect(dlySend);
  const bRum = Gn(0); bOut.connect(bRum); bSub.connect(bRum); bRum.connect(rumSend);
  // synth
  const sIn = Gn(1); const sSh = shaper(1.2); const sOut = Gn(1); sIn.connect(sSh); sSh.connect(sOut); sOut.connect(duck);
  const sDly = Gn(0.6), sRev = Gn(0.4); sOut.connect(sDly); sDly.connect(dlySend); sOut.connect(sRev); sRev.connect(revSend);
  // noise
  const nIn = Gn(1); const nCrush = ac.createWaveShaper(); nCrush.curve = makeCrush(6); const nOut = Gn(0.8);
  nIn.connect(nCrush); nCrush.connect(nOut); nOut.connect(bus);
  const nRev = Gn(0.5); nOut.connect(nRev); nRev.connect(revSend);

  // computer voice: highpass -> ring modulator -> distortion -> bitcrush -> band -> comb (metal) -> master
  const vIn = Gn(1); const vHP = F('highpass', 140);
  const vDry = Gn(1), vWet = Gn(0), ring = Gn(0);
  const ringOsc = ac.createOscillator(); ringOsc.type = 'sine'; ringOsc.frequency.value = 72; ringOsc.connect(ring.gain); ringOsc.start();
  const vSum = Gn(1); const vSh = shaper(3, '2x'); const vCrush = ac.createWaveShaper(); vCrush.curve = makeCrush(8);
  const vBP = F('bandpass', 1500, 0.25); const vPost = Gn(1.6);
  const comb = ac.createDelay(0.05); comb.delayTime.value = 0.0062; const combFb = Gn(0.55); const combG = Gn(0.5);
  const vOut = Gn(0.9); const vDly = Gn(0.3), vRev = Gn(0.3);
  vIn.connect(vHP); vHP.connect(vDry); vHP.connect(ring); ring.connect(vWet); vDry.connect(vSum); vWet.connect(vSum);
  vSum.connect(vSh); vSh.connect(vCrush); vCrush.connect(vBP); vBP.connect(vPost); vPost.connect(vOut);
  vPost.connect(comb); comb.connect(combFb); combFb.connect(comb); comb.connect(combG); combG.connect(vOut);
  vOut.connect(mDrive); vOut.connect(vDly); vDly.connect(dlySend); vOut.connect(vRev); vRev.connect(revSend);

  const events = [];
  const fire = (time, voice, lane, vel = 1) => events.push({ time, voice, lane, vel });

  // ---------------------------------------------------------- voices
  function kickParams() {
    const s = sound.DRUMS;
    return [
      { tune: 47 - s.weight * 4, decay: 0.36 + s.weight * 0.3, punch: 7, click: 0.35, drive: 2.5 + s.grit * 5, rumble: 0.35 + s.space * 0.8 },
      { tune: 54 - s.weight * 5, decay: 0.2 + s.weight * 0.22, punch: 11, click: 0.85, drive: 2 + s.grit * 4, rumble: 0.05 + s.space * 0.3 },
      { tune: 51 - s.weight * 4, decay: 0.28 + s.weight * 0.25, punch: 9, click: 0.6, drive: 7 + s.grit * 12, rumble: 0.35 + s.space * 0.6 },
    ][sound.DRUMS.model];
  }
  function kick(t, vel = 1) {
    const k = kickParams(), f = k.tune;
    const o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f * k.punch, t); o.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.016);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.085); o.frequency.linearRampToValueAtTime(f * 0.9, t + k.decay);
    const g = Gn(0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.0015);
    g.gain.setValueAtTime(vel, t + 0.02 + k.decay * 0.15); g.gain.exponentialRampToValueAtTime(0.0005, t + k.decay);
    o.connect(g); g.connect(kIn); o.start(t); o.stop(t + k.decay + 0.05);
    const n = noiseSrc(t, 0.03); const bp = F('bandpass', 3500, 0.8); const ng = Gn(0);
    ng.gain.setValueAtTime(vel * k.click, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
    n.connect(bp); bp.connect(ng); ng.connect(kIn);
    duck.gain.cancelScheduledValues(t);
    duck.gain.setTargetAtTime(0.22, t, 0.004);
    duck.gain.setTargetAtTime(1, t + 0.03, 0.065);
  }
  function hat(t, vel, decay, toneF = 8000) {
    const mg = Gn(1.5); const n = noiseSrc(t, decay + 0.1); const ng = Gn(sound.DRUMS.model === 2 ? 0.3 : 0.5);
    const bp = F('bandpass', toneF + 2000, 0.6); const hp = F('highpass', toneF, 0.9); const g = Gn(0);
    metal.connect(mg); mg.connect(bp); n.connect(ng); ng.connect(bp); bp.connect(hp); hp.connect(g); g.connect(dIn);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay); g.gain.setValueAtTime(0, t + decay + 0.002);
    setTimeout(() => { try { metal.disconnect(mg); } catch (e) { /* gone */ } }, Math.max(0, (t - ac.currentTime + decay + 0.15) * 1000));
  }
  function clap(t, vel, wet = 0.4) {
    const n = noiseSrc(t, 0.6); const hp = F('highpass', 700); const bp = F('bandpass', 1300, 1.5); const g = Gn(0); const w = Gn(wet);
    const sp = 0.011, v = vel * 1.5;
    g.gain.setValueAtTime(0, t);
    for (let k = 0; k < 3; k++) { g.gain.setValueAtTime(v, t + k * sp); g.gain.exponentialRampToValueAtTime(v * 0.12, t + k * sp + sp * 0.95); }
    g.gain.setValueAtTime(v, t + 3 * sp); g.gain.exponentialRampToValueAtTime(0.001, t + 3 * sp + 0.3);
    n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(dIn); g.connect(w); w.connect(revSend);
  }
  function tom(t, vel, f) {
    const o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f * 2.2, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    const g = Gn(0); g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    const s = Gn(0.25); o.connect(g); g.connect(dIn); g.connect(s); s.connect(dlySend); o.start(t); o.stop(t + 0.25);
  }
  function metalHit(t, vel, f, ring, crush, dest = dIn) {
    const ex = noiseSrc(t, 2); const eg = Gn(0);
    eg.gain.setValueAtTime(vel * 2.5, t); eg.gain.exponentialRampToValueAtTime(0.0005, t + 0.006);
    ex.connect(eg);
    const q = 30 + ring * 220; const sum = Gn(Math.sqrt(q) * 0.5); const sh = shaper(crush, '2x'); const w = Gn(0.6);
    [1, 1.593, 2.135, 2.295, 2.917, 3.598].forEach((m, i) => { const bp = F('bandpass', f * m, q * (1 - i * 0.06)); eg.connect(bp); bp.connect(sum); });
    sum.connect(sh); sh.connect(dest); sh.connect(w); w.connect(revSend);
  }
  function bass(t, deg, dur, vel, tone) {
    const S = sound.BASS, m = S.model;
    const f = hz(41 + root() + semi(deg) + (m === 1 ? 12 : 0));
    const filt = F('lowpass', 200, m === 1 ? 5 + tone * 16 : 1 + tone * 6);
    const cut = 50 * Math.pow(2, 1 + tone * 6.4);
    const envMul = 1.5 + S.motion * (m === 1 ? 7 : 4) * (vel > 0.9 ? 1.3 : 1);
    filt.frequency.setValueAtTime(Math.min(15000, cut * envMul), t);
    filt.frequency.setTargetAtTime(cut, t + 0.002, 0.025 + S.motion * 0.12);
    const gate = dur * (m === 0 ? 0.72 : 0.86);
    const amp = Gn(0), subAmp = Gn(0);
    const subL = (m === 1 ? 0.12 + S.weight * 0.4 : 0.3 + S.weight * 0.85) * vel;
    const mainL = (m === 1 ? 0.55 : 0.5) * vel;
    for (const [a, lv] of [[amp, mainL], [subAmp, subL]]) {
      a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(lv, t + 0.004);
      a.gain.setValueAtTime(lv, t + gate); a.gain.setTargetAtTime(0, t + gate, 0.014);
    }
    const det = 8 + S.grit * 14;
    const set = m === 0 ? [['sawtooth', 1, 0, 0.35], ['triangle', 1, 0, 0.45]]
      : m === 1 ? [['sawtooth', 1, 0, 0.7]]
      : [['sawtooth', 1, -det, 0.5], ['sawtooth', 1, det, 0.5], ['square', 0.5, 0, 0.3]];
    const oscs = [];
    for (const [type, mult, d, lvl] of set) {
      const o = ac.createOscillator(); o.type = type; o.frequency.value = f * mult; o.detune.value = d;
      const g = Gn(lvl); o.connect(g); g.connect(filt); oscs.push(o);
    }
    const sub = ac.createOscillator(); sub.type = 'sine'; sub.frequency.value = f / (m === 1 ? 4 : 2); sub.connect(subAmp); subAmp.connect(bSub); oscs.push(sub);
    filt.connect(amp); amp.connect(bIn);
    for (const o of oscs) { o.start(t); o.stop(t + gate + 0.15); }
  }
  // kind: 'pluck' | 'stab' | 'pad'
  function synth(t, deg, kind, tone, vel = 1, dur = 0.5) {
    const S = sound.SYNTH;
    const det = 4 + S.weight * 20;
    const filt = F('lowpass', 800, kind === 'pad' ? 1.5 : 3 + S.motion * 6);
    const amp = Gn(0);
    let notes, base, oscTypes, end;
    if (kind === 'pluck') {
      base = 65; notes = [deg]; oscTypes = ['sawtooth', 'square'];
      const peak = 600 + tone * 7000 * (0.4 + S.motion);
      filt.frequency.setValueAtTime(Math.min(16000, peak), t); filt.frequency.setTargetAtTime(250 + tone * 900, t + 0.002, 0.04 + S.motion * 0.08);
      amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(0.16 * vel, t + 0.003); amp.gain.setTargetAtTime(0, t + 0.01, 0.06 + S.motion * 0.05);
      end = t + 0.6;
    } else if (kind === 'stab') {
      base = 53; notes = [deg, deg + 2, deg + 4, deg + 6]; oscTypes = ['sawtooth', 'sawtooth'];
      filt.frequency.setValueAtTime(1000 + tone * 4000 * (0.5 + S.motion), t); filt.frequency.setTargetAtTime(350 + tone * 1200, t + 0.002, 0.05 + S.motion * 0.05);
      amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(0.11 * vel, t + 0.004); amp.gain.setTargetAtTime(0, t + 0.01, 0.08 + S.motion * 0.06);
      end = t + 0.8;
    } else {
      base = 53; notes = [deg, deg + 2, deg + 4, deg + 7]; oscTypes = ['sawtooth', 'sawtooth', 'triangle'];
      const c0 = 300 + tone * 1500;
      filt.frequency.setValueAtTime(c0, t); filt.frequency.linearRampToValueAtTime(c0 * (1.5 + S.motion * 2.5), t + dur * 0.6);
      filt.frequency.linearRampToValueAtTime(c0, t + dur);
      amp.gain.setValueAtTime(0, t); amp.gain.linearRampToValueAtTime(0.06 * vel, t + Math.min(0.5, dur * 0.3));
      amp.gain.setValueAtTime(0.06 * vel, t + dur); amp.gain.setTargetAtTime(0, t + dur, 0.5);
      end = t + dur + 2.5;
    }
    filt.connect(amp); amp.connect(sIn);
    for (const d of notes) {
      const fr = hz(base + root() + semi(d));
      oscTypes.forEach((type, i) => {
        const o = ac.createOscillator(); o.type = type; o.frequency.value = fr * (i === 2 ? 0.5 : 1);
        o.detune.value = i === 0 ? -det : i === 1 ? det : 0;
        o.connect(filt); o.start(t); o.stop(end);
      });
      if (S.weight > 0.65 && kind !== 'pluck') {
        const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr * 2; o.detune.value = det * 0.5;
        const g = Gn(0.35); o.connect(g); g.connect(filt); o.start(t); o.stop(end);
      }
    }
  }
  function noiseHit(t, deg, vel) {
    const S = sound.NOISE, m = S.model;
    const f = (80 + S.weight * 320) * Math.pow(2, semi(deg) / 12);
    if (m === 0) {
      metalHit(t, vel * 0.6, f, 0.35 + S.motion * 0.5, 2 + S.grit * 8, nIn);
    } else if (m === 1) {
      const reps = 1 + Math.floor(R() * 3);
      for (let i = 0; i < reps; i++) {
        const tt = t + i * 0.028;
        const src = noiseSrc(tt, 0.12); const bp = F('bandpass', f * 4 * (1 + R()), 2.5); const g = Gn(0);
        const d = 0.02 + (1 - S.motion) * 0.06;
        g.gain.setValueAtTime(vel * 0.9, tt); g.gain.exponentialRampToValueAtTime(0.001, tt + d);
        src.connect(bp); bp.connect(g); g.connect(nIn);
      }
    } else {
      const src = noiseSrc(t, 2.4); const bp = F('bandpass', f * 2, 6); const g = Gn(0);
      bp.frequency.setValueAtTime(f * 1.5, t); bp.frequency.exponentialRampToValueAtTime(f * (3 + S.motion * 6), t + 0.9);
      bp.frequency.exponentialRampToValueAtTime(f, t + 2.2);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.5, t + 0.35); g.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
      src.connect(bp); bp.connect(g); g.connect(nIn);
    }
  }
  // riser: auto (fixed length) or held (touch)
  function riser(t, dur) {
    const src = noiseSrc(t, dur ? dur + 0.1 : 0);
    const bp = F('bandpass', 300, 5);
    const len = dur || 8;
    bp.frequency.setValueAtTime(250, t); bp.frequency.exponentialRampToValueAtTime(9000, t + len);
    const g = Gn(0); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.38, t + len * 0.95);
    if (dur) g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    src.connect(bp); bp.connect(g); g.connect(bus); g.connect(revSend);
    return { src, g };
  }
  function impact(t) {
    kick(t, 1);
    const n = noiseSrc(t, 2.6); const lp = F('lowpass', 9000); const g = Gn(0);
    lp.frequency.setValueAtTime(9000, t); lp.frequency.exponentialRampToValueAtTime(220, t + 2.4);
    g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.001, t + 2.4);
    n.connect(lp); lp.connect(g); g.connect(revSend); g.connect(bus);
    const o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(30, t + 1.2);
    const og = Gn(0); og.gain.setValueAtTime(0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
    o.connect(og); og.connect(duck); o.start(t); o.stop(t + 1.4);
  }
  let heldRiser = null;

  // ---------------------------------------------------------- sequencer
  let nextT = 0, timer = null;
  const TOMS = [110, 131, 147, 165, 196];
  const stepDur = () => 60 / seq.bpm / 4;

  function setMaster(t, m, barDur) {
    const lpF = 300 * Math.pow(2, m.lp * 6.06);
    const hpF = 18 * Math.pow(2, m.hp * 6);
    mLP.frequency.cancelScheduledValues(t); mLP.frequency.setValueAtTime(mLP.frequency.value, t);
    mLP.frequency.exponentialRampToValueAtTime(Math.min(20000, lpF), t + barDur);
    mHP.frequency.cancelScheduledValues(t); mHP.frequency.setValueAtTime(mHP.frequency.value, t);
    mHP.frequency.exponentialRampToValueAtTime(Math.max(18, hpF), t + barDur);
  }
  function startRamp(to, bars) { seq.ramp = { from: seq.bpm, to, steps: bars * 16, pos: 0 }; }
  function enterSection(t, prevSecName, barDur) {
    const sec = seq.plan[seq.sec], name = sec.name;
    if (name === 'OUTRO') { seq.next = genSong(seq.song.world, seq.song); startRamp(seq.next.bpm, sec.bars + 4); if (api.onOutro) api.onOutro(); }
    if (name === 'BUILD') riser(t, barDur * sec.bars);
    if ((name === 'PEAK' || name === 'PEAK II') && ['BUILD', 'BREAK', 'REBUILD'].includes(prevSecName)) impact(t);
    if (name === 'BASS SOLO') impact(t);
    if (name === 'PEAK II') { relax(seq.song); mutate(seq.song, 0.9); }
    bRum.gain.setTargetAtTime(name === 'BASS SOLO' ? 0.9 : 0, t, name === 'BASS SOLO' ? 0.1 : 1.5);
  }

  function onBar(t) {
    const prevSecName = seq.plan[seq.sec] ? seq.plan[seq.sec].name : '';
    seq.songBar++; seq.secBar++; seq.totalBars++;
    const barDur = stepDur() * 16;
    let jumped = false;

    // genre change in progress
    if (seq.pendingWorld && !seq.trans) {
      seq.trans = { to: genSong(seq.pendingWorld, seq.song), bar: -1, bars: 8 };
      seq.pendingWorld = null;
      startRamp(seq.trans.to.bpm, 8);
    }
    if (seq.trans) {
      const tr = seq.trans;
      tr.bar++;
      if (tr.bar === 4) tr.riser = riser(t, barDur * 4);
      if (tr.bar === 6) applySongSound(tr.to, ['DRUMS']);
      if (tr.bar >= tr.bars) {
        // land in the new world at its groove section
        seq.song = tr.to; seq.worldKey = tr.to.world; seq.trans = null; seq.next = null;
        seq.plan = makePlan(); seq.sec = 1; seq.secBar = 0; seq.songBar = 0; seq.songTime = 0;
        applySongSound(seq.song, ['BASS', 'SYNTH', 'NOISE']);
        impact(t);
        jumped = true;
        bRum.gain.setTargetAtTime(0, t, 0.3);
        if (A) A.songStarted(t, seq.song);
      } else {
        const k = (tr.bar + 1) / tr.bars;
        setMaster(t, { lp: 1, hp: k > 0.5 ? (k - 0.5) * 2 * 0.55 : 0 }, barDur);
        ui.dirty = true;
        return;
      }
    }

    // NEXT pressed: wind down now (short outro); pressed again during the outro: cut to the next song
    if (!jumped && seq.nextReq) {
      seq.nextReq = false;
      const oi = seq.plan.length - 1;
      if (seq.sec !== oi) { seq.plan[oi].bars = 8; seq.sec = oi; seq.secBar = 0; enterSection(t, prevSecName, barDur); }
    }
    if (!jumped && seq.skipNow) { seq.skipNow = false; seq.secBar = seq.plan[seq.sec].bars; }

    // section / song progression
    if (!jumped && seq.secBar >= seq.plan[seq.sec].bars) {
      seq.sec++; seq.secBar = 0;
      if (seq.sec >= seq.plan.length) {
        seq.song = seq.next || genSong(seq.song.world, seq.song);
        seq.next = null; seq.nextByUser = false;
        seq.plan = makePlan(); seq.sec = 0; seq.songBar = 0; seq.songTime = 0;
        applySongSound(seq.song);
        if (A) A.songStarted(t, seq.song);
      }
      enterSection(t, prevSecName, barDur);
    }
    const sec = seq.plan[seq.sec];
    if (sec.name === 'BREAK' && seq.secBar === Math.floor(sec.bars / 2)) riser(t, barDur * (sec.bars - seq.secBar));
    if (sec.name === 'REBUILD' && seq.secBar === sec.bars - 4) riser(t, barDur * 4);
    // AUTO pilot: drifts energy and the home note while nobody touches the field
    if (state.voice === 'AUTO' && !state.touch) {
      if (seq.songBar % 2 === 0) state.auto.ty = clamp(state.auto.ty + (R() - 0.45) * 0.45, 0.15, 0.95);
      if (seq.songBar % 8 === 0) state.home = clamp(state.home + pick([-2, -1, 0, 0, 1, 2, 3]), 0, 6);
    }

    // evolve once per loop, relax every 16 bars
    if (seq.songBar % 4 === 0 && seq.songBar > 0 && R() < 0.35 + state.evolve * 0.65) mutate(seq.song, state.evolve);
    if (seq.songBar % 16 === 0 && seq.songBar > 0) relax(seq.song);

    const k = (seq.secBar + 1) / sec.bars;
    setMaster(t, sectionMaster(sec.name, k), barDur);
    const dt = 60 / seq.bpm * 0.75;
    dL.delayTime.setTargetAtTime(dt, t, 0.2); dR.delayTime.setTargetAtTime(dt, t, 0.2);
    ui.dirty = true;
  }

  function playStep(t) {
    const p = seq.step16;
    if (p === 0) onBar(t);
    const sd = stepDur();
    const song = seq.song;
    const lp = (((seq.songBar % 4) + 4) % 4) * 16 + p;
    const tr = seq.trans;
    let L, kSec, secName;
    if (tr) { kSec = (tr.bar + p / 16) / tr.bars; L = transLayers(kSec); secName = 'TRANS'; }
    else { const sec = seq.plan[seq.sec]; kSec = (seq.secBar + p / 16) / sec.bars; L = sectionLayers(sec.name, kSec); secName = sec.name; }
    const src = (layer) => (tr && kSec >= (SWITCH_AT[layer] ?? 1) ? tr.to : song);
    const val = (layer) => src(layer).live[layer][lp] * (L[layer] ?? 0);
    const E = state.evolve;
    const hitP = (v) => v >= 1 || (v > 0 && R() < v * (0.55 + E * 0.45));
    const swing = (src('hat').swing || 0) + sound.DRUMS.motion * 0.1;
    const tt = t + (p % 2 ? swing * sd * 0.6 : 0);
    const touch = state.touch;
    const v = state.vals;
    const lastBarOf = (n) => seq.secBar % n === n - 1;
    const isAuto = !!touch && touch.voice === 'AUTO';
    const tDrums = !!touch && (touch.voice === 'DRUMS' || isAuto);
    const tBass = !!touch && (touch.voice === 'BASS' || isAuto);
    const tSynth = !!touch && (touch.voice === 'SYNTH' || (isAuto && touch.y > 0.45));
    const tNoise = !!touch && (touch.voice === 'NOISE' || (isAuto && touch.y > 0.72));

    // DRUMS — arrangement decides, a finger on DRUMS overrides the layer stack
    let D = { kick: L.kick, hat: L.hat, open: L.open, perc: L.perc, ride: L.ride, clap: L.clap, metal: L.metal, extra: L.extra };
    if (tDrums) {
      const n = isAuto ? Math.round(clamp(touch.y, 0, 1) * 7) : touch.lane;
      D = { kick: 1, hat: n >= 1 ? 1 : 0, open: n >= 2 ? 1 : 0, perc: n >= 3 ? 1 : 0, ride: n >= 4 ? 1 : 0, clap: n >= 5 ? 1 : 0, metal: n >= 6 ? 1 : 0, extra: n >= 7 ? 1 : 0 };
    }
    const dv = (layer) => src(layer).live[layer][lp] * (D[layer] ?? 0);
    const buildEnd = !tr && (secName === 'BUILD') && lastBarOf(seq.plan[seq.sec].bars) && p >= 12;
    const half = L.half && !tDrums;
    if (half ? (p === 0 || p === 8) : (hitP(dv('kick')) && !buildEnd)) { kick(t, 1); fire(t, 'DRUMS', 0); }
    if (D.extra && p % 4 === 3 && R() < 0.4) kick(tt, 0.5);
    if (half ? p % 4 === 2 && R() < 0.8 : hitP(dv('hat'))) { hat(tt, 0.15 + (p % 2) * 0.05, 0.03 + v.DRUMS * 0.03, 8500); fire(tt, 'DRUMS', 1, 0.5); }
    else if (D.hat && R() < sound.DRUMS.motion * 0.25) hat(tt, 0.08, 0.025, 9500);
    if (hitP(dv('open'))) { hat(tt, 0.28, 0.14 + v.DRUMS * 0.2, 7000); fire(tt, 'DRUMS', 2); }
    if (hitP(dv('perc'))) {
      const n = src('perc').live.percN[lp] || 0;
      tom(tt, 0.18 + v.DRUMS * 0.15, TOMS[n % 5] * WORLDS[src('perc').world].percPitch);
      fire(tt, 'DRUMS', 3);
    }
    if (hitP(dv('ride'))) { hat(tt, 0.1, 0.26, 5400); fire(tt, 'DRUMS', 4, 0.4); }
    if (half ? p === 12 : hitP(dv('clap'))) { clap(tt, half ? 0.75 : 0.6, half ? 0.7 : 0.25 + v.DRUMS * 0.4); fire(tt, 'DRUMS', 5); }
    if (hitP(dv('metal'))) { metalHit(tt, 0.45, 190 + (lp * 37) % 240, 0.5, 3); fire(tt, 'DRUMS', 6); }
    if (D.extra && R() < 0.35) hat(tt, 0.08, 0.025, 9500);
    // fills: clap rolls at phrase ends, a full roll into drops
    if (!tr && D.clap && (secName === 'GROOVE' || secName === 'PEAK' || secName === 'PEAK II') && lastBarOf(8) && p >= 12) clap(tt, 0.25 + (p - 12) * 0.12, 0.2);
    if (!tr && (secName === 'BUILD' || secName === 'BREAK') && lastBarOf(seq.plan[seq.sec].bars) && (p % 2 === 0 || p >= 8)) clap(tt, 0.15 + p * 0.04, 0.3);
    if (tr && tr.bar === tr.bars - 1 && p >= 8) clap(tt, 0.15 + p * 0.04, 0.3);

    // BASS
    if (tBass) {
      if (p % 4 !== 0) { bass(tt, touch.lane, sd, p % 4 === 2 ? 1 : 0.75, v.BASS); fire(tt, 'BASS', touch.lane); }
    } else if (L.bassLong || half) {
      // slow passages: long notes that thunder through the rumble chain
      if (p === 0 || p === 8) {
        const deg = clamp(state.home + src('bass').live.notes[lp - p], -3, 11);
        bass(tt, deg, sd * 7.5, 1, L.bassLong ? clamp(0.25 + kSec * 0.5, 0, 1) : v.BASS);
        fire(tt, 'BASS', clamp(deg, 0, 7), 1);
      }
    } else if (hitP(val('bass'))) {
      const deg = clamp(state.home + src('bass').live.notes[lp], -3, 11);
      bass(tt, deg, sd, p % 4 === 2 ? 1 : 0.72, v.BASS);
      fire(tt, 'BASS', clamp(deg, 0, 7), 0.5);
    }

    // SYNTH
    const sm = sound.SYNTH.model;
    if (tSynth) {
      if (sm === 0) {
        const arp = [0, 2, 4, 6, 7, 4, 2, 4];
        const fast = sound.SYNTH.motion > 0.55 || v.SYNTH > 0.75;
        if (fast || p % 2 === 0 || p % 4 === 3) { synth(tt, touch.lane + arp[p % 8], 'pluck', v.SYNTH); fire(tt, 'SYNTH', touch.lane); }
      } else if (sm === 1) {
        if (p % 4 === 2 || (p % 8 === 7 && R() < 0.5)) { synth(tt, touch.lane, 'stab', v.SYNTH); fire(tt, 'SYNTH', touch.lane); }
      } else if (p % 8 === 0 || touch.changed) {
        synth(tt, touch.lane, 'pad', v.SYNTH, 1, sd * 8); fire(tt, 'SYNTH', touch.lane); touch.changed = false;
      }
    } else {
      const barRoot = state.home + src('bass').live.notes[lp - p];
      if (L.pad && p === 0) { synth(tt, barRoot, 'pad', v.SYNTH, 1, sd * 16 * 0.95); fire(tt, 'SYNTH', clamp(barRoot, 0, 7), 0.6); }
      if (hitP(val('stab'))) {
        const kind = ['pluck', 'stab', 'pad'][sm];
        const d = kind === 'pluck' ? barRoot + pick([0, 2, 4, 7]) : barRoot;
        synth(tt, d, kind, v.SYNTH, 1, sd * 3);
        fire(tt, 'SYNTH', clamp(barRoot, 0, 7), 0.5);
      }
    }

    // NOISE
    if (tNoise) {
      if (p % 2 === 1 && R() < 0.15 + v.NOISE * 0.5 + sound.NOISE.motion * 0.3) { noiseHit(tt, touch.lane, 0.5 + v.NOISE * 0.4); fire(tt, 'NOISE', touch.lane); }
    } else {
      const nv = val('noise') * (0.5 + sound.NOISE.motion);
      if (sound.NOISE.model === 2 ? (p === 0 && L.noise && seq.songBar % 2 === 0 && R() < 0.4 + sound.NOISE.motion * 0.4) : hitP(nv)) {
        noiseHit(tt, state.home + pick([0, 2, 4]), 0.5);
        fire(tt, 'NOISE', clamp(state.home, 0, 7), 0.5);
      }
    }

    A.stepQueue.push({ time: t, step: p, kick: dv('kick') > 0 });

    // advance
    seq.songTime += sd;
    seq.step16 = (p + 1) % 16;
    if (seq.ramp) {
      seq.ramp.pos++;
      seq.bpm = seq.ramp.from + (seq.ramp.to - seq.ramp.from) * Math.min(1, seq.ramp.pos / seq.ramp.steps);
      if (seq.ramp.pos >= seq.ramp.steps) seq.ramp = null;
    }
  }
  function schedule() {
    if (nextT < ac.currentTime - 0.2) nextT = ac.currentTime + 0.03;
    while (nextT < ac.currentTime + 0.12) { playStep(nextT); nextT += stepDur(); }
  }

  let last = {};
  const api = {
    ac, analyser, events, stepQueue: [], recTap, onSongStart: null, onOutro: null, songListeners: [],
    songStarted(t, song) { if (this.onSongStart) this.onSongStart(t, song); for (const fn of this.songListeners) fn(t, song); },
    nextBarTime() { const sd = stepDur(); return Math.max(ac.currentTime + 0.05, nextT + ((16 - seq.step16) % 16) * sd); },
    nextBeatTime() { const sd = stepDur(); return Math.max(ac.currentTime + 0.03, nextT + ((4 - (seq.step16 % 4)) % 4) * sd); },
    voiceModel(m, grit, metal, space) {
      const t = ac.currentTime;
      const P = [
        { wet: 0.45 + metal * 0.5, fb: 0.45 + metal * 0.4, comb: 0.35 + metal * 0.5, drive: 2 + grit * 6, bits: 9 - grit * 3, bp: 1500, q: 0.25 },
        { wet: 0.25 + metal * 0.4, fb: 0.25 + metal * 0.35, comb: 0.2 + metal * 0.3, drive: 6 + grit * 16, bits: 7 - grit * 3, bp: 1600, q: 0.35 },
        { wet: 0.2 + metal * 0.4, fb: 0.2 + metal * 0.3, comb: 0.15 + metal * 0.3, drive: 3 + grit * 8, bits: 7 - grit * 2, bp: 1500, q: 1.3 },
      ][m];
      vWet.gain.setTargetAtTime(P.wet, t, 0.02); vDry.gain.setTargetAtTime(1 - P.wet * 0.8, t, 0.02);
      combFb.gain.setTargetAtTime(Math.min(0.85, P.fb), t, 0.02); combG.gain.setTargetAtTime(P.comb, t, 0.02);
      vSh.curve = makeCurve(P.drive); vCrush.curve = makeCrush(Math.round(P.bits));
      vBP.frequency.setTargetAtTime(P.bp, t, 0.02); vBP.Q.setTargetAtTime(P.q, t, 0.02);
      vPost.gain.setTargetAtTime(1.6 / (1 + P.drive * 0.06), t, 0.02);
      vDly.gain.setTargetAtTime(space * 0.8, t, 0.05); vRev.gain.setTargetAtTime(0.1 + space * 0.9, t, 0.05);
      ringOsc.frequency.setTargetAtTime(40 + metal * 90, t, 0.02);
    },
    speak(buf, t) {
      const src = ac.createBufferSource(); src.buffer = buf; src.connect(vIn); src.start(t);
      const dur = buf.duration;
      bus.gain.cancelScheduledValues(t); bus.gain.setTargetAtTime(0.55, t, 0.08); bus.gain.setTargetAtTime(1, t + dur, 0.5);
      return dur;
    },
    setVolume(v) { out.gain.setTargetAtTime(v * v * 1.1, ac.currentTime, 0.03); },
    start() {
      ac.resume();
      nextT = ac.currentTime + 0.06;
      clearInterval(timer); timer = setInterval(schedule, 25); schedule();
    },
    stop() {
      clearInterval(timer); timer = null; events.length = 0; this.stepQueue.length = 0;
      if (heldRiser) { heldRiser.src.stop(); heldRiser = null; }
    },
    get running() { return !!timer; },
    update() {
      const t = ac.currentTime, v = state.vals;
      const set = (key, val, fn) => { if (last[key] === undefined || Math.abs(last[key] - val) > 0.02) { last[key] = val; fn(val); } };
      const kp = kickParams();
      set('kdrive', kp.drive, (x) => { kSh.curve = makeCurve(x); });
      kRum.gain.setTargetAtTime(kp.rumble * 1.4, t, 0.05);
      set('ddrive', sound.DRUMS.grit * 0.6 + v.DRUMS * 0.5, (x) => { dDrive.curve = makeCurve(1 + x * 6); dIn.gain.setTargetAtTime(1 / (1 + x * 0.5), t, 0.03); });
      dRev.gain.setTargetAtTime(0.04 + sound.DRUMS.space * 0.45 + v.DRUMS * 0.15, t, 0.08);
      const bg = sound.BASS.grit * 0.7 + v.BASS * 0.4;
      set('bgrit' + sound.BASS.model, bg, (x) => { bSh.curve = makeCurve(1.5 + x * (sound.BASS.model === 2 ? 12 : 8)); bOut.gain.setTargetAtTime(0.85 / (1 + x * 0.9), t, 0.03); });
      bSend.gain.setTargetAtTime(sound.BASS.space * 0.35, t, 0.08);
      bSub.gain.setTargetAtTime(0.9, t, 0.05);
      set('sgrit', sound.SYNTH.grit, (x) => { sSh.curve = makeCurve(1.2 + x * 10); sOut.gain.setTargetAtTime(1 / (1 + x * 1.2), t, 0.03); });
      sDly.gain.setTargetAtTime(0.15 + sound.SYNTH.space * 0.85, t, 0.08);
      sRev.gain.setTargetAtTime(0.1 + sound.SYNTH.space * 0.6, t, 0.08);
      fb.gain.setTargetAtTime(0.28 + sound.SYNTH.space * 0.4, t, 0.08);
      set('ncrush', sound.NOISE.grit, (x) => { nCrush.curve = makeCrush(Math.round(10 - x * 7)); });
      nRev.gain.setTargetAtTime(0.1 + sound.NOISE.space * 1.0 + v.NOISE * 0.3, t, 0.08);
      revRet.gain.setTargetAtTime(0.45 + v.NOISE * 0.3, t, 0.08);
    },
    noteOn(voice) { if (voice === 'NOISE' && !heldRiser) heldRiser = riser(ac.currentTime, 0); },
    noteOff(voice) {
      if (voice === 'NOISE' && heldRiser) {
        const t = ac.currentTime;
        heldRiser.g.gain.cancelScheduledValues(t); heldRiser.g.gain.setValueAtTime(heldRiser.g.gain.value, t); heldRiser.g.gain.linearRampToValueAtTime(0, t + 0.06);
        heldRiser.src.stop(t + 0.1); heldRiser = null;
        impact(t + 0.005);
      }
    },
    preview(voice) {
      const t = ac.currentTime + 0.01, sd = stepDur();
      if (voice === 'DRUMS') kick(t, 1);
      else if (voice === 'BASS') bass(t, state.home, sd * 2, 1, state.vals.BASS);
      else if (voice === 'SYNTH') synth(t, state.home, ['pluck', 'stab', 'pad'][sound.SYNTH.model], state.vals.SYNTH, 1, sd * 8);
      else noiseHit(t, state.home, 0.7);
    },
  };
  return api;
}

// ============================================================ UI
const $ = (id) => document.getElementById(id);
const fieldEl = $('field'), fc = $('fieldCanvas'), fctx = fc.getContext('2d');
const scope = $('scope'), sctx = scope.getContext('2d');
const stepsEl = $('steps');
for (let i = 0; i < 16; i++) { const s = document.createElement('span'); if (i % 4 === 0) s.className = 'q'; stepsEl.appendChild(s); }
const stepSpans = [...stepsEl.children];
const keyLeds = Object.fromEntries([...document.querySelectorAll('.key')].map((k) => [k.dataset.voice, k.querySelector('.led')]));

function ensureAudio() {
  if (!A) {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* unsupported */ }
    A = createAudio();
  }
}
function setPlaying(on) {
  ensureAudio();
  if (!on && typeof REC !== 'undefined' && REC.active) recStop();
  state.playing = on;
  if (on) {
    A.setVolume(volume); A.start();
    applyVox();
    if (!A.voxHooked) {
      A.voxHooked = true;
      A.songListeners.push((t) => { if (vox.trans) voxSay(nextTransPhrase(), t + 0.02); });
      A.onOutro = prepareTransition;
    }
    // set start: the intro line lands on the second bar
    if (vox.intro && $('voxIntro').value.trim()) voxSay($('voxIntro').value, () => A.nextBarTime() + (60 / seq.bpm) * 4);
  } else A.stop();
  keepAwake(on);
  $('playBtn').setAttribute('aria-pressed', String(on));
  $('playBtn').setAttribute('aria-label', on ? 'Stop' : 'Play');
  $('playIcon').innerHTML = on ? '<rect x="4" y="4" width="10" height="10" rx="1.5" fill="#ff4f00"></rect>' : '<path d="M5 3 L15 9 L5 15 Z" fill="#ff4f00"></path>';
  $('startHint').hidden = on;
}
$('playBtn').addEventListener('click', () => setPlaying(!state.playing));

// world change: smooth if playing, immediate if stopped
$('worldBtn').addEventListener('click', () => {
  const cur = seq.pendingWorld || (seq.trans ? seq.trans.to.world : seq.worldKey);
  const nextKey = WORLD_KEYS[(WORLD_KEYS.indexOf(cur) + 1) % WORLD_KEYS.length];
  if (state.playing) {
    if (seq.trans) { seq.trans.to = genSong(nextKey, seq.song); seq.ramp = { from: seq.bpm, to: seq.trans.to.bpm, steps: (seq.trans.bars - seq.trans.bar) * 16, pos: 0 }; }
    else seq.pendingWorld = nextKey;
  } else {
    seq.worldKey = nextKey;
    seq.song = genSong(nextKey, null); seq.song.num = 1;
    seq.plan = makePlan(); seq.sec = 0; seq.secBar = -1; seq.songBar = -1; seq.step16 = 0; seq.songTime = 0;
    seq.bpm = seq.song.bpm; seq.ramp = null;
    applySongSound(seq.song);
  }
  ui.dirty = true;
});

// NEXT: wind the current song down and bring in the next one (tap again during the outro = cut now)
$('nextBtn').addEventListener('click', () => {
  if (!state.playing) {
    seq.song = genSong(seq.worldKey, seq.song);
    seq.plan = makePlan(); seq.sec = 0; seq.secBar = -1; seq.songBar = -1; seq.step16 = 0; seq.songTime = 0;
    seq.bpm = seq.song.bpm; seq.ramp = null;
    applySongSound(seq.song);
  } else if (seq.trans) {
    return;
  } else if (seq.plan[seq.sec].name === 'OUTRO') {
    seq.skipNow = true;
  } else {
    seq.nextReq = true; seq.nextByUser = true;
  }
  ui.dirty = true;
});

function setVoice(v) {
  state.voice = v;
  if (v !== 'AUTO') state.lastVoice = v;
  document.querySelectorAll('.key').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.voice === v)));
  $('voiceName').textContent = v;
  $('yLabel').textContent = { DRUMS: '↑ DRUCK · DRIVE + HALL', BASS: '↑ KLANG · FILTER + GRIT', SYNTH: '↑ HELL · FILTER + ECHO', NOISE: '↑ DICHTE · METALL + RAUM', AUTO: '↑ ENERGIE · ALLE STIMMEN · LOSLASSEN = AUTOPILOT' }[v];
  $('lblA').firstChild.textContent = { DRUMS: 'LAYER', BASS: 'CUT', SYNTH: 'TONE', NOISE: 'DENS', AUTO: 'ENERGY' }[v];
  $('lblB').firstChild.textContent = { DRUMS: 'DRIVE', BASS: 'GRIT', SYNTH: 'MODEL', NOISE: 'MODEL', AUTO: 'DRUMS' }[v];
  renderSound();
}
const sv = () => (state.voice === 'AUTO' ? state.lastVoice : state.voice);
document.querySelectorAll('.key').forEach((k) => k.addEventListener('click', () => setVoice(k.dataset.voice)));

// mode: FELD / SOUND
function setMode(m) {
  state.mode = m;
  $('modePlay').setAttribute('aria-pressed', String(m === 'PLAY'));
  $('modeSound').setAttribute('aria-pressed', String(m === 'SOUND'));
  $('modeSet').setAttribute('aria-pressed', String(m === 'SET'));
  $('modeVox').setAttribute('aria-pressed', String(m === 'VOX'));
  fieldEl.hidden = m !== 'PLAY';
  $('sound').hidden = m !== 'SOUND';
  $('set').hidden = m !== 'SET';
  $('vox').hidden = m !== 'VOX';
  if (m === 'SET' && typeof renderRecList === 'function') renderRecList();
  if (m === 'PLAY') requestAnimationFrame(resize);
  renderSound();
}
$('modePlay').addEventListener('click', () => setMode('PLAY'));
$('modeSound').addEventListener('click', () => setMode('SOUND'));
$('modeSet').addEventListener('click', () => setMode('SET'));
$('modeVox').addEventListener('click', () => setMode('VOX'));

// ---------------------------------------------------------- SOUND view
const knobEls = {};
const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
function buildKnobs() {
  const wrap = $('knobs');
  KNOBS.forEach((key, i) => {
    const tile = document.createElement('div');
    tile.className = 'knob'; tile.setAttribute('role', 'slider'); tile.tabIndex = 0;
    tile.setAttribute('aria-valuemin', '0'); tile.setAttribute('aria-valuemax', '100');
    const svg = svgEl('svg', { viewBox: '0 0 120 120', 'aria-hidden': 'true' });
    svg.appendChild(svgEl('circle', { cx: 60, cy: 60, r: 50, fill: 'none', stroke: '#2b2b2b', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-dasharray': '235.6 314.2', transform: 'rotate(135 60 60)' }));
    const arc = svgEl('circle', { cx: 60, cy: 60, r: 50, fill: 'none', stroke: '#f2f0eb', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-dasharray': '0 314.2', transform: 'rotate(135 60 60)' });
    svg.appendChild(arc);
    svg.appendChild(svgEl('circle', { cx: 60, cy: 60, r: 36, fill: '#222222', stroke: '#0a0a0a', 'stroke-width': 2 }));
    svg.appendChild(svgEl('circle', { cx: 60, cy: 60, r: 33, fill: 'none', stroke: 'rgba(255,255,255,0.05)' }));
    const g = svgEl('g', {});
    g.appendChild(svgEl('line', { x1: 60, y1: 30, x2: 60, y2: 42, stroke: '#f2f0eb', 'stroke-width': 3, 'stroke-linecap': 'round' }));
    svg.appendChild(g);
    const n = document.createElement('div'); n.className = 'n'; n.textContent = key.toUpperCase();
    const d = document.createElement('div'); d.className = 'd';
    tile.append(svg, n, d);
    wrap.appendChild(tile);
    knobEls[key] = { tile, arc, g, d, n };

    let startY = 0, startX = 0, startV = 0, lastTap = 0;
    tile.addEventListener('pointerdown', (e) => {
      tile.setPointerCapture(e.pointerId);
      startY = e.clientY; startX = e.clientX; startV = sound[sv()][key];
      tile.classList.add('active');
      const now = performance.now();
      if (now - lastTap < 300) { setKnob(key, DEFAULT_SOUND[sv()][key]); }
      lastTap = now;
    });
    tile.addEventListener('pointermove', (e) => {
      if (!tile.hasPointerCapture(e.pointerId)) return;
      setKnob(key, startV + ((startY - e.clientY) + (e.clientX - startX)) / 220);
    });
    const up = () => tile.classList.remove('active');
    tile.addEventListener('pointerup', up); tile.addEventListener('pointercancel', up);
    tile.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 0.05 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -0.05 : 0;
      if (d) { setKnob(key, sound[sv()][key] + d); e.preventDefault(); }
    });
  });
}
function setKnob(key, v) {
  sound[sv()][key] = clamp(v, 0, 1);
  locked[sv()] = true;
  renderSound();
}
function buildModels() {
  const wrap = $('models');
  for (let i = 0; i < 3; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.addEventListener('click', () => {
      sound[sv()].model = i; locked[sv()] = true; renderSound();
      if (A) A.preview(sv());
    });
    wrap.appendChild(b);
  }
}
function renderSound() {
  const v = sv(), S = sound[v];
  $('sndVoice').textContent = v;
  $('sndLock').textContent = locked[v] ? 'MANUELL · BLEIBT BEI SONGWECHSEL' : 'AUTO · WECHSELT MIT DEM SONG';
  [...$('models').children].forEach((b, i) => { b.textContent = MODELS[v][i]; b.setAttribute('aria-pressed', String(S.model === i)); });
  KNOBS.forEach((key, i) => {
    const k = knobEls[key], val = S[key];
    k.arc.setAttribute('stroke-dasharray', `${(235.6 * val).toFixed(1)} 314.2`);
    k.arc.setAttribute('stroke', k.tile.classList.contains('active') ? ACC : '#f2f0eb');
    k.g.setAttribute('transform', `rotate(${(225 + val * 270) % 360} 60 60)`);
    k.d.textContent = KNOB_HELP[v][i] + ' · ' + Math.round(val * 100);
    k.tile.setAttribute('aria-label', key + ' ' + v);
    k.tile.setAttribute('aria-valuenow', String(Math.round(val * 100)));
  });
}
ui.renderSound = renderSound;
buildKnobs(); buildModels();

// ---------------------------------------------------------- evolve ribbon
const ribbon = $('ribbon');
function setEvolve(x) {
  state.evolve = clamp(x, 0, 1);
  const pc = Math.round(state.evolve * 100);
  $('evoVal').textContent = pc + '%';
  $('evoFill').style.width = pc + '%';
  $('evoThumb').style.left = pc + '%';
  ribbon.setAttribute('aria-valuenow', String(pc));
}
function ribbonAt(e) { const r = ribbon.querySelector('.track').getBoundingClientRect(); setEvolve((e.clientX - r.left) / r.width); }
ribbon.addEventListener('pointerdown', (e) => { ribbon.setPointerCapture(e.pointerId); ribbonAt(e); });
ribbon.addEventListener('pointermove', (e) => { if (ribbon.hasPointerCapture(e.pointerId)) ribbonAt(e); });
ribbon.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { setEvolve(state.evolve + 0.05); e.preventDefault(); }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { setEvolve(state.evolve - 0.05); e.preventDefault(); }
});
setEvolve(0.4);

// ---------------------------------------------------------- field
let fw = 0, fh = 0, dpr = 1;
function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  const r = fieldEl.getBoundingClientRect();
  fw = r.width; fh = r.height;
  fc.width = Math.max(1, Math.round(fw * dpr)); fc.height = Math.max(1, Math.round(fh * dpr));
  const sr = scope.getBoundingClientRect();
  scope.width = Math.max(1, Math.round(sr.width * dpr)); scope.height = Math.max(1, Math.round(sr.height * dpr));
}
addEventListener('resize', resize);
new ResizeObserver(resize).observe(fieldEl);
resize();

const PAD_B = 26;
let finger = null;
const trail = [];
const flashes = [];
const laneFromX = (x) => clamp(Math.floor((x / fw) * LANES), 0, LANES - 1);
const yVal = (y) => clamp(1 - y / (fh - PAD_B), 0, 1);

function fieldInput(e) {
  const r = fieldEl.getBoundingClientRect();
  const x = clamp(e.clientX - r.left, 0, fw), y = clamp(e.clientY - r.top, 0, fh - PAD_B);
  const lane = laneFromX(x);
  finger.x = x; finger.y = y;
  const yv = yVal(y);
  state.vals[state.voice] = yv;
  if (state.voice === 'AUTO') {
    state.vals.DRUMS = 0.2 + yv * 0.6; state.vals.BASS = 0.15 + yv * 0.75; state.vals.SYNTH = 0.25 + yv * 0.65; state.vals.NOISE = yv;
    state.auto.y = state.auto.ty = yv;
  }
  if (state.voice === 'BASS' || state.voice === 'SYNTH' || state.voice === 'AUTO') state.home = lane;
  if (!state.touch || state.touch.lane !== lane || state.touch.voice !== state.voice) {
    state.touch = { voice: state.voice, lane, changed: true, y: yv };
  }
  state.touch.y = yv;
  trail.push({ x, y, lane, t: performance.now() });
}
fieldEl.addEventListener('pointerdown', (e) => {
  if (finger) return;
  fieldEl.setPointerCapture(e.pointerId);
  if (!state.playing) setPlaying(true);
  finger = { id: e.pointerId, x: 0, y: 0 };
  fieldInput(e);
  A.noteOn(state.voice);
});
fieldEl.addEventListener('pointermove', (e) => { if (finger && e.pointerId === finger.id) fieldInput(e); });
function fieldUp(e) {
  if (!finger || e.pointerId !== finger.id) return;
  if (A) A.noteOff(state.touch ? state.touch.voice : state.voice);
  finger = null;
  state.touch = null;
}
fieldEl.addEventListener('pointerup', fieldUp);
fieldEl.addEventListener('pointercancel', fieldUp);

// ---------------------------------------------------------- display + drawing
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function renderSongbar() {
  const bar = $('songbar');
  bar.innerHTML = '';
  for (const s of seq.plan) {
    const span = document.createElement('span');
    span.style.flex = String(s.bars);
    span.appendChild(document.createElement('i'));
    bar.appendChild(span);
  }
  ui.planRef = seq.plan;
}
function renderDisplay() {
  const song = seq.song;
  const w = WORLDS[seq.worldKey];
  if (seq.trans || seq.pendingWorld) {
    const to = seq.trans ? WORLDS[seq.trans.to.world] : WORLDS[seq.pendingWorld];
    $('worldName').innerHTML = `${w.id} <span class="to">→ ${to.id} ${to.name}</span>`;
  } else {
    $('worldName').textContent = `${w.id} · ${w.name}`;
  }
  $('tempo').textContent = `${Math.round(seq.bpm)} BPM · ${keyName(song.root)} MIN`;
  const dnaW = seq.trans ? WORLDS[seq.trans.to.world] : seq.pendingWorld ? WORLDS[seq.pendingWorld] : w;
  $('dna').textContent = dnaW.dna;
  const nb = $('nextBtn');
  const inOutro = !seq.trans && seq.plan[seq.sec] && seq.plan[seq.sec].name === 'OUTRO';
  nb.classList.toggle('armed', seq.nextReq || seq.skipNow || (inOutro && seq.nextByUser));
  nb.textContent = seq.skipNow ? 'GLEICH ▸▸' : inOutro ? 'JETZT ▸▸' : 'NEXT ▸▸';
  $('songNum').textContent = String(song.num).padStart(2, '0');
  $('secName').textContent = seq.trans ? 'ÜBERGANG' : (seq.plan[seq.sec] ? seq.plan[seq.sec].name : 'INTRO');
  if (ui.planRef !== seq.plan) renderSongbar();
  const spans = [...$('songbar').children];
  spans.forEach((s, i) => {
    s.classList.toggle('done', i < seq.sec);
    const fill = s.firstChild;
    fill.style.width = i === seq.sec ? `${clamp((seq.secBar + 1) / seq.plan[i].bars, 0, 1) * 100}%` : '0%';
  });
  const total = seq.plan.reduce((a, s) => a + s.bars, 0) * (60 / seq.bpm) * 4;
  $('songTime').textContent = `${fmt(seq.songTime)} / ${fmt(total)}`;
  $('barVal').textContent = Math.max(0, seq.songBar + 1);
}

let curStep = -1, pulse = 0, frameCount = 0;
const ledHit = { DRUMS: 0, BASS: 0, SYNTH: 0, NOISE: 0 };
function draw() {
  requestAnimationFrame(draw);
  const now = performance.now();
  if (A && A.running) {
    const at = A.ac.currentTime;
    while (A.stepQueue.length && A.stepQueue[0].time <= at) {
      const s = A.stepQueue.shift();
      curStep = s.step;
      if (s.kick) pulse = 1;
    }
    while (A.events.length && A.events[0].time <= at) {
      const ev = A.events.shift();
      ledHit[ev.voice] = 1;
      if (ev.voice === state.voice) flashes.push({ lane: ev.lane, t: now, vel: ev.vel, y: finger ? finger.y : null });
    }
    if (frameCount % 4 === 0) A.update();
  }
  frameCount++;
  pulse *= 0.9;
  $('beatLed').classList.toggle('on', pulse > 0.4);
  for (const v of VOICES) { ledHit[v] *= 0.85; keyLeds[v].classList.toggle('hit', ledHit[v] > 0.3); }
  stepSpans.forEach((s, i) => s.classList.toggle('on', i === curStep));
  if (frameCount % 6 === 0 || ui.dirty) { renderDisplay(); ui.dirty = false; }

  if (state.voice === 'AUTO' && !state.touch && state.playing) {
    const a = state.auto;
    a.y += (a.ty - a.y) * 0.015;
    state.vals.AUTO = a.y;
    state.vals.DRUMS = 0.2 + a.y * 0.6; state.vals.BASS = 0.15 + a.y * 0.75; state.vals.SYNTH = 0.25 + a.y * 0.65; state.vals.NOISE = a.y * 0.8;
  }
  const v = state.vals[state.voice];
  const root = seq.song.root;
  const lane = state.touch ? state.touch.lane : state.home;
  $('vNote').textContent = state.voice === 'DRUMS' ? (state.touch ? DRUM_LABELS[lane] : 'AUTO') : degName(lane, root);
  $('vA').textContent = state.voice === 'DRUMS' && state.touch ? lane + 1 : Math.round(v * 100);
  $('vB').textContent = state.voice === 'AUTO' ? DRUM_LABELS[Math.round(v * 7)] : state.voice === 'DRUMS' ? Math.round(v * 100) : state.voice === 'BASS' ? Math.round((sound.BASS.grit * 0.7 + v * 0.4) * 100) : MODELS[state.voice][sound[state.voice].model];

  if (state.mode === 'PLAY') drawField(now);
  if (frameCount % 15 === 0) {
    const vs = $('voxStatus');
    if (performance.now() < voxBusyUntil) vs.innerHTML = '<span class="live">● SPRICHT</span>'; else vs.textContent = 'BEREIT';
    const st = $('recStatus');
    if (REC.active) { st.innerHTML = `<span class="live">● REC ${fmt(REC.frames / REC.sr)} · SONG ${String(REC.index).padStart(2, '0')}</span>`; }
    else st.textContent = REC.pendingSet ? 'SPEICHERT …' : 'BEREIT';
  }
  drawScope();
}

function drawField(now) {
  const c = fctx;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, fw, fh);
  const lw = fw / LANES, h = fh - PAD_B;
  const root = seq.song.root;
  for (let i = 0; i < LANES; i++) {
    const x = i * lw;
    const active = state.touch && state.touch.lane === i;
    const home = !state.touch && state.voice !== 'DRUMS' && i === state.home;
    if (active || home) { c.fillStyle = active ? 'rgba(255,79,0,0.10)' : 'rgba(242,240,235,0.035)'; c.fillRect(x, 0, lw, h); }
    if (i > 0) { c.fillStyle = 'rgba(242,240,235,0.06)'; c.fillRect(Math.round(x), 0, 1, h); }
    c.font = '500 9px "IBM Plex Mono", monospace';
    c.textAlign = 'center';
    c.fillStyle = active ? ACC : i === 0 || i === 7 ? '#c9c6bf' : '#8e8c87';
    c.fillText(state.voice === 'DRUMS' ? DRUM_LABELS[i] : degName(i, root), x + lw / 2, fh - 10);
  }
  c.fillStyle = 'rgba(242,240,235,0.04)';
  for (let k = 1; k < 4; k++) c.fillRect(0, Math.round((h * k) / 4), fw, 1);
  const vy = (1 - state.vals[state.voice]) * h;
  c.setLineDash([2, 6]); c.strokeStyle = 'rgba(242,240,235,0.25)';
  c.beginPath(); c.moveTo(0, vy); c.lineTo(fw, vy); c.stroke(); c.setLineDash([]);
  c.fillStyle = `rgba(255,79,0,${0.15 + pulse * 0.6})`;
  c.fillRect(0, h - 2, fw * ((curStep + 1) / 16), 2);

  while (trail.length && now - trail[0].t > 1600) trail.shift();
  if (trail.length > 1) {
    c.lineWidth = 1.5; c.setLineDash([3, 5]); c.strokeStyle = 'rgba(242,240,235,0.28)';
    c.beginPath(); trail.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.stroke();
    c.setLineDash([]); c.lineWidth = 3; c.lineJoin = 'round'; c.strokeStyle = 'rgba(255,79,0,0.7)';
    c.beginPath();
    trail.forEach((p, i) => {
      const qx = p.lane * lw + lw / 2;
      if (!i) c.moveTo(qx, p.y);
      else { const pq = trail[i - 1].lane * lw + lw / 2; if (pq !== qx) c.lineTo(pq, p.y); c.lineTo(qx, p.y); }
    });
    c.stroke();
  }
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i];
    const age = (now - f.t) / 600;
    if (age > 1) { flashes.splice(i, 1); continue; }
    const x = f.lane * lw + lw / 2;
    const y = f.y != null ? f.y : (1 - state.vals[state.voice]) * h;
    const r = 8 + age * (reduceMotion ? 16 : 46);
    c.strokeStyle = `rgba(255,79,0,${(1 - age) * (0.35 + (f.vel || 1) * 0.45)})`;
    c.lineWidth = 2;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
  }
  if (!finger && state.voice === 'AUTO' && state.playing) {
    const gx = state.home * lw + lw / 2, gy = (1 - state.auto.y) * h;
    c.strokeStyle = 'rgba(255,79,0,0.55)'; c.lineWidth = 1.5; c.setLineDash([3, 4]);
    c.beginPath(); c.arc(gx, gy, 16 + pulse * 6, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    c.fillStyle = 'rgba(255,79,0,0.6)'; c.beginPath(); c.arc(gx, gy, 5, 0, Math.PI * 2); c.fill();
    c.font = '500 9px "IBM Plex Mono", monospace'; c.textAlign = 'center'; c.fillStyle = '#8e8c87';
    c.fillText('AUTOPILOT', gx, gy - 26);
  }
  if (finger) {
    const ln = laneFromX(finger.x), qx = ln * lw + lw / 2;
    c.fillStyle = 'rgba(255,79,0,0.12)'; c.beginPath(); c.arc(qx, finger.y, 34, 0, Math.PI * 2); c.fill();
    c.fillStyle = ACC; c.beginPath(); c.arc(qx, finger.y, 11, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(242,240,235,0.5)'; c.lineWidth = 1.5; c.beginPath(); c.arc(finger.x, finger.y, 20, 0, Math.PI * 2); c.stroke();
    const label = (state.voice === 'DRUMS' ? DRUM_LABELS[ln] : degName(ln, root)) + ' · ' + Math.round(state.vals[state.voice] * 100);
    c.font = '500 10px "IBM Plex Mono", monospace';
    const tw = c.measureText(label).width + 14;
    const cx = clamp(qx - tw / 2, 6, fw - tw - 6);
    let cy = finger.y - 58; if (cy < 6) cy = finger.y + 44;
    c.fillStyle = ACC; c.beginPath(); if (c.roundRect) c.roundRect(cx, cy, tw, 20, 6); else c.rect(cx, cy, tw, 20); c.fill();
    c.fillStyle = '#070707'; c.textAlign = 'left'; c.fillText(label, cx + 7, cy + 14);
  }
}

const scopeBuf = new Uint8Array(1024);
function drawScope() {
  const c = sctx, w = scope.width, h = scope.height;
  c.clearRect(0, 0, w, h);
  c.strokeStyle = ACC; c.lineWidth = 1.2 * dpr;
  c.beginPath();
  if (A && A.running) {
    A.analyser.getByteTimeDomainData(scopeBuf);
    const n = 512;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * w;
      const y = h / 2 + ((scopeBuf[i] - 128) / 128) * (h * 0.45);
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
    }
  } else { c.moveTo(0, h / 2); c.lineTo(w, h / 2); }
  c.stroke();
}

// ---------------------------------------------------------- VOX: computer voice for set start and transitions
const VOX_MODELS = ['METALL', 'VERZERRT', 'FUNK'];
const VOX_SUGGEST = [
  'Willkommen im Maschinenraum', 'System online', 'Field eins aktiviert', 'Nächste Übertragung', 'Neues Signal',
  'Keep moving', 'Body music', 'Welcome to the machine', 'Berlin. Jetzt.', 'Der Bass übernimmt',
  'Kein Schlaf bis Montag', 'Access granted', 'Daten werden geladen', 'Wir sind die Maschine',
];
const vox = { model: 0, pitch: 0.35, grit: 0.5, metal: 0.6, space: 0.5, intro: true, trans: true, introText: '', transText: '', idx: 0, cache: new Map() };
try { Object.assign(vox, JSON.parse(localStorage.getItem('field1.vox') || '{}')); } catch (e) { /* storage blocked */ }
vox.cache = new Map();
if (vox.introText) $('voxIntro').value = vox.introText;
if (vox.transText) $('voxTrans').value = vox.transText;
function saveVox() {
  vox.introText = $('voxIntro').value; vox.transText = $('voxTrans').value;
  try { const { cache, ...plain } = vox; localStorage.setItem('field1.vox', JSON.stringify(plain)); } catch (e) { /* storage blocked */ }
}
const voxPitchHz = () => 55 + vox.pitch * 110;
async function voxRender(text) {
  const key = text + '|' + Math.round(voxPitchHz());
  if (vox.cache.has(key)) return vox.cache.get(key);
  if (!window.F1Voice) return null;
  const buf = await window.F1Voice.render(text, { pitch: voxPitchHz(), speed: 0.95 });
  if (vox.cache.size > 20) vox.cache.clear();
  vox.cache.set(key, buf);
  return buf;
}
function applyVox() { if (A) A.voiceModel(vox.model, vox.grit, vox.metal, vox.space); }
let voxBusyUntil = 0;
async function voxSay(text, when) {
  text = (text || '').trim();
  if (!text) return;
  ensureAudio();
  applyVox();
  A.ac.resume();
  const buf = await voxRender(text);
  if (!buf) return;
  let t = typeof when === 'function' ? when() : when;
  if (!t || t < A.ac.currentTime + 0.02) t = state.playing ? A.nextBeatTime() : A.ac.currentTime + 0.05;
  const dur = A.speak(buf, t);
  voxBusyUntil = performance.now() + (t - A.ac.currentTime + dur) * 1000;
}
const transPhrases = () => $('voxTrans').value.split('/').map((x) => x.trim()).filter(Boolean);
function nextTransPhrase() { const l = transPhrases(); if (!l.length) return ''; const p = l[vox.idx % l.length]; vox.idx++; return p; }
// pre-render the next transition line during the outro so it lands exactly on the new song
function prepareTransition() { if (!vox.trans) return; const l = transPhrases(); if (l.length) voxRender(l[vox.idx % l.length]); }

function buildVox() {
  const chips = $('voxChips');
  for (const t of VOX_SUGGEST) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = t.toUpperCase();
    b.addEventListener('click', () => { $('voxText').value = t; voxSay(t); });
    chips.appendChild(b);
  }
  const models = $('voxModels');
  VOX_MODELS.forEach((name, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = name;
    b.addEventListener('click', () => { vox.model = i; saveVox(); renderVox(); voxSay($('voxText').value || 'System online'); });
    models.appendChild(b);
  });
  const KN = [['pitch', 'PITCH', 'Tonhöhe'], ['grit', 'GRIT', 'Verzerrung'], ['metal', 'METAL', 'Ringmod + Kamm'], ['space', 'SPACE', 'Echo + Hall']];
  for (const [key, label, help] of KN) makeKnob($('voxKnobs'), {
    label, help, get: () => vox[key], set: (x) => { vox[key] = x; if (key === 'pitch') vox.cache.clear(); saveVox(); applyVox(); },
    def: { pitch: 0.35, grit: 0.5, metal: 0.6, space: 0.5 }[key],
  });
  $('voxSay').addEventListener('click', () => voxSay($('voxText').value));
  $('voxText').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); voxSay($('voxText').value); } });
  $('voxIntroOn').addEventListener('click', () => { vox.intro = !vox.intro; saveVox(); renderVox(); });
  $('voxTransOn').addEventListener('click', () => { vox.trans = !vox.trans; saveVox(); renderVox(); });
  $('voxIntro').addEventListener('change', saveVox);
  $('voxTrans').addEventListener('change', () => { saveVox(); vox.cache.clear(); });
  renderVox();
}
function renderVox() {
  [...$('voxModels').children].forEach((b, i) => b.setAttribute('aria-pressed', String(vox.model === i)));
  for (const [id, on] of [['voxIntroOn', vox.intro], ['voxTransOn', vox.trans]]) { $(id).setAttribute('aria-pressed', String(on)); $(id).textContent = on ? 'AN' : 'AUS'; }
  for (const k of voxKnobs) k.render();
}
const voxKnobs = [];
function makeKnob(wrap, o) {
  const tile = document.createElement('div');
  tile.className = 'knob'; tile.setAttribute('role', 'slider'); tile.tabIndex = 0;
  tile.setAttribute('aria-label', o.label); tile.setAttribute('aria-valuemin', '0'); tile.setAttribute('aria-valuemax', '100');
  const svg = svgEl('svg', { viewBox: '0 0 120 120', 'aria-hidden': 'true' });
  svg.appendChild(svgEl('circle', { cx: 60, cy: 60, r: 50, fill: 'none', stroke: '#2b2b2b', 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-dasharray': '235.6 314.2', transform: 'rotate(135 60 60)' }));
  const arc = svgEl('circle', { cx: 60, cy: 60, r: 50, fill: 'none', stroke: '#f2f0eb', 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-dasharray': '0 314.2', transform: 'rotate(135 60 60)' });
  svg.appendChild(arc);
  svg.appendChild(svgEl('circle', { cx: 60, cy: 60, r: 34, fill: '#222222', stroke: '#0a0a0a', 'stroke-width': 2 }));
  const g = svgEl('g', {}); g.appendChild(svgEl('line', { x1: 60, y1: 30, x2: 60, y2: 44, stroke: '#f2f0eb', 'stroke-width': 4, 'stroke-linecap': 'round' })); svg.appendChild(g);
  const n = document.createElement('div'); n.className = 'n'; n.textContent = o.label;
  const d = document.createElement('div'); d.className = 'd';
  tile.append(svg, n, d); wrap.appendChild(tile);
  const k = {
    render() {
      const val = o.get();
      arc.setAttribute('stroke-dasharray', `${(235.6 * val).toFixed(1)} 314.2`);
      arc.setAttribute('stroke', tile.classList.contains('active') ? ACC : '#f2f0eb');
      g.setAttribute('transform', `rotate(${(225 + val * 270) % 360} 60 60)`);
      d.textContent = o.help + ' · ' + Math.round(val * 100);
      tile.setAttribute('aria-valuenow', String(Math.round(val * 100)));
    },
  };
  let sy = 0, sx = 0, sv0 = 0, lastTap = 0;
  const setV = (x) => { o.set(clamp(x, 0, 1)); k.render(); };
  tile.addEventListener('pointerdown', (e) => {
    tile.setPointerCapture(e.pointerId); sy = e.clientY; sx = e.clientX; sv0 = o.get(); tile.classList.add('active');
    const now = performance.now(); if (now - lastTap < 300) setV(o.def); lastTap = now; k.render();
  });
  tile.addEventListener('pointermove', (e) => { if (tile.hasPointerCapture(e.pointerId)) setV(sv0 + ((sy - e.clientY) + (e.clientX - sx)) / 200); });
  const up = () => { tile.classList.remove('active'); k.render(); };
  tile.addEventListener('pointerup', up); tile.addEventListener('pointercancel', up);
  tile.addEventListener('keydown', (e) => {
    const dd = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 0.05 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -0.05 : 0;
    if (dd) { setV(o.get() + dd); e.preventDefault(); }
  });
  voxKnobs.push(k);
  return k;
}
buildVox();

// ---------------------------------------------------------- volume
const volEl = $('vol');
let volume = 0.85;
try { const v = parseFloat(localStorage.getItem('field1.volume')); if (v >= 0 && v <= 1) volume = v; } catch (e) { /* storage blocked */ }
function setVolume(v) {
  volume = clamp(v, 0, 1);
  const pc = Math.round(volume * 100);
  $('volArc').setAttribute('stroke-dasharray', `${(216.8 * volume).toFixed(1)} 289`);
  $('volVal').textContent = pc;
  volEl.setAttribute('aria-valuenow', String(pc));
  if (A) A.setVolume(volume);
  try { localStorage.setItem('field1.volume', String(volume)); } catch (e) { /* storage blocked */ }
}
{
  let sy = 0, sx = 0, sv = 0;
  volEl.addEventListener('pointerdown', (e) => { volEl.setPointerCapture(e.pointerId); sy = e.clientY; sx = e.clientX; sv = volume; volEl.classList.add('active'); });
  volEl.addEventListener('pointermove', (e) => { if (volEl.hasPointerCapture(e.pointerId)) setVolume(sv + ((sy - e.clientY) + (e.clientX - sx)) / 160); });
  const up = () => volEl.classList.remove('active');
  volEl.addEventListener('pointerup', up); volEl.addEventListener('pointercancel', up);
  volEl.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 0.05 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -0.05 : 0;
    if (d) { setVolume(volume + d); e.preventDefault(); }
  });
}
setVolume(volume);

// ---------------------------------------------------------- recorder: one MP3 per song + the whole set as one seamless MP3
const LAME_LOCAL = new URL('vendor/lame.min.js', document.baseURI).href;
const LAME_CDN = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';
const KBPS = 256;
const WORKLET_SRC = `
// Recording tap with a look-ahead brickwall limiter (ceiling -1 dBFS) so the MP3s never clip.
class Tap extends AudioWorkletProcessor {
  constructor() { super(); this.n = 0; this.size = 4096; this.l = new Float32Array(this.size); this.r = new Float32Array(this.size); this.f0 = 0; this.on = true;
    this.LA = Math.round(sampleRate * 0.004); this.dl = new Float32Array(this.LA); this.dr = new Float32Array(this.LA); this.di = 0;
    this.env = 1; this.g = 1; this.ceil = 0.891; this.rel = Math.exp(-1 / (sampleRate * 0.15)); this.att = Math.exp(-1 / (sampleRate * 0.0008));
    this.port.onmessage = (e) => { if (e.data === 'stop') this.on = false; }; }
  process(inputs) {
    const inp = inputs[0];
    if (!this.on) return false;
    if (inp && inp.length) {
      const L = inp[0], Rr = inp[1] || inp[0];
      for (let i = 0; i < L.length; i++) {
        if (this.n === 0) this.f0 = currentFrame + i;
        const xl = L[i], xr = Rr[i];
        const pk = Math.max(Math.abs(xl), Math.abs(xr));
        const req = pk > this.ceil ? this.ceil / pk : 1;
        this.env = req < this.env ? req : req + (this.env - req) * this.rel;
        this.g = this.env + (this.g - this.env) * this.att;
        const ol = this.dl[this.di], or = this.dr[this.di];
        this.dl[this.di] = xl; this.dr[this.di] = xr; this.di = (this.di + 1) % this.LA;
        const c = this.ceil;
        this.l[this.n] = Math.max(-c, Math.min(c, ol * this.g)); this.r[this.n] = Math.max(-c, Math.min(c, or * this.g)); this.n++;
        if (this.n === this.size) {
          this.port.postMessage({ f0: this.f0, l: this.l, r: this.r }, [this.l.buffer, this.r.buffer]);
          this.l = new Float32Array(this.size); this.r = new Float32Array(this.size); this.n = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('field1-tap', Tap);`;
const WORKER_SRC = `
let lame = null, sr = 48000, kbps = 256, songEnc = null, setEnc = null, songParts = [], setParts = [], songSamples = 0, setSamples = 0;
const toI16 = (f) => { const o = new Int16Array(f.length); for (let i = 0; i < f.length; i++) { const v = Math.max(-1, Math.min(1, f[i])); o[i] = v < 0 ? v * 32768 : v * 32767; } return o; };
const push = (arr, buf) => { if (buf && buf.length) arr.push(new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))); };
const newSong = () => { songEnc = new lamejs.Mp3Encoder(2, sr, kbps); songParts = []; songSamples = 0; };
function finishSong(meta) {
  push(songParts, songEnc.flush());
  postMessage({ type: 'song', parts: songParts, samples: songSamples, meta }, songParts.map((p) => p.buffer));
  newSong();
}
onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') {
    try { importScripts(m.local); } catch (err) { importScripts(m.cdn); }
    sr = m.sr; kbps = m.kbps; newSong(); setEnc = new lamejs.Mp3Encoder(2, sr, kbps); setParts = []; setSamples = 0;
    postMessage({ type: 'ready' });
  } else if (m.type === 'pcm') {
    const l = toI16(m.l), r = toI16(m.r);
    push(songParts, songEnc.encodeBuffer(l, r)); push(setParts, setEnc.encodeBuffer(l, r));
    songSamples += l.length; setSamples += l.length;
  } else if (m.type === 'split') {
    finishSong(m.meta);
  } else if (m.type === 'stop') {
    finishSong(m.meta);
    push(setParts, setEnc.flush());
    postMessage({ type: 'set', parts: setParts, samples: setSamples, meta: m.setMeta }, setParts.map((p) => p.buffer));
  }
};`;

const REC = { active: false, node: null, worker: null, sr: 48000, startFrame: 0, markers: [], cur: null, index: 0, session: null, frames: 0, songFrames: 0, lock: null };
const recBtn = $('recBtn');

function songMeta(song, index) {
  const w = WORLDS[song.world];
  return { index, songNum: song.num, world: w.name, key: keyName(song.root) + ' MIN', bpm: Math.round(seq.bpm), session: REC.session };
}
function fileName(meta, kind) {
  const d = new Date(meta.session);
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  if (kind === 'set') return `CMPOSR_FIELD-1_${stamp}_SET.mp3`;
  return `CMPOSR_FIELD-1_${stamp}_${String(meta.index).padStart(2, '0')}_${meta.world}_${meta.key.replace(' ', '-')}_${meta.bpm}BPM.mp3`;
}

async function recStart() {
  if (!state.playing) setPlaying(true);
  const ac = A.ac;
  if (!ac.audioWorklet) { toast('Aufnahme wird von diesem Browser nicht unterstützt.'); return; }
  try {
    REC.sr = ac.sampleRate;
    if (!REC.moduleLoaded) {
      const url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
      await ac.audioWorklet.addModule(url);
      REC.moduleLoaded = true;
    }
    REC.worker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: 'application/javascript' })));
    await new Promise((res, rej) => {
      REC.worker.onmessage = (e) => { if (e.data.type === 'ready') res(); };
      REC.worker.onerror = (e) => rej(e);
      REC.worker.postMessage({ type: 'init', local: LAME_LOCAL, cdn: LAME_CDN, sr: REC.sr, kbps: KBPS });
    });
  } catch (err) {
    toast('MP3-Encoder konnte nicht geladen werden.');
    if (REC.worker) REC.worker.terminate();
    REC.worker = null;
    return;
  }
  REC.worker.onmessage = onWorkerMessage;
  REC.session = Date.now();
  REC.index = 1;
  REC.markers = [];
  REC.frames = 0;
  REC.cur = songMeta(seq.song, REC.index);
  REC.cur.partial = seq.songTime > 2;
  REC.node = new AudioWorkletNode(ac, 'field1-tap', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
  const sink = ac.createGain(); sink.gain.value = 0;
  A.recTap.connect(REC.node); REC.node.connect(sink); sink.connect(ac.destination);
  REC.sink = sink;
  REC.node.port.onmessage = (e) => onChunk(e.data.f0, e.data.l, e.data.r);
  REC.active = true;
  A.onSongStart = (t, song) => { REC.markers.push({ frame: Math.round(t * REC.sr), meta: songMeta(song, 0) }); };
  recBtn.setAttribute('aria-pressed', 'true');
  recBtn.setAttribute('aria-label', 'Aufnahme stoppen');
  REC.pendingSet = true;
  renderRecList();
  toast('Aufnahme läuft · jeder Song wird einzeln gespeichert');
}
function onChunk(f0, l, r) {
  if (!REC.active) return;
  let off = 0;
  const n = l.length;
  while (REC.markers.length && REC.markers[0].frame < f0 + n) {
    const cut = clamp(REC.markers[0].frame - f0, off, n);
    if (cut > off) sendPcm(l.subarray(off, cut), r.subarray(off, cut));
    const mk = REC.markers.shift();
    finishSegment();
    REC.index++;
    mk.meta.index = REC.index;
    REC.cur = mk.meta;
    off = cut;
  }
  if (off < n) sendPcm(l.subarray(off), r.subarray(off));
}
function sendPcm(l, r) {
  const lc = new Float32Array(l), rc = new Float32Array(r);
  REC.worker.postMessage({ type: 'pcm', l: lc, r: rc }, [lc.buffer, rc.buffer]);
  REC.frames += lc.length;
}
function finishSegment() {
  REC.worker.postMessage({ type: 'split', meta: REC.cur });
}
function recStop() {
  if (!REC.active) return;
  REC.active = false;
  A.onSongStart = null;
  try { REC.node.port.postMessage('stop'); A.recTap.disconnect(REC.node); REC.node.disconnect(); REC.sink.disconnect(); } catch (e) { /* already gone */ }
  REC.worker.postMessage({ type: 'stop', meta: REC.cur, setMeta: { session: REC.session, songs: REC.index } });
  recBtn.setAttribute('aria-pressed', 'false');
  recBtn.setAttribute('aria-label', 'Aufnahme starten');
  toast('Aufnahme beendet · Dateien unter SET');
}
recBtn.addEventListener('click', () => { ensureAudio(); if (REC.active) recStop(); else recStart(); });

// finished files arrive from the worker
const recFiles = [];   // { id, kind, name, meta, blob, seconds, url }
function onWorkerMessage(e) {
  const m = e.data;
  if (m.type !== 'song' && m.type !== 'set') return;
  const seconds = m.samples / REC.sr;
  if (m.type === 'set') { REC.pendingSet = false; if (REC.worker) { REC.worker.terminate(); REC.worker = null; } }
  if (seconds < 3) { renderRecList(); return; }
  const blob = new Blob(m.parts, { type: 'audio/mpeg' });
  const meta = m.meta;
  const rec = { kind: m.type, name: fileName(meta, m.type), meta, blob, seconds, created: Date.now() };
  dbPut(rec).then((id) => { rec.id = id; }).catch(() => {});
  recFiles.push(rec);
  renderRecList();
}

// persistence (IndexedDB) so recordings survive a reload
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    try {
      const req = indexedDB.open('field1', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('recs', { keyPath: 'id', autoIncrement: true });
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    } catch (err) { rej(err); }
  });
  return dbp;
}
function dbPut(rec) {
  return db().then((d) => new Promise((res, rej) => {
    const { url, ...plain } = rec;
    const tx = d.transaction('recs', 'readwrite'); const r = tx.objectStore('recs').add(plain);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
}
function dbAll() {
  return db().then((d) => new Promise((res, rej) => {
    const r = d.transaction('recs').objectStore('recs').getAll();
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
}
function dbClear() {
  return db().then((d) => new Promise((res) => { const tx = d.transaction('recs', 'readwrite'); tx.objectStore('recs').clear(); tx.oncomplete = () => res(); tx.onerror = () => res(); }));
}
dbAll().then((all) => { for (const r of all) recFiles.push(r); renderRecList(); }).catch(() => {});

// saving: share sheet on phones/tablets (saves to Files / Drive), download elsewhere
const isTouchDevice = /iPhone|iPad|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
async function saveFiles(list) {
  const files = list.map((r) => new File([r.blob], r.name, { type: r.blob.type || 'audio/mpeg' }));
  if (isTouchDevice && navigator.canShare && navigator.canShare({ files })) {
    try { await navigator.share({ files, title: 'CMPOSR FIELD-1' }); return; } catch (err) { if (err && err.name === 'AbortError') return; }
  }
  for (const f of files) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f); a.download = f.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    await new Promise((r) => setTimeout(r, 350));
  }
}
function latestSession() {
  const s = recFiles.reduce((m, r) => Math.max(m, r.meta.session || 0), 0);
  return recFiles.filter((r) => r.meta.session === s);
}
$('recSaveAll').addEventListener('click', () => {
  const list = latestSession().sort((a, b) => (a.kind === 'set') - (b.kind === 'set') || a.meta.index - b.meta.index);
  if (list.length) saveFiles(list);
});
$('recPlaylist').addEventListener('click', () => {
  const songs = latestSession().filter((r) => r.kind === 'song').sort((a, b) => a.meta.index - b.meta.index);
  if (!songs.length) return;
  const lines = ['#EXTM3U', ...songs.flatMap((r) => [`#EXTINF:${Math.round(r.seconds)},CMPOSR FIELD-1 - ${String(r.meta.index).padStart(2, '0')} ${r.meta.world} ${r.meta.key}`, r.name])];
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'audio/x-mpegurl' });
  const name = songs[0].name.replace(/_\d\d_.*$/, '_SET.m3u');
  saveFiles([{ blob, name }]);
});
$('recClear').addEventListener('click', (e) => {
  const b = e.currentTarget;
  if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'SICHER?'; setTimeout(() => { b.dataset.confirm = ''; b.textContent = 'LÖSCHEN'; }, 3000); return; }
  b.dataset.confirm = ''; b.textContent = 'LÖSCHEN';
  stopPreview();
  recFiles.length = 0;
  dbClear().then(renderRecList);
  renderRecList();
});

let previewAudio = null, previewRec = null;
function stopPreview() { if (previewAudio) { previewAudio.pause(); URL.revokeObjectURL(previewAudio.src); } previewAudio = null; previewRec = null; }
function togglePreview(rec) {
  if (previewRec === rec) { stopPreview(); renderRecList(); return; }
  stopPreview();
  previewAudio = new Audio(URL.createObjectURL(rec.blob));
  previewRec = rec;
  previewAudio.onended = () => { stopPreview(); renderRecList(); };
  previewAudio.play().catch(() => {});
  renderRecList();
}
const fmtDur = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const fmtMB = (b) => (b / 1048576).toFixed(1) + ' MB';
function renderRecList() {
  const wrap = $('recList');
  wrap.innerHTML = '';
  const sessions = [...new Set(recFiles.map((r) => r.meta.session))].sort((a, b) => b - a);
  if (REC.active && !sessions.includes(REC.session)) sessions.unshift(REC.session);
  for (const s of sessions) {
    const d = new Date(s);
    const h = document.createElement('div'); h.className = 'recsess';
    h.textContent = `SET · ${d.toLocaleDateString('de-DE')} ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
    wrap.appendChild(h);
    const items = recFiles.filter((r) => r.meta.session === s).sort((a, b) => (b.kind === 'set') - (a.kind === 'set') || a.meta.index - b.meta.index);
    for (const r of items) wrap.appendChild(recRow(r));
    if (s === REC.session && (REC.active || REC.pendingSet)) {
      const row = document.createElement('div'); row.className = 'recrow pending';
      row.innerHTML = `<span class="no">${REC.active ? String(REC.index).padStart(2, '0') : '··'}</span><span class="info"><b>${REC.active ? 'NIMMT AUF …' : 'SET WIRD ERSTELLT …'}</b><span>${REC.active ? 'wird beim Songwechsel gespeichert' : 'einen Moment'}</span></span>`;
      wrap.appendChild(row);
    }
  }
  $('recEmpty').hidden = recFiles.length > 0 || REC.active;
  const has = latestSession().length > 0;
  $('recSaveAll').disabled = !has; $('recPlaylist').disabled = !has; $('recClear').disabled = !recFiles.length;
}
function recRow(r) {
  const row = document.createElement('div');
  row.className = 'recrow' + (r.kind === 'set' ? ' setfile' : '');
  const no = document.createElement('span'); no.className = 'no'; no.textContent = r.kind === 'set' ? 'SET' : String(r.meta.index).padStart(2, '0');
  const info = document.createElement('span'); info.className = 'info';
  const b = document.createElement('b');
  b.textContent = r.kind === 'set' ? `KOMPLETTES SET · ${r.meta.songs} SONGS` : `${r.meta.world} · ${r.meta.key} · ${r.meta.bpm}${r.meta.partial ? ' · AB MITTE' : ''}`;
  const sp = document.createElement('span'); sp.textContent = `${fmtDur(r.seconds)} · ${fmtMB(r.blob.size)} · MP3`;
  info.append(b, sp);
  const play = document.createElement('button'); play.type = 'button';
  play.textContent = previewRec === r ? '■' : '▶'; play.className = previewRec === r ? 'on' : '';
  play.setAttribute('aria-label', previewRec === r ? 'Anhören stoppen' : 'Anhören');
  play.addEventListener('click', () => togglePreview(r));
  const save = document.createElement('button'); save.type = 'button'; save.textContent = '⇩';
  save.setAttribute('aria-label', 'Datei sichern');
  save.addEventListener('click', () => saveFiles([r]));
  row.append(no, info, play, save);
  return row;
}

let toastTimer = null;
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

// keep the screen awake while playing, so long sets are not cut off by auto-lock
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* not allowed here */ }
}

// keep audio alive when the app comes back to the foreground (iOS suspends it)
document.addEventListener('visibilitychange', () => { if (!document.hidden && A && state.playing) { A.ac.resume(); keepAwake(true); } });

setVoice('BASS');
renderSongbar();
renderDisplay();
draw();

// test hook (used by automated checks only)
window.__field1 = { seq, state, sound, REC, recFiles, jump(sec) { seq.sec = sec; seq.secBar = -1; } };
})();
