import type { AmbienceConfig, MotifDef, MusicMode, SrcRequest, SrcResolver, ThemeDef, VariantDef } from "../types";

export const MUSIC_MODES: MusicMode[] = ["explore", "combat"];
export const DEFAULT_LAYERS = 4;

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

/** Instrument stems in a motif. */
export function layerCount(motif: MotifDef, variant?: VariantDef): number {
  return motif.layers ?? variant?.layers ?? DEFAULT_LAYERS;
}

/** Stem URLs for one motif, indexed by layer. `null` means nothing was uploaded. */
export function motifUrls(
  theme: ThemeDef,
  motif: MotifDef,
  variant?: VariantDef,
  resolve?: SrcResolver
): Array<string | null> {
  return Array.from({ length: layerCount(motif, variant) }, (_, layer) =>
    sourceUrl(
      { kind: "music", themeId: theme.id, motifId: motif.id, mode: motif.mode, layer },
      motif.stems?.[layer],
      resolve
    )
  );
}

/** The motifs a variant draws on, in pool order. */
export function variantMotifs(theme: ThemeDef, variant: VariantDef, mode?: MusicMode): MotifDef[] {
  const chosen = variant.motifs;
  return theme.motifs.filter(
    (m) => (!mode || m.mode === mode) && (!chosen || chosen.includes(m.id))
  );
}
