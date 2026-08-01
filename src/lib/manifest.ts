import { layerCount, motifUrls, bedUrl, variantMotifs } from "./audio/sources";
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
  motifId?: string;
  mode?: MusicMode;
  /** 0-based; layer 0 is heard alone at intensity 1. */
  layer?: number;
  /** For music: which variants of the scene draw on this motif. */
  usedBy?: string[];
}

export interface ManifestOptions {
  resolveSrc?: SrcResolver;
  /** Include every bed in the library, not just the ones scenes list. Default true. */
  includeUnusedBeds?: boolean;
}

/**
 * Every file a config needs, derived from the config itself so it cannot drift
 * from what the engine actually requests. Motifs shared between variants appear
 * once, because they are one file.
 */
export function assetManifest(config: AmbienceConfig, opts: ManifestOptions = {}): AssetEntry[] {
  const entries: AssetEntry[] = [];

  for (const theme of config.themes) {
    for (const motif of theme.motifs) {
      const variants = theme.variants.filter((v) => variantMotifs(theme, v).some((m) => m.id === motif.id));
      // a variant may raise the layer count, so take the widest that uses it
      const widest = variants.reduce(
        (n, v) => Math.max(n, layerCount(motif, v)),
        layerCount(motif)
      );
      const urls = motifUrls(theme, { ...motif, layers: widest }, undefined, opts.resolveSrc);

      urls.forEach((url, layer) => {
        entries.push({
          kind: "music",
          url,
          label: `${theme.name} · ${motif.id} · layer ${layer + 1}`,
          themeId: theme.id,
          motifId: motif.id,
          mode: motif.mode,
          layer,
          usedBy: variants.map((v) => v.name),
        });
      });
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
  byTheme: Array<{
    themeId: string;
    name: string;
    motifs: number;
    layers: number;
    music: number;
    /** Seconds of unique music, if bpm and bars are set. */
    seconds: number;
  }>;
}

/** Seconds one motif runs for, from the scene's tempo and bar count. */
export function motifSeconds(bpm = 90, bars = 12): number {
  return (60 / bpm) * 4 * bars;
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
      motifs: theme.motifs.length,
      layers: Math.max(...theme.motifs.map((m) => layerCount(m, theme.variants[0]))),
      music: entries.filter((e) => e.kind === "music" && e.themeId === theme.id).length,
      seconds: theme.motifs.length * motifSeconds(theme.bpm, theme.bars),
    })),
  };
}

/**
 * How long a variant's stack runs before its order comes round, in seconds.
 * This is the number to check against "it should not feel like a loop".
 */
export function poolSeconds(config: AmbienceConfig, themeId: string, variantId: string, mode: MusicMode): number {
  const theme = config.themes.find((t) => t.id === themeId);
  const variant = theme?.variants.find((v) => v.id === variantId);
  if (!theme || !variant) return 0;
  return variantMotifs(theme, variant, mode).length * motifSeconds(theme.bpm, theme.bars);
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
