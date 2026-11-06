/* FIELD-1 voice: a small formant speech synthesiser.
 * German letter-to-sound rules, a monotone buzz source and three formant filters.
 * It is deliberately robotic; the metallic character is added later by the voice FX chain.
 * window.F1Voice.render(text, { pitch, speed }) -> Promise<AudioBuffer>
 */
(() => {
'use strict';

// vowel formants F1, F2, F3 (Hz)
const VOW = {
  a: [760, 1300, 2500], e: [400, 2150, 2750], E: [590, 1820, 2560], '@': [500, 1500, 2500],
  i: [280, 2280, 2950], I: [390, 1960, 2600], o: [410, 780, 2480], O: [590, 960, 2450],
  u: [300, 690, 2300], U: [390, 960, 2300], y: [280, 1760, 2200], Y: [390, 1620, 2220],
  2: [410, 1450, 2250], 6: [660, 1320, 2420],
};
// consonants: voiced buzz level (va), formant colour (f), noise band [lo, hi, level], duration (ms)
const CON = {
  m: { va: 0.45, f: [260, 1100, 2200], dur: 70 },
  n: { va: 0.45, f: [260, 1650, 2600], dur: 65 },
  N: { va: 0.42, f: [260, 2000, 2700], dur: 70 },
  l: { va: 0.55, f: [360, 1100, 2650], dur: 60 },
  R: { va: 0.45, f: [520, 1250, 2300], dur: 55, n: [700, 1700, 0.12] },
  j: { va: 0.5, f: [280, 2200, 2900], dur: 55 },
  v: { va: 0.3, f: [300, 1200, 2300], dur: 65, n: [1400, 5000, 0.2] },
  z: { va: 0.25, f: [300, 1500, 2500], dur: 85, n: [4500, 9000, 0.4] },
  f: { va: 0, dur: 90, n: [1500, 8000, 0.32] },
  s: { va: 0, dur: 100, n: [4500, 9500, 0.55] },
  S: { va: 0, dur: 105, n: [1900, 6000, 0.6] },
  C: { va: 0, dur: 95, n: [2800, 6800, 0.42] },
  x: { va: 0, dur: 95, n: [900, 2700, 0.4] },
  h: { va: 0, dur: 60, n: [500, 3200, 0.22] },
  p: { stop: true, va: 0, closure: 75, n: [400, 1900, 0.45] },
  t: { stop: true, va: 0, closure: 65, n: [3000, 7500, 0.55] },
  k: { stop: true, va: 0, closure: 75, n: [1400, 3600, 0.55] },
  b: { stop: true, va: 0.12, closure: 50, n: [400, 1900, 0.25] },
  d: { stop: true, va: 0.12, closure: 45, n: [2500, 6500, 0.3] },
  g: { stop: true, va: 0.12, closure: 55, n: [1300, 3300, 0.3] },
};

// words that do not follow German spelling (English club words, brand names)
const DICT = {
  welcome: 'wellkamm', to: 'tu', the: 'de', machine: 'maschien', system: 'sistem', online: 'onlain',
  body: 'boddi', music: 'mjusik', techno: 'tekno', next: 'nekst', transmission: 'tränsmischn',
  field: 'fiild', cmposr: 'kompouser', composer: 'kompouser', set: 'set', start: 'start', go: 'gou',
  are: 'ar', you: 'ju', ready: 'reddi', access: 'äkzess', granted: 'grentid', move: 'muuf',
  keep: 'kiip', moving: 'muuwing', no: 'nou', sleep: 'sliip', till: 'till', monday: 'mandei',
  berlin: 'berlin', club: 'klabb', sound: 'saund', drop: 'dropp', bass: 'bäis', rave: 'reiv',
  dance: 'dääns', night: 'nait', initiating: 'inischieiting', sequence: 'siekwens', deploying: 'diploiing',
  new: 'nju', pattern: 'pättern', signal: 'signal', lost: 'lost', we: 'wie', is: 'iss', this: 'diss',
  and: 'änd', of: 'ov', in: 'in', a: 'ä', control: 'kontroul', human: 'hjuman', robot: 'roubot',
  data: 'deita', loading: 'louding', error: 'ärror', power: 'pauer', up: 'app', down: 'daun',
};
const DIGITS = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'];

const isV = (ch) => !!ch && 'aeiouyäöü'.includes(ch);
const VMAP = { a: ['a', 'a'], e: ['e', 'E'], i: ['i', 'I'], o: ['o', 'O'], u: ['u', 'U'], y: ['y', 'Y'], ä: ['E', 'E'], ö: ['2', '2'], ü: ['y', 'Y'] };

function g2p(raw) {
  const word = DICT[raw] || raw;
  const out = [];
  const push = (...ps) => { for (const p of ps) out.push({ p }); };
  const vow = (p, long) => out.push({ p, v: true, long });
  let i = 0;
  while (i < word.length) {
    const rest = word.slice(i);
    const start = i === 0;
    const at = (k) => word[i + k] || '';
    if (rest.startsWith('tsch')) { push('t', 'S'); i += 4; continue; }
    if (rest.startsWith('sch')) { push('S'); i += 3; continue; }
    if (rest.startsWith('ch')) { const prev = word[i - 1]; push(start ? 'k' : prev && 'aou'.includes(prev) ? 'x' : 'C'); i += 2; continue; }
    if (rest.startsWith('ck')) { push('k'); i += 2; continue; }
    if (rest.startsWith('ph')) { push('f'); i += 2; continue; }
    if (rest.startsWith('pf')) { push('p', 'f'); i += 2; continue; }
    if (rest.startsWith('qu')) { push('k', 'v'); i += 2; continue; }
    if (rest.startsWith('th')) { push('t'); i += 2; continue; }
    if (rest.startsWith('ng')) { push('N'); i += 2; continue; }
    if (rest.startsWith('nk')) { push('N', 'k'); i += 2; continue; }
    if (rest.startsWith('tz')) { push('t', 's'); i += 2; continue; }
    if (rest.startsWith('ss')) { push('s'); i += 2; continue; }
    if (rest[0] === 'ß') { push('s'); i += 1; continue; }
    if (start && (rest.startsWith('sp') || rest.startsWith('st'))) { push('S', rest[1]); i += 2; continue; }
    if (/^(ei|ai|ay|ey)/.test(rest)) { vow('a', false); vow('I', false); i += 2; continue; }
    if (/^(eu|äu|oi)/.test(rest)) { vow('O', false); vow('Y', false); i += 2; continue; }
    if (rest.startsWith('au')) { vow('a', false); vow('U', false); i += 2; continue; }
    if (rest.startsWith('ie')) { vow('i', true); i += 2; continue; }
    if (rest === 'er' && i > 0) { vow('6', false); i += 2; continue; }
    if (rest === 'e' && i > 0) { vow('@', false); i += 1; continue; }
    if (rest === 'en' && i > 1) { vow('@', false); push('n'); i += 2; continue; }
    const ch = rest[0];
    if (isV(ch)) {
      let long;
      if (at(1) === ch || (at(1) === 'h' && !isV(at(2)))) { long = true; i += 2; }
      else {
        let j = i + 1, cons = 0;
        while (j < word.length && !isV(word[j])) { cons++; j++; }
        long = cons === 0 || (cons === 1 && j < word.length);
        i += 1;
      }
      vow(VMAP[ch][long ? 0 : 1], long);
      continue;
    }
    if (at(1) === ch) i++; // doubled consonant = one sound
    const nextV = isV(at(1));
    switch (ch) {
      case 's': push((start && nextV) || (i > 0 && isV(word[i - 1]) && nextV) ? 'z' : 's'); break;
      case 'z': push('t', 's'); break;
      case 'x': push('k', 's'); break;
      case 'v': push('f'); break;
      case 'w': push('v'); break;
      case 'c': if (at(1) === 'e' || at(1) === 'i') push('t', 's'); else push('k'); break;
      case 'r': push('R'); break;
      case 'h': if (nextV) push('h'); break;
      case 'b': case 'd': case 'g': push(i === word.length - 1 ? { b: 'p', d: 't', g: 'k' }[ch] : ch); break;
      default: if (CON[ch]) push(ch);
    }
    i++;
  }
  return out;
}

// text -> list of timed segments
function build(text, speed) {
  const clean = text.toLowerCase()
    .replace(/\d/g, (d) => ' ' + DIGITS[+d] + ' ')
    .replace(/[^a-zäöüß.,!?;:\- ]/g, ' ');
  const tokens = clean.match(/[a-zäöüß]+|[.,!?;:]/g) || [];
  const segs = [];
  const k = 1 / speed;
  let lastF = VOW['@'];
  for (const tok of tokens) {
    if (/[.,!?;:]/.test(tok)) { segs.push({ dur: (tok === ',' ? 0.17 : 0.32) * k, va: 0, f: lastF }); continue; }
    for (const ph of g2p(tok)) {
      if (ph.v) {
        const f = VOW[ph.p];
        const dur = (ph.p === '@' ? 0.065 : ph.long ? 0.155 : 0.09) * k;
        segs.push({ dur, va: 1, f });
        lastF = f;
        continue;
      }
      const c = CON[ph.p];
      if (!c) continue;
      if (c.stop) {
        segs.push({ dur: (c.closure / 1000) * k, va: c.va, f: lastF });
        segs.push({ dur: 0.018 * k, va: c.va, f: lastF, n: [c.n[0], c.n[1], c.n[2] * 1.4] });
        if (!c.va) segs.push({ dur: 0.025 * k, va: 0, f: lastF, n: [600, 3500, 0.15] });
      } else {
        segs.push({ dur: (c.dur / 1000) * k, va: c.va, f: c.f || lastF, n: c.n });
        if (c.f) lastF = c.f;
      }
    }
    segs.push({ dur: 0.045 * k, va: 0, f: lastF });
  }
  return segs;
}

async function render(text, opts = {}) {
  const pitch = opts.pitch || 88;
  const speed = opts.speed || 1;
  const sr = 24000;
  const segs = build(text, speed);
  if (!segs.length) return null;
  const total = segs.reduce((a, s) => a + s.dur, 0) + 0.35;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new OAC(1, Math.ceil(total * sr), sr);

  const src = ctx.createOscillator();
  src.type = 'sawtooth';
  src.frequency.value = pitch;
  const voiceG = ctx.createGain();
  voiceG.gain.value = 0;
  src.connect(voiceG);
  const sum = ctx.createGain();
  sum.gain.value = 1;
  const forms = [0, 1, 2].map((n) => {
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = [5, 9, 12][n];
    f.frequency.value = VOW['@'][n];
    const g = ctx.createGain();
    g.gain.value = [1.8, 1.6, 1.0][n];
    voiceG.connect(f); f.connect(g); g.connect(sum);
    return f;
  });
  const nb = ctx.createBuffer(1, sr, sr);
  { const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
  const nHP = ctx.createBiquadFilter(); nHP.type = 'highpass'; nHP.frequency.value = 2000;
  const nLP = ctx.createBiquadFilter(); nLP.type = 'lowpass'; nLP.frequency.value = 6000;
  const nG = ctx.createGain(); nG.gain.value = 0;
  ns.connect(nHP); nHP.connect(nLP); nLP.connect(nG); nG.connect(sum);
  sum.connect(ctx.destination);

  let t = 0.06;
  for (const s of segs) {
    const te = t + s.dur;
    const glide = Math.min(0.035, s.dur * 0.45);
    forms.forEach((f, n) => { f.frequency.linearRampToValueAtTime(s.f[n], t + glide); f.frequency.setValueAtTime(s.f[n], te); });
    voiceG.gain.linearRampToValueAtTime(s.va, t + Math.min(0.012, s.dur * 0.3));
    voiceG.gain.setValueAtTime(s.va, te);
    if (s.n) {
      nHP.frequency.setValueAtTime(s.n[0], t);
      nLP.frequency.setValueAtTime(s.n[1], t);
      nG.gain.linearRampToValueAtTime(s.n[2], t + Math.min(0.01, s.dur * 0.3));
      nG.gain.setValueAtTime(s.n[2], te);
    } else {
      nG.gain.linearRampToValueAtTime(0, t + 0.008);
      nG.gain.setValueAtTime(0, te);
    }
    t = te;
  }
  voiceG.gain.linearRampToValueAtTime(0, t + 0.04);
  nG.gain.linearRampToValueAtTime(0, t + 0.02);
  src.start(0); ns.start(0);
  const buf = await ctx.startRendering();
  const d = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  if (peak > 0) for (let i = 0; i < d.length; i++) d[i] *= 0.9 / peak;
  return buf;
}

window.F1Voice = { render, g2p };
})();
