import { T, coverBackground, softer } from "../theme";
import type { ThemeDef } from "../types";

export interface ThemeGridProps {
  themes: ThemeDef[];
  selectedId: string;
  onSelect: (themeId: string) => void;
  accent: string;
}

/** Cover art only — the name is in the header, and the art is the recognition cue. */
export function ThemeGrid(props: ThemeGridProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
      {props.themes.map((t) => {
        const selected = t.id === props.selectedId;
        return (
          <button
            key={t.id}
            className="amb-btn"
            onClick={() => props.onSelect(t.id)}
            title={t.name}
            aria-label={t.name}
            aria-pressed={selected}
            style={{
              aspectRatio: "1 / 1",
              borderRadius: 12,
              background: coverBackground(t),
              outline: selected ? "2px solid " + props.accent : "none",
              outlineOffset: 2,
              boxShadow: softer,
              opacity: selected ? 1 : 0.72,
              transition: "opacity .2s ease, outline-color .3s ease",
            }}
          />
        );
      })}
      {props.themes.length === 0 && (
        <div style={{ gridColumn: "1 / -1", fontSize: 13, color: T.faint }}>No themes configured.</div>
      )}
    </div>
  );
}
