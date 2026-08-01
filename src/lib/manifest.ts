import { MUSIC_MODES, bedUrl, layerCount, musicUrls } from "./audio/sources";
import type { AmbienceConfig, MusicMode, SrcResolver } from "./types";

/** One file the console will ask for. */
export interface AssetEntry {
  kind: "music" | "bed";
  /** Where it will be fetched from, or null if nothing is mapped yet. */
  url: string | null;
  /** Human-readable description of what this file is. */
  label: string;
  bedId?: string;
  themeId?: string;
  variantId?: string;
  mode?: MusicMode;
  /** 0-based; layer 0 is heard alone at intensity 1. */
  layer?: number;
  /** For beds: the themes that list this bed by default. */
  usedBy?: string[];
}

export interface ManifestOptions {
  resolveSrc?: SrcResolver;
  /** Include every bed in the library, not just the ones themes list. Default true. */
  includeUnusedBeds?: boolean;
}

/**
 * Every file a config needs, derived from the config itself so it cannot drift
 * from what the engine actually requests. Useful for producing an upload
 * checklist, and for an admin screen that diffs required against uploaded.
 */
export function assetManifest(config: AmbienceConfig, opts: ManifestOptions = {}): AssetEntry[] {
  const entries: AssetEntry[] = [];

  for (const theme of config.themes) {
    for (const variant of theme.variants) {
      const urls = musicUrls(theme, variant, opts.resolveSrc);
      for (const mode of MUSIC_MODES) {
        urls[mode].forEach((url, layer) => {
          entries.push({
            kind: "music",
            url,
            label: `${theme.name} · ${variant.name} · ${mode} · layer ${layer + 1}`,
            themeId: theme.id,
            variantId: variant.id,
            mode,
            layer,
          });
        });
      }
    }
  }

  const usedBy = new Map<string, string[]>();
  for (const theme of config.themes) {
    for (const bedId of theme.ambience) {
      usedBy.set(bedId, (usedBy.get(bedId) ?? []).concat(theme.name));
    }
  }

  for (const bedId of Object.keys(config.beds)) {
    const used = usedBy.get(bedId);
    if (!used && opts.includeUnusedBeds === false) continue;
    entries.push({
      kind: "bed",
      url: bedUrl(config, bedId, opts.resolveSrc),
      label: config.beds[bedId].name,
      bedId,
      usedBy: used ?? [],
    });
  }

  return entries;
}

export interface ManifestSummary {
  music: number;
  beds: number;
  total: number;
  /** Entries with no URL mapped — nothing will be fetched for these. */
  unmapped: number;
  /** Per theme: how many music files it needs. */
  byTheme: Array<{ themeId: string; name: string; variants: number; layers: number; music: number }>;
}

export function manifestSummary(config: AmbienceConfig, opts: ManifestOptions = {}): ManifestSummary {
  const entries = assetManifest(config, opts);
  return {
    music: entries.filter((e) => e.kind === "music").length,
    beds: entries.filter((e) => e.kind === "bed").length,
    total: entries.length,
    unmapped: entries.filter((e) => !e.url).length,
    byTheme: config.themes.map((theme) => ({
      themeId: theme.id,
      name: theme.name,
      variants: theme.variants.length,
      layers: Math.max(...theme.variants.map(layerCount)),
      music: theme.variants.reduce((n, v) => n + layerCount(v) * MUSIC_MODES.length, 0),
    })),
  };
}

/**
 * Which required files are not in a set of uploaded URLs. Pair it with
 * `assetLayout({ available })` to keep a part-produced library quiet.
 */
export function missingAssets(
  config: AmbienceConfig,
  uploaded: Iterable<string>,
  opts: ManifestOptions = {}
): AssetEntry[] {
  const have = new Set(uploaded);
  return assetManifest(config, opts).filter((e) => !e.url || !have.has(e.url));
}
