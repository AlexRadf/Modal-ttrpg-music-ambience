import { DEFAULTS, LEVEL_GAIN, MAX_INTENSITY, busTrim } from "../constants";
import type {
  AmbienceConfig,
  BedLevel,
  EngineOptions,
  EngineStatus,
  Intensity,
  LoadFailure,
  Mode,
  MusicMode,
} from "../types";
import { AssetLoader } from "./loader";
import { MUSIC_MODES, bedUrl, musicUrls } from "./sources";
import { clamp, ramp } from "./util";

/** One theme+variant, loaded and playing. Layers that failed to load are null. */
interface Deck {
  key: string;
  out: GainNode;
  modes: Record<MusicMode, GainNode>;
  layers: Record<MusicMode, Array<GainNode | null>>;
  sources: AudioBufferSourceNode[];
  stopped: boolean;
}

interface Bed {
  gain: GainNode;
  source: AudioBufferSourceNode | null;
  level: BedLevel;
  stopping: boolean;
}

/**
 * The audio side of the console, with no React in it.
 *
 * Signal flow:
 *
 *   master ─┬─ music ── deck ─┬─ explore ── layer 1..n
 *           │                 └─ combat  ── layer 1..n
 *           └─ ambience ── bed × n
 *
 * Every stem of a deck starts on the same sample and runs for the life of the
 * deck; intensity and mode only move gain. That is what keeps the layers phase
 * locked, so raising the intensity sounds like an arrangement opening up rather
 * than a second track being started.
 */
