# Ambience console

A modular music and ambience player for TTRPG web apps. One floating button opens a
console where you pick a place, a version of that place, how hard the scene is going,
and what the room sounds like underneath.

It is a React component with a Web Audio engine behind it. It plays audio files you host;
nothing is bundled and nothing is generated.

```bash
npm install
npm run dev      # demo at http://localhost:5173
npm run build    # library -> dist/
```

## Drop it in

```tsx
import { AmbienceConsole, assetLayout } from "@ambience/console";

export function App() {
  return (
    <>
      <YourApp />
      <AmbienceConsole options={{ resolveSrc: assetLayout({ base: "/audio" }) }} />
    </>
  );
}
```

That is the whole integration. The component renders its own floating trigger, provides
its own state, persists to `localStorage`, and ships styles inline — no CSS to import and
no Tailwind. The one thing it needs is where your uploads live.

## How it sounds

Three ideas do the work.

**Vertical layering.** Every stem of the current scene starts on the same sample and
keeps running for as long as the scene does. Intensity does not start or stop anything;
it moves gain on layers that are already playing. Raising it sounds like an arrangement
opening up rather than a second track fading in, because it is the same performance
throughout.

**Two stacks, one grid.** Exploration and combat are separate stem stacks of the same
piece, started together and crossfaded between. Combat lands in time because it was
already playing, silently, in the same bar.

**Power-summed ambience.** Uncorrelated beds sum in power, so `n` beds at equal level run
`10·log10(n)` dB hot. The ambience bus is divided by `√n`, which cancels it exactly — the
room holds its level whether one bed is up or six.

Modes: `off` silences music only. Ambience beds keep playing, which is usually what you
want when the table stops for a rules argument.

## Pointing it at your files

`resolveSrc` maps an asset onto the URL it was uploaded to. `assetLayout` is a helper for
the conventional arrangement:

```tsx
<AmbienceConsole options={{ resolveSrc: assetLayout({ base: "/audio", ext: "ogg" }) }} />
```

```
/audio/ambience/{bedId}.ogg
/audio/music/{themeId}/{variantId}/{explore|combat}-{1..5}.ogg
```

Any other naming scheme is a function — ids in, URLs out. Return `null` for anything not
uploaded and the engine skips it silently instead of reporting it missing:

```ts
resolveSrc: (req) =>
  req.kind === "bed"
    ? uploads.beds[req.bedId] ?? null
    : uploads.stems[`${req.themeId}/${req.variantId}/${req.mode}/${req.layer}`] ?? null;
```

Per-asset URLs in the config win over the resolver, which is the escape hatch for one
oddly-named file or a signed URL:

```ts
beds: { "hearth-fire": { id: "hearth-fire", name: "Hearth fire", src: "https://cdn/…/fire.ogg" } }
```

Uploads behind auth: `options.fetchInit` is passed to every `fetch`, so
`{ credentials: "include" }` or an `Authorization` header works. Cross-origin hosts need
CORS headers — audio is fetched and decoded, not streamed through an `<audio>` tag.

Call `engine.preload(themeId, variantId)` to warm the cache — worth doing when the
console opens, so the first press of play does not wait on ten downloads.

## Authoring the stems

All layers of a stack must be the same musical length and come from the same performance:
bounce them from one session with layers soloed, do not record them separately. They start
on the same sample and are gated by gain alone, so anything else drifts.

- Layer 1 is the floor, heard alone at intensity 1. Layer 5 is the top, heard only at 5.
- The combat stack must match the exploration stack's length exactly, or switching mid-bar
  puts the two out of phase.
- Fewer than five layers is fine — set `layers: 3` on the variant and the intensity control
  shows three steps.
- Loop points must be clean in the file itself; playback uses `loop = true`, which is
  sample-exact and does no crossfading.

## When a file is missing

There is no fallback, so failures are made visible rather than papered over:

- A bed whose file will not load is marked **unavailable** in the list, greyed with its
  level dots unlit, and left out of the bus trim. Clicking it retries.
- A music stem that fails is skipped; the rest of the stack still plays. If every stem of
  a scene fails, whatever was already playing keeps playing rather than dropping to silence.
- Every failure lands in `status.errors` as `{ url, message }`, so you can surface them in
  your own UI. The demo prints them.

A server with an SPA fallback answers `200` with `index.html` for a missing file, which
would otherwise surface as a baffling decode error — the loader checks the content type and
reports `expected audio, server sent text/html` instead.

## Drive it from your app

Wrap the part of your app that needs control and use the hook. This is how an initiative
tracker flips the table into combat:

