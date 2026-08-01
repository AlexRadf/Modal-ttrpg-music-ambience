/** Public surface of the ambience console. */

export { AmbienceConsole } from "./lib/ui/AmbienceConsole";
export type { AmbienceConsoleProps } from "./lib/ui/AmbienceConsole";

export { AmbienceProvider, useAmbience, useOptionalAmbience } from "./lib/state/context";
export type {
  AmbienceProviderProps,
  AmbienceContextValue,
  AmbienceState,
  AmbienceActions,
} from "./lib/state/context";

export { AmbienceEngine } from "./lib/audio/engine";
export { assetLayout } from "./lib/audio/resolve";
export type { AssetLayoutOptions } from "./lib/audio/resolve";

export { DEFAULT_CONFIG, ALIEN_PACK, BEDS, THEMES, ONE_SHOTS } from "./lib/data";
export { assetManifest, manifestSummary, missingAssets, motifSeconds, poolSeconds } from "./lib/manifest";
export type { AssetEntry, ManifestOptions, ManifestSummary } from "./lib/manifest";
export { intensityCount, variantMotifs } from "./lib/audio/sources";
export { LEVEL_GAIN, MAX_INTENSITY, busTrim } from "./lib/constants";
export { T as tokens } from "./lib/theme";

export type {
  AmbienceConfig,
  BedDef,
  BedLevel,
  EngineOptions,
  EngineStatus,
  Intensity,
  LoadFailure,
  IntensityMode,
  MotifDef,
  OneShotDef,
  Mode,
  MusicMode,
  SrcRequest,
  SrcResolver,
  ThemeDef,
  VariantDef,
} from "./lib/types";
