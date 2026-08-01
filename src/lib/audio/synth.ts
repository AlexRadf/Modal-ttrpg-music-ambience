import type { MusicMode } from "../types";
import { degreeHz, hash, makeSeamless, parseKey, rng, wrapTail } from "./util";

/**
 * Procedural stand-ins for audio that has not been recorded yet.
 *
 * Everything here renders offline into a seamless loop, seeded off the asset id
 * so a given bed or stem sounds the same on every load. It exists so the console
 * is playable — and demoable — before a single file has been produced; point
 * `resolveSrc` at real audio and none of this runs.
 */

type Rand = () => number;

interface Voice {
  type?: OscillatorType;
  freq: number;
  at: number;
  dur: number;
  gain: number;
  attack?: number;
  release?: number;
  lp?: number;
  hp?: number;
  detune?: number;
  pan?: number;
  /** Slide to this frequency across the note. */
  glideTo?: number;
}

interface NoiseHit {
  at: number;
  dur: number;
  gain: number;
  attack?: number;
  lp?: number;
  hp?: number;
  q?: number;
  pan?: number;
}

function offline(seconds: number, sampleRate: number, channels = 2): OfflineAudioContext {
  return new OfflineAudioContext(channels, Math.max(1, Math.ceil(seconds * sampleRate)), sampleRate);
}

function noiseBuffer(ctx: BaseAudioContext, seconds: number, rand: Rand): AudioBuffer {
  const len = Math.ceil(seconds * ctx.sampleRate);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = rand() * 2 - 1;
    // one-pole smoothing tilts white towards pink, which sits better under music
    last = 0.94 * last + 0.06 * white;
    data[i] = white * 0.35 + last * 2.2;
  }
  return buf;
}

function pannedOut(ctx: BaseAudioContext, pan = 0): AudioNode {
  if (pan === 0 || typeof (ctx as AudioContext).createStereoPanner !== "function") return ctx.destination;
  const p = ctx.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  p.connect(ctx.destination);
  return p;
}

/** One enveloped oscillator note. */
function tone(ctx: BaseAudioContext, v: Voice) {
  const osc = ctx.createOscillator();
  osc.type = v.type || "sine";
  osc.frequency.setValueAtTime(v.freq, v.at);
  if (v.glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, v.glideTo), v.at + v.dur);
  if (v.detune) osc.detune.value = v.detune;

  const g = ctx.createGain();
  const attack = v.attack ?? 0.01;
  const release = v.release ?? Math.max(0.08, v.dur * 0.5);
  g.gain.setValueAtTime(0, v.at);
  g.gain.linearRampToValueAtTime(v.gain, v.at + attack);
  g.gain.setValueAtTime(v.gain, v.at + v.dur);
  g.gain.exponentialRampToValueAtTime(0.0001, v.at + v.dur + release);

  let node: AudioNode = g;
  if (v.lp) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = v.lp;
    node.connect(f);
    node = f;
  }
  if (v.hp) {
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = v.hp;
    node.connect(f);
    node = f;
  }

  osc.connect(g);
  node.connect(pannedOut(ctx, v.pan));
  osc.start(v.at);
  osc.stop(v.at + v.dur + release + 0.02);
}

/** One enveloped burst of noise — hats, crackle, rustle, surf. */
function noise(ctx: BaseAudioContext, buf: AudioBuffer, h: NoiseHit) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  // start from a random-ish offset so repeated hits are not identical
  const offset = (h.at * 7.31) % Math.max(0.001, buf.duration - 0.01);

  const g = ctx.createGain();
  const attack = Math.min(h.attack ?? 0.005, h.dur * 0.5);
  const end = h.at + Math.max(h.dur, attack + 0.01);
  g.gain.setValueAtTime(0, h.at);
  g.gain.linearRampToValueAtTime(h.gain, h.at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, end);

  let node: AudioNode = g;
  if (h.hp) {
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = h.hp;
    if (h.q) f.Q.value = h.q;
    node.connect(f);
    node = f;
  }
  if (h.lp) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = h.lp;
    node.connect(f);
    node = f;
  }

  src.connect(g);
  node.connect(pannedOut(ctx, h.pan));
  src.start(h.at, offset);
  src.stop(end + 0.05);
}

