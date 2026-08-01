import { DEFAULTS, LEVEL_GAIN, MAX_INTENSITY, busTrim } from "../constants";
import type {
  AmbienceConfig,
  BedLevel,
  EngineOptions,
  EngineStatus,
  Intensity,
  LoadFailure,
  Mode,
  MotifDef,
  MusicMode,
  ThemeDef,
  VariantDef,
} from "../types";
import { AssetLoader } from "./loader";
import { bedUrl, motifUrls, oneShotUrl, variantMotifs } from "./sources";
import { clamp, ramp, shuffle } from "./util";

/** One sounding source and its gain — a stem, or one intensity mix. */
interface Voice {
  level: number;
  source: AudioBufferSourceNode;
  gain: GainNode;
  url: string;
}

/** One motif, scheduled or sounding. */
interface Pass {
  motif: MotifDef;
  startAt: number;
  endAt: number;
  voices: Voice[];
  released: boolean;
}

/**
 * One pool of motifs, playing. A deck normally has one; during a mode change it
 * briefly has two while the outgoing stack fades.
 */
interface Chain {
  mode: MusicMode;
  gain: GainNode;
  pool: MotifDef[];
  order: MotifDef[];
  cursor: number;
  /** Motif ids recently heard, newest first — the no-repeat window. */
  recent: string[];
  passes: Pass[];
  /** Fires shortly before the sounding motif ends, to queue its successor. */
  timer: number | null;
  stopped: boolean;
}

/** One theme+variant. */
interface Deck {
  key: string;
  theme: ThemeDef;
  variant: VariantDef;
  out: GainNode;
  chains: Chain[];
  stopped: boolean;
}

interface Bed {
  gain: GainNode;
  source: AudioBufferSourceNode | null;
  level: BedLevel;
  stopping: boolean;
  url: string | null;
}

/**
 * The audio side of the console, with no React in it.
 *
 *   master ─┬─ music ── deck ── chain ── layer 1..n ← motif stems
 *           └─ ambience ── bed × n
 *
 * A scene's score is a pool of motifs, shuffled and chained end to end on the
 * audio clock, so the join is sample-exact and the music runs for minutes
 * without repeating its order. Only the sounding motif and the one queued
 * behind it are ever decoded, which is what keeps memory flat however long the
 * session runs.
 *
 * Inside a motif, the instrument stems all start on the same sample and are
 * gated by gain. Intensity moves those gains, so raising it adds an instrument
 * to a passage already in progress rather than restarting anything. The layer
 * gains belong to the chain, not to the motif, so the setting carries across
 * the join untouched.
 */
