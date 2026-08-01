import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AmbienceEngine } from "../audio/engine";
import { DEFAULTS } from "../constants";
import { DEFAULT_CONFIG } from "../data";
import type {
  AmbienceConfig,
  BedDef,
  BedLevel,
  EngineOptions,
  EngineStatus,
  Intensity,
  Mode,
  ThemeDef,
  VariantDef,
} from "../types";

/** Everything the console remembers between sessions. */
export interface AmbienceState {
  themeId: string;
  variantId: string;
  intensity: Intensity;
  mode: Mode;
  /** Bed id -> level. Beds absent from the map are off. */
  levels: Record<string, BedLevel>;
  /** Beds pulled in from the library on top of the theme's own list. */
  extra: string[];
  masterVolume: number;
}

export interface AmbienceActions {
  setTheme: (themeId: string) => void;
  setVariant: (variantId: string) => void;
  setIntensity: (n: Intensity) => void;
  setMode: (mode: Mode) => void;
  /** Sets a bed's level; setting the level it already has turns it off. */
  toggleBedLevel: (bedId: string, level: Exclude<BedLevel, 0>) => void;
  setBedLevel: (bedId: string, level: BedLevel) => void;
  addBed: (bedId: string) => void;
  removeBed: (bedId: string) => void;
  setMasterVolume: (v: number) => void;
  /** Fires a stinger over the top of whatever is playing. */
  fireOneShot: (oneShotId: string) => void;
}

export interface AmbienceContextValue {
  config: AmbienceConfig;
  state: AmbienceState;
  actions: AmbienceActions;
  status: EngineStatus;
  theme: ThemeDef;
  variant: VariantDef;
  /** Theme beds followed by any added from the library, in display order. */
  rows: string[];
  bed: (id: string) => BedDef;
  /** Accent for the current theme, overridden while in combat. */
  accent: string;
  engine: AmbienceEngine;
}

const Ctx = createContext<AmbienceContextValue | null>(null);

export interface AmbienceProviderProps {
  children: ReactNode;
  config?: AmbienceConfig;
  options?: EngineOptions;
  initialState?: Partial<AmbienceState>;
  /** localStorage key for persistence. Pass false to keep the console stateless. */
  persistKey?: string | false;
  onStateChange?: (state: AmbienceState) => void;
}

const COMBAT_ACCENT = "#C4553C";

function initialFor(config: AmbienceConfig, overrides?: Partial<AmbienceState>): AmbienceState {
  const theme = config.themes[0];
  return {
    themeId: theme?.id ?? "",
    variantId: theme?.variants[0]?.id ?? "",
    intensity: 3,
    mode: "off",
    levels: {},
    extra: [],
    masterVolume: DEFAULTS.masterVolume,
    ...overrides,
  };
}

function load(key: string | false | undefined, fallback: AmbienceState): AmbienceState {
  if (!key || typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<AmbienceState>) } : fallback;
  } catch {
    return fallback;
  }
}