/** A continuous filtered-noise layer with a slow amplitude drift. */
function noiseLayer(
  ctx: BaseAudioContext,
  buf: AudioBuffer,
  opts: { gain: number; type: BiquadFilterType; freq: number; q?: number; lfoHz?: number; depth?: number; pan?: number }
) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = opts.type;
  filter.frequency.value = opts.freq;
  filter.Q.value = opts.q ?? 0.8;

  const g = ctx.createGain();
  g.gain.value = opts.gain;

  if (opts.lfoHz) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = opts.lfoHz;
    const depth = ctx.createGain();
    depth.gain.value = opts.gain * (opts.depth ?? 0.5);
    lfo.connect(depth).connect(g.gain);
    lfo.start(0);
  }

  src.connect(filter).connect(g).connect(pannedOut(ctx, opts.pan));
  src.start(0);
}

/* ---------------------------------------------------------------- beds ---- */

type BedRecipe = (ctx: BaseAudioContext, dur: number, rand: Rand, nb: AudioBuffer) => void;

/** Sparse events, spread over the loop but kept clear of the very end. */
function scatter(dur: number, count: number, rand: Rand, fn: (at: number, i: number) => void) {
  const usable = dur * 0.94;
  for (let i = 0; i < count; i++) fn(((i + rand() * 0.9) / count) * usable, i);
}

