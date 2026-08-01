import { useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { T, softer } from "../theme";
import { useAmbience } from "../state/context";
import type { OneShotDef } from "../types";

/** Pads fire on press and play once over the top of everything else. */
export function SoundBoard() {
  const { config, actions, status, accent } = useAmbience();
  const [query, setQuery] = useState("");
  const [lit, setLit] = useState<Record<string, number>>({});
  const timers = useRef<Record<string, number>>({});

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = Object.values(config.oneShots ?? {}).filter((s) => s.name.toLowerCase().includes(q));
    const byGroup = new Map<string, OneShotDef[]>();
    for (const shot of all) {
      const key = shot.group ?? "Other";
      byGroup.set(key, (byGroup.get(key) ?? []).concat(shot));
    }
    return [...byGroup.entries()];
  }, [config.oneShots, query]);

  const fire = (id: string) => {
    actions.fireOneShot(id);
    // a short flash so a press that produced no sound is still visibly a press
    setLit((p) => ({ ...p, [id]: Date.now() }));
    window.clearTimeout(timers.current[id]);
    timers.current[id] = window.setTimeout(() => {
      setLit((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
    }, 260);
  };

  const total = Object.keys(config.oneShots ?? {}).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 20 }}>
      {total === 0 ? (
        <div style={{ fontSize: 13, color: T.faint }}>No one-shots in this config.</div>
      ) : (
        <>
          <div style={{ position: "relative" }}>
            <Search
              size={15}
              aria-hidden
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.faint }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && query) {
                  e.stopPropagation();
                  setQuery("");
                }
              }}
              placeholder="Filter"
              aria-label="Filter one-shots"
              style={{
                width: "100%",
                borderRadius: 12,
                padding: "9px 12px 9px 36px",
                fontFamily: "inherit",
                fontSize: 14,
                outline: "none",
                background: T.track,
                color: T.ink,
                border: "1px solid " + T.line,
              }}
            />
            {query && (
              <button
                className="amb-btn"
                onClick={() => setQuery("")}
                aria-label="Clear filter"
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  display: "grid",
                  placeItems: "center",
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  color: T.faint,
                }}
              >
                <X size={13} strokeWidth={2.4} />
              </button>
            )}
          </div>

          {groups.map(([group, shots]) => (
            <div key={group}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: ".07em",
                  textTransform: "uppercase",
                  color: T.faint,
                  marginBottom: 8,
                }}
              >
                {group}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(136px, 1fr))",
                  gap: 8,
                }}
              >
                {shots.map((shot) => {
                  const on = !!lit[shot.id];
                  const missing = status.unavailableOneShots.includes(shot.id);
                  return (
                    <button
                      key={shot.id}
                      className="amb-btn"
                      onClick={() => fire(shot.id)}
                      title={missing ? shot.name + " — audio unavailable" : shot.name}
                      style={{
                        minHeight: 52,
                        padding: "10px 12px",
                        borderRadius: 14,
                        textAlign: "left",
                        fontSize: 13,
                        fontWeight: 500,
                        lineHeight: 1.3,
                        color: on ? "#FFF" : missing ? T.faint : T.ink,
                        background: on ? accent : T.surface,
                        border: "1px solid " + (on ? "transparent" : T.line),
                        boxShadow: on ? "none" : softer,
                        transform: on ? "scale(.97)" : "none",
                        transition: "background .12s ease, color .12s ease, transform .12s ease",
                      }}
                    >
                      {shot.name}
                      {missing && (
                        <div style={{ fontSize: 10.5, fontStyle: "italic", color: T.faint, marginTop: 2 }}>
                          unavailable
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {groups.length === 0 && (
            <div style={{ fontSize: 13, color: T.faint }}>Nothing matches “{query}”.</div>
          )}
        </>
      )}
    </div>
  );
}
