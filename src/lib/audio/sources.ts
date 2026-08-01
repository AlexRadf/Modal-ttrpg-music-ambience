import { MAX_INTENSITY } from "../constants";
import type { AmbienceConfig, MusicMode, SrcRequest, SrcResolver, ThemeDef, VariantDef } from "../types";

export const MUSIC_MODES: MusicMode[] = ["explore", "combat"];

/**
 * Where an asset's URL comes from, in one place: the config's own `src` wins,
 * then the resolver, then nothing. The engine plays what this returns and the
 * manifest lists it, so the two cannot disagree about what a scene needs.
 */
export function sourceUrl(req: SrcRequest, explicit: string | undefined, resolve?: SrcResolver): string | null {
  return explicit ?? resolve?.(req) ?? null;
}

export function bedUrl(config: AmbienceConfig, bedId: string, resolve?: SrcResolver): string | null {
  return sourceUrl({ kind: "bed", bedId }, config.beds[bedId]?.src, resolve);
}

/** Stems per stack, as authored. */
export function layerCount(variant: VariantDef): number {
  return variant.music?.explore?.length ?? variant.music?.combat?.length ?? variant.layers ?? MAX_INTENSITY;
}

/** Stem URLs per stack, indexed by layer. `null` means nothing was uploaded. */
export function musicUrls(
  theme: ThemeDef,
  variant: VariantDef,
  resolve?: SrcResolver
): Record<MusicMode, Array<string | null>> {
  const out = {} as Record<MusicMode, Array<string | null>>;
  for (const mode of MUSIC_MODES) {
    const explicit = variant.music?.[mode];
    const count = explicit?.length ?? variant.layers ?? MAX_INTENSITY;
    out[mode] = Array.from({ length: count }, (_, layer) =>
      sourceUrl({ kind: "music", themeId: theme.id, variantId: variant.id, mode, layer }, explicit?.[layer], resolve)
    );
  }
  return out;
}