const RECIPES: Array<{ match: RegExp; make: BedRecipe }> = [
  {
    // moving air
    match: /wind|breeze|canopy|gale|draught/,
    make: (ctx, _d, _r, nb) => {
      noiseLayer(ctx, nb, { gain: 0.16, type: "bandpass", freq: 420, q: 0.6, lfoHz: 0.07, depth: 0.7, pan: -0.2 });
      noiseLayer(ctx, nb, { gain: 0.08, type: "bandpass", freq: 1300, q: 0.9, lfoHz: 0.11, depth: 0.8, pan: 0.25 });
      noiseLayer(ctx, nb, { gain: 0.1, type: "lowpass", freq: 180, lfoHz: 0.05, depth: 0.5 });
    },
  },
  {
    // broadband water
    match: /rain|surf|swell|creek|river|water|flood/,
    make: (ctx, _d, _r, nb) => {
      noiseLayer(ctx, nb, { gain: 0.13, type: "highpass", freq: 900, lfoHz: 0.09, depth: 0.3, pan: -0.15 });
      noiseLayer(ctx, nb, { gain: 0.1, type: "bandpass", freq: 2600, q: 0.5, lfoHz: 0.17, depth: 0.5, pan: 0.2 });
      noiseLayer(ctx, nb, { gain: 0.09, type: "lowpass", freq: 300, lfoHz: 0.06, depth: 0.6 });
    },
  },
  {
    // fire
    match: /fire|ember|torch|hearth|flame/,
    make: (ctx, dur, rand, nb) => {
      noiseLayer(ctx, nb, { gain: 0.11, type: "lowpass", freq: 260, lfoHz: 0.13, depth: 0.6 });
      noiseLayer(ctx, nb, { gain: 0.03, type: "bandpass", freq: 1800, q: 0.7, lfoHz: 0.31, depth: 0.9 });
      scatter(dur, 90, rand, (at) => {
        noise(ctx, nb, {
          at,
          dur: 0.02 + rand() * 0.05,
          gain: 0.05 + rand() * 0.14,
          hp: 900 + rand() * 2500,
          pan: rand() * 1.2 - 0.6,
        });
      });
    },
  },
  {
    // single drops
    match: /drip|drop/,
    make: (ctx, dur, rand, nb) => {
      noiseLayer(ctx, nb, { gain: 0.04, type: "lowpass", freq: 200, lfoHz: 0.05, depth: 0.4 });
      scatter(dur, 14, rand, (at) => {
        const f = 700 + rand() * 1400;
        tone(ctx, { type: "sine", freq: f, glideTo: f * 1.9, at, dur: 0.012, gain: 0.22, attack: 0.002, release: 0.16, pan: rand() * 1.4 - 0.7 });
      });
    },
  },
  {
    // voices at a distance
    match: /crowd|murmur|market|bustle|whisper|breathing/,
    make: (ctx, dur, rand, nb) => {
      noiseLayer(ctx, nb, { gain: 0.12, type: "bandpass", freq: 520, q: 0.8, lfoHz: 0.23, depth: 0.5, pan: -0.2 });
      noiseLayer(ctx, nb, { gain: 0.07, type: "bandpass", freq: 1100, q: 1.2, lfoHz: 0.37, depth: 0.7, pan: 0.2 });
      scatter(dur, 26, rand, (at) => {
        noise(ctx, nb, {
          at,
          dur: 0.18 + rand() * 0.4,
          gain: 0.03 + rand() * 0.05,
          hp: 300,
          lp: 800 + rand() * 900,
          q: 2,
          attack: 0.08,
          pan: rand() * 1.6 - 0.8,
        });
      });
    },
  },
  {
    // struck metal and stone
    match: /bell|temple|buoy|crystal|resonance|chime/,
    make: (ctx, dur, rand, nb) => {
      noiseLayer(ctx, nb, { gain: 0.03, type: "lowpass", freq: 240, lfoHz: 0.04, depth: 0.5 });
      const base = 210 + rand() * 180;
      scatter(dur, 4, rand, (at) => {
        const pan = rand() * 0.8 - 0.4;
        [1, 2.01, 2.98, 4.17].forEach((mult, i) => {
          tone(ctx, {
            type: "sine",
            freq: base * mult,
            at,
            dur: 0.02,
            gain: 0.16 / (i + 1),
            attack: 0.003,
            release: 3.2 / (i * 0.5 + 1),
            pan,
          });
        });
      });
    },
  },
  {
    // birds and small animals
    match: /bird|gull|carrion|rat|insect|chirp/,
    make: (ctx, dur, rand, nb) => {
      noiseLayer(ctx, nb, { gain: 0.05, type: "bandpass", freq: 700, q: 0.7, lfoHz: 0.09, depth: 0.6 });
      scatter(dur, 22, rand, (at) => {
        const f = 1600 + rand() * 2400;
        const up = rand() > 0.5;
        tone(ctx, {
          type: "sine",
          freq: up ? f : f * 1.5,
          glideTo: up ? f * 1.6 : f * 0.8,
          at,
          dur: 0.05 + rand() * 0.09,
          gain: 0.06 + rand() * 0.07,
          attack: 0.01,
          release: 0.06,
          pan: rand() * 1.6 - 0.8,
        });
      });
    },
  },
  {
    // long animal calls
    match: /howl|moan|groan/,
    make: (ctx, dur, rand, nb) => {
      noiseLayer(ctx, nb, { gain: 0.07, type: "lowpass", freq: 300, lfoHz: 0.05, depth: 0.6 });
      scatter(dur, 3, rand, (at) => {
        const f = 150 + rand() * 90;
        tone(ctx, { type: "sawtooth", freq: f, glideTo: f * 1.3, at, dur: 1.1 + rand(), gain: 0.05, attack: 0.5, release: 1.4, lp: 700, pan: rand() * 1.2 - 0.6 });
      });
    },
  },
  {
    // machinery, timber and rope
    match: /chain|pulley|brass|mechanism|cart|wheel|metal|hull|creak|rigging|door/,
    make: (ctx, dur, rand, nb) => {
      noiseLayer(ctx, nb, { gain: 0.06, type: "lowpass", freq: 220, lfoHz: 0.08, depth: 0.5 });
      scatter(dur, 8, rand, (at) => {
        const f = 90 + rand() * 140;
        tone(ctx, { type: "sawtooth", freq: f, glideTo: f * (0.8 + rand() * 0.5), at, dur: 0.5 + rand() * 0.8, gain: 0.045, attack: 0.15, release: 0.5, lp: 520, pan: rand() * 1.4 - 0.7 });
      });
      scatter(dur, 6, rand, (at) => {
        noise(ctx, nb, { at: at + 0.3, dur: 0.09, gain: 0.05 + rand() * 0.05, hp: 1400, q: 3, pan: rand() * 1.4 - 0.7 });
      });
    },
  },
  {
    // tonal hums and room tone
    match: /hum|drone|tone|arcane|stone/,
    make: (ctx, _d, rand, nb) => {
      noiseLayer(ctx, nb, { gain: 0.05, type: "lowpass", freq: 200, lfoHz: 0.03, depth: 0.4 });
      const base = 55 + rand() * 30;
      [1, 1.5, 2.002, 3.01].forEach((mult, i) => {
        const osc = ctx.createOscillator();
        osc.type = i > 1 ? "sine" : "triangle";
        osc.frequency.value = base * mult;
        osc.detune.value = (rand() - 0.5) * 14;
        const g = ctx.createGain();
        g.gain.value = 0.09 / (i + 1);
        osc.connect(g).connect(pannedOut(ctx, (i % 2 ? 1 : -1) * 0.3));
        osc.start(0);
      });
    },
  },
  {
    // handled objects
    match: /tankard|cutlery|page|grit|leaf|footfall|coin|glass/,
    make: (ctx, dur, rand, nb) => {
      noiseLayer(ctx, nb, { gain: 0.03, type: "lowpass", freq: 400, lfoHz: 0.07, depth: 0.5 });
      scatter(dur, 20, rand, (at) => {
        noise(ctx, nb, {
          at,
          dur: 0.05 + rand() * 0.14,
          gain: 0.04 + rand() * 0.06,
          hp: 1200 + rand() * 2600,
          q: 1.5,
          attack: 0.01,
          pan: rand() * 1.6 - 0.8,
        });
      });
    },
  },
  {
    // weather at a distance
    match: /thunder|storm|rumble/,
    make: (ctx, dur, rand, nb) => {
      noiseLayer(ctx, nb, { gain: 0.09, type: "lowpass", freq: 160, lfoHz: 0.04, depth: 0.6 });
      scatter(dur, 3, rand, (at) => {
        noise(ctx, nb, { at, dur: 1.6 + rand() * 1.4, gain: 0.12, lp: 260, attack: 0.35, pan: rand() * 1.2 - 0.6 });
      });
    },
  },
  {
    // plucked strings across the room
    match: /lute|harp|string/,
    make: (ctx, dur, rand, nb) => {
      noiseLayer(ctx, nb, { gain: 0.02, type: "lowpass", freq: 300 });
      const { root, scale } = parseKey("A minor");
      scatter(dur, 16, rand, (at, i) => {
        tone(ctx, {
          type: "triangle",
          freq: degreeHz(root * 2, scale, [0, 2, 4, 6, 4, 2][i % 6]),
          at,
          dur: 0.03,
          gain: 0.07,
          attack: 0.006,
          release: 0.9,
          lp: 2600,
          pan: rand() * 0.8 - 0.4,
        });
      });
    },
  },
];

