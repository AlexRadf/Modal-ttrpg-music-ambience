import type { BedLevel } from "./types";

/** Authoring metadata stays in the data, hidden in the UI. */
export const SHOW_AUTHORING = false;

/**
 * Uncorrelated beds sum in power, so n at equal level run +10*log10(n)
 * dB hot. Dividing the ambience bus by sqrt(n) cancels it exactly.
 */
export function busTrim(n: number): number {
  return n > 0 ? 1 / Math.sqrt(n) : 1;
}

/** -18 / -12 / -6 dB. */
export const LEVEL_GAIN: Record<Exclude<BedLevel, 0>, number> = { 1: 0.126, 2: 0.251, 3: 0.501 };

export const MAX_INTENSITY = 5;

export const DEFAULTS = {
  crossfadeMs: 1800,
  intensityFadeMs: 900,
  modeFadeMs: 700,
  bedFadeMs: 600,
  masterVolume: 0.8,
  /**
   * 320 MB of decoded audio: enough for two motifs of stereo stems plus a full
   * set of beds, with room to keep the rest of a pool cached. Audio that is
   * sounding is never evicted, so this is a target rather than a hard cap —
   * see the memory note in ASSETS.md for the arithmetic, and lower it for
   * tablets or if the stems are mono.
   */
  maxDecodedBytes: 320 * 1024 * 1024,
  /** Start decoding the next motif this long before the current one ends. */
  motifQueueLeadMs: 10000,
  /** Motifs that must pass before a passage can repeat. */
  noRepeatWindow: 3,
  intensityMode: "mixes" as const,
};