export class AmbienceEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private ambienceBus!: GainNode;
  private sfxBus!: GainNode;
  private loader!: AssetLoader;

  private deck: Deck | null = null;
  private beds = new Map<string, Bed>();
  private unavailable = new Set<string>();
  private listeners = new Set<(s: EngineStatus) => void>();

  private scene: { themeId: string; variantId: string } | null = null;
  private mode: Mode = "off";
  private intensity: Intensity = 3;
  private generation = 0;
  private switchSeq = 0;
  private status: EngineStatus = {
    running: false,
    loading: false,
    errors: [],
    unavailableBeds: [],
    motifId: null,
    decodedBytes: 0,
  };

  private opts: Required<Omit<EngineOptions, "resolveSrc" | "fetchInit">> &
    Pick<EngineOptions, "resolveSrc" | "fetchInit">;

  constructor(private config: AmbienceConfig, options: EngineOptions = {}) {
    this.opts = {
      crossfadeMs: options.crossfadeMs ?? DEFAULTS.crossfadeMs,
      intensityFadeMs: options.intensityFadeMs ?? DEFAULTS.intensityFadeMs,
      intensityMode: options.intensityMode ?? DEFAULTS.intensityMode,
      noRepeatWindow: options.noRepeatWindow ?? DEFAULTS.noRepeatWindow,
      modeFadeMs: options.modeFadeMs ?? DEFAULTS.modeFadeMs,
      bedFadeMs: options.bedFadeMs ?? DEFAULTS.bedFadeMs,
      masterVolume: options.masterVolume ?? DEFAULTS.masterVolume,
      maxDecodedBytes: options.maxDecodedBytes ?? DEFAULTS.maxDecodedBytes,
      motifQueueLeadMs: options.motifQueueLeadMs ?? DEFAULTS.motifQueueLeadMs,
      resolveSrc: options.resolveSrc,
      fetchInit: options.fetchInit,
    };
  }

  /* ------------------------------------------------------------- status --- */

  onStatus(fn: (s: EngineStatus) => void): () => void {
    this.listeners.add(fn);
    fn(this.status);
    return () => this.listeners.delete(fn);
  }

  private emit(patch: Partial<EngineStatus>) {
    this.status = { ...this.status, ...patch };
    for (const fn of this.listeners) fn(this.status);
  }

  private report(failure: LoadFailure) {
    this.emit({ errors: this.status.errors.concat(failure).slice(-12) });
  }

  private markBed(bedId: string, available: boolean) {
    const had = this.unavailable.has(bedId);
    if (available === !had) return;
    if (available) this.unavailable.delete(bedId);
    else this.unavailable.add(bedId);
    this.emit({ unavailableBeds: [...this.unavailable] });
  }

  /* ------------------------------------------------------------ lifecycle - */

  /**
   * Builds the graph on first use. Browsers only allow a context to start from a
   * user gesture, so this is deliberately not called from the constructor.
   */
  private ensure(): AudioContext {
    if (this.ctx) return this.ctx;

    const Ctor: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.opts.masterVolume;
    this.master.connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 1;
    this.musicBus.connect(this.master);

    this.ambienceBus = ctx.createGain();
    this.ambienceBus.gain.value = 1;
    this.ambienceBus.connect(this.master);

    // stingers sit on their own bus so the ambience trim never ducks them
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 1;
    this.sfxBus.connect(this.master);

    this.loader = new AssetLoader(ctx, {
      maxDecodedBytes: this.opts.maxDecodedBytes,
      fetchInit: this.opts.fetchInit,
      onBusy: (busy) => this.emit({ loading: busy }),
      onError: (failure) => this.report(failure),
      onFootprint: (decodedBytes) => this.emit({ decodedBytes }),
    });

    return ctx;
  }

  /** Must be called from a user gesture the first time. */
  async resume(): Promise<void> {
    const ctx = this.ensure();
    if (ctx.state !== "running") await ctx.resume();
    this.emit({ running: ctx.state === "running" });
  }

  async suspend(): Promise<void> {
    if (!this.ctx || this.ctx.state === "closed") return;
    await this.ctx.suspend();
    this.emit({ running: false });
  }

  dispose() {
    this.generation++;
    if (this.deck) this.stopDeck(this.deck, 0);
    this.deck = null;
    for (const [, bed] of this.beds) this.killBed(bed, 0);
    this.beds.clear();
    this.listeners.clear();
    if (this.ctx && this.ctx.state !== "closed") void this.ctx.close();
    this.ctx = null;
  }

  setMasterVolume(v: number) {
    this.opts.masterVolume = clamp(v, 0, 1);
    if (this.ctx) ramp(this.master.gain, this.opts.masterVolume, 0.08, this.ctx);
  }

  /* ------------------------------------------------------------- loading -- */

  private find(themeId: string, variantId?: string) {
    const theme = this.config.themes.find((t) => t.id === themeId);
    const variant = theme?.variants.find((v) => v.id === variantId) ?? theme?.variants[0];
    return theme && variant ? { theme, variant } : null;
  }

  /**
   * Downloads and decodes the first motif of a scene plus its beds, without
   * disturbing playback. Worth calling when the console opens, so the first
   * press of play is instant.
   */
  async preload(themeId: string, variantId?: string): Promise<void> {
    const found = this.find(themeId, variantId);
    if (!found) return;
    this.ensure();

    const { theme, variant } = found;
    const first = variantMotifs(theme, variant, "explore")[0];
    const stems = first ? motifUrls(theme, first, variant, this.opts.resolveSrc) : [];
    const beds = theme.ambience.map((bedId) => bedUrl(this.config, bedId, this.opts.resolveSrc));

    await this.loader.prefetch(stems.concat(beds).filter((url): url is string => !!url));
  }

  /* ---------------------------------------------------------------- music - */

  /** Loads a theme+variant and crossfades it in. Safe to call while one is loading. */
  async setScene(themeId: string, variantId: string): Promise<void> {
    this.scene = { themeId, variantId };
    if (this.mode === "off") {
      if (this.deck) this.retireDeck();
      return;
    }
    await this.loadDeck(themeId, variantId);
  }

  setIntensity(n: Intensity) {
    this.intensity = clamp(n, 1, MAX_INTENSITY) as Intensity;
    if (!this.deck || !this.ctx) return;
    const fade = this.opts.intensityFadeMs / 1000;

    for (const chain of this.deck.chains) {
      for (const pass of chain.passes) {
        if (this.opts.intensityMode === "layers") {
          // additive stems: gate the ones above the level
          for (const voice of pass.voices) {
            ramp(voice.gain.gain, voice.level <= this.intensity ? 1 : 0, fade, this.ctx);
          }
        } else {
          void this.swapPassIntensity(chain, pass, fade);
        }
      }
    }
  }

  setMode(mode: Mode) {
    const previous = this.mode;
    this.mode = mode;
    if (!this.ctx) {
      if (mode !== "off" && this.scene) void this.setScene(this.scene.themeId, this.scene.variantId);
      return;
    }

    if (mode === "off") {
      this.retireDeck();
      return;
    }
    if (previous === "off" || !this.deck) {
      if (this.scene) void this.loadDeck(this.scene.themeId, this.scene.variantId);
      return;
    }
    void this.switchChain(this.deck, mode);
  }

  private async loadDeck(themeId: string, variantId: string): Promise<void> {
    const ctx = this.ensure();
    const found = this.find(themeId, variantId);
    if (!found) return;

    const { theme, variant } = found;
    const key = theme.id + "/" + variant.id;
    if (this.deck && this.deck.key === key) return;

    const mode: MusicMode = this.mode === "combat" ? "combat" : "explore";
    const token = ++this.generation;

    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.musicBus);
    const deck: Deck = { key, theme, variant, out, chains: [], stopped: false };

    const chain = await this.startChain(deck, mode, token);
    if (token !== this.generation || !this.ctx) {
      if (chain) this.stopChain(chain, 0);
      out.disconnect();
      return;
    }
    if (!chain) {
      out.disconnect();
      return;
    }

    // the deck's own gain does the crossfade; the chain sits open behind it
    chain.gain.gain.value = 1;

    const fade = this.opts.crossfadeMs / 1000;
    ramp(out.gain, 1, fade, ctx);
    if (this.deck) this.stopDeck(this.deck, fade);
    this.deck = deck;
  }

  /** Builds a chain for a mode and gets its first motif sounding. */
  private async startChain(deck: Deck, mode: MusicMode, token: number): Promise<Chain | null> {
    const ctx = this.ctx!;
    const pool = variantMotifs(deck.theme, deck.variant, mode);
    if (pool.length === 0) {
      this.report({ url: deck.key + "/" + mode, message: "no motifs for this stack" });
      return null;
    }

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(deck.out);

    const chain: Chain = {
      mode,
      gain,
      pool,
      order: shuffle(pool),
      cursor: 0,
      recent: [],
      passes: [],
      timer: null,
      stopped: false,
    };

    const started = await this.playNext(deck, chain, ctx.currentTime + 0.12, token);
    if (!started) {
      gain.disconnect();
      return null;
    }

    deck.chains.push(chain);
    return chain;
  }

  /** Fades from the current stack to the other one. */
  private async switchChain(deck: Deck, mode: MusicMode): Promise<void> {
    const current = deck.chains[deck.chains.length - 1];
    if (current && current.mode === mode) return;

    const token = this.generation;
    const seq = ++this.switchSeq;
    const fade = this.opts.modeFadeMs / 1000;

    const chain = await this.startChain(deck, mode, token);
    // a second switch, or a scene change, landed while this stack was loading
    if (!chain || seq !== this.switchSeq || token !== this.generation || !this.ctx) {
      if (chain) {
        this.stopChain(chain, 0);
        deck.chains = deck.chains.filter((c) => c !== chain);
      }
      return;
    }

    ramp(chain.gain.gain, 1, fade, this.ctx);
    for (const other of deck.chains) if (other !== chain) this.stopChain(other, fade);
    deck.chains = [chain];
  }

  /**
   * The next motif, honouring the no-repeat window: a passage heard in the last
   * `noRepeatWindow` motifs is stepped over rather than played again. The bag is
   * still a shuffle, so every motif gets its turn within a cycle.
   */
  private pickMotif(chain: Chain): MotifDef {
    if (chain.cursor >= chain.order.length) {
      chain.order = shuffle(chain.order);
      chain.cursor = 0;
    }

    const window = Math.min(this.opts.noRepeatWindow, Math.max(0, chain.pool.length - 1));
    const blocked = chain.recent.slice(0, window);

    let i = chain.cursor;
    while (i < chain.order.length && blocked.includes(chain.order[i].id)) i++;
    // a pool smaller than the window can leave nothing eligible; take the next
    if (i >= chain.order.length) i = chain.cursor;

    const [motif] = chain.order.splice(i, 1);
    chain.order.splice(chain.cursor, 0, motif);
    chain.cursor++;
    chain.recent = [motif.id, ...chain.recent].slice(0, 12);
    return motif;
  }

  /**
   * Loads the next motif and schedules it to start exactly when `at` arrives.
   * Because the start time is on the audio clock and the buffers are already
   * decoded, the join between motifs is sample-exact.
   */
  private async playNext(deck: Deck, chain: Chain, at: number, token: number, attempt = 0): Promise<boolean> {
    const ctx = this.ctx;
    if (!ctx || chain.stopped || token !== this.generation) return false;

    const motif = this.pickMotif(chain);
    const pass = await this.startPass(deck, chain, motif, at, token);
    if (!pass) {
      // skip a motif that cannot play rather than stalling the chain
      return attempt + 1 < chain.pool.length ? this.playNext(deck, chain, at, token, attempt + 1) : false;
    }

    if (!chain.stopped) this.emit({ motifId: motif.id });
    if (chain.timer !== null) window.clearTimeout(chain.timer);

    // Queue the successor a little before this one ends — not now. Scheduling
    // the whole order up front would decode every motif in the pool and defeat
    // the point; the lead just has to cover a fetch and decode, and never more
    // than half the motif or a short one would re-arm instantly and run away.
    const duration = pass.endAt - pass.startAt;
    const lead = Math.min(this.opts.motifQueueLeadMs / 1000, duration / 2);
    const delay = Math.max(0, pass.endAt - lead - ctx.currentTime) * 1000;
    chain.timer = window.setTimeout(() => {
      chain.timer = null;
      void this.playNext(deck, chain, pass.endAt, token);
    }, delay);

    // and let the finished one go, so memory stays at two motifs
    this.retirePass(chain, pass);
    return true;
  }

  /**
   * Starts one motif. In `layers` mode every stem sounds at once and intensity
   * gates them; in `mixes` mode only the current level sounds and intensity
   * crossfades to another mix of the same passage.
   */
  private async startPass(
    deck: Deck,
    chain: Chain,
    motif: MotifDef,
    at: number,
    token: number
  ): Promise<Pass | null> {
    const urls = motifUrls(deck.theme, motif, deck.variant, this.opts.resolveSrc);
    const wanted =
      this.opts.intensityMode === "layers"
        ? urls.map((url, i) => ({ url, level: i + 1 }))
        : [{ url: urls[this.levelFor(urls.length) - 1] ?? null, level: this.levelFor(urls.length) }];

    const present = wanted.filter((w): w is { url: string; level: number } => !!w.url);
    if (present.length === 0) return null;

    const buffers = await Promise.all(present.map((w) => this.loader.load(w.url).catch(() => null)));
    const ctx = this.ctx;
    if (!ctx || chain.stopped || token !== this.generation) return null;

    const ok = present
      .map((w, i) => ({ ...w, buffer: buffers[i] }))
      .filter((w): w is { url: string; level: number; buffer: AudioBuffer } => !!w.buffer);
    if (ok.length === 0) {
      this.report({ url: motif.id, message: "no audio could be loaded for this motif" });
      return null;
    }

    // decoding may have overrun the join; start now and take the small gap
    const startAt = Math.max(at, ctx.currentTime + 0.02);
    const duration = Math.max(...ok.map((o) => o.buffer.duration));
    const pass: Pass = { motif, startAt, endAt: startAt + duration, voices: [], released: false };

    for (const o of ok) {
      pass.voices.push(this.startVoice(chain, o.url, o.buffer, o.level, startAt, 0, this.voiceGain(o.level)));
    }

    chain.passes.push(pass);
    return pass;
  }

  /** The intensity level actually available, given how many were authored. */
  private levelFor(available: number): number {
    return Math.max(1, Math.min(this.intensity, available));
  }

  private voiceGain(level: number): number {
    return this.opts.intensityMode === "layers" ? (level <= this.intensity ? 1 : 0) : 1;
  }

  private startVoice(
    chain: Chain,
    url: string,
    buffer: AudioBuffer,
    level: number,
    when: number,
    offset: number,
    gainValue: number
  ): Voice {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    gain.connect(chain.gain);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    this.loader.pin(url);
    source.start(when, offset);

    return { level, source, gain, url };
  }

  /**
   * Crossfades a pass to a different intensity mix of the *same* motif, entered
   * at the same point in the passage — which is why every level has to exist for
   * every motif.
   */
  private async swapPassIntensity(chain: Chain, pass: Pass, fade: number): Promise<void> {
    const deck = this.deck;
    if (!deck || !this.ctx || pass.released || chain.stopped) return;

    const urls = motifUrls(deck.theme, pass.motif, deck.variant, this.opts.resolveSrc);
    const level = this.levelFor(urls.length);
    if (pass.voices.length === 1 && pass.voices[0].level === level) return;

    const url = urls[level - 1];
    if (!url) return;

    let buffer: AudioBuffer;
    try {
      buffer = await this.loader.load(url);
    } catch {
      return;
    }
    // the slider may have moved again while this decoded
    if (!this.ctx || pass.released || chain.stopped || this.levelFor(urls.length) !== level) return;

    const now = this.ctx.currentTime;
    if (pass.startAt > now + 0.02) {
      // still queued: swap it outright, same motif, same slot
      const old = pass.voices;
      pass.voices = [this.startVoice(chain, url, buffer, level, pass.startAt, 0, 1)];
      for (const v of old) this.endVoice(v, 0);
      return;
    }

    const when = now + 0.05;
    const offset = when - pass.startAt;
    if (offset >= buffer.duration) return;

    const next = this.startVoice(chain, url, buffer, level, when, offset, 0);
    ramp(next.gain.gain, 1, fade, this.ctx);
    const old = pass.voices;
    pass.voices = [next];
    for (const v of old) this.endVoice(v, fade);
  }

  private endVoice(voice: Voice, fade: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    ramp(voice.gain.gain, 0, fade, ctx);
    try {
      voice.source.stop(ctx.currentTime + fade + 0.05);
    } catch {
      /* already stopped */
    }
    this.loader.unpin(voice.url);
    window.setTimeout(() => voice.gain.disconnect(), (fade + 0.25) * 1000);
  }

  private retirePass(chain: Chain, pass: Pass) {
    const ctx = this.ctx!;
    const after = (pass.endAt - ctx.currentTime + 0.5) * 1000;
    window.setTimeout(() => {
      if (pass.released) return;
      pass.released = true;
      for (const voice of pass.voices) {
        try {
          voice.source.disconnect();
        } catch {
          /* already gone */
        }
        voice.gain.disconnect();
        this.loader.unpin(voice.url);
      }
      chain.passes = chain.passes.filter((p) => p !== pass);
    }, Math.max(0, after));
  }

  private retireDeck() {
    this.generation++;
    if (this.deck) this.stopDeck(this.deck, this.opts.modeFadeMs / 1000);
    this.deck = null;
    this.emit({ motifId: null });
  }

  /* ------------------------------------------------------------ one-shots - */

  /**
   * Fires a stinger over the top of whatever is playing. Nothing is held: the
   * buffer is unpinned as soon as it has finished, and repeated presses layer
   * rather than cutting each other off.
   */
  async fireOneShot(oneShotId: string): Promise<void> {
    this.ensure();
    const url = oneShotUrl(this.config, oneShotId, this.opts.resolveSrc);
    if (!url) {
      this.report({ url: oneShotId, message: "no audio uploaded for this one-shot" });
      return;
    }

    let buffer: AudioBuffer;
    try {
      buffer = await this.loader.load(url);
    } catch {
      return;
    }
    if (!this.ctx) return;

    const gain = this.ctx.createGain();
    gain.gain.value = this.config.oneShots?.[oneShotId]?.trim ?? 1;
    gain.connect(this.sfxBus);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    this.loader.pin(url);
    source.start();
    source.onended = () => {
      gain.disconnect();
      this.loader.unpin(url);
    };
  }

  private stopDeck(deck: Deck, fade: number) {
    if (deck.stopped || !this.ctx) return;
    deck.stopped = true;
    ramp(deck.out.gain, 0, fade, this.ctx);
    for (const chain of deck.chains) this.stopChain(chain, fade);
    window.setTimeout(() => {
      deck.out.disconnect();
      this.loader.releaseUnpinned();
    }, (fade + 0.3) * 1000);
  }

  private stopChain(chain: Chain, fade: number) {
    if (chain.stopped || !this.ctx) return;
    chain.stopped = true;
    if (chain.timer !== null) {
      window.clearTimeout(chain.timer);
      chain.timer = null;
    }
    ramp(chain.gain.gain, 0, fade, this.ctx);
    const at = this.ctx.currentTime + fade + 0.05;
    for (const pass of chain.passes) {
      for (const voice of pass.voices) {
        try {
          voice.source.stop(at);
        } catch {
          /* already stopped */
        }
      }
      if (!pass.released) {
        pass.released = true;
        for (const voice of pass.voices) this.loader.unpin(voice.url);
      }
    }
    window.setTimeout(() => chain.gain.disconnect(), (fade + 0.3) * 1000);
  }

  /* -------------------------------------------------------------- ambience - */

  setBedLevel(bedId: string, level: BedLevel) {
    const ctx = this.ensure();
    const fade = this.opts.bedFadeMs / 1000;
    const existing = this.beds.get(bedId);

    if (level === 0) {
      if (existing) {
        this.killBed(existing, fade);
        this.beds.delete(bedId);
      }
      this.trimAmbienceBus(fade);
      return;
    }

    if (existing && !existing.stopping) {
      existing.level = level;
      ramp(existing.gain.gain, this.bedGain(bedId, level), fade, ctx);
      this.trimAmbienceBus(fade);
      return;
    }

    const url = bedUrl(this.config, bedId, this.opts.resolveSrc);
    if (!url) {
      this.markBed(bedId, false);
      this.report({ url: bedId, message: "no audio uploaded for this bed" });
      return;
    }

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.ambienceBus);
    const bed: Bed = { gain, source: null, level, stopping: false, url };
    this.beds.set(bedId, bed);
    this.trimAmbienceBus(fade);

    void this.loader
      .load(url)
      .then((buffer) => {
        this.markBed(bedId, true);
        // the row may have been switched off again while this was decoding
        if (this.beds.get(bedId) !== bed || bed.stopping || bed.level === 0 || !this.ctx) return;
        this.loader.pin(url);
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(bed.gain);
        // a random offset stops two beds from the same file lining up
        source.start(this.ctx.currentTime, Math.random() * buffer.duration);
        bed.source = source;
        ramp(bed.gain.gain, this.bedGain(bedId, bed.level), fade, this.ctx);
      })
      .catch(() => {
        this.markBed(bedId, false);
        if (this.beds.get(bedId) === bed) {
          bed.gain.disconnect();
          this.beds.delete(bedId);
        }
        this.trimAmbienceBus(fade);
      });
  }

  private bedGain(bedId: string, level: Exclude<BedLevel, 0>): number {
    return LEVEL_GAIN[level] * (this.config.beds[bedId]?.trim ?? 1);
  }

  private killBed(bed: Bed, fade: number) {
    if (!this.ctx) return;
    bed.stopping = true;
    ramp(bed.gain.gain, 0, fade, this.ctx);
    const at = this.ctx.currentTime + fade + 0.05;
    try {
      bed.source?.stop(at);
    } catch {
      /* already stopped */
    }
    if (bed.url && bed.source) this.loader.unpin(bed.url);
    window.setTimeout(() => bed.gain.disconnect(), (fade + 0.2) * 1000);
  }

  /** Keeps n simultaneous beds at the same perceived level as one. */
  private trimAmbienceBus(fade: number) {
    if (!this.ctx) return;
    let active = 0;
    for (const [, bed] of this.beds) if (!bed.stopping && bed.level > 0) active++;
    ramp(this.ambienceBus.gain, busTrim(active), fade, this.ctx);
  }
}
