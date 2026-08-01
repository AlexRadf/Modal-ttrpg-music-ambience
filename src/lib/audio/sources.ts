import type { AmbienceConfig, MotifDef, MusicMode, SrcRequest, SrcResolver, ThemeDef, VariantDef } from "../types";

export const MUSIC_MODES: MusicMode[] = ["explore", "combat"];
export const DEFAULT_INTENSITIES = 4;

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

export function oneShotUrl(config: AmbienceConfig, oneShotId: string, resolve?: SrcResolver): string | null {
  return sourceUrl({ kind: "one-shot", oneShotId }, config.oneShots?.[oneShotId]?.src, resolve);
}

/** Intensity levels a motif was written at. */
export function intensityCount(motif: MotifDef, variant?: VariantDef): number {
  return motif.intensities ?? variant?.intensities ?? DEFAULT_INTENSITIES;
}

/**
 * URLs for one motif, indexed by intensity level (0-based). `null` means
 * nothing was uploaded. In `mixes` mode each entry is a complete mix of the
 * passage; in `layers` mode each is an additive stem.
 */
export function motifUrls(
  theme: ThemeDef,
  motif: MotifDef,
  variant?: VariantDef,
  resolve?: SrcResolver
): Array<string | null> {
  return Array.from({ length: intensityCount(motif, variant) }, (_, i) =>
    sourceUrl(
      { kind: "music", themeId: theme.id, motifId: motif.id, mode: motif.mode, intensity: i + 1 },
      motif.mixes?.[i],
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