export function AmbienceProvider(props: AmbienceProviderProps) {
  const config = props.config ?? DEFAULT_CONFIG;
  const { persistKey = "ambience-console", onStateChange } = props;

  const [state, setState] = useState<AmbienceState>(() =>
    load(persistKey, initialFor(config, props.initialState))
  );
  const [status, setStatus] = useState<EngineStatus>({
    running: false,
    loading: false,
    errors: [],
    unavailableBeds: [],
    unavailableOneShots: [],
    motifId: null,
    decodedBytes: 0,
  });
  /** Nothing touches the AudioContext until the first deliberate gesture. */
  const [armed, setArmed] = useState(false);

  const engine = useMemo(() => new AmbienceEngine(config, props.options), [config]);
  useEffect(() => () => engine.dispose(), [engine]);
  useEffect(() => engine.onStatus(setStatus), [engine]);

  const theme = useMemo(
    () => config.themes.find((t) => t.id === state.themeId) ?? config.themes[0],
    [config, state.themeId]
  );
  const variant = useMemo(
    () => theme?.variants.find((v) => v.id === state.variantId) ?? theme?.variants[0],
    [theme, state.variantId]
  );

  const arm = useCallback(() => {
    setArmed(true);
    void engine.resume();
  }, [engine]);

  /* --- engine sync. Each effect is a no-op until the console is armed. ----- */

  useEffect(() => {
    if (armed && theme && variant) void engine.setScene(theme.id, variant.id);
  }, [armed, engine, theme, variant]);

  useEffect(() => {
    if (armed) engine.setIntensity(state.intensity);
  }, [armed, engine, state.intensity]);

  useEffect(() => {
    if (armed) engine.setMode(state.mode);
  }, [armed, engine, state.mode]);

  useEffect(() => {
    engine.setMasterVolume(state.masterVolume);
  }, [engine, state.masterVolume]);

  const applied = useRef<Record<string, BedLevel>>({});
  useEffect(() => {
    if (!armed) return;
    const ids = new Set([...Object.keys(applied.current), ...Object.keys(state.levels)]);
    for (const id of ids) {
      const next = state.levels[id] ?? 0;
      if ((applied.current[id] ?? 0) !== next) engine.setBedLevel(id, next);
    }
    applied.current = state.levels;
  }, [armed, engine, state.levels]);

  useEffect(() => {
    if (persistKey && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(persistKey, JSON.stringify(state));
      } catch {
        /* private mode, quota — not worth failing over */
      }
    }
    onStateChange?.(state);
  }, [state, persistKey, onStateChange]);

  /* --------------------------------------------------------------- actions - */

  const actions = useMemo<AmbienceActions>(() => {
    const patch = (fn: (s: AmbienceState) => AmbienceState) => {
      arm();
      setState(fn);
    };

    return {
      setTheme: (themeId) =>
        patch((s) => {
          const next = config.themes.find((t) => t.id === themeId);
          if (!next) return s;
          // a new place starts clean: its own variant, no borrowed beds
          return { ...s, themeId, variantId: next.variants[0]?.id ?? "", levels: {}, extra: [] };
        }),
      setVariant: (variantId) => patch((s) => ({ ...s, variantId })),
      setIntensity: (intensity) => patch((s) => ({ ...s, intensity })),
      setMode: (mode) => patch((s) => ({ ...s, mode })),
      setBedLevel: (bedId, level) => patch((s) => ({ ...s, levels: { ...s.levels, [bedId]: level } })),
      toggleBedLevel: (bedId, level) =>
        patch((s) => ({ ...s, levels: { ...s.levels, [bedId]: s.levels[bedId] === level ? 0 : level } })),
      addBed: (bedId) =>
        patch((s) => (s.extra.includes(bedId) ? s : { ...s, extra: s.extra.concat(bedId) })),
      removeBed: (bedId) =>
        patch((s) => ({
          ...s,
          extra: s.extra.filter((x) => x !== bedId),
          levels: { ...s.levels, [bedId]: 0 },
        })),
      setMasterVolume: (masterVolume) => setState((s) => ({ ...s, masterVolume })),
      fireOneShot: (oneShotId) => {
        arm();
        void engine.fireOneShot(oneShotId);
      },
    };
  }, [arm, config, engine]);

  const rows = useMemo(() => (theme?.ambience ?? []).concat(state.extra), [theme, state.extra]);

  const bed = useCallback(
    (id: string): BedDef => config.beds[id] ?? { id, name: id },
    [config]
  );

  const value = useMemo<AmbienceContextValue>(
    () => ({
      config,
      state,
      actions,
      status,
      theme,
      variant,
      rows,
      bed,
      accent: state.mode === "combat" ? COMBAT_ACCENT : theme?.accent ?? COMBAT_ACCENT,
      engine,
    }),
    [config, state, actions, status, theme, variant, rows, bed, engine]
  );

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

/** Drive the console from anywhere in the host app. Throws outside a provider. */
export function useAmbience(): AmbienceContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAmbience must be used inside an <AmbienceProvider>");
  return ctx;
}

/** Same, but returns null instead of throwing — used to self-wrap the console. */
export function useOptionalAmbience(): AmbienceContextValue | null {
  return useContext(Ctx);
}
