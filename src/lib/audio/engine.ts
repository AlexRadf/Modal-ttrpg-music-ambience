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
import { bedUrl, layerCount, motifUrls, variantMotifs } from "./sources";
import { clamp, ramp, shuffle } from "./util";

/** One motif, scheduled or sounding. */
interface Pass {
  motif: MotifDef;
  startAt: number;
  endAt: number;
  sources: AudioBufferSourceNode[];
  urls: string[];
  released: boolean;
}

/**
 * One pool of motifs, playing. A deck normally has one; during a mode change it
 * briefly has two while the outgoing stack fades.
 */
interface Chain {
  mode: MusicMode;
  gain: GainNode;
  /** Persist across motifs, so intensity survives the join. */
  layers: GainNode[];
  order: MotifDef[];
  cursor: number;
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
      layerFadeMs: options.layerFadeMs ?? DEFAULTS.layerFadeMs,
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
    if (this.deck) for (const chain of this.deck.chains) this.applyIntensity(chain, this.opts.layerFadeMs / 1000);
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

    const layers = Math.max(...pool.map((m) => layerCount(m, deck.variant)));
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(deck.out);

    const chain: Chain = {
      mode,
      gain,
      layers: Array.from({ length: layers }, () => {
        const g = ctx.createGain();
        g.gain.value = 0;
        g.connect(gain);
        return g;
      }),
      order: shuffle(pool),
      cursor: 0,
      passes: [],
      timer: null,
      stopped: false,
    };

    this.applyIntensity(chain, 0);
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
   * Loads the next motif in the order and schedules it to start exactly when
   * `at` arrives. Because the start time is on the audio clock and the buffers
   * are already decoded, the join between motifs is sample-exact.
   */
  private async playNext(deck: Deck, chain: Chain, at: number, token: number): Promise<boolean> {
    const ctx = this.ctx;
    if (!ctx || chain.stopped || token !== this.generation) return false;

    if (chain.cursor >= chain.order.length) {
      // a fresh shuffle rather than the same rotation twice
      chain.order = shuffle(chain.order, chain.order[chain.order.length - 1]?.id);
      chain.cursor = 0;
    }
    const motif = chain.order[chain.cursor++];
    const urls = motifUrls(deck.theme, motif, deck.variant, this.opts.resolveSrc);

    const settled = await Promise.all(
      urls.map((url) => (url ? this.loader.load(url).catch(() => null) : Promise.resolve(null)))
    );
    if (!this.ctx || chain.stopped || token !== this.generation) return false;

    const buffers = settled.filter((b): b is AudioBuffer => !!b);
    if (buffers.length === 0) {
      this.report({ url: motif.id, message: "no stems could be loaded" });
      // skip a motif that cannot play rather than stalling the chain
      return chain.order.length > 1 ? this.playNext(deck, chain, at, token) : false;
    }

    // decoding may have overrun the join; start now and take the small gap
    const startAt = Math.max(at, ctx.currentTime + 0.02);
    const duration = Math.max(...buffers.map((b) => b.duration));
    const pass: Pass = { motif, startAt, endAt: startAt + duration, sources: [], urls: [], released: false };

    settled.forEach((buffer, layer) => {
      if (!buffer) return;
      const target = chain.layers[Math.min(layer, chain.layers.length - 1)];
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(target);
      source.start(startAt);
      pass.sources.push(source);

      const url = urls[layer];
      if (url) {
        this.loader.pin(url);
        pass.urls.push(url);
      }
    });

    chain.passes.push(pass);
    if (!chain.stopped) this.emit({ motifId: motif.id });

    // Queue the successor a little before this one ends — not now. Scheduling
    // the whole order up front would decode every motif in the pool and defeat
    // the point; the lead just has to cover a fetch and decode.
    // never lead by more than half the motif, or a motif shorter than the lead
    // would queue its successor instantly and run away down the pool
    const lead = Math.min(this.opts.motifQueueLeadMs / 1000, duration / 2);
    const delay = Math.max(0, pass.endAt - lead - ctx.currentTime) * 1000;
    if (chain.timer !== null) window.clearTimeout(chain.timer);
    chain.timer = window.setTimeout(() => {
      chain.timer = null;
      void this.playNext(deck, chain, pass.endAt, token);
    }, delay);

    // and let the finished one go, so memory stays at two motifs
    this.retirePass(chain, pass);

    return true;
  }

  private retirePass(chain: Chain, pass: Pass) {
    const ctx = this.ctx!;
    const after = (pass.endAt - ctx.currentTime + 0.5) * 1000;
    window.setTimeout(() => {
      if (pass.released) return;
      pass.released = true;
      for (const source of pass.sources) {
        try {
          source.disconnect();
        } catch {
          /* already gone */
        }
      }
      for (const url of pass.urls) this.loader.unpin(url);
      chain.passes = chain.passes.filter((p) => p !== pass);
    }, Math.max(0, after));
  }

  private applyIntensity(chain: Chain, fade: number) {
    if (!this.ctx) return;
    chain.layers.forEach((gain, i) => {
      ramp(gain.gain, i < this.intensity ? 1 : 0, fade, this.ctx!);
    });
  }

  private retireDeck() {
    this.generation++;
    if (this.deck) this.stopDeck(this.deck, this.opts.modeFadeMs / 1000);
    this.deck = null;
    this.emit({ motifId: null });
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
      for (const source of pass.sources) {
        try {
          source.stop(at);
        } catch {
          /* already stopped */
        }
      }
      if (!pass.released) {
        pass.released = true;
        for (const url of pass.urls) this.loader.unpin(url);
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
