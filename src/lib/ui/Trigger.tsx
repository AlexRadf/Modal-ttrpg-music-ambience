import { Music } from "lucide-react";
import { T, soft } from "../theme";

export interface TriggerProps {
  onClick: () => void;
  hidden: boolean;
  /** Filled while something is playing, outlined when silent. */
  active: boolean;
  accent: string;
  offset?: { right?: number; bottom?: number };
}

/** The floating button that opens the console. */
export function Trigger(props: TriggerProps) {
  return (
    <button
      className="amb-btn amb-root"
      onClick={props.onClick}
      aria-label="Open ambience"
      aria-expanded={!props.hidden ? undefined : false}
      style={{
        position: "fixed",
        zIndex: 50,
        display: "grid",
        placeItems: "center",
        right: props.offset?.right ?? 20,
        bottom: props.offset?.bottom ?? 20,
        width: 52,
        height: 52,
        borderRadius: 999,
        background: props.active ? props.accent : T.surface,
        color: props.active ? "#FFF" : T.ink,
        border: "1px solid " + (props.active ? "transparent" : T.line),
        boxShadow: soft,
        opacity: props.hidden ? 0 : 1,
        pointerEvents: props.hidden ? "none" : "auto",
        transition: "opacity .2s ease, background .3s ease",
      }}
    >
      <Music size={20} strokeWidth={2} />
    </button>
  );
}
