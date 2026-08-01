import type { SrcResolver } from "../types";

export interface AssetLayoutOptions {
  /** Root the files are served from, e.g. "/audio" or a CDN origin. */
  base: string;
  /** File extension, without the dot. */
  ext?: string;
  /** Beds live in one flat folder; ids are filenames. */
  bedDir?: string;
  musicDir?: string;
}

/**
 * The conventional layout:
 *
 *   {base}/{bedDir}/{bedId}.{ext}
 *   {base}/{musicDir}/{themeId}/{variantId}/{mode}-{n}.{ext}
 *
 * Pass the result as `resolveSrc`. Anything that 404s falls back to the
 * synthesiser, so a half-produced library still plays.
 */
export function assetLayout(opts: AssetLayoutOptions): SrcResolver {
  const base = opts.base.replace(/\/+$/, "");
  const ext = opts.ext ?? "ogg";
  const bedDir = opts.bedDir ?? "ambience";
  const musicDir = opts.musicDir ?? "music";

  return (req) => {
    if (req.kind === "bed") return `${base}/${bedDir}/${req.bedId}.${ext}`;
    return `${base}/${musicDir}/${req.themeId}/${req.variantId}/${req.mode}-${req.layer + 1}.${ext}`;
  };
}
