/* ======================================================================
   SIGNAL — a drop-in TTRPG music + ambience console.

   Add it to any page with one tag:

       <script src="signal.js"></script>

   With no audio files it runs a synthesised demo set so you can see the
   whole thing working. Point it at a library.json (generated from your
   audio/ folder by build-library.mjs) and your own material replaces the
   demo set entirely — you never edit this file to add tracks.

   Optional globals, set before the script tag:
       window.SIGNAL_BASE     = 'https://cdn.example.com/';  // path prefix
       window.SIGNAL_MANIFEST = 'library.json';              // manifest URL
   ====================================================================== */

(function () {
  'use strict';

  const FADE = 4;                                   // every crossfade, seconds
  const BED_FADE = 1.2;                             // ambience toggles
  const BASE = window.SIGNAL_BASE || '';
  const MANIFEST = window.SIGNAL_MANIFEST || 'library.json';


  /* ====================================================================
     1. MUSICAL MATERIAL — used only by the built-in demo set
     --------------------------------------------------------------------
     Phrases are scale degrees against SCALE, one slot per eighth note,
     null for a rest. Themes and counter-lines run 32 slots (four bars);
     figures run 8, so they stay in phase.

     Counter-lines are written to move in the theme's gaps. That is what
     makes intensity five read as an answer rather than a thickening.
     ==================================================================== */

  const SCALE = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19];   // natural minor
  const _ = null;

  const PHRASES = {
    /* Themes — exploration */
    descent:  [0,_,_,_, 4,_,_,_, 5,_,4,_, _,_,_,_, 3,_,_,_, 2,_,_,_, 4,_,_,_, 0,_,_,_],
    ascent:   [0,_,2,_, 3,_,_,_, 4,_,_,_, _,_,_,_, 5,_,4,_, 2,_,_,_, 3,_,2,_, 0,_,_,_],
    hollow:   [7,_,_,_, _,_,_,_, 4,_,_,_, _,_,_,_, 5,_,_,_, _,_,_,_, 4,_,_,_, 2,_,_,_],
    question: [2,_,_,_, 4,_,3,_, 2,_,_,_, _,_,_,_, 0,_,_,_, 2,_,4,_, 3,_,_,_, _,_,_,_],
    vigil:    [4,_,_,_, 3,_,_,_, 2,_,_,_, 4,_,_,_, 5,_,_,_, 4,_,3,_, 2,_,_,_, _,_,_,_],
    lament:   [5,_,_,_, 4,_,_,_, 2,_,3,_, 2,_,_,_, 0,_,_,_, 2,_,_,_, 4,_,2,_, 0,_,_,_],
    drifting: [0,_,_,_, _,_,_,_, 2,_,_,_, _,_,_,_, 4,_,_,_, 3,_,_,_, _,_,_,_, 2,_,_,_],

    /* Themes — combat */
    charge:   [0,0,_,0, 3,_,2,_, 0,0,_,0, 4,_,3,_, 0,0,_,0, 5,_,4,_, 3,_,2,_, 0,_,_,_],
    hunt:     [0,_,3,_, 4,_,3,_, 0,_,3,_, 5,_,4,_, 0,_,3,_, 4,_,5,_, 6,_,5,_, 4,_,_,_],
    stand:    [4,_,_,_, 7,_,_,_, 6,_,5,_, 4,_,_,_, 3,_,_,_, 4,_,5,_, 4,_,2,_, 0,_,_,_],
    rout:     [7,_,6,_, 5,_,4,_, 7,_,6,_, 4,_,3,_, 5,_,4,_, 3,_,2,_, 4,_,3,_, 0,_,_,_],

    /* Counter-lines — they sit in the theme's gaps, higher up */
    fill:     [_,_,_,_, 7,_,6,_, _,_,_,_, 7,_,_,_, _,_,_,_, 6,_,5,_, _,_,_,_, 4,_,_,_],
    drift:    [_,_,_,_, _,_,_,_, 7,_,_,_, 6,_,_,_, _,_,_,_, _,_,_,_, 5,_,4,_, _,_,_,_],
    surge:    [_,_,7,_, _,_,6,_, _,_,7,_, _,_,8,_, _,_,7,_, _,_,6,_, _,_,5,_, _,_,4,_],
    answer:   [_,_,_,_, 6,_,7,_, _,_,_,_, 8,_,7,_, _,_,_,_, 5,_,6,_, _,_,_,_, 4,_,_,_],

    /* One-bar figures */
    arp:       [0, 2, 4, 2, 5, 4, 2, 0],
    arpSlow:   [0, _, 4, _, 2, _, 4, _],
    arpWide:   [0, 4, 7, 4, 5, 4, 2, _],
    ostinato:  [0, 0, 3, 0, 4, 0, 3, 0],
    ostinato2: [0, 0, 4, 0, 3, 0, 5, 0],
    ostinato3: [0, 3, 0, 4, 0, 3, 0, 2]
  };

  /* The five cinematic layers of a cue, innermost first. Each entry is
     only what that intensity adds — three is the theme alone, not the
     theme plus everything under it. Mirror these roles when you record
     your own stems; see GUIDE.md. */
  function stemSpec(kind, tr) {
    if (kind === 'combat') {
      return [
        /* 1 pulse      */ { v: 'line', gain: 0.30, p: { bpm: tr.bpm, root: tr.root - 12, phrase: tr.figure,
                                                         oct: 0, wave: 'sawtooth', atk: 0.006, dec: 0.22, cut: 760 } },
        /* 2 low brass  */ { v: 'pad',  gain: 0.34, p: { root: tr.root - 12, intervals: [0, 7, 12],
                                                         cut: 360, wave: 'sawtooth', sub: true } },
        /* 3 theme      */ { v: 'line', gain: 0.28, p: { bpm: tr.bpm, root: tr.root, phrase: tr.theme,
                                                         oct: 24, wave: 'sawtooth', atk: 0.035, dec: 0.60,
                                                         cut: 2300, vib: true } },
        /* 4 taiko      */ { v: 'perc', gain: 0.34, p: { bpm: tr.bpm, kind: 'taiko' } },
        /* 5 counter    */ { v: 'crest', gain: 0.28, p: { bpm: tr.bpm, root: tr.root, phrase: tr.counter,
                                                          oct: 31, kind: 'cymbal' } }
      ];
    }
    return [
      /* 1 low strings  */ { v: 'pad',  gain: 0.46, p: { root: tr.root - 12, intervals: [0, 7],
                                                         cut: 300, wave: 'sawtooth', sub: true } },
      /* 2 high strings */ { v: 'pad',  gain: 0.24, p: { root: tr.root, intervals: [3, 7, 12],
                                                         cut: 1000, wave: 'triangle', swell: true } },
      /* 3 theme        */ { v: 'line', gain: 0.27, p: { bpm: tr.bpm, root: tr.root, phrase: tr.theme,
                                                         oct: 24, wave: 'triangle', atk: 0.10, dec: 1.10,
                                                         cut: 1700, vib: true } },
      /* 4 figure       */ { v: 'line', gain: 0.17, p: { bpm: tr.bpm, root: tr.root, phrase: tr.figure,
                                                         oct: 12, wave: 'sawtooth', atk: 0.006, dec: 0.28, cut: 1400 } },
      /* 5 counter      */ { v: 'crest', gain: 0.22, p: { bpm: tr.bpm, root: tr.root, phrase: tr.counter,
                                                          oct: 31, kind: 'soft' } }
    ];
  }


  /* ====================================================================
     2. BUILT-IN DEMO SET
     --------------------------------------------------------------------
     A fallback so the console works with zero audio files. Generate a
     library.json from your own folder and this whole block is replaced
     at runtime.
     ==================================================================== */

  let LIBRARY = {

    scifi: {
      label: 'Sci-fi horror',
      blurb: 'Corridors, cryo, and things in the vents',
      glyph: '<path d="M12 2L21 7v10l-9 5-9-5V7z" opacity=".28"/><path d="M12 7l4.5 2.5v5L12 17l-4.5-2.5v-5z"/>',
      scenes: {
        cryo: {
          label: 'Cryo bay',
          music: {
            explore: { root: 44, bpm: 62, theme: 'drifting', counter: 'drift', figure: 'arpSlow' },
            combat:  { root: 44, bpm: 124, theme: 'charge', counter: 'surge', figure: 'ostinato' }
          },
          ambience: [
            { id: 'a1', label: 'Air recyclers',  synth: 'hiss',   hz: 1400, gain: 0.30 },
            { id: 'a2', label: 'Hull settling',  synth: 'groan',  root: 38, gain: 0.55 },
            { id: 'a3', label: 'Coolant drip',   synth: 'drip',   gain: 0.45 },
            { id: 'a4', label: 'Deck plate hum', synth: 'rumble', gain: 0.50 },
            { id: 'a5', label: 'Comms chatter',  synth: 'comms',  gain: 0.35 }
          ],
          oneshots: ['chime', 'airlock', 'doorSlam', 'staticBurst', 'heartbeat', 'steamVent']
        },
        corridors: {
          label: 'Ship corridors',
          music: {
            explore: { root: 49, bpm: 70, theme: 'question', counter: 'fill', figure: 'arpSlow' },
            combat:  { root: 49, bpm: 136, theme: 'hunt', counter: 'surge', figure: 'ostinato2' }
          },
          ambience: [
            { id: 'a1', label: 'Vent hiss',        synth: 'hiss',      hz: 2600, gain: 0.28 },
            { id: 'a2', label: 'Deck plate hum',   synth: 'rumble',    gain: 0.50 },
            { id: 'a3', label: 'Hull groans',      synth: 'groan',     root: 33, gain: 0.60 },
            { id: 'a4', label: 'Flickering strip', synth: 'machinery', hz: 3.2, gain: 0.30 },
            { id: 'a5', label: 'Distant klaxon',   synth: 'farAlarm',  gain: 0.40 },
            { id: 'a6', label: 'Condensation',     synth: 'drip',      gain: 0.40 }
          ],
          oneshots: ['ping', 'doorSlam', 'screech', 'shot', 'steamVent', 'klaxon', 'impact', 'staticBurst']
        },
        derelict: {
          label: 'Derelict interior',
          music: {
            explore: { root: 41, bpm: 54, theme: 'lament', counter: 'drift', figure: 'arpWide' },
            combat:  { root: 41, bpm: 120, theme: 'rout', counter: 'surge', figure: 'ostinato2' }
          },
          ambience: [
            { id: 'a1', label: 'Cavernous wind',  synth: 'hiss',      hz: 480, gain: 0.40 },
            { id: 'a2', label: 'Organic breath',  synth: 'groan',     root: 28, gain: 0.65 },
            { id: 'a3', label: 'Resin drips',     synth: 'drip',      gain: 0.50 },
            { id: 'a4', label: 'Subsonic pulse',  synth: 'rumble',    gain: 0.60 },
            { id: 'a5', label: 'Distant skitter', synth: 'machinery', hz: 9.0, gain: 0.22 }
          ],
          oneshots: ['screech', 'impact', 'steamVent', 'heartbeat', 'ping', 'boom']
        }
      }
    },

    fantasy: {
      label: 'Dark fantasy',
      blurb: 'Crypts, deep woods, and the long watch',
      glyph: '<path d="M12 2l7 4v6c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z" opacity=".28"/><path d="M12 6.5l3.5 2v3.5c0 2.6-1.5 4.4-3.5 5.2-2-.8-3.5-2.6-3.5-5.2V8.5z"/>',
      scenes: {
        crypt: {
          label: 'Crypt',
          music: {
            explore: { root: 38, bpm: 58, theme: 'lament', counter: 'fill', figure: 'arpWide' },
            combat:  { root: 38, bpm: 126, theme: 'charge', counter: 'answer', figure: 'ostinato3' }
          },
          ambience: [
            { id: 'a1', label: 'Deep draught',   synth: 'hiss',   hz: 420, gain: 0.35 },
            { id: 'a2', label: 'Water drip',     synth: 'drip',   gain: 0.50 },
            { id: 'a3', label: 'Settling stone', synth: 'groan',  root: 31, gain: 0.50 },
            { id: 'a4', label: 'Subsonic bed',   synth: 'rumble', gain: 0.45 }
          ],
          oneshots: ['impact', 'doorSlam', 'screech', 'heartbeat', 'boom', 'chime']
        },
        deepWood: {
          label: 'Deep wood',
          music: {
            explore: { root: 45, bpm: 64, theme: 'ascent', counter: 'fill', figure: 'arp' },
            combat:  { root: 45, bpm: 134, theme: 'stand', counter: 'surge', figure: 'ostinato2' }
          },
          ambience: [
            { id: 'a1', label: 'Wind in branches', synth: 'hiss',      hz: 700, gain: 0.32 },
            { id: 'a2', label: 'Creaking timber',  synth: 'groan',     root: 36, gain: 0.45 },
            { id: 'a3', label: 'Insects',          synth: 'machinery', hz: 8.0, gain: 0.18 },
            { id: 'a4', label: 'Low bed',          synth: 'rumble',    gain: 0.42 }
          ],
          oneshots: ['screech', 'impact', 'shot', 'boom', 'ping']
        },
        keep: {
          label: 'The keep',
          music: {
            explore: { root: 47, bpm: 68, theme: 'vigil', counter: 'fill', figure: 'arp' },
            combat:  { root: 47, bpm: 132, theme: 'stand', counter: 'surge', figure: 'ostinato3' }
          },
          ambience: [
            { id: 'a1', label: 'Storm outside',  synth: 'hiss',      hz: 320, gain: 0.45 },
            { id: 'a2', label: 'Hearth',         synth: 'machinery', hz: 11.0, gain: 0.22 },
            { id: 'a3', label: 'Distant bell',   synth: 'farAlarm',  gain: 0.30 },
            { id: 'a4', label: 'Hall murmur',    synth: 'comms',     gain: 0.28 }
          ],
          oneshots: ['doorSlam', 'chime', 'impact', 'klaxon', 'boom']
        }
      }
    },

    ambient: {
      label: 'Ambient',
      blurb: 'Genre-neutral cues for downtime and travel',
      glyph: '<circle cx="12" cy="12" r="9" opacity=".26"/><circle cx="12" cy="12" r="5.5" opacity=".5"/><circle cx="12" cy="12" r="2"/>',
      scenes: {
        drift: {
          label: 'Slow drift',
          music: {
            explore: { root: 41, bpm: 56, theme: 'drifting', counter: 'drift', figure: 'arpSlow' },
            combat:  { root: 41, bpm: 118, theme: 'hunt', counter: 'surge', figure: 'ostinato' }
          },
          ambience: [
            { id: 'a1', label: 'Low tone',   synth: 'rumble',    gain: 0.55 },
            { id: 'a2', label: 'Upper air',  synth: 'hiss',      hz: 2200, gain: 0.22 },
            { id: 'a3', label: 'Slow pulse', synth: 'machinery', hz: 0.5, gain: 0.25 },
            { id: 'a4', label: 'Far voices', synth: 'comms',     gain: 0.24 }
          ],
          oneshots: ['chime', 'impact', 'staticBurst', 'heartbeat']
        },
        vigil: {
          label: 'Night vigil',
          music: {
            explore: { root: 33, bpm: 50, theme: 'hollow', counter: 'drift', figure: 'arpSlow' },
            combat:  { root: 33, bpm: 114, theme: 'hunt', counter: 'answer', figure: 'ostinato' }
          },
          ambience: [
            { id: 'a1', label: 'Void tone',     synth: 'rumble',    gain: 0.55 },
            { id: 'a2', label: 'Thin air',      synth: 'hiss',      hz: 1800, gain: 0.25 },
            { id: 'a3', label: 'Slow ticking',  synth: 'machinery', hz: 0.7, gain: 0.30 }
          ],
          oneshots: ['chime', 'beacon', 'heartbeat', 'staticBurst']
        }
      }
    }

  };

  const DEFAULT_GLYPH = '<circle cx="12" cy="12" r="9" opacity=".26"/>' +
                        '<circle cx="12" cy="12" r="5.5" opacity=".5"/>' +
                        '<circle cx="12" cy="12" r="2"/>';

  const ONESHOTS = {
    ping:        { label: 'Ping' },
    klaxon:      { label: 'Klaxon' },
    doorSlam:    { label: 'Heavy door' },
    airlock:     { label: 'Airlock' },
    screech:     { label: 'Screech' },
    shot:        { label: 'Shot' },
    chime:       { label: 'Chime' },
    staticBurst: { label: 'Static' },
    impact:      { label: 'Impact' },
    steamVent:   { label: 'Steam vent' },
    heartbeat:   { label: 'Heartbeat' },
    beacon:      { label: 'Beacon' },
    boom:        { label: 'Boom' }
  };


  /* ====================================================================
     3. AUDIO ENGINE
     ==================================================================== */

  let ctx = null, masterGain = null, noiseBuf = null, brownBuf = null;

  const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function initAudio() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = state.master;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -9; limiter.knee.value = 8; limiter.ratio.value = 12;
    limiter.attack.value = 0.004; limiter.release.value = 0.25;
    masterGain.connect(limiter);
    limiter.connect(ctx.destination);

    const len = ctx.sampleRate * 4;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    brownBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const b = brownBuf.getChannelData(0);
    let last = 0;
    for (let j = 0; j < len; j++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      b[j] = last * 3.2;
    }
    return ctx;
  }

  function ensureCtx() {
    initAudio();
    if (ctx.state === 'suspended') ctx.resume();
  }

  /* ---- Audio file loading ---- */

  const bufCache = {};

  function loadBuffer(src) {
    if (bufCache[src]) return bufCache[src];
    bufCache[src] = fetch(BASE + src)
      .then((r) => {
        if (!r.ok) throw new Error(r.status + ' — ' + src);
        return r.arrayBuffer();
      })
      .then((a) => ctx.decodeAudioData(a))
      .catch((e) => {
        delete bufCache[src];
        console.warn('[signal] could not load', src, e);
        throw e;
      });
    return bufCache[src];
  }

  /* Wraps a file so it behaves like a synth voice: an output node that
     exists immediately, with the looping source attached once decoded. */
  function fileVoice(src) {
    const out = ctx.createGain();
    let node = null, killed = false;
    loadBuffer(src).then((buf) => {
      if (killed) return;
      node = ctx.createBufferSource();
      node.buffer = buf; node.loop = true;
      node.connect(out); node.start();
    }).catch(() => {});
    return { out, stop() { killed = true; if (node) { try { node.stop(); } catch (e) {} } } };
  }

  const makeVoice = (def) => (def.src ? fileVoice(def.src) : VOICES[def.synth](def));

  function noiseSource(brown) {
    const s = ctx.createBufferSource();
    s.buffer = brown ? brownBuf : noiseBuf;
    s.loop = true; s.start();
    return s;
  }

  function lfo(rate, depth, target, base) {
    const o = ctx.createOscillator(); o.frequency.value = rate;
    const g = ctx.createGain(); g.gain.value = depth;
    o.connect(g); g.connect(target);
    if (base !== undefined) target.value = base;
    o.start();
    return { stop() { try { o.stop(); } catch (e) {} } };
  }

  function shaper(amount) {
    const ws = ctx.createWaveShaper(), n = 2048, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
    }
    ws.curve = curve; ws.oversample = '2x';
    return ws;
  }

  /* Lookahead scheduler. All stems in a cue are built in the same tick,
     so they share a start time and stay locked to each other. */
  function sequencer(bpm, steps, onStep) {
    const stepDur = 60 / bpm / 2;                 // eighth notes
    let next = ctx.currentTime + 0.10;
    let i = 0, alive = true, timer = null;
    (function tick() {
      if (!alive) return;
      while (next < ctx.currentTime + 0.15) {
        onStep(i % steps, next);
        i++; next += stepDur;
      }
      timer = setTimeout(tick, 25);
    })();
    return { stop() { alive = false; clearTimeout(timer); } };
  }

  const VOICES = {

    /* ---- Scored layers ---- */

    pad(cfg) {
      const out = ctx.createGain();
      const cut = cfg.cut || 400;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.4;
      const fl = lfo(0.03, cut * 0.28, lp.frequency, cut);
      const parts = [];
      (cfg.intervals || [0, 7]).forEach((iv, idx) => {
        const hz = midiToHz(cfg.root + iv);
        [-4, 5].forEach((det) => {
          const o = ctx.createOscillator();
          o.type = cfg.wave || 'sawtooth';
          o.frequency.value = hz; o.detune.value = det;
          const g = ctx.createGain(); g.gain.value = 0.11 / (idx * 0.4 + 1);
          o.connect(g); g.connect(lp); o.start(); parts.push(o);
        });
      });
      if (cfg.sub) {
        const s = ctx.createOscillator(); s.type = 'sine';
        s.frequency.value = midiToHz(cfg.root - 12);
        const sg = ctx.createGain(); sg.gain.value = 0.26;
        s.connect(sg); sg.connect(out); s.start(); parts.push(s);
      }
      const amp = ctx.createGain();
      let al = null;
      if (cfg.swell) al = lfo(0.055, 0.30, amp.gain, 0.62);
      else amp.gain.value = 0.85;
      lp.connect(amp); amp.connect(out);
      return { out, stop() {
        parts.forEach((o) => { try { o.stop(); } catch (e) {} });
        fl.stop(); if (al) al.stop();
      } };
    },

    line(cfg) {
      const out = ctx.createGain();
      const pat = PHRASES[cfg.phrase] || PHRASES.arp;
      const dec = cfg.dec || 0.4;
      const cut = cfg.cut || 1600;
      const seq = sequencer(cfg.bpm || 90, pat.length, (i, when) => {
        const d = pat[i];
        if (d === null || d === undefined) return;
        const hz = midiToHz(cfg.root + (cfg.oct || 0) + SCALE[d]);
        const o = ctx.createOscillator();
        o.type = cfg.wave || 'triangle';
        o.frequency.setValueAtTime(hz, when);
        if (cfg.vib) {
          const vo = ctx.createOscillator(); vo.type = 'sine'; vo.frequency.value = 5.1;
          const vg = ctx.createGain(); vg.gain.value = 6;
          vo.connect(vg); vg.connect(o.detune);
          vo.start(when); vo.stop(when + dec + 0.1);
        }
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.6;
        f.frequency.setValueAtTime(cut, when);
        f.frequency.exponentialRampToValueAtTime(Math.max(cut * 0.35, 220), when + dec);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(0.26, when + (cfg.atk || 0.02));
        g.gain.exponentialRampToValueAtTime(0.0001, when + dec);
        o.connect(f); f.connect(g); g.connect(out);
        o.start(when); o.stop(when + dec + 0.06);
      });
      return { out, stop: seq.stop };
    },

    perc(cfg) {
      const out = ctx.createGain();

      function taiko(when, vel) {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(112, when);
        o.frequency.exponentialRampToValueAtTime(50, when + 0.17);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(vel, when + 0.007);
        g.gain.exponentialRampToValueAtTime(0.0001, when + 0.44);
        o.connect(g); g.connect(out);
        o.start(when); o.stop(when + 0.48);
        const n = ctx.createBufferSource(); n.buffer = noiseBuf;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
        bp.frequency.value = 430; bp.Q.value = 1.2;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.0001, when);
        ng.gain.exponentialRampToValueAtTime(vel * 0.32, when + 0.003);
        ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);
        n.connect(bp); bp.connect(ng); ng.connect(out);
        n.start(when); n.stop(when + 0.12);
      }

      function cymbal(when, vel) {
        const n = ctx.createBufferSource(); n.buffer = noiseBuf;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6200;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(vel, when + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, when + 1.5);
        n.connect(hp); hp.connect(g); g.connect(out);
        n.start(when); n.stop(when + 1.55);
      }

      const patterns = {
        // Under an exploration cue: presence, not a beat.
        soft(i, w) {
          if (i === 0) taiko(w, 0.40);
          if (i === 16) taiko(w, 0.28);
          if (i === 26) taiko(w, 0.18);
        },
        taiko(i, w) {
          if (i % 8 === 0) taiko(w, 0.55);
          else if (i === 6 || i === 14 || i === 22 || i === 30) taiko(w, 0.34);
          else if (i === 11 || i === 27) taiko(w, 0.26);
        },
        cymbal(i, w) {
          if (i === 0) cymbal(w, 0.16);
          if (i === 16) cymbal(w, 0.11);
          if (i === 4 || i === 12 || i === 20 || i === 28) taiko(w, 0.30);
        }
      };

      const seq = sequencer(cfg.bpm || 120, 32, patterns[cfg.kind] || patterns.soft);
      return { out, stop: seq.stop };
    },

    /* Intensity five: the counter-melody answering the theme, with the
       percussion that carries it. One layer, two elements. */
    crest(cfg) {
      const out = ctx.createGain();
      const isCombat = cfg.kind === 'cymbal';
      const l = VOICES.line({
        bpm: cfg.bpm, root: cfg.root, phrase: cfg.phrase, oct: cfg.oct,
        wave: isCombat ? 'sawtooth' : 'triangle',
        atk: isCombat ? 0.05 : 0.09,
        dec: isCombat ? 0.55 : 1.20,
        cut: 2600, vib: true
      });
      const p = VOICES.perc({ bpm: cfg.bpm, kind: cfg.kind });
      const lg = ctx.createGain(); lg.gain.value = 0.85;
      const pg = ctx.createGain(); pg.gain.value = 0.80;
      l.out.connect(lg); lg.connect(out);
      p.out.connect(pg); pg.connect(out);
      return { out, stop() { l.stop(); p.stop(); } };
    },

    /* ---- Ambience beds ---- */

    hiss(cfg) {
      const out = ctx.createGain();
      const s = noiseSource(false);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = cfg.hz || 1500;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = (cfg.hz || 1500) * 4;
      const g = ctx.createGain();
      const sw = lfo(0.06, 0.09, g.gain, 0.30);
      s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out);
      return { out, stop() { try { s.stop(); } catch (e) {} sw.stop(); } };
    },

    rumble() {
      const out = ctx.createGain();
      const s = noiseSource(true);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1;
      const fl = lfo(0.035, 34, lp.frequency, 110);
      const g = ctx.createGain();
      const gl = lfo(0.05, 0.18, g.gain, 0.85);
      s.connect(lp); lp.connect(g); g.connect(out);
      return { out, stop() { try { s.stop(); } catch (e) {} fl.stop(); gl.stop(); } };
    },

    groan(cfg) {
      const out = ctx.createGain();
      const f = midiToHz(cfg.root || 34);
      const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
      const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 1.01;
      const d1 = lfo(0.031, 22, o1.detune, 0);
      const d2 = lfo(0.019, 34, o2.detune, 0);
      const g = ctx.createGain();
      const gl = lfo(0.023, 0.16, g.gain, 0.22);
      o1.connect(g); o2.connect(g);
      const ns = noiseSource(false);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 22;
      const bl = lfo(0.017, 190, bp.frequency, 340);
      const ng = ctx.createGain();
      const nl = lfo(0.041, 0.09, ng.gain, 0.10);
      ns.connect(bp); bp.connect(ng); ng.connect(out);
      g.connect(out); o1.start(); o2.start();
      return { out, stop() {
        [o1, o2].forEach((o) => { try { o.stop(); } catch (e) {} });
        try { ns.stop(); } catch (e) {}
        [d1, d2, gl, bl, nl].forEach((l) => l.stop());
      } };
    },

    machinery(cfg) {
      const out = ctx.createGain();
      const rate = cfg.hz || 2;
      const s = noiseSource(false);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 4;
      const g = ctx.createGain(); g.gain.value = 0.14;
      const sq = ctx.createOscillator(); sq.type = 'square'; sq.frequency.value = rate;
      const sqg = ctx.createGain(); sqg.gain.value = 0.13;
      sq.connect(sqg); sqg.connect(g.gain); sq.start();
      const thud = ctx.createOscillator(); thud.type = 'sine'; thud.frequency.value = 62;
      const tg = ctx.createGain(); tg.gain.value = 0.10;
      const tsq = ctx.createOscillator(); tsq.type = 'square'; tsq.frequency.value = rate;
      const tsqg = ctx.createGain(); tsqg.gain.value = 0.10;
      tsq.connect(tsqg); tsqg.connect(tg.gain); tsq.start(); thud.start();
      thud.connect(tg); tg.connect(out);
      s.connect(bp); bp.connect(g); g.connect(out);
      return { out, stop() {
        [sq, tsq, thud].forEach((o) => { try { o.stop(); } catch (e) {} });
        try { s.stop(); } catch (e) {}
      } };
    },

    comms() {
      const out = ctx.createGain();
      const s = noiseSource(false);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 7;
      const fl = lfo(0.21, 380, bp.frequency, 1050);
      const g = ctx.createGain(); g.gain.value = 0.10;
      const mod = noiseSource(true);
      const mg = ctx.createGain(); mg.gain.value = 0.14;
      mod.connect(mg); mg.connect(g.gain);
      s.connect(bp); bp.connect(g); g.connect(out);
      return { out, stop() {
        [s, mod].forEach((n) => { try { n.stop(); } catch (e) {} }); fl.stop();
      } };
    },

    farAlarm() {
      const out = ctx.createGain();
      const o = ctx.createOscillator(); o.type = 'square';
      const sw = lfo(0.55, 90, o.frequency, 520);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 1;
      const g = ctx.createGain(); g.gain.value = 0.04;
      const gate = ctx.createOscillator(); gate.type = 'square'; gate.frequency.value = 0.28;
      const gg = ctx.createGain(); gg.gain.value = 0.035;
      gate.connect(gg); gg.connect(g.gain); gate.start();
      const rev = ctx.createBiquadFilter(); rev.type = 'lowpass'; rev.frequency.value = 1200;
      o.connect(lp); lp.connect(g); g.connect(rev); rev.connect(out); o.start();
      return { out, stop() {
        [o, gate].forEach((x) => { try { x.stop(); } catch (e) {} }); sw.stop();
      } };
    },

    drip() {
      const out = ctx.createGain();
      let alive = true, timer = null;
      function ping() {
        if (!alive) return;
        const t = ctx.currentTime;
        const f = 900 + Math.random() * 1100;
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 0.45, t + 0.09);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.22 + Math.random() * 0.16, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 3;
        o.connect(bp); bp.connect(g); g.connect(out);
        o.start(t); o.stop(t + 0.3);
        timer = setTimeout(ping, 700 + Math.random() * 3400);
      }
      timer = setTimeout(ping, 400 + Math.random() * 1200);
      return { out, stop() { alive = false; clearTimeout(timer); } };
    }

  };


  /* ---- One shots ---- */

  function fire(entry) {
    ensureCtx();

    // File-backed one shot: decode once, then fire and forget.
    if (entry && typeof entry === 'object' && entry.src) {
      loadBuffer(entry.src).then((buf) => {
        const s = ctx.createBufferSource();
        s.buffer = buf; s.connect(masterGain); s.start();
      }).catch(() => {});
      return;
    }

    const id = typeof entry === 'string' ? entry : (entry && entry.id);
    const t = ctx.currentTime, out = masterGain;

    function env(node, peak, atk, dec) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + atk);
      g.gain.exponentialRampToValueAtTime(0.0001, t + atk + dec);
      node.connect(g); g.connect(out);
      return g;
    }
    function osc(type, hz, at) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(hz, at || t); return o;
    }
    function nz(dur) {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf;
      s.start(t); s.stop(t + dur); return s;
    }

    switch (id) {

      case 'ping': {
        for (let i = 0; i < 4; i++) {
          const at = t + i * 0.42;
          const o = ctx.createOscillator(); o.type = 'sine';
          o.frequency.setValueAtTime(1180, at);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, at);
          g.gain.exponentialRampToValueAtTime(0.30, at + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0001, at + 0.30);
          const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1180; bp.Q.value = 9;
          o.connect(bp); bp.connect(g); g.connect(out);
          o.start(at); o.stop(at + 0.34);
        }
        break;
      }

      case 'klaxon': {
        const ko = osc('sawtooth', 440);
        for (let k = 0; k < 4; k++) {
          ko.frequency.setValueAtTime(440, t + k * 0.5);
          ko.frequency.linearRampToValueAtTime(300, t + k * 0.5 + 0.25);
          ko.frequency.setValueAtTime(440, t + k * 0.5 + 0.25);
        }
        const kf = ctx.createBiquadFilter(); kf.type = 'lowpass'; kf.frequency.value = 1600;
        ko.connect(kf);
        const kg = ctx.createGain();
        kg.gain.setValueAtTime(0.0001, t);
        kg.gain.exponentialRampToValueAtTime(0.26, t + 0.05);
        kg.gain.setValueAtTime(0.26, t + 1.7);
        kg.gain.exponentialRampToValueAtTime(0.0001, t + 2.1);
        kf.connect(kg); kg.connect(out);
        ko.start(t); ko.stop(t + 2.2);
        break;
      }

      case 'doorSlam': {
        const ds = nz(0.5);
        const dl = ctx.createBiquadFilter(); dl.type = 'lowpass';
        dl.frequency.setValueAtTime(3000, t);
        dl.frequency.exponentialRampToValueAtTime(200, t + 0.35);
        ds.connect(dl); env(dl, 0.5, 0.005, 0.45);
        const dt = osc('sine', 130);
        dt.frequency.exponentialRampToValueAtTime(38, t + 0.3);
        env(dt, 0.55, 0.006, 0.5);
        dt.start(t); dt.stop(t + 0.6);
        break;
      }

      case 'airlock': {
        const dur = 2.2;
        const as = nz(dur);
        const af = ctx.createBiquadFilter(); af.type = 'bandpass'; af.Q.value = 1.1;
        af.frequency.setValueAtTime(400, t);
        af.frequency.exponentialRampToValueAtTime(4200, t + dur * 0.4);
        af.frequency.exponentialRampToValueAtTime(700, t + dur);
        as.connect(af);
        const ag = ctx.createGain();
        ag.gain.setValueAtTime(0.0001, t);
        ag.gain.exponentialRampToValueAtTime(0.34, t + 0.25);
        ag.gain.setValueAtTime(0.34, t + dur * 0.55);
        ag.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        af.connect(ag); ag.connect(out);
        const st = t + dur * 0.9;
        const thunk = osc('sine', 90, st);
        thunk.frequency.exponentialRampToValueAtTime(35, st + 0.25);
        const tg = ctx.createGain();
        tg.gain.setValueAtTime(0.0001, st);
        tg.gain.exponentialRampToValueAtTime(0.5, st + 0.01);
        tg.gain.exponentialRampToValueAtTime(0.0001, st + 0.4);
        thunk.connect(tg); tg.connect(out);
        thunk.start(st); thunk.stop(st + 0.45);
        break;
      }

      case 'screech': {
        const sd = shaper(20);
        const so = osc('sawtooth', 2100);
        so.frequency.exponentialRampToValueAtTime(240, t + 0.75);
        const so2 = osc('square', 1730);
        so2.frequency.exponentialRampToValueAtTime(310, t + 0.7);
        const sg = ctx.createGain(); sg.gain.value = 0.35;
        so.connect(sg); so2.connect(sg); sg.connect(sd);
        const sb = ctx.createBiquadFilter(); sb.type = 'bandpass'; sb.frequency.value = 1400; sb.Q.value = 1.4;
        sd.connect(sb);
        const sge = ctx.createGain();
        sge.gain.setValueAtTime(0.0001, t);
        sge.gain.exponentialRampToValueAtTime(0.32, t + 0.03);
        sge.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        sb.connect(sge); sge.connect(out);
        const sn = nz(0.9);
        const snf = ctx.createBiquadFilter(); snf.type = 'highpass'; snf.frequency.value = 2600;
        sn.connect(snf); env(snf, 0.18, 0.03, 0.8);
        so.start(t); so.stop(t + 0.95); so2.start(t); so2.stop(t + 0.95);
        break;
      }

      case 'shot': {
        for (let r = 0; r < 7; r++) {
          const rt = t + r * 0.075;
          const rn = ctx.createBufferSource(); rn.buffer = noiseBuf;
          const rf = ctx.createBiquadFilter(); rf.type = 'lowpass';
          rf.frequency.setValueAtTime(4200, rt);
          rf.frequency.exponentialRampToValueAtTime(350, rt + 0.06);
          const rg = ctx.createGain();
          rg.gain.setValueAtTime(0.0001, rt);
          rg.gain.exponentialRampToValueAtTime(0.38, rt + 0.003);
          rg.gain.exponentialRampToValueAtTime(0.0001, rt + 0.07);
          rn.connect(rf); rf.connect(rg); rg.connect(out);
          rn.start(rt); rn.stop(rt + 0.09);
          const rb = ctx.createOscillator(); rb.type = 'sine';
          rb.frequency.setValueAtTime(180, rt);
          rb.frequency.exponentialRampToValueAtTime(50, rt + 0.06);
          const rbg = ctx.createGain();
          rbg.gain.setValueAtTime(0.0001, rt);
          rbg.gain.exponentialRampToValueAtTime(0.30, rt + 0.004);
          rbg.gain.exponentialRampToValueAtTime(0.0001, rt + 0.08);
          rb.connect(rbg); rbg.connect(out);
          rb.start(rt); rb.stop(rt + 0.1);
        }
        break;
      }

      case 'chime': {
        [740, 988, 1319].forEach((hz, i) => {
          const at = t + i * 0.16;
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(hz, at);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, at);
          g.gain.exponentialRampToValueAtTime(0.20, at + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
          o.connect(g); g.connect(out);
          o.start(at); o.stop(at + 1.0);
        });
        break;
      }

      case 'staticBurst': {
        const stn = nz(0.55);
        const stf = ctx.createBiquadFilter(); stf.type = 'bandpass'; stf.frequency.value = 2000; stf.Q.value = 0.7;
        stn.connect(stf);
        const stg = ctx.createGain();
        stg.gain.setValueAtTime(0.0001, t);
        stg.gain.exponentialRampToValueAtTime(0.30, t + 0.008);
        stg.gain.setValueAtTime(0.30, t + 0.28);
        stg.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
        stf.connect(stg); stg.connect(out);
        const chop = ctx.createOscillator(); chop.type = 'square'; chop.frequency.value = 26;
        const chg = ctx.createGain(); chg.gain.value = 0.14;
        chop.connect(chg); chg.connect(stg.gain); chop.start(t); chop.stop(t + 0.55);
        break;
      }

      case 'impact': {
        const mn = nz(1.6);
        const mb = ctx.createBiquadFilter(); mb.type = 'bandpass'; mb.frequency.value = 620; mb.Q.value = 16;
        const mb2 = ctx.createBiquadFilter(); mb2.type = 'bandpass'; mb2.frequency.value = 1490; mb2.Q.value = 20;
        mn.connect(mb); mn.connect(mb2);
        env(mb, 0.42, 0.003, 1.5); env(mb2, 0.26, 0.003, 1.1);
        const mt = osc('sine', 105);
        mt.frequency.exponentialRampToValueAtTime(45, t + 0.2);
        env(mt, 0.45, 0.004, 0.35);
        mt.start(t); mt.stop(t + 0.45);
        break;
      }

      case 'steamVent': {
        const vn = nz(1.5);
        const vf = ctx.createBiquadFilter(); vf.type = 'highpass'; vf.frequency.value = 1400;
        const vf2 = ctx.createBiquadFilter(); vf2.type = 'lowpass';
        vf2.frequency.setValueAtTime(9000, t);
        vf2.frequency.exponentialRampToValueAtTime(1800, t + 1.4);
        vn.connect(vf); vf.connect(vf2);
        const vg = ctx.createGain();
        vg.gain.setValueAtTime(0.0001, t);
        vg.gain.exponentialRampToValueAtTime(0.40, t + 0.06);
        vg.gain.exponentialRampToValueAtTime(0.0001, t + 1.45);
        vf2.connect(vg); vg.connect(out);
        break;
      }

      case 'heartbeat': {
        [0, 0.32].forEach((off, i) => {
          const at = t + off;
          const o = ctx.createOscillator(); o.type = 'sine';
          o.frequency.setValueAtTime(78, at);
          o.frequency.exponentialRampToValueAtTime(36, at + 0.16);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, at);
          g.gain.exponentialRampToValueAtTime(i ? 0.42 : 0.58, at + 0.012);
          g.gain.exponentialRampToValueAtTime(0.0001, at + 0.30);
          o.connect(g); g.connect(out);
          o.start(at); o.stop(at + 0.35);
        });
        break;
      }

      case 'beacon': {
        for (let d = 0; d < 5; d++) {
          const bt = t + d * 0.34;
          const bo = ctx.createOscillator(); bo.type = 'square'; bo.frequency.setValueAtTime(1046, bt);
          const bg = ctx.createGain();
          bg.gain.setValueAtTime(0.0001, bt);
          bg.gain.exponentialRampToValueAtTime(0.16, bt + 0.005);
          bg.gain.setValueAtTime(0.16, bt + 0.10);
          bg.gain.exponentialRampToValueAtTime(0.0001, bt + 0.16);
          const blp = ctx.createBiquadFilter(); blp.type = 'lowpass'; blp.frequency.value = 2400;
          bo.connect(blp); blp.connect(bg); bg.connect(out);
          bo.start(bt); bo.stop(bt + 0.2);
        }
        break;
      }

      case 'boom': {
        const hn = nz(3.0);
        const hf = ctx.createBiquadFilter(); hf.type = 'lowpass';
        hf.frequency.setValueAtTime(300, t);
        hf.frequency.exponentialRampToValueAtTime(7000, t + 1.1);
        hf.frequency.exponentialRampToValueAtTime(900, t + 2.9);
        hn.connect(hf);
        const hg = ctx.createGain();
        hg.gain.setValueAtTime(0.0001, t);
        hg.gain.exponentialRampToValueAtTime(0.46, t + 1.0);
        hg.gain.exponentialRampToValueAtTime(0.0001, t + 2.95);
        hf.connect(hg); hg.connect(out);
        const hs = osc('sine', 110);
        hs.frequency.exponentialRampToValueAtTime(24, t + 2.4);
        const hsg = ctx.createGain();
        hsg.gain.setValueAtTime(0.0001, t);
        hsg.gain.exponentialRampToValueAtTime(0.5, t + 0.2);
        hsg.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
        hs.connect(hsg); hsg.connect(out);
        hs.start(t); hs.stop(t + 2.7);
        break;
      }
    }
  }


  /* ====================================================================
     4. STATE
     ==================================================================== */

  const state = {
    open: false,
    view: 'menu',        // 'menu' | 'board'
    genre: null,
    scene: null,
    tab: 'soundscape',
    mode: 'off',         // 'off' | 'explore' | 'combat'
    lastMode: 'explore',
    intensity: 3,
    master: 0.7,
    ambience: {},        // layer id -> 0..3
    lastLevel: {}        // layer id -> level to restore on toggle-on
  };

  const AMB_LEVELS = [0, 0.28, 0.6, 1.0];
  const live = { score: null, amb: {} };
  let scoreToken = 0;

  const genre = () => LIBRARY[state.genre];
  const scene = () => genre().scenes[state.scene];
  const music = () => (scene().music || {});
  const hasMode = (m) => !!music()[m];
  const cue = () => music()[state.mode === 'off' ? state.lastMode : state.mode];
  const playing = () => state.mode !== 'off';
  const carryKey = (layer) => layer.carry || layer.synth || layer.label;

  function retireGroup(group, seconds) {
    if (!group || !ctx) return;
    const t = ctx.currentTime, f = seconds === undefined ? FADE : seconds;
    group.stems.forEach((s) => {
      s.gain.gain.cancelScheduledValues(t);
      s.gain.gain.setValueAtTime(Math.max(s.gain.gain.value, 0.0001), t);
      s.gain.gain.linearRampToValueAtTime(0.0001, t + f);
    });
    setTimeout(() => {
      group.stems.forEach((s) => {
        s.voice.stop(); try { s.gain.disconnect(); } catch (e) {}
      });
    }, f * 1000 + 300);
  }

  function applyIntensity(group) {
    if (!group || !ctx) return;
    const t = ctx.currentTime;
    group.stems.forEach((s) => {
      const target = s.index < state.intensity ? s.target : 0.0001;
      s.gain.gain.cancelScheduledValues(t);
      s.gain.gain.setValueAtTime(Math.max(s.gain.gain.value, 0.0001), t);
      s.gain.gain.linearRampToValueAtTime(target, t + FADE);
    });
  }

  /* The old cue fades out as the new one fades in. Starting, switching
     explore/combat and changing scene all run through here, so every
     transition sounds the same: 4 seconds, nothing ever cuts. */
  function crossfadeScore() {
    ensureCtx();
    retireGroup(live.score);
    live.score = null;
    const token = ++scoreToken;
    const kind = state.mode === 'off' ? state.lastMode : state.mode;
    const tr = cue();
    if (!tr) return;

    // File-backed cue: decode every stem first, then start them all at
    // one shared time so they stay locked together.
    if (tr.stems && tr.stems.length) {
      Promise.all(tr.stems.map(loadBuffer)).then((bufs) => {
        if (token !== scoreToken) return;
        const at = ctx.currentTime + 0.06;
        live.score = { stems: bufs.map((buf, i) => {
          const node = ctx.createBufferSource();
          node.buffer = buf; node.loop = true;
          const g = ctx.createGain(); g.gain.value = 0.0001;
          node.connect(g); g.connect(masterGain);
          node.start(at);
          return {
            voice: { stop() { try { node.stop(); } catch (e) {} } },
            gain: g,
            target: (tr.gains && tr.gains[i]) || 1,
            index: i
          };
        }) };
        applyIntensity(live.score);
      }).catch(() => {});
      return;
    }

    // Synthesised cue.
    live.score = { stems: stemSpec(kind, tr).map((s, i) => {
      const v = VOICES[s.v](Object.assign({}, s.p));
      const g = ctx.createGain(); g.gain.value = 0.0001;
      v.out.connect(g); g.connect(masterGain);
      return { voice: v, gain: g, target: s.gain, index: i };
    }) };
    applyIntensity(live.score);
  }

  function stopScore() {
    scoreToken++;
    retireGroup(live.score);
    live.score = null;
  }

  function setMode(m) {
    if (m === state.mode) return;
    if (m !== 'off' && !hasMode(m)) return;
    state.mode = m;
    if (m === 'off') stopScore();
    else { state.lastMode = m; crossfadeScore(); }
    renderBoard(); renderStatus();
  }

  function setIntensity(v) {
    v = Math.min(5, Math.max(1, v));
    if (v === state.intensity) return false;
    state.intensity = v;
    if (playing()) applyIntensity(live.score);
    return true;
  }

  function setAmbience(layer, level, seconds) {
    ensureCtx();
    const f = seconds === undefined ? BED_FADE : seconds;
    state.ambience[layer.id] = level;
    if (level > 0) state.lastLevel[layer.id] = level;
    let l = live.amb[layer.id];

    if (level === 0) {
      if (l) {
        const t0 = ctx.currentTime;
        l.gain.gain.cancelScheduledValues(t0);
        l.gain.gain.setValueAtTime(Math.max(l.gain.gain.value, 0.0001), t0);
        l.gain.gain.linearRampToValueAtTime(0.0001, t0 + f);
        const v = l.voice, g = l.gain;
        setTimeout(() => { v.stop(); try { g.disconnect(); } catch (e) {} }, f * 1000 + 200);
        delete live.amb[layer.id];
      }
      return;
    }

    if (!l) {
      const voice = makeVoice(layer);
      const gain = ctx.createGain(); gain.gain.value = 0.0001;
      voice.out.connect(gain); gain.connect(masterGain);
      l = live.amb[layer.id] = { voice, gain, base: layer.gain || 0.5 };
    }
    const t = ctx.currentTime;
    l.gain.gain.cancelScheduledValues(t);
    l.gain.gain.setValueAtTime(Math.max(l.gain.gain.value, 0.0001), t);
    l.gain.gain.linearRampToValueAtTime(l.base * AMB_LEVELS[level], t + f);
  }

  /* Clicking the name toggles the bed; clicking a bar sets that level,
     or turns it off if that level is already the one running. */
  function toggleAmbience(layer) {
    const lvl = state.ambience[layer.id] || 0;
    setAmbience(layer, lvl ? 0 : (state.lastLevel[layer.id] || 2));
    renderBoard(); renderStatus();
  }

  function retireAllAmbience(seconds) {
    if (!ctx) { live.amb = {}; state.ambience = {}; return; }
    const f = seconds === undefined ? FADE : seconds;
    const t = ctx.currentTime;
    Object.keys(live.amb).forEach((id) => {
      const l = live.amb[id];
      l.gain.gain.cancelScheduledValues(t);
      l.gain.gain.setValueAtTime(Math.max(l.gain.gain.value, 0.0001), t);
      l.gain.gain.linearRampToValueAtTime(0.0001, t + f);
      setTimeout(() => { l.voice.stop(); try { l.gain.disconnect(); } catch (e) {} }, f * 1000 + 200);
    });
    live.amb = {};
    state.ambience = {};
  }

  /* Switching scene never stops the music: the cue you were on keeps
     playing while the new scene's cue comes up under it. Beds that exist
     in both scenes carry across at the level you had them. */
  function changeScene(newId) {
    if (newId === state.scene) return;

    const carry = {};
    (scene().ambience || []).forEach((l) => {
      const lv = state.ambience[l.id] || 0;
      if (lv) (carry[carryKey(l)] = carry[carryKey(l)] || []).push(lv);
    });

    retireAllAmbience(FADE);
    state.scene = newId;

    // Keep playing whatever mode we were in, if the new scene has it.
    if (playing() && !hasMode(state.mode)) {
      state.mode = hasMode('explore') ? 'explore' : 'off';
      if (state.mode !== 'off') state.lastMode = state.mode;
    }
    if (playing()) crossfadeScore(); else stopScore();

    (scene().ambience || []).forEach((l) => {
      const q = carry[carryKey(l)];
      if (q && q.length) setAmbience(l, q.shift(), FADE);
    });

    renderBoard(); renderStatus();
  }

  function panic() {
    stopScore();
    retireAllAmbience(0.4);
    state.mode = 'off';
    render();
  }


  /* ====================================================================
     5. UI
     ==================================================================== */

  const host = document.createElement('div');
  host.id = 'signal-host';
  host.style.cssText = 'position:fixed;inset:auto 0 0 0;z-index:2147483000;pointer-events:none;';
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });

  const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .wrap {
    --plate: #1b2028;
    --seam: rgba(255,255,255,.07);
    --seam-lit: rgba(255,255,255,.14);
    --text: #e6eaef;
    --muted: #7d8794;
    --explore: #e3b787;
    --combat: #df8b7d;
    --bed: #8ec9bd;
    --accent: var(--explore);
    position: fixed; right: 22px; bottom: 22px;
    pointer-events: none;
    font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .lab {
    font-size: 10.5px; font-weight: 600; letter-spacing: .18em;
    text-transform: uppercase;
  }

  /* ---------- Launcher ---------- */
  .fab {
    pointer-events: auto; position: absolute; right: 0; bottom: 0;
    width: 56px; height: 56px; border: 0; border-radius: 50%;
    background: linear-gradient(150deg, #2a323d 0%, #171b22 100%);
    box-shadow: 0 10px 30px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.07);
    cursor: pointer; display: grid; place-items: center;
    transition: transform .22s cubic-bezier(.2,.8,.3,1), opacity .2s;
  }
  .fab:hover { transform: translateY(-2px); }
  .fab:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
  .fab svg { width: 22px; height: 22px; fill: var(--explore); opacity: .9; }
  .fab.hidden { opacity: 0; transform: scale(.9); pointer-events: none; }
  .fab .ring {
    position: absolute; inset: -4px; border-radius: 50%;
    border: 1px solid var(--explore); opacity: 0;
  }
  .fab.active .ring { animation: breathe 3.2s ease-in-out infinite; }
  @keyframes breathe {
    0%,100% { opacity: .1; transform: scale(1); }
    50%     { opacity: .38; transform: scale(1.06); }
  }

  /* ---------- Panel ---------- */
  .panel {
    pointer-events: auto; position: absolute; right: 0; bottom: 0;
    width: 348px; max-height: min(640px, calc(100vh - 44px));
    display: flex; flex-direction: column;
    background: linear-gradient(168deg, #202631 0%, #161a21 52%, #12151a 100%);
    border: 1px solid var(--seam); border-radius: 24px;
    box-shadow: 0 24px 70px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.05);
    overflow: hidden; transform-origin: bottom right;
    opacity: 0; transform: scale(.94) translateY(8px); visibility: hidden;
    transition: opacity .2s ease, transform .26s cubic-bezier(.2,.9,.3,1);
  }
  .panel.open { opacity: 1; transform: none; visibility: visible; }

  /* ---------- Header ---------- */
  .head { padding: 16px 18px 0; flex: none; }
  .head-top { display: flex; align-items: center; gap: 10px; min-height: 28px; }
  .title { font-size: 13px; font-weight: 600; letter-spacing: .14em;
           text-transform: uppercase; color: var(--text); }
  .spacer { margin-left: auto; }
  .icobtn {
    width: 28px; height: 28px; border: 0; border-radius: 50%; cursor: pointer; flex: none;
    background: transparent; color: var(--muted); display: grid; place-items: center;
    transition: background .16s, color .16s;
  }
  .icobtn:hover { background: rgba(255,255,255,.06); color: var(--text); }
  .icobtn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .icobtn svg { width: 12px; height: 12px; stroke: currentColor; stroke-width: 1.8;
                fill: none; stroke-linecap: round; stroke-linejoin: round; }

  .scene-row { margin-top: 14px; position: relative; }
  select.scene {
    width: 100%; appearance: none; -webkit-appearance: none; cursor: pointer;
    font: inherit; font-size: 13px; font-weight: 500; color: var(--text);
    background: linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.02));
    border: 1px solid var(--seam); border-radius: 14px;
    padding: 11px 34px 11px 14px; transition: border-color .16s;
  }
  select.scene:hover { border-color: var(--seam-lit); }
  select.scene:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  select.scene option { background: #1b2028; color: var(--text); }
  .caret {
    position: absolute; right: 15px; top: 50%; transform: translateY(-50%);
    pointer-events: none; width: 9px; height: 9px;
    stroke: var(--muted); stroke-width: 1.8; fill: none; stroke-linecap: round;
  }

  /* ---------- Tabs ---------- */
  .tabs { display: flex; gap: 22px; padding: 14px 18px 0; flex: none; }
  .tab {
    background: none; border: 0; cursor: pointer; position: relative; font: inherit;
    font-size: 11px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase;
    color: var(--muted); padding: 0 0 11px; transition: color .16s;
  }
  .tab:hover { color: var(--text); }
  .tab[aria-selected="true"] { color: var(--text); }
  .tab[aria-selected="true"]::after {
    content: ''; position: absolute; left: 0; right: 0; bottom: 0;
    height: 1.5px; border-radius: 2px; background: var(--accent);
  }
  .tab:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }

  /* ---------- Body ---------- */
  .body { overflow-y: auto; flex: 1; padding: 18px; }
  .body::-webkit-scrollbar { width: 8px; }
  .body::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,.09); border-radius: 4px;
    border: 2px solid transparent; background-clip: padding-box;
  }
  .sec { color: var(--muted); margin-bottom: 12px; }

  /* ---------- Main menu ---------- */
  .card {
    display: flex; align-items: center; gap: 15px; width: 100%; text-align: left;
    background: linear-gradient(160deg, rgba(255,255,255,.055), rgba(255,255,255,.015));
    border: 1px solid var(--seam); border-radius: 18px;
    padding: 17px 18px; margin-bottom: 10px; cursor: pointer; font: inherit;
    transition: border-color .18s, transform .14s, background .18s;
  }
  .card:hover {
    background: linear-gradient(160deg, rgba(255,255,255,.085), rgba(255,255,255,.03));
    border-color: var(--seam-lit); transform: translateY(-1px);
  }
  .card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .card-glyph { width: 30px; height: 30px; flex: none; fill: var(--explore); opacity: .85; }
  .card-title { display: block; font-size: 14px; font-weight: 600;
                letter-spacing: .04em; color: var(--text); }
  .card-sub { display: block; font-size: 11.5px; color: var(--muted);
              margin-top: 4px; line-height: 1.5; }

  /* ---------- Music ---------- */
  .music.explore { --accent: var(--explore); }
  .music.combat  { --accent: var(--combat); }
  .music.off     { --accent: var(--muted); }

  .modes {
    display: flex; gap: 4px; padding: 4px; margin-bottom: 20px;
    background: rgba(255,255,255,.03);
    border: 1px solid var(--seam); border-radius: 15px;
  }
  .modes button {
    flex: 1; font: inherit; font-size: 11px; font-weight: 600;
    letter-spacing: .14em; text-transform: uppercase;
    border: 0; background: none; color: var(--muted);
    padding: 9px 4px; border-radius: 11px; cursor: pointer;
    transition: background .18s, color .18s;
  }
  .modes button:hover:not(:disabled) { color: var(--text); }
  .modes button:disabled { opacity: .3; cursor: default; }
  .modes button[aria-pressed="true"] {
    background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04));
    color: var(--accent);
  }
  .modes button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

  /* The bars are the slider. No track, no handle, no readout. */
  .meter {
    position: relative; height: 58px; display: flex; align-items: flex-end;
    justify-content: space-between; cursor: pointer; touch-action: none;
    padding: 0 8px;
  }
  .meter:focus-visible { outline: 2px solid var(--accent); outline-offset: 8px; border-radius: 4px; }
  .meter i {
    display: block; width: 10px; border-radius: 999px; background: rgba(255,255,255,.09);
    transition: background .45s ease, opacity .45s ease;
  }
  .meter i:nth-child(1) { height: 31%; }
  .meter i:nth-child(2) { height: 48%; }
  .meter i:nth-child(3) { height: 65%; }
  .meter i:nth-child(4) { height: 82%; }
  .meter i:nth-child(5) { height: 100%; }
  .meter i.on { background: var(--accent); }
  .music.off .meter i.on { opacity: .3; }

  .rule { height: 1px; background: var(--seam); margin: 24px 0 18px; }

  /* ---------- Ambience ---------- */
  .layer {
    display: flex; align-items: center; gap: 12px;
    border-radius: 13px; margin-bottom: 4px;
    border: 1px solid transparent; padding-right: 12px;
    transition: background .18s, border-color .18s;
  }
  .layer:hover { background: rgba(255,255,255,.03); }
  .layer.on {
    border-color: rgba(142,201,189,.2);
    background: linear-gradient(180deg, rgba(142,201,189,.08), rgba(142,201,189,.025));
  }
  .layer-toggle {
    flex: 1; min-width: 0; text-align: left; font: inherit; font-size: 12.5px;
    background: none; border: 0; cursor: pointer; color: var(--muted);
    padding: 11px 0 11px 13px; border-radius: 13px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    transition: color .18s;
  }
  .layer-toggle:hover { color: var(--text); }
  .layer.on .layer-toggle { color: var(--text); }
  .layer-toggle:focus-visible { outline: 2px solid var(--bed); outline-offset: -2px; }
  .levels { display: flex; align-items: flex-end; gap: 4px; flex: none; }
  .lvl {
    width: 5px; border: 0; border-radius: 999px; cursor: pointer; padding: 0;
    background: rgba(255,255,255,.13); transition: background .18s;
  }
  .lvl:hover { background: rgba(255,255,255,.28); }
  .lvl:focus-visible { outline: 2px solid var(--bed); outline-offset: 3px; }
  .lvl.filled { background: var(--bed); }
  .lvl[data-l="1"] { height: 9px; }
  .lvl[data-l="2"] { height: 14px; }
  .lvl[data-l="3"] { height: 19px; }

  /* ---------- One shots ---------- */
  .pads { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
  .pad {
    position: relative; overflow: hidden; font: inherit;
    background: linear-gradient(160deg, rgba(255,255,255,.055), rgba(255,255,255,.015));
    border: 1px solid var(--seam); border-radius: 15px;
    padding: 18px 13px; cursor: pointer; text-align: left;
    font-size: 12px; font-weight: 500; letter-spacing: .02em; color: var(--text);
    transition: border-color .16s, transform .09s, background .16s;
  }
  .pad:hover {
    background: linear-gradient(160deg, rgba(255,255,255,.085), rgba(255,255,255,.03));
    border-color: var(--seam-lit);
  }
  .pad:active { transform: scale(.97); }
  .pad:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .pad::after {
    content: ''; position: absolute; inset: 0; opacity: 0; pointer-events: none;
    background: radial-gradient(circle at 50% 50%, rgba(227,183,135,.3), transparent 70%);
  }
  .pad.hit::after { animation: flash .5s ease-out; }
  @keyframes flash { from { opacity: 1; } to { opacity: 0; } }

  .empty { font-size: 12.5px; color: var(--muted); line-height: 1.6; padding: 4px 0; }

  /* ---------- Footer ---------- */
  .foot {
    flex: none; border-top: 1px solid var(--seam); padding: 14px 18px;
    display: flex; align-items: center; gap: 14px;
  }
  .foot .lab { color: var(--muted); flex: none; }
  .foot input[type=range] {
    -webkit-appearance: none; appearance: none; flex: 1; height: 3px;
    background: rgba(255,255,255,.13); border-radius: 3px; cursor: pointer;
  }
  .foot input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%;
    background: var(--text); cursor: pointer;
  }
  .foot input[type=range]::-moz-range-thumb {
    width: 12px; height: 12px; border: 0; border-radius: 50%;
    background: var(--text); cursor: pointer;
  }
  .foot input[type=range]:focus-visible { outline: 2px solid var(--accent); outline-offset: 5px; }
  .silence {
    flex: none; font: inherit; font-size: 10.5px; font-weight: 600;
    letter-spacing: .16em; text-transform: uppercase;
    background: transparent; border: 1px solid var(--seam); color: var(--muted);
    border-radius: 999px; padding: 7px 13px; cursor: pointer;
    transition: border-color .18s, color .18s;
  }
  .silence:hover { border-color: rgba(223,139,125,.5); color: var(--combat); }
  .silence:focus-visible { outline: 2px solid var(--combat); outline-offset: 2px; }

  .hide { display: none !important; }

  @media (max-width: 460px) {
    .wrap { right: 12px; bottom: 12px; left: 12px; }
    .panel { width: auto; left: 0; right: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    * { animation-duration: .01ms !important; transition-duration: .01ms !important; }
  }
  `;

  const style = document.createElement('style');
  style.textContent = CSS;
  root.appendChild(style);

  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  root.appendChild(wrap);

  wrap.innerHTML = `
    <div class="panel" role="dialog" aria-label="Music and ambience">
      <div class="head">
        <div class="head-top">
          <button class="icobtn hide" id="back" aria-label="Back to menu">
            <svg viewBox="0 0 12 12"><path d="M7.5 1.5L3 6l4.5 4.5"/></svg>
          </button>
          <span class="title" id="title">Signal</span>
          <span class="spacer"></span>
          <button class="icobtn" id="close" aria-label="Close">
            <svg viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8"/></svg>
          </button>
        </div>
        <div class="scene-row hide" id="scene-row">
          <select class="scene" id="scene" aria-label="Scene"></select>
          <svg class="caret" viewBox="0 0 10 10"><path d="M1 3l4 4 4-4"/></svg>
        </div>
      </div>
      <div class="tabs hide" id="tabs" role="tablist">
        <button class="tab" id="tab-soundscape" role="tab" aria-selected="true">Soundscape</button>
        <button class="tab" id="tab-oneshots" role="tab" aria-selected="false">One shots</button>
      </div>
      <div class="body" id="body" role="tabpanel"></div>
      <div class="foot">
        <span class="lab">Master</span>
        <input type="range" id="master" min="0" max="100" value="70" aria-label="Master volume">
        <button class="silence" id="silence">Silence</button>
      </div>
    </div>
    <button class="fab" id="fab" aria-label="Open music and ambience">
      <span class="ring"></span>
      <svg viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z"/></svg>
    </button>
  `;

  const $ = (id) => root.getElementById(id);
  const panel = wrap.querySelector('.panel');
  const fab = $('fab');

  function render() {
    const board = state.view === 'board' && state.genre && LIBRARY[state.genre];
    if (!board) state.view = 'menu';
    $('back').classList.toggle('hide', !board);
    $('scene-row').classList.toggle('hide', !board);
    $('tabs').classList.toggle('hide', !board);
    $('title').textContent = board ? genre().label : 'Signal';
    if (board) { renderScenes(); renderBoard(); }
    else { renderMenu(); }
    renderStatus();
  }

  function renderMenu() {
    const body = $('body');
    body.innerHTML = '';
    const keys = Object.keys(LIBRARY);
    if (!keys.length) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = 'No sets found. Add audio to your audio/ folder and run the library build.';
      body.appendChild(p);
      return;
    }
    keys.forEach((key) => {
      const g = LIBRARY[key];
      const c = document.createElement('button');
      c.className = 'card';
      c.type = 'button';
      c.innerHTML =
        '<svg class="card-glyph" viewBox="0 0 24 24">' + (g.glyph || DEFAULT_GLYPH) + '</svg>' +
        '<span><span class="card-title"></span>' +
        (g.blurb ? '<span class="card-sub"></span>' : '') + '</span>';
      c.querySelector('.card-title').textContent = g.label || key;
      if (g.blurb) c.querySelector('.card-sub').textContent = g.blurb;
      c.addEventListener('click', () => openGenre(key));
      body.appendChild(c);
    });
  }

  function openGenre(key) {
    if (key !== state.genre) {
      if (state.genre) panic();
      state.genre = key;
      state.scene = Object.keys(LIBRARY[key].scenes || {})[0] || null;
      state.mode = 'off';
      state.lastMode = 'explore';
      state.intensity = 3;
      state.ambience = {};
      state.lastLevel = {};
    }
    state.view = 'board';
    render();
  }

  function renderScenes() {
    const sel = $('scene');
    sel.innerHTML = '';
    const scenes = genre().scenes || {};
    Object.keys(scenes).forEach((s) => {
      const o = document.createElement('option');
      o.value = s; o.textContent = scenes[s].label || s;
      if (s === state.scene) o.selected = true;
      sel.appendChild(o);
    });
  }

  function renderBoard() {
    const body = $('body');
    body.innerHTML = '';
    $('tab-soundscape').setAttribute('aria-selected', String(state.tab === 'soundscape'));
    $('tab-oneshots').setAttribute('aria-selected', String(state.tab === 'oneshots'));
    if (!state.scene) { renderMenu(); return; }
    if (state.tab === 'soundscape') { renderMusic(body); renderAmbience(body); }
    else { renderPads(body); }
  }

  function renderMusic(body) {
    const box = document.createElement('div');
    box.className = 'music ' + state.mode;

    const sec = document.createElement('div');
    sec.className = 'sec lab';
    sec.textContent = 'Music';
    box.appendChild(sec);

    const modes = document.createElement('div');
    modes.className = 'modes';
    [['off', 'Off'], ['explore', 'Explore'], ['combat', 'Combat']].forEach((m) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = m[1];
      b.disabled = m[0] !== 'off' && !hasMode(m[0]);
      b.setAttribute('aria-pressed', state.mode === m[0] ? 'true' : 'false');
      b.addEventListener('click', () => setMode(m[0]));
      modes.appendChild(b);
    });
    box.appendChild(modes);

    // Intensity: five bars getting taller, dragged left to right.
    const meter = document.createElement('div');
    meter.className = 'meter';
    meter.tabIndex = 0;
    meter.setAttribute('role', 'slider');
    meter.setAttribute('aria-label', 'Intensity');
    meter.setAttribute('aria-valuemin', '1');
    meter.setAttribute('aria-valuemax', '5');
    for (let i = 0; i < 5; i++) meter.appendChild(document.createElement('i'));

    function paint() {
      Array.prototype.forEach.call(meter.children, (el, n) => {
        el.className = n < state.intensity ? 'on' : '';
      });
      meter.setAttribute('aria-valuenow', String(state.intensity));
    }

    function fromX(clientX) {
      const r = meter.getBoundingClientRect();
      if (setIntensity(Math.ceil(((clientX - r.left) / r.width) * 5))) paint();
    }

    let dragging = false;
    meter.addEventListener('pointerdown', (e) => {
      dragging = true;
      try { meter.setPointerCapture(e.pointerId); } catch (err) {}
      fromX(e.clientX);
    });
    meter.addEventListener('pointermove', (e) => { if (dragging) fromX(e.clientX); });
    meter.addEventListener('pointerup', () => { dragging = false; });
    meter.addEventListener('pointercancel', () => { dragging = false; });
    meter.addEventListener('keydown', (e) => {
      const d = (e.key === 'ArrowRight' || e.key === 'ArrowUp') ? 1
              : (e.key === 'ArrowLeft' || e.key === 'ArrowDown') ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      if (setIntensity(state.intensity + d)) paint();
    });

    paint();
    box.appendChild(meter);
    body.appendChild(box);

    const rule = document.createElement('div');
    rule.className = 'rule';
    body.appendChild(rule);
  }

  function renderAmbience(body) {
    const beds = scene().ambience || [];
    const sec = document.createElement('div');
    sec.className = 'sec lab';
    sec.textContent = 'Ambience';
    body.appendChild(sec);

    if (!beds.length) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = 'No beds in this scene.';
      body.appendChild(p);
      return;
    }

    beds.forEach((layer) => {
      const lvl = state.ambience[layer.id] || 0;
      const row = document.createElement('div');
      row.className = 'layer' + (lvl ? ' on' : '');

      const name = document.createElement('button');
      name.type = 'button';
      name.className = 'layer-toggle';
      name.textContent = layer.label;
      name.setAttribute('aria-pressed', lvl ? 'true' : 'false');
      name.addEventListener('click', () => toggleAmbience(layer));
      row.appendChild(name);

      const levels = document.createElement('span');
      levels.className = 'levels';
      [1, 2, 3].forEach((n) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'lvl' + (n <= lvl ? ' filled' : '');
        b.dataset.l = n;
        b.setAttribute('aria-label', layer.label + ' — ' + ['low', 'medium', 'high'][n - 1]);
        b.addEventListener('click', () => {
          setAmbience(layer, lvl === n ? 0 : n);
          renderBoard(); renderStatus();
        });
        levels.appendChild(b);
      });
      row.appendChild(levels);
      body.appendChild(row);
    });
  }

  function renderPads(body) {
    const list = scene().oneshots || [];
    if (!list.length) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = 'No one shots in this scene.';
      body.appendChild(p);
      return;
    }
    const grid = document.createElement('div');
    grid.className = 'pads';
    list.forEach((entry) => {
      const def = typeof entry === 'string' ? ONESHOTS[entry] : entry;
      if (!def) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pad';
      b.textContent = def.label;
      b.addEventListener('click', () => {
        fire(entry);
        b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit');
      });
      grid.appendChild(b);
    });
    body.appendChild(grid);
  }

  function renderStatus() {
    const active = playing() || Object.keys(live.amb).length > 0;
    fab.className = 'fab' + (state.open ? ' hidden' : '') + (active ? ' active' : '');
  }

  /* ---- Wiring ---- */

  fab.addEventListener('click', () => {
    state.open = true;
    panel.classList.add('open');
    ensureCtx();
    renderStatus();
    $('close').focus();
  });

  function closePanel() {
    state.open = false;
    panel.classList.remove('open');
    renderStatus();
    fab.focus();
  }
  $('close').addEventListener('click', closePanel);

  $('back').addEventListener('click', () => { state.view = 'menu'; render(); });
  $('scene').addEventListener('change', (e) => changeScene(e.target.value));
  $('tab-soundscape').addEventListener('click', () => { state.tab = 'soundscape'; renderBoard(); });
  $('tab-oneshots').addEventListener('click', () => { state.tab = 'oneshots'; renderBoard(); });

  $('master').addEventListener('input', (e) => {
    state.master = e.target.value / 100;
    if (masterGain) masterGain.gain.setTargetAtTime(state.master, ctx.currentTime, 0.02);
  });

  $('silence').addEventListener('click', panic);

  document.addEventListener('keydown', (e) => {
    if (state.open && e.key === 'Escape') closePanel();
  });

  render();


  /* ---- Load the library, if there is one ------------------------------
     library.json is generated from your audio/ folder by
     build-library.mjs. When it loads it replaces the demo set entirely.
     When it's missing, the demo set stays and everything still works.
     ------------------------------------------------------------------ */

  fetch(BASE + MANIFEST, { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error('no library'); return r.json(); })
    .then((json) => {
      if (!json || !Object.keys(json).length) return;
      LIBRARY = json;
      state.genre = null; state.scene = null; state.view = 'menu';
      render();
    })
    .catch(() => { /* keep the built-in demo set */ });

})();
