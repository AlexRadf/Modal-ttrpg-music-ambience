import type { SrcResolver } from "../types";

export interface AssetLayoutOptions {
  /** Root the files are served from, e.g. "/audio" or a CDN origin. */
  base: string;
  /** File extension, without the dot. */
  ext?: string;
  /** Beds live in one flat folder; ids are filenames. */
  bedDir?: string;
  musicDir?: string;
  /**
   * The URLs that actually exist. When given, anything not in the set resolves
   * to `null` — the engine skips it silently instead of reporting a missing
   * file, which is what you want while a library is still being produced.
   */
  available?: Iterable<string>;
}

/**
 * The conventional layout:
 *
 *   {base}/{bedDir}/{bedId}.{ext}
 *   {base}/{musicDir}/{themeId}/{motifId}/layer-{n}.{ext}
 *
 * Motifs sit under the scene rather than under a variant, because two variants
 * of a scene share motifs — and so should share the files.
 *
 * Pass the result as `resolveSrc`. Assets that carry their own `src` in the
 * config are used as-is and never reach this.
 */
export function assetLayout(opts: AssetLayoutOptions): SrcResolver {
  const base = opts.base.replace(/\/+$/, "");
  const ext = opts.ext ?? "ogg";
  const bedDir = opts.bedDir ?? "ambience";
  const musicDir = opts.musicDir ?? "music";
  const available = opts.available ? new Set(opts.available) : null;

  return (req) => {
    const url =
      req.kind === "bed"
        ? `${base}/${bedDir}/${req.bedId}.${ext}`
        : `${base}/${musicDir}/${req.themeId}/${req.motifId}/layer-${req.layer + 1}.${ext}`;
    return !available || available.has(url) ? url : null;
  };
}
