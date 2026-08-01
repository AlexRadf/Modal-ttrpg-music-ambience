import { T } from "../theme";
import { MAX_INTENSITY } from "../constants";
import type { Intensity } from "../types";

export interface StemStackProps {
  value: Intensity;
  onChange: (n: Intensity) => void;
  accent: string;
  /** The music bus is off — show the stack as inactive without disabling it. */
  dimmed?: boolean;
  /** Steps to show: however many stems this variant was authored with. */
  max?: number;
}

/** How many stem layers of the current stack are unmuted. */
export function StemStack(props: StemStackProps) {
  const steps = Math.max(1, Math.min(props.max ?? MAX_INTENSITY, MAX_INTENSITY));
  const heights = Array.from({ length: steps }, (_, i) => (steps === 1 ? 50 : 18 + (i * 32) / (steps - 1)));

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 6, height: 50 }}>
      {heights.map((h, i) => {
        const on = i < props.value;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: h,
              borderRadius: 8,
              background: on ? props.accent : T.track,
              opacity: on ? (props.dimmed ? 0.3 : 0.42 + i * 0.145) : 1,
              border: "1px solid " + (on ? "transparent" : T.line),
              transition: "background .25s ease, opacity .25s ease",
            }}
          />
        );
      })}
      <input
        className="amb-slider"
        type="range"
        min={1}
        max={steps}
        step={1}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value) as Intensity)}
        aria-label="Intensity"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          margin: 0,
          cursor: "pointer",
          opacity: 0,
        }}
      />
    </div>
  );
}
