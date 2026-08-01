import type { ReactNode } from "react";
import { T, softer } from "../theme";

export interface TabDef<T extends string> {
  id: T;
  label: string;
  Icon?: (props: { size?: number; strokeWidth?: number }) => ReactNode;
  /** Shown after the label, e.g. a count. */
  badge?: string | number;
}

export interface TabBarProps<T extends string> {
  tabs: Array<TabDef<T>>;
  value: T;
  onChange: (id: T) => void;
  accent: string;
  label: string;
}

/**
 * The console's top-level switch. Same segmented-control language as the mode
 * toggle, so the two read as the same kind of control at different scopes.
 */
export function TabBar<T extends string>(props: TabBarProps<T>) {
  const idx = Math.max(
    0,
    props.tabs.findIndex((t) => t.id === props.value)
  );

  return (
    <div
      role="tablist"
      aria-label={props.label}
      style={{
        position: "relative",
        display: "flex",
        borderRadius: 14,
        padding: 3,
        background: T.track,
        border: "1px solid " + T.line,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 3,
          bottom: 3,
          width: "calc((100% - 6px) / " + props.tabs.length + ")",
          left: "calc(3px + " + idx + " * (100% - 6px) / " + props.tabs.length + ")",
          borderRadius: 11,
          background: T.surface,
          boxShadow: softer,
          transition: "left .26s cubic-bezier(.4,0,.2,1)",
        }}
      />
      {props.tabs.map((tab) => {
        const on = tab.id === props.value;
        const Icon = tab.Icon;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={on}
            className="amb-btn"
            onClick={() => props.onChange(tab.id)}
            style={{
              position: "relative",
              display: "flex",
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "8px 0",
              fontSize: 12.5,
              fontWeight: 600,
              color: on ? T.ink : T.muted,
              transition: "color .22s ease",
            }}
          >
            {Icon && <Icon size={13} strokeWidth={2.3} />}
            {tab.label}
            {tab.badge !== undefined && (
              <span style={{ fontWeight: 500, color: on ? props.accent : T.faint }}>{tab.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
