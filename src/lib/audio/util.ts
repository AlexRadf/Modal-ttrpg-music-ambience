/** FNV-1a. Turns an asset id into a stable seed so synthesised audio never drifts. */
export function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, and deterministic for a given seed. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Ramps a param without the clicks a bare setValue causes. Uses a linear ramp
 * from wherever the param actually is now, which keeps interrupted fades smooth.
 */
export function ramp(param: AudioParam, value: number, seconds: number, ctx: BaseAudioContext) {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  if (seconds <= 0) param.setValueAtTime(value, now);
  else param.linearRampToValueAtTime(value, now + seconds);
}

/**
 * Folds the tail of a buffer back over its head so `loop = true` has nothing to
 * click on. Costs `fadeSec` of length; the returned buffer is shorter.
 */
export function makeSeamless(ctx: BaseAudioContext, buffer: AudioBuffer, fadeSec: number): AudioBuffer {
  const rate = buffer.sampleRate;
  const fade = Math.min(Math.floor(fadeSec * rate), Math.floor(buffer.length / 3));
  if (fade <= 0) return buffer;

  const length = buffer.length - fade;
  const out = ctx.createBuffer(buffer.numberOfChannels, length, rate);

  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c);
    const dst = out.getChannelData(c);
    dst.set(src.subarray(0, length));
    for (let i = 0; i < fade; i++) {
      // equal-power crossfade of the discarded tail back onto the head
      const t = i / fade;
      const a = Math.cos((t * Math.PI) / 2);
      const b = Math.sin((t * Math.PI) / 2);
      dst[i] = dst[i] * b + src[length + i] * a;
    }
  }
  return out;
}

/**
 * Trims a rendered buffer back to an exact loop length, adding whatever spilled
 * past the end (note tails, decays) onto the head. Unlike `makeSeamless` this
 * preserves the length exactly, which musical loops need.
 */
export function wrapTail(ctx: BaseAudioContext, buffer: AudioBuffer, loopSeconds: number): AudioBuffer {
  const rate = buffer.sampleRate;
  const length = Math.min(Math.round(loopSeconds * rate), buffer.length);
  const spill = buffer.length - length;
  const out = ctx.createBuffer(buffer.numberOfChannels, length, rate);

  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c);
    const dst = out.getChannelData(c);
    dst.set(src.subarray(0, length));
    for (let i = 0; i < spill && i < length; i++) dst[i] += src[length + i];
  }
  return out;
}

const NOTES: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

/** Parses "G minor" into a root frequency and a scale. Falls back to A minor. */
export function parseKey(key?: string): { root: number; scale: number[] } {
  const m = /^\s*([A-G][#b]?)\s*(minor|major|min|maj)?/i.exec(key || "");
  const semitone = m ? NOTES[m[1].charAt(0).toUpperCase() + m[1].slice(1)] ?? 9 : 9;
  const major = m ? /^maj/i.test(m[2] || "") : false;
  // A2 = 110 Hz is a comfortable root for the low drone
  const root = 110 * Math.pow(2, ((semitone - 9 + 12) % 12) / 12);
  return { root, scale: major ? MAJOR : MINOR };
}

/** Frequency of a scale degree, where degree may run past an octave. */
export function degreeHz(root: number, scale: number[], degree: number): number {
  const octave = Math.floor(degree / scale.length);
  const step = ((degree % scale.length) + scale.length) % scale.length;
  return root * Math.pow(2, octave + scale[step] / 12);
}
