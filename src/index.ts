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
export { synthBed, synthMusicLayer, musicLoopSeconds } from "./lib/audio/synth";

export { DEFAULT_CONFIG, BEDS, THEMES } from "./lib/data";
export { LEVEL_GAIN, MAX_INTENSITY, busTrim } from "./lib/constants";
export { T as tokens } from "./lib/theme";

export type {
  AmbienceConfig,
  BedDef,
  BedLevel,
  EngineOptions,
  EngineStatus,
  Intensity,
  Mode,
  MusicMode,
  SrcRequest,
  SrcResolver,
  ThemeDef,
  VariantDef,
} from "./lib/types";