/** Filtered noise — what any unrecognised bed id gets. */
const GENERIC: BedRecipe = (ctx, _d, rand, nb) => {
  noiseLayer(ctx, nb, { gain: 0.12, type: "bandpass", freq: 300 + rand() * 900, q: 0.7, lfoHz: 0.08, depth: 0.6 });
  noiseLayer(ctx, nb, { gain: 0.06, type: "lowpass", freq: 220, lfoHz: 0.05, depth: 0.5 });
};

/** Renders a seamless ambience loop for a bed id. */
export async function synthBed(sampleRate: number, bedId: string, seconds = 14): Promise<AudioBuffer> {
  const fade = 0.6;
  const ctx = offline(seconds, sampleRate);
  const rand = rng(hash("bed:" + bedId));
  const nb = noiseBuffer(ctx, 3.1, rng(hash("noise:" + bedId)));

  const recipe = RECIPES.find((r) => r.match.test(bedId));
  (recipe ? recipe.make : GENERIC)(ctx, seconds, rand, nb);

  const rendered = await ctx.startRendering();
  return makeSeamless(ctx, rendered, fade);
}

/* --------------------------------------------------------------- music ---- */

interface Grid {
  bpm: number;
  beat: number;
  bar: number;
  bars: number;
  dur: number;
  root: number;
  scale: number[];
}

