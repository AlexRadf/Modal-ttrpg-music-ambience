import { useState } from "react";
import { X } from "lucide-react";
import { T, coverBackground, softer } from "../theme";
import { SHOW_AUTHORING, busTrim } from "../constants";
import { intensityCount, variantMotifs } from "../audio/sources";
import { AmbienceProvider, useAmbience, useOptionalAmbience, type AmbienceProviderProps } from "../state/context";
import { BedList } from "./BedList";
import { Modal } from "./Modal";
import { ModeToggle } from "./ModeToggle";
import { StemStack } from "./StemStack";
import { ThemeGrid } from "./ThemeGrid";
import { Trigger } from "./Trigger";
import { VariantSelect } from "./VariantSelect";
import { useWideLayout } from "./hooks";
import { injectStyles } from "./styles";

export interface AmbienceConsoleProps extends Omit<Partial<AmbienceProviderProps>, "children"> {
  /** Controlled open state. Leave undefined to let the console manage its own. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Show the floating button. Turn it off to open the console from your own UI. */
  trigger?: boolean;
  triggerOffset?: { right?: number; bottom?: number };
  /** Render docked in the page instead of over an overlay. */
  inline?: boolean;
  /** Reveal BPM, key and the current bus trim in the header. */
  showAuthoring?: boolean;
  /** Add a master volume slider to the header. */
  showVolume?: boolean;
}

/**
 * The console. Drop it anywhere:
 *
 *   <AmbienceConsole />
 *
 * It provides its own state when there is no `<AmbienceProvider>` above it, and
 * joins the existing one when there is — so the host app can share control.
 */
export function AmbienceConsole(props: AmbienceConsoleProps) {
  const existing = useOptionalAmbience();
  injectStyles();

  if (existing) return <ConsoleUI {...props} />;

  return (
    <AmbienceProvider
      config={props.config}
      options={props.options}
      initialState={props.initialState}
      persistKey={props.persistKey}
      onStateChange={props.onStateChange}
    >
      <ConsoleUI {...props} />
    </AmbienceProvider>
  );
}

function ConsoleUI(props: AmbienceConsoleProps) {
  const { config, state, actions, status, theme, variant, rows, accent } = useAmbience();
  const wide = useWideLayout();

  const controlled = props.open !== undefined;
  const [internalOpen, setInternalOpen] = useState(props.defaultOpen ?? false);
  const open = controlled ? !!props.open : internalOpen;

  const setOpen = (next: boolean) => {
    if (!controlled) setInternalOpen(next);
    props.onOpenChange?.(next);
  };

  const showAuthoring = props.showAuthoring ?? SHOW_AUTHORING;
  // beds whose audio is missing are not playing, so they do not count towards
  // the bus trim readout or light up the trigger
  const activeBeds = rows.filter(
    (id) => (state.levels[id] ?? 0) > 0 && !status.unavailableBeds.includes(id)
  ).length;

  if (!theme || !variant) return null;

  // the intensity control shows as many steps as the scene has instrument stems
  const motifs = variantMotifs(theme, variant);
  const maxLayers = motifs.length ? Math.max(...motifs.map((m) => intensityCount(m, variant))) : undefined;

  const body = (
    <>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px" }}>
        <div
          aria-hidden
          style={{
            height: 36,
            width: 36,
            flexShrink: 0,
            borderRadius: 12,
            background: coverBackground(theme),
            boxShadow: softer,
          }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.25,
              color: T.ink,
            }}
          >
            {theme.name}
          </div>
          {showAuthoring && (
            <div
              style={{
                fontSize: 12,
                lineHeight: 1.25,
                color: T.faint,
                fontVariantNumeric: "tabular-nums",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {theme.bpm} BPM · {theme.key} · bus {busTrim(activeBeds).toFixed(2)}
            </div>
          )}
        </div>

        {status.loading && (
          <span
            aria-live="polite"
            aria-label="Loading audio"
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: accent,
              animation: "amb-pulse 1.1s ease-in-out infinite",
            }}
          />
        )}

        {props.showVolume && (
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={state.masterVolume}
            onChange={(e) => actions.setMasterVolume(Number(e.target.value))}
            aria-label="Volume"
            style={{ width: 88, accentColor: accent, cursor: "pointer" }}
          />
        )}

        {!props.inline && (
          <button
            className="amb-btn"
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{
              display: "grid",
              placeItems: "center",
              height: 32,
              width: 32,
              flexShrink: 0,
              borderRadius: 999,
              background: T.track,
              color: T.muted,
            }}
          >
            <X size={15} strokeWidth={2.2} />
          </button>
        )}
      </div>

      <div style={{ height: 1, background: T.line }} />

      <div
        className="amb-scroll"
        style={{ display: "flex", flexDirection: wide ? "row" : "column", overflowY: "auto" }}
      >
        {/* Left: where you are, and how hard it is going */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            padding: 20,
            width: wide ? "50%" : "100%",
          }}
        >
          <ThemeGrid
            themes={config.themes}
            selectedId={theme.id}
            onSelect={actions.setTheme}
            accent={accent}
          />
          <VariantSelect variants={theme.variants} value={variant.id} onChange={actions.setVariant} />
          <StemStack
            value={state.intensity}
            onChange={actions.setIntensity}
            accent={accent}
            dimmed={state.mode === "off"}
            max={maxLayers}
          />
          <ModeToggle mode={state.mode} onChange={actions.setMode} accent={accent} />
        </div>

        {/* Right: what the room sounds like */}
        <div
          style={{
            padding: 20,
            width: wide ? "50%" : "100%",
            background: T.inset,
            borderLeft: wide ? "1px solid " + T.line : "none",
            borderTop: wide ? "none" : "1px solid " + T.line,
          }}
        >
          <BedList />
        </div>
      </div>
    </>
  );

  return (
    <>
      {props.trigger !== false && !props.inline && (
        <Trigger
          onClick={() => setOpen(true)}
          hidden={open}
          active={state.mode !== "off" || activeBeds > 0}
          accent={accent}
          offset={props.triggerOffset}
        />
      )}
      <Modal open={props.inline ? true : open} onClose={() => setOpen(false)} label="Ambience" inline={props.inline}>
        {body}
      </Modal>
    </>
  );
}
