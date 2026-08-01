import { useMemo } from "react";
import { AmbienceConsole, AmbienceProvider, assetLayout, tokens as T, useAmbience } from "../index";

/**
 * A stand-in for a host app. Two things to look at: the console's own UI, and
 * `useAmbience` driving it from outside — which is how an encounter tracker
 * would flip the table into combat.
 *
 * Audio comes from wherever `?assets=` points, defaulting to /audio. Nothing is
 * bundled, so until files are uploaded there the panel below lists what is
 * missing, URL by URL.
 */
export function App() {
  const params = new URLSearchParams(window.location.search);
  const base = params.get("assets") || "/audio";
  const ext = params.get("ext") || "ogg";
  const options = useMemo(() => ({ resolveSrc: assetLayout({ base, ext }) }), [base, ext]);

  return (
    <AmbienceProvider persistKey="ambience-demo" options={options}>
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

          <HostControls base={base} />
        </div>

        <AmbienceConsole showAuthoring showVolume />
      </div>
    </AmbienceProvider>
  );
}

function HostControls(props: { base: string }) {
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
          serving audio from <code style={{ fontFamily: "ui-monospace, monospace" }}>{props.base}</code> ·{" "}
          {status.running ? "context running" : "context idle"}
          {status.loading ? " · loading" : ""}
        </div>
      </div>

      {status.errors.length > 0 && (
        <div
          style={{
            marginTop: 12,
            borderRadius: 14,
            border: "1px solid " + T.line,
            background: T.surface,
            padding: "12px 16px",
            fontSize: 12.5,
            lineHeight: 1.7,
            color: T.muted,
          }}
        >
          <strong style={{ color: T.ink, fontWeight: 600 }}>Could not load</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontFamily: "ui-monospace, monospace", fontSize: 11.5 }}>
            {status.errors.slice(-6).map((e, i) => (
              <li key={i} style={{ wordBreak: "break-all" }}>
                {e.url} — {e.message}
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 8, color: T.faint, fontSize: 12 }}>
            Upload files to match, or start the demo with{" "}
            <code style={{ fontFamily: "ui-monospace, monospace" }}>?assets=https://your-server/audio</code>.
          </div>
        </div>
      )}
    </div>
  );
}
