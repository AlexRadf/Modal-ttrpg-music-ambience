/**
 * Playback modes. `off` silences the music bus; ambience beds keep their levels.
 *
 * `victory` is transitional rather than a resting state: it plays one swell and
 * hands back to `explore` on its own, which is how a fight ends without the GM
 * having to catch the moment.
 */
export type Mode = "off" | "explore" | "combat" | "victory";

/** The stacks a scene can be playing. `off` has no stack. */
export type MusicMode = Exclude<Mode, "off">;

/** Per-bed loudness. 0 is not playing; 1-3 map onto LEVEL_GAIN. */
export type BedLevel = 0 | 1 | 2 | 3;

/**
 * Music intensity. Each level is its own mix of a motif — level 1 might be
 * strings alone, level 3 strings with piano and bass — and changing level
 * crossfades between those mixes at the same point in the same passage.
 */
export type Intensity = 1 | 2 | 3 | 4 | 5;

/** See `EngineOptions.intensityMode`. */
export type IntensityMode = "mixes" | "layers";

/**
 * One ambience bed in the global library. Beds live in a single flat namespace
 * so any theme can borrow any bed, and so ids double as filenames.
 */
export interface BedDef {
  id: string;
  name: string;
  /** URL of the uploaded file. Omit to have `resolveSrc` derive it from the id. */
  src?: string;
  /** Static trim in linear gain, for beds that are hot or quiet at the source. */
  trim?: number;
}

/**
 * A musical section — one passage of a scene's score, half a minute or so long.
 *
 * A scene owns a pool of these and the console chains them, shuffled, so a few
 * minutes pass before the order comes round again. Motifs are the unit because
 * only the playing motif and the one queued behind it are ever decoded: memory
 * is bounded by the motif length, not by how long the music runs.
 *
 * Each motif carries its instrument layers as separate stems. They start on the
 * same sample and are gated by gain, so intensity adds and removes instruments
 * inside a passage without restarting it.
 */
export interface MotifDef {
  id: string;
  /** Which stack this belongs to; a scene's pool holds both. */
  mode: MusicMode;
  /** Optional label for authoring tools. */
  name?: string;
  /** Intensity mixes of this passage. Defaults to the variant's `intensities`. */
  intensities?: number;
  /** Explicit mix URLs by intensity. Omit to have `resolveSrc` derive them. */
  mixes?: string[];
  /** Length in bars. Authoring metadata; playback uses the decoded length. */
  bars?: number;
}

/** A tonal/emotional take on a theme — same place, different night. */
export interface VariantDef {
  id: string;
  name: string;
  /**
   * Motif ids this variant draws on, from its theme's pool. Omit to use the
   * whole pool. Overlapping selections are how two variants of one scene share
   * material while still sounding like different nights.
   */
  motifs?: string[];
  /** Intensity mixes per motif when a motif does not say. Defaults to 4. */
  intensities?: number;
}

/** A place. Carries its own art, palette, variants and default bed selection. */
export interface ThemeDef {
  id: string;
  name: string;
  /** Hex accent used across the UI while this theme is selected. */
  accent: string;
  /** Cover image URL. When null/absent, `art` is used instead. */
  image?: string | null;
  /** Any CSS background value — the placeholder until real cover art exists. */
  art?: string;
  bpm?: number;
  key?: string;
  /** Bars per motif. Authoring metadata: with `bpm` it fixes the stem length. */
  bars?: number;
  /** The scene's motifs, both stacks. Variants select from these. */
  motifs: MotifDef[];
  variants: VariantDef[];
  /** Bed ids shown by default for this theme, in display order. */
  ambience: string[];
}

/**
 * A stinger: fired by hand, plays once, sits on top of whatever is running.
 * Doors, explosions, a spell going off — the punctuation the GM adds live.
 */
export interface OneShotDef {
  id: string;
  name: string;
  /** Grouping for the UI, e.g. "Impacts", "Creature". */
  group?: string;
  src?: string;
  /** Static trim in linear gain. */
  trim?: number;
}

/** Everything the console needs to render and play. Swap it to reskin the widget. */
export interface AmbienceConfig {
  beds: Record<string, BedDef>;
  themes: ThemeDef[];
  /** Global stinger library, available in every scene. */
  oneShots?: Record<string, OneShotDef>;
}

/**
 * What the engine needs a URL for, so a host can name uploads however it likes.
 * Motifs belong to a scene rather than to a variant, so two variants that share
 * a motif share the file.
 */
export type SrcRequest =
  | { kind: "bed"; bedId: string }
  | { kind: "one-shot"; oneShotId: string }
  | { kind: "music"; themeId: string; motifId: string; mode: MusicMode; intensity: number };

/**
 * Maps a request onto the URL the file was uploaded to. Returning `null` means
 * "nothing was uploaded for this" — the engine skips it silently rather than
 * reporting a missing file.
 */
export type SrcResolver = (req: SrcRequest) => string | null;

export interface EngineOptions {
  /** Crossfade when the theme or variant changes. */
  crossfadeMs?: number;
  /** Crossfade between two intensity mixes of the same motif. */
  intensityFadeMs?: number;
  /**
   * How intensity is built, so the two can be compared on real material.
   *
   * `mixes` (default): each level is a complete mix of the passage, and
   * changing level crossfades to that level of the *same* motif at the same
   * position. Every level must exist for every motif. One file sounding at a
   * time, so it is also the lighter of the two.
   *
   * `layers`: each level is an additive stem, and they sum. Level 3 means
   * stems 1, 2 and 3 sounding together. Raising the level fades a stem in
   * rather than crossfading the passage.
   */
  intensityMode?: IntensityMode;
  /** Fade when switching between the exploration and combat stacks. */
  modeFadeMs?: number;
  /** Fade when a bed changes level. */
  bedFadeMs?: number;
  /** 0..1, applied at the master bus. */
  masterVolume?: number;
  /** Where the uploaded files live. Required unless every asset carries its own URL. */
  resolveSrc?: SrcResolver;
  /** Passed to every `fetch` — for `credentials`, auth headers, or a CORS mode. */
  fetchInit?: RequestInit;
  /**
   * Ceiling on decoded audio held in memory, in bytes. Buffers that are not
   * currently sounding are dropped, least recently used first, to stay under
   * it. Decoded audio is uncompressed — a 45 s stereo stem at 44.1 kHz is about
   * 16 MB whatever the file size — so this, not the download, is what bounds
   * the console's footprint. Default 192 MB.
   */
  maxDecodedBytes?: number;
  /** How long a motif may overrun while its successor is still decoding. */
  motifQueueLeadMs?: number;
  /**
   * How many motifs must pass before one can be heard again. Keeps a shuffle
   * from putting the same passage back immediately. Default 3, clamped to the
   * pool size.
   */
  noRepeatWindow?: number;
}

/** An asset that could not be fetched or decoded. */
export interface LoadFailure {
  url: string;
  message: string;
}

/** Snapshot of what the engine is doing, for loading states and diagnostics. */
export interface EngineStatus {
  running: boolean;
  loading: boolean;
  /** Most recent load failures, newest last. */
  errors: LoadFailure[];
  /** Bed ids whose audio could not be loaded, so the UI can mark them. */
  unavailableBeds: string[];
  /** The motif currently sounding, if any. */
  motifId: string | null;
  /**
   * The mode the engine is actually in. It moves on its own when a victory
   * swell finishes and hands back to exploration, so the UI follows this.
   */
  mode: Mode;
  /** Decoded audio currently held, in bytes. */
  decodedBytes: number;
}