function grid(bpm: number, key: string | undefined, bars: number): Grid {
  const beat = 60 / bpm;
  const { root, scale } = parseKey(key);
  return { bpm, beat, bar: beat * 4, bars, dur: beat * 4 * bars, root, scale };
}

/** Layer 1 — the floor. Always present, carries the key. */
function layerDrone(ctx: BaseAudioContext, g: Grid, mode: MusicMode, rand: Rand) {
  const partials: Array<[number, number, number]> = [
    [1, 0.13, -0.25],
    [1.5, 0.07, 0.3],
    [2, 0.05, 0],
  ];
  for (const [mult, gain, pan] of partials) {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = g.root * mult * 0.5;
    osc.detune.value = (rand() - 0.5) * 10;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, 0);
    env.gain.linearRampToValueAtTime(gain, g.bar * 0.5);

    if (mode === "combat") {
      // slow tremolo puts the floor on edge without changing the harmony
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 1 / g.beat / 2;
      const depth = ctx.createGain();
      depth.gain.value = gain * 0.45;
      lfo.connect(depth).connect(env.gain);
      lfo.start(0);
    }

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = mode === "combat" ? 520 : 340;

    osc.connect(env).connect(lp).connect(pannedOut(ctx, pan));
    osc.start(0);
  }
}

/** Layer 2 — harmony. Swelling pad when exploring, stabs in combat. */
function layerPad(ctx: BaseAudioContext, g: Grid, mode: MusicMode, rand: Rand) {
  const chords = [0, 3, 5, 4];
  for (let b = 0; b < g.bars; b++) {
    const degree = chords[b % chords.length];
    const notes = [degree, degree + 2, degree + 4];
    notes.forEach((d, i) => {
      const freq = degreeHz(g.root, g.scale, d + 7);
      if (mode === "combat") {
        for (let beat = 0; beat < 4; beat += 2) {
          tone(ctx, {
            type: "sawtooth",
            freq,
            at: b * g.bar + beat * g.beat,
            dur: g.beat * 0.35,
            gain: 0.05,
            attack: 0.01,
            release: 0.25,
            lp: 1400,
            detune: (rand() - 0.5) * 12,
            pan: (i - 1) * 0.35,
          });
        }
      } else {
        tone(ctx, {
          type: "sawtooth",
          freq,
          at: b * g.bar,
          dur: g.bar * 0.7,
          gain: 0.035,
          attack: g.bar * 0.35,
          release: g.bar * 0.5,
          lp: 900,
          detune: (rand() - 0.5) * 10,
          pan: (i - 1) * 0.4,
        });
      }
    });
  }
}

/** Layer 3 — movement. A wandering figure, or a driving ostinato. */
function layerFigure(ctx: BaseAudioContext, g: Grid, mode: MusicMode, rand: Rand) {
  const steps = mode === "combat" ? 8 : 2;
  const shape = mode === "combat" ? [0, 0, 2, 0, 4, 0, 2, 3] : [0, 4, 2, 6];
  for (let b = 0; b < g.bars; b++) {
    for (let s = 0; s < steps; s++) {
      if (mode === "explore" && rand() < 0.25) continue;
      const degree = shape[(b * steps + s) % shape.length] + (mode === "combat" ? 7 : 14);
      tone(ctx, {
        type: mode === "combat" ? "square" : "triangle",
        freq: degreeHz(g.root, g.scale, degree),
        at: b * g.bar + (s * g.bar) / steps,
        dur: mode === "combat" ? g.beat * 0.16 : g.beat * 0.3,
        gain: mode === "combat" ? 0.045 : 0.055,
        attack: 0.006,
        release: mode === "combat" ? 0.12 : 1.1,
        lp: mode === "combat" ? 2200 : 3200,
        pan: (rand() - 0.5) * 0.7,
      });
    }
  }
}

