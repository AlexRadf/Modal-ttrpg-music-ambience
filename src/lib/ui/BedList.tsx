import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { T } from "../theme";
import { BedRow } from "./BedRow";
import { useAmbience } from "../state/context";

/** The ambience mixer: the theme's beds, plus anything borrowed from the library. */
export function BedList() {
  const { config, state, actions, rows, bed, accent } = useAmbience();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.keys(config.beds).filter(
      (id) => !rows.includes(id) && config.beds[id].name.toLowerCase().includes(q)
    );
  }, [config, rows, query]);

  const closeSearch = () => {
    setAdding(false);
    setQuery("");
  };

  return (
    <div style={{ overflow: "hidden", borderRadius: 16, border: "1px solid " + T.line, background: T.surface }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", background: T.track }}>
        <div style={{ flex: 1 }} />
        {["I", "II", "III"].map((n) => (
          <div
            key={n}
            aria-hidden
            style={{ width: 30, textAlign: "center", fontSize: 12, fontWeight: 600, color: T.faint, letterSpacing: ".06em" }}
          >
            {n}
          </div>
        ))}
      </div>

      {rows.map((id, i) => (
        <BedRow
          key={id}
          name={bed(id).name}
          level={state.levels[id] ?? 0}
          onSet={(n) => actions.toggleBedLevel(id, n)}
          onRemove={state.extra.includes(id) ? () => actions.removeBed(id) : null}
          accent={accent}
          first={i === 0}
        />
      ))}

      {!adding ? (
        <button
          className="amb-btn"
          onClick={() => setAdding(true)}
          style={{
            display: "flex",
            width: "100%",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            fontSize: 14,
            fontWeight: 500,
            borderTop: "1px solid " + T.line,
            color: T.muted,
          }}
        >
          <Plus size={15} strokeWidth={2.2} />
          Add more
        </button>
      ) : (
        <div style={{ borderTop: "1px solid " + T.line }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search
                size={15}
                aria-hidden
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.faint }}
              />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    closeSearch();
                  }
                  if (e.key === "Enter" && results[0]) actions.addBed(results[0]);
                }}
                placeholder="Filter"
                aria-label="Filter the ambience library"
                style={{
                  width: "100%",
                  borderRadius: 12,
                  padding: "8px 12px 8px 36px",
                  fontFamily: "inherit",
                  fontSize: 14,
                  outline: "none",
                  background: T.track,
                  color: T.ink,
                  border: "1px solid " + T.line,
                }}
              />
            </div>
            <button
              className="amb-btn"
              onClick={closeSearch}
              aria-label="Done"
              style={{
                display: "grid",
                placeItems: "center",
                width: 32,
                height: 32,
                flexShrink: 0,
                borderRadius: 999,
                background: T.track,
                color: T.muted,
              }}
            >
              <X size={15} strokeWidth={2.2} />
            </button>
          </div>

          <div className="amb-scroll" style={{ padding: "0 8px 8px", maxHeight: 200, overflowY: "auto" }}>
            {results.map((id) => (
              <button
                key={id}
                className="amb-btn"
                onClick={() => {
                  actions.addBed(id);
                  setQuery("");
                }}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 12,
                  padding: "8px 12px",
                  fontSize: 14,
                  color: T.muted,
                }}
              >
                <Plus size={13} strokeWidth={2.4} style={{ color: T.faint, flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {config.beds[id].name}
                </span>
              </button>
            ))}
            {results.length === 0 && (
              <div style={{ padding: "8px 12px", fontSize: 13, color: T.faint }}>Nothing else to add.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
