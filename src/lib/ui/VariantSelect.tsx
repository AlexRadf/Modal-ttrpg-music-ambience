import { ChevronDown } from "lucide-react";
import { T } from "../theme";
import type { VariantDef } from "../types";

export interface VariantSelectProps {
  variants: VariantDef[];
  value: string;
  onChange: (variantId: string) => void;
}

/** Which take on the theme is playing. Changing it crossfades the whole deck. */
export function VariantSelect(props: VariantSelectProps) {
  return (
    <div style={{ position: "relative" }}>
      <select
        className="amb-select"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        aria-label="Version"
        style={{
          width: "100%",
          appearance: "none",
          WebkitAppearance: "none",
          borderRadius: 16,
          padding: "12px 40px 12px 16px",
          fontSize: 14,
          fontWeight: 500,
          outline: "none",
          background: T.track,
          color: T.ink,
          border: "1px solid " + T.line,
          cursor: "pointer",
        }}
      >
        {props.variants.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        aria-hidden
        style={{
          pointerEvents: "none",
          position: "absolute",
          right: 16,
          top: "50%",
          transform: "translateY(-50%)",
          color: T.muted,
        }}
      />
    </div>
  );
}
