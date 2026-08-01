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
  /** Explicit URL. When omitted the engine asks `resolveSrc`, then falls back to synthesis. */
  src?: string;
  /** Static trim in linear gain, for beds that are hot or quiet at the source. */
  trim?: number;
}

/** A tonal/emotional take on a theme — same place, different night. */
export interface VariantDef {
  id: string;
  name: string;
  /**
   * Explicit stem URLs, innermost layer first. Every layer of both stacks starts
   * together and is gated by gain, so the stacks must be the same length and the
   * same musical length. Omit to let `resolveSrc`/synthesis provide them.
   */
  music?: Partial<Record<MusicMode, string[]>>;
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

/** What the engine is being asked to load, so a host can name files however it likes. */
export type SrcRequest =
  | { kind: "bed"; bedId: string }
  | { kind: "music"; themeId: string; variantId: string; mode: MusicMode; layer: number };

/**
 * Maps a request onto a URL. Return `null` to skip the network entirely and use
 * the built-in synthesiser (handy before any audio has been recorded).
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
  /** Build audio procedurally when a source has no URL or fails to load. Default true. */
  synthFallback?: boolean;
  resolveSrc?: SrcResolver;
}

/** Snapshot of what the engine is doing, surfaced for loading states and diagnostics. */
export interface EngineStatus {
  running: boolean;
  loading: boolean;
  /** Non-fatal load failures, keyed by the URL that failed. */
  errors: string[];
}