/** Layer 4 — pulse. Soft heartbeat exploring, a kit in combat. */
function layerPulse(ctx: BaseAudioContext, g: Grid, mode: MusicMode, rand: Rand, nb: AudioBuffer) {
  for (let b = 0; b < g.bars; b++) {
    for (let beat = 0; beat < 4; beat++) {
      const at = b * g.bar + beat * g.beat;
      const downbeat = beat === 0 || beat === 2;

      if (mode === "combat" ? downbeat : beat === 0) {
        tone(ctx, { type: "sine", freq: 92, glideTo: 42, at, dur: 0.07, gain: mode === "combat" ? 0.5 : 0.28, attack: 0.004, release: 0.18 });
      }
      if (mode === "combat" && !downbeat) {
        noise(ctx, nb, { at, dur: 0.16, gain: 0.14, hp: 1500, lp: 7000, attack: 0.002 });
      }
      if (mode === "combat") {
        for (const off of [0, 0.5]) {
          noise(ctx, nb, { at: at + off * g.beat, dur: 0.045, gain: 0.05, hp: 6000, pan: (rand() - 0.5) * 0.5 });
        }
      } else if (beat === 2) {
        noise(ctx, nb, { at, dur: 0.4, gain: 0.035, hp: 700, lp: 4000, attack: 0.09, pan: (rand() - 0.5) * 0.6 });
      }
    }
  }
}

/** Layer 5 — the top. A sparse melody, or something like a horn call. */
function layerLead(ctx: BaseAudioContext, g: Grid, mode: MusicMode, rand: Rand) {
  const phrase = mode === "combat" ? [7, 9, 11, 9] : [7, 9, 8, 6, 4];
  const stride = mode === "combat" ? g.bar / 2 : g.bar;
  const count = Math.max(1, Math.round(g.dur / stride));
  for (let i = 0; i < count; i++) {
    if (mode === "explore" && rand() < 0.3) continue;
    const at = i * stride + (mode === "combat" ? 0 : g.beat * 0.5);
    tone(ctx, {
      type: mode === "combat" ? "sawtooth" : "sine",
      freq: degreeHz(g.root, g.scale, phrase[i % phrase.length] + 7),
      at,
      dur: mode === "combat" ? g.beat * 0.7 : g.beat * 1.4,
      gain: mode === "combat" ? 0.06 : 0.05,
      attack: mode === "combat" ? 0.02 : 0.35,
      release: mode === "combat" ? 0.3 : 1.6,
      lp: mode === "combat" ? 2600 : 2000,
      detune: (rand() - 0.5) * 8,
      pan: (rand() - 0.5) * 0.5,
    });
  }
}

const LAYERS = [layerDrone, layerPad, layerFigure, layerPulse, layerLead];

export interface MusicSpec {
  themeId: string;
  variantId: string;
  mode: MusicMode;
  layer: number;
  bpm?: number;
  key?: string;
  bars?: number;
}

/**
 * Renders one stem. Every stem of a variant shares a grid and a length, so the
 * engine can start them together and gate them with gain alone.
 */
export async function synthMusicLayer(sampleRate: number, spec: MusicSpec): Promise<AudioBuffer> {
  const bars = spec.bars ?? 4;
  const g = grid(spec.bpm || 90, spec.key, bars);
  // render past the loop so note tails can be wrapped back onto the head
  const tail = 3;
  const ctx = offline(g.dur + tail, sampleRate);
  const seed = hash([spec.themeId, spec.variantId, spec.mode, spec.layer].join(":"));
  const rand = rng(seed);
  const nb = noiseBuffer(ctx, 2.3, rng(seed ^ 0x9e3779b9));

  const make = LAYERS[Math.min(spec.layer, LAYERS.length - 1)];
  if (make === layerPulse) make(ctx, g, spec.mode, rand, nb);
  else (make as (c: BaseAudioContext, g: Grid, m: MusicMode, r: Rand) => void)(ctx, g, spec.mode, rand);

  const rendered = await ctx.startRendering();
  return wrapTail(ctx, rendered, g.dur);
}

/** Loop length of a variant's stems, so callers can reason about the grid. */
export function musicLoopSeconds(bpm = 90, bars = 4): number {
  return (60 / bpm) * 4 * bars;
}
