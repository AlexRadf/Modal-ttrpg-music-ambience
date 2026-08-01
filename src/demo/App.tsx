import { AmbienceConsole, AmbienceProvider, tokens as T, useAmbience } from "../index";

/**
 * A stand-in for a host app. The point of the demo is the two ways in:
 * the console's own UI, and the `useAmbience` hook driving it from outside —
 * which is how an encounter tracker would flip the table into combat.
 */
export function App() {
  return (
    <AmbienceProvider persistKey="ambience-demo">
      <div
        style={{
          minHeight: "100vh",
          fontFamily: T.font,
          color: T.ink,
          background: "radial-gradient(80% 60% at 50% 0%, #FFFFFF 0%, " + T.shell + " 70%)",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "72px 24px 160px" }}>
          <h1 style={{ fontSize: 30, fontWeight: 650, letterSpacing: "-.02em", margin: 0 }}>
            Session in progress
          </h1>
          <p style={{ marginTop: 12, fontSize: 15, lineHeight: 1.6, color: T.muted }}>
            Your app content. The console sits over the top of it, and answers to the same state your
            app can read and write.
          </p>

          <HostControls />

          <p style={{ marginTop: 40, fontSize: 13, lineHeight: 1.7, color: T.faint }}>
            No audio files are bundled. Every stem and bed you hear is synthesised on the fly from its
            id, so the whole thing is playable before a note has been recorded. Point{" "}
            <code style={{ fontFamily: "ui-monospace, monospace" }}>resolveSrc</code> at real files and
            the synthesiser steps aside.
          </p>
        </div>

        <AmbienceConsole showAuthoring showVolume />
      </div>
    </AmbienceProvider>
  );
}

function HostControls() {
  const { state, actions, status, theme, variant } = useAmbience();

  const button = (label: string, onClick: () => void, primary = false) => (
    <button
      key={label}
      onClick={onClick}
      style={{
        borderRadius: 999,
        padding: "9px 16px",
        fontSize: 13,
        fontWeight: 550,
        fontFamily: "inherit",
        cursor: "pointer",
        color: primary ? "#FFF" : T.ink,
        background: primary ? T.combat : T.surface,
        border: "1px solid " + (primary ? "transparent" : T.line),
        boxShadow: "0 1px 2px rgba(20,20,26,.04)",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {button("Roll initiative", () => actions.setMode("combat"), true)}
        {button("Combat ends", () => actions.setMode("explore"))}
        {button("Turn it down", () => actions.setIntensity(1))}
        {button("Something is wrong", () => actions.setBedLevel("low-breathing", 2))}
      </div>

      <div
        style={{
          marginTop: 20,
          borderRadius: 14,
          border: "1px solid " + T.line,
          background: T.surface,
          padding: "12px 16px",
          fontSize: 12.5,
          lineHeight: 1.8,
          color: T.muted,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <div>
          {theme.name} · {variant.name}
        </div>
        <div>
          mode {state.mode} · intensity {state.intensity} · beds{" "}
          {Object.values(state.levels).filter((n) => n > 0).length}
        </div>
        <div style={{ color: T.faint }}>
          {status.running ? "context running" : "context idle"}
          {status.loading ? " · loading" : ""}
          {status.errors.length ? " · " + status.errors.length + " load fallbacks" : ""}
        </div>
      </div>
    </div>
  );
}
