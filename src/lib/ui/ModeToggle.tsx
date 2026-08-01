import { Footprints, PartyPopper, Power, Swords } from "lucide-react";
import { T, softer } from "../theme";
import type { Mode } from "../types";

export const MODES: Array<{ id: Mode; label: string; Icon: typeof Power }> = [
  { id: "off", label: "Off", Icon: Power },
  { id: "explore", label: "Explore", Icon: Footprints },
  { id: "combat", label: "Combat", Icon: Swords },
  // transitional: the swell plays, then the engine hands back to exploration
  { id: "victory", label: "Victory", Icon: PartyPopper },
];

export interface ModeToggleProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
  accent: string;
}

/** Off / exploration / combat. Ambience beds keep playing in all three. */
export function ModeToggle(props: ModeToggleProps) {
  const idx = MODES.findIndex((m) => m.id === props.mode);

  return (
    <div
      role="group"
      aria-label="Mode"
      style={{
        position: "relative",
        display: "flex",
        borderRadius: 16,
        padding: 4,
        background: T.track,
        border: "1px solid " + T.line,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 4,
          bottom: 4,
          width: "calc((100% - 8px) / " + MODES.length + ")",
          left: "calc(4px + " + idx + " * (100% - 8px) / " + MODES.length + ")",
          borderRadius: 12,
          background: props.mode === "off" ? "#FFF" : props.accent,
          boxShadow: softer,
          transition: "left .28s cubic-bezier(.4,0,.2,1), background .3s ease",
        }}
      />
      {MODES.map((m) => {
        const on = props.mode === m.id;
        const Icon = m.Icon;
        return (
          <button
            key={m.id}
            className="amb-btn"
            onClick={() => props.onChange(m.id)}
            aria-pressed={on}
            style={{
              position: "relative",
              display: "flex",
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              padding: "10px 0",
              fontSize: 11.5,
              fontWeight: 600,
              color: on ? (m.id === "off" ? T.ink : "#FFF") : T.muted,
              transition: "color .25s ease",
            }}
          >
            <Icon size={13} strokeWidth={2.3} />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
