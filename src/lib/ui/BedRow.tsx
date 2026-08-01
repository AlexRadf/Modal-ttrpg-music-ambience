import { useState } from "react";
import { X } from "lucide-react";
import { T } from "../theme";
import type { BedLevel } from "../types";

export interface BedRowProps {
  name: string;
  level: BedLevel;
  onSet: (level: Exclude<BedLevel, 0>) => void;
  /** Only beds added from the library can be removed. */
  onRemove?: (() => void) | null;
  accent: string;
  first?: boolean;
  /** The upload for this bed could not be loaded. */
  unavailable?: boolean;
}

/** One ambience bed: name, and three loudness steps that also act as on/off. */
export function BedRow(props: BedRowProps) {
  const [hover, setHover] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        borderTop: props.first ? "none" : "1px solid " + T.line,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ flexShrink: 0, width: 14 }}>
        {props.onRemove && (
          <button
            className="amb-btn"
            onClick={props.onRemove}
            aria-label={"Remove " + props.name}
            style={{
              display: "grid",
              placeItems: "center",
              width: 14,
              height: 14,
              borderRadius: 999,
              color: T.faint,
              opacity: hover ? 1 : 0,
              transition: "opacity .15s ease",
            }}
          >
            <X size={12} strokeWidth={2.4} />
          </button>
        )}
      </div>

      <div
        title={props.unavailable ? props.name + " — audio unavailable" : undefined}
        style={{ display: "flex", flex: 1, minWidth: 0, alignItems: "baseline", gap: 8 }}
      >
        <span
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 14,
            color: props.unavailable ? T.faint : props.level ? T.ink : T.muted,
            fontWeight: props.level && !props.unavailable ? 500 : 400,
          }}
        >
          {props.name}
        </span>
        {props.unavailable && (
          <span style={{ flexShrink: 0, fontSize: 11, fontStyle: "italic", color: T.faint }}>unavailable</span>
        )}
      </div>

      {([1, 2, 3] as const).map((n) => {
        // a bed with no audio must not look like it is playing, whatever its level
        const on = !props.unavailable && props.level >= n;
        return (
          <button
            key={n}
            className="amb-btn"
            onClick={() => props.onSet(n)}
            aria-label={props.name + " loudness " + n}
            aria-pressed={on}
            style={{
              display: "grid",
              placeItems: "center",
              width: 30,
              height: 26,
              borderRadius: 8,
              background: on ? props.accent : T.track,
              opacity: props.unavailable ? 0.5 : on ? 0.35 + n * 0.22 : 1,
              border: "1px solid " + (on ? "transparent" : T.line),
              transition: "background .16s ease, opacity .16s ease",
            }}
          >
            <span
              style={{ width: 5, height: 5, borderRadius: 999, background: on ? "#FFF" : T.faint }}
            />
          </button>
        );
      })}
    </div>
  );
}