```tsx
import { AmbienceProvider, AmbienceConsole, useAmbience } from "@ambience/console";

function EncounterButton() {
  const { actions } = useAmbience();
  return <button onClick={() => actions.setMode("combat")}>Roll initiative</button>;
}

<AmbienceProvider>
  <EncounterButton />
  <AmbienceConsole />
</AmbienceProvider>;
```

`useAmbience()` gives you `state`, `actions`, `status`, the resolved `theme` and
`variant`, and the `engine` itself. `AmbienceConsole` joins a provider when there is one
above it and creates its own when there is not, so both integrations are one line.

Browsers only let audio start from a user gesture. Nothing touches the `AudioContext`
until the first deliberate action, so calling `setMode("combat")` on page load will set
the state and stay silent until someone clicks. Drive it from a click, not an effect.

## Content

The bundled pack is for **ALIEN RPG**: six scenes — hypersleep bay, derelict, colony
habitat, hive, storm surface, med lab — with two variants each and a shared library of 53
sci-fi horror beds. Scene names are generic rather than lifted from any published
scenario, and they are display strings, so rename them freely; the ids are what filenames
are built from.

It is plain data. Replace it wholesale, or extend it:

```tsx
<AmbienceConsole config={{ ...ALIEN_PACK, themes: ALIEN_PACK.themes.concat(myScenes) }} />
```

Beds live in one flat namespace so any scene can borrow any bed — that is what the "Add
more" search pulls from — and ids double as filenames. A scene lists the beds it opens
with; the rest of the library is one search away. Give a scene `image` for real cover art,
or leave it null and the `art` gradient stands in.

## What to record

[ASSETS.md](ASSETS.md) is the upload checklist: every file the pack needs, with format,
level and loop-length specs, and a suggested order to produce them in. It is generated
from the config, so it cannot drift:

```bash
npm run assets                            # regenerate ASSETS.md
npm run assets -- --base=/media --ext=m4a # for a different layout
```

The same generator is exported, for an admin screen that diffs required against uploaded:

```ts
import { assetManifest, missingAssets, DEFAULT_CONFIG } from "@ambience/console";

const required = assetManifest(DEFAULT_CONFIG, { resolveSrc });
const outstanding = missingAssets(DEFAULT_CONFIG, await listUploadedUrls());
```

## Props

| Prop | Default | |
|---|---|---|
| `config` | bundled pack | Themes and beds. |
| `options` | — | `EngineOptions`: `resolveSrc`, `fetchInit`, fade times, `masterVolume`. |
| `open` / `defaultOpen` / `onOpenChange` | uncontrolled | Control the modal from outside. |
| `trigger` | `true` | Render the floating button. |
| `inline` | `false` | Dock the console in the page instead of over an overlay. |
| `showAuthoring` | `false` | Reveal BPM, key and current bus trim in the header. |
| `showVolume` | `false` | Add a master volume slider to the header. |
| `persistKey` | `"ambience-console"` | `localStorage` key, or `false` to stay stateless. |

## Signal flow

```
master ─┬─ music ──── deck ─┬─ explore ── layer 1..5
        │                   └─ combat  ── layer 1..5
        └─ ambience ─ bed × n        (bus × 1/√n)
```

`src/lib/audio/engine.ts` owns all of it and has no React in it, so it can be driven from
anywhere — `new AmbienceEngine(config, options)` is a supported way to use this without
the UI at all.

## Layout

```
src/lib/
  types.ts, constants.ts, theme.ts   contract, gain tables, design tokens
  data/                              the bundled content pack
  audio/  engine.ts                  buses, decks, beds, fades
          loader.ts                  fetch + decode, cached, per-URL failures
          resolve.ts                 URL layout helper
          util.ts                    gain ramps
  state/context.tsx                  React state, persistence, engine sync
  ui/                                the console, one file per part
src/demo/                            a host app to try it in
```

## Notes

- Bed levels are −18 / −12 / −6 dB (`LEVEL_GAIN`); music stems play at unity. The balance
  between the two buses is yours to set at the source when you master the files.
- Each URL is fetched and decoded once and shared, so a bed used by six themes costs one
  download. A failed URL is dropped from the cache so the next attempt retries.
- The demo takes `?assets=` and `?ext=` on the query string, which is the quickest way to
  point it at a real server: `npm run dev` then `/?assets=https://your-host/audio&ext=mp3`.
- Escape and overlay clicks close the console, focus is trapped while it is open and
  restored on close, and `prefers-reduced-motion` disables the animations.