export class AmbienceEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private ambienceBus!: GainNode;
  private loader!: AssetLoader;

  private deck: Deck | null = null;
  private beds = new Map<string, Bed>();
  private unavailable = new Set<string>();
  private listeners = new Set<(s: EngineStatus) => void>();

  private scene: { themeId: string; variantId: string } | null = null;
  private mode: Mode = "off";
  private intensity: Intensity = 3;
  private generation = 0;
  private status: EngineStatus = { running: false, loading: false, errors: [], unavailableBeds: [] };

  private opts: Required<Omit<EngineOptions, "resolveSrc" | "fetchInit">> &
    Pick<EngineOptions, "resolveSrc" | "fetchInit">;

  constructor(private config: AmbienceConfig, options: EngineOptions = {}) {
    this.opts = {
      crossfadeMs: options.crossfadeMs ?? DEFAULTS.crossfadeMs,
      layerFadeMs: options.layerFadeMs ?? DEFAULTS.layerFadeMs,
      modeFadeMs: options.modeFadeMs ?? DEFAULTS.modeFadeMs,
      bedFadeMs: options.bedFadeMs ?? DEFAULTS.bedFadeMs,
      masterVolume: options.masterVolume ?? DEFAULTS.masterVolume,
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

    this.loader = new AssetLoader(ctx, {
      fetchInit: this.opts.fetchInit,
      onBusy: (busy) => this.emit({ loading: busy }),
      onError: (failure) => this.report(failure),
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

  /* ------------------------------------------------------------- sources -- */

  /**
   * Downloads and decodes a scene's assets without disturbing playback. Worth
   * calling when the console opens, so the first press of play is instant.
   */
  async preload(themeId: string, variantId?: string): Promise<void> {
    const theme = this.config.themes.find((t) => t.id === themeId);
    if (!theme) return;
    const variant = theme.variants.find((v) => v.id === variantId) ?? theme.variants[0];
    if (!variant) return;

    this.ensure();
    const urls = musicUrls(theme, variant, this.opts.resolveSrc);
    const wanted = MUSIC_MODES.flatMap((mode) => urls[mode])
      .concat(theme.ambience.map((bedId) => bedUrl(this.config, bedId, this.opts.resolveSrc)))
      .filter((url): url is string => !!url);

    await this.loader.prefetch(wanted);
  }

  /* ---------------------------------------------------------------- music - */

  /** Loads a theme+variant and crossfades it in. Safe to call while one is loading. */
  async setScene(themeId: string, variantId: string): Promise<void> {
    this.scene = { themeId, variantId };
    if (this.mode === "off") {
      // nothing audible to build yet; the deck is created when a mode is chosen
      if (this.deck) this.retireDeck();
      return;
    }
    await this.loadDeck(themeId, variantId);
  }

  setIntensity(n: Intensity) {
    this.intensity = clamp(n, 1, MAX_INTENSITY) as Intensity;
    if (this.deck) this.applyIntensity(this.deck, this.opts.layerFadeMs / 1000);
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
    this.applyMode(this.deck, this.opts.modeFadeMs / 1000);
  }

  private async loadDeck(themeId: string, variantId: string): Promise<void> {
    const ctx = this.ensure();
    const theme = this.config.themes.find((t) => t.id === themeId);
    const variant = theme?.variants.find((v) => v.id === variantId) || theme?.variants[0];
    if (!theme || !variant) return;

    const key = themeId + "/" + variant.id;
    if (this.deck && this.deck.key === key) return;

    const token = ++this.generation;
    const urls = musicUrls(theme, variant, this.opts.resolveSrc);
    const buffers = {} as Record<MusicMode, Array<AudioBuffer | null>>;

    // one bad stem should not cost the whole scene, so failures are tolerated
    const settled = await Promise.all(
      MUSIC_MODES.map((mode) =>
        Promise.allSettled(urls[mode].map((url) => (url ? this.loader.load(url) : Promise.resolve(null))))
      )
    );
    if (token !== this.generation || !this.ctx) return;

    let loaded = 0;
    MUSIC_MODES.forEach((mode, i) => {
      buffers[mode] = settled[i].map((result) => {
        const buffer = result.status === "fulfilled" ? result.value : null;
        if (buffer) loaded++;
        return buffer;
      });
    });

    if (loaded === 0) {
      // nothing to play: keep whatever is already playing rather than going silent
      const declared = MUSIC_MODES.some((mode) => urls[mode].some(Boolean));
      this.report({ url: key, message: declared ? "no stems could be loaded" : "no music uploaded for this variant" });
      return;
    }

    const deck = this.buildDeck(ctx, key, buffers);
    const fade = this.opts.crossfadeMs / 1000;

    this.applyIntensity(deck, 0);
    this.applyMode(deck, 0);
    ramp(deck.out.gain, 1, fade, ctx);

    if (this.deck) this.stopDeck(this.deck, fade);
    this.deck = deck;
  }

  private buildDeck(ctx: AudioContext, key: string, buffers: Record<MusicMode, Array<AudioBuffer | null>>): Deck {
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.musicBus);

    const modes = {} as Record<MusicMode, GainNode>;
    const layers = {} as Record<MusicMode, Array<GainNode | null>>;
    const sources: AudioBufferSourceNode[] = [];

    // one start time for every stem in the deck — this is the phase lock
    const startAt = ctx.currentTime + 0.12;

    for (const mode of MUSIC_MODES) {
      const modeGain = ctx.createGain();
      modeGain.gain.value = 0;
      modeGain.connect(out);
      modes[mode] = modeGain;

      layers[mode] = (buffers[mode] ?? []).map((buffer) => {
        if (!buffer) return null;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.connect(modeGain);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(gain);
        source.start(startAt);
        sources.push(source);

        return gain;
      });
    }

    return { key, out, modes, layers, sources, stopped: false };
  }

  private applyIntensity(deck: Deck, fade: number) {
    if (!this.ctx) return;
    for (const mode of MUSIC_MODES) {
      deck.layers[mode].forEach((gain, i) => {
        if (gain) ramp(gain.gain, i < this.intensity ? 1 : 0, fade, this.ctx!);
      });
    }
  }

  private applyMode(deck: Deck, fade: number) {
    if (!this.ctx) return;
    for (const mode of MUSIC_MODES) {
      ramp(deck.modes[mode].gain, this.mode === mode ? 1 : 0, fade, this.ctx);
    }
  }

  /** Fade the current deck out and let it go — used when switching to `off`. */
  private retireDeck() {
    this.generation++;
    if (this.deck) this.stopDeck(this.deck, this.opts.modeFadeMs / 1000);
    this.deck = null;
  }

  private stopDeck(deck: Deck, fade: number) {
    if (deck.stopped || !this.ctx) return;
    deck.stopped = true;
    ramp(deck.out.gain, 0, fade, this.ctx);
    const at = this.ctx.currentTime + fade + 0.05;
    for (const source of deck.sources) {
      try {
        source.stop(at);
      } catch {
        /* already stopped */
      }
    }
    window.setTimeout(() => deck.out.disconnect(), (fade + 0.2) * 1000);
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
    const bed: Bed = { gain, source: null, level, stopping: false };
    this.beds.set(bedId, bed);
    this.trimAmbienceBus(fade);

    void this.loader
      .load(url)
      .then((buffer) => {
        this.markBed(bedId, true);
        // the row may have been switched off again while this was decoding
        if (this.beds.get(bedId) !== bed || bed.stopping || bed.level === 0 || !this.ctx) return;
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
