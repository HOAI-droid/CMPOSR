export const ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const SCALES = {
  MINOR: [0, 2, 3, 5, 7, 8, 10],
  PHRYG: [0, 1, 3, 5, 7, 8, 10],
  DORIAN: [0, 2, 3, 5, 7, 9, 10],
  HARM: [0, 2, 3, 5, 7, 8, 11],
};
export const SCALE_NAMES = Object.keys(SCALES);

// scale degree (can be negative / above 7) -> semitones
export function degreeToSemi(deg, scaleName) {
  const sc = SCALES[scaleName] || SCALES.MINOR;
  const oct = Math.floor(deg / sc.length);
  const idx = ((deg % sc.length) + sc.length) % sc.length;
  return sc[idx] + 12 * oct;
}

export function noteName(deg, root, scaleName) {
  const semi = degreeToSemi(deg, scaleName) + root;
  const oct = Math.floor(semi / 12);
  return ROOTS[((semi % 12) + 12) % 12] + (oct > 0 ? '+' : oct < 0 ? '-' : '');
}
