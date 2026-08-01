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
  layerFadeMs: 900,
  modeFadeMs: 700,
  bedFadeMs: 600,
  masterVolume: 0.8,
};
