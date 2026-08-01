/** Playback modes. `off` silences the music bus; ambience beds keep their levels. */
export type Mode = "off" | "explore" | "combat";

/** The two musical stacks a variant can be playing. `off` has no stack. */
export type MusicMode = Exclude<Mode, "off">;

/** Per-bed loudness. 0 is not playing; 1-3 map onto LEVEL_GAIN. */
export type BedLevel = 0 | 1 | 2 | 3;

/** Music intensity, i.e. how many stem layers of the current stack are unmuted. */
export type Intensity = 1 | 2 | 3 | 4 | 5;

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

/** A tonal/emotional take on a theme — same place, different night. */
export interface VariantDef {
  id: string;
  name: string;
  /**
   * Stem URLs, innermost layer first. Both stacks must have the same number of
   * stems, cut to the same musical length, and be bounced from one performance:
   * they all start on the same sample and are gated by gain alone.
   *
   * Omit to have `resolveSrc` derive the URLs, in which case `layers` says how
   * many stems were uploaded.
   */
  music?: Partial<Record<MusicMode, string[]>>;
  /** Stems per stack when URLs come from `resolveSrc`. Defaults to 5. */
  layers?: number;
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
  variants: VariantDef[];
  /** Bed ids shown by default for this theme, in display order. */
  ambience: string[];
}

/** Everything the console needs to render and play. Swap it to reskin the widget. */
export interface AmbienceConfig {
  beds: Record<string, BedDef>;
  themes: ThemeDef[];
}

/** What the engine needs a URL for, so a host can name uploads however it likes. */
export type SrcRequest =
  | { kind: "bed"; bedId: string }
  | { kind: "music"; themeId: string; variantId: string; mode: MusicMode; layer: number };

/**
 * Maps a request onto the URL the file was uploaded to. Returning `null` means
 * "nothing was uploaded for this" — the engine skips it silently rather than
 * reporting a missing file.
 */
export type SrcResolver = (req: SrcRequest) => string | null;

export interface EngineOptions {
  /** Crossfade when the theme or variant changes. */
  crossfadeMs?: number;
  /** Fade when an intensity layer is added or dropped. */
  layerFadeMs?: number;
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
}
