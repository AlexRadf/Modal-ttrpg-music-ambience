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

**Motifs, chained.** A scene's score is a pool of short passages, shuffled and chained end
to end on the audio clock so the join is sample-exact. The music runs for minutes without
its order coming round, and — because only the sounding motif and its successor have to be
resident — memory stays flat however long the session lasts. A five-minute stem would be
about 106 MB decoded; this is what avoids that.

**Intensity crossfades in place.** Each motif is recorded at several levels — strings,
then strings with piano, then bass, then a counter-melody. Changing level crossfades to
that level of the *same motif at the same point in the passage*, so the arrangement
thickens without the music restarting. Every level therefore has to exist for every motif.

The additive alternative — stems that sum, so level 3 means stems 1, 2 and 3 sounding
together — is built in as `intensityMode: "layers"`, and the demo can A/B the two on the
same material. `mixes` is the default: one file sounds at a time, so it is also lighter.

**Nothing repeats too soon.** The motif order is a shuffled bag, and a passage heard in
the last few motifs is stepped over rather than played again (`noRepeatWindow`, default 3).

**Power-summed ambience.** Uncorrelated beds sum in power, so `n` beds at equal level run
`10·log10(n)` dB hot. The ambience bus is divided by `√n`, which cancels it exactly — the
room holds its level whether one bed is up or six.

**Separate pools per mode.** Exploration and combat are separate motif pools, so combat
can be its own music rather than a busier arrangement of the same cue. Switching crossfades
from one pool into the other, and only the active pool is loaded.

Modes: `off` silences music only — ambience beds keep playing, which is usually what you
want when the table stops for a rules argument.

**One-shots.** `actions.fireOneShot(id)` fires a stinger over the top of everything, on
its own bus so the ambience trim never ducks it. The library is in the config; the console
does not yet have a UI strip for them.

## Pointing it at your files

`resolveSrc` maps an asset onto the URL it was uploaded to. `assetLayout` is a helper for
the conventional arrangement:

```tsx
<AmbienceConsole options={{ resolveSrc: assetLayout({ base: "/audio", ext: "ogg" }) }} />
```

```
/audio/ambience/{bedId}.ogg
/audio/music/{themeId}/{motifId}/intensity-{1..n}.ogg
/audio/one-shots/{oneShotId}.ogg
```

Motifs sit under the scene, not under a variant, because variants are selections from the
scene's pool — two variants that share a motif share the file.

Any other naming scheme is a function — ids in, URLs out. Return `null` for anything not
uploaded and the engine skips it silently instead of reporting it missing:

```ts
resolveSrc: (req) =>
  req.kind === "bed"
    ? uploads.beds[req.bedId] ?? null
    : uploads.stems[`${req.themeId}/${req.motifId}/${req.intensity}`] ?? null;
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

## Authoring the music

A motif is one passage, bounced once per intensity level. Level 1 is the thinnest
arrangement, and each level up adds instruments — each file is a **complete mix at that
level**, not an additive stem.

- Bounce every level of a motif from one session so they line up sample for sample. The
  crossfade enters the new level at the position the old one had reached.
- **Every intensity level of a motif must be exactly the same length**, with no silence at
  either end: motifs are chained by scheduling the next to start the sample after the last
  ends, and levels are crossfaded at a shared position.
- Ring-outs that cross a join should be printed into the head of the next motif.
- Level count is per motif (or per variant): `intensities: 3` gives a three-step control.
- The full spec, including exact motif lengths per scene, is in [ASSETS.md](ASSETS.md).

## When a file is missing

There is no fallback, so failures are made visible rather than papered over:

- A bed whose file will not load is marked **unavailable** in the list, greyed with its
  level dots unlit, and left out of the bus trim. Clicking it retries.
- A music file that fails is skipped, and a motif with nothing loadable is stepped over so
  the chain keeps moving. If a whole scene fails,
  whatever was already playing keeps playing rather than dropping to silence.
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
habitat, hive, storm surface, med lab — each with a pool of twelve motifs (eight
exploration, four combat) and a shared library of 53 sci-fi horror beds.

Variants are selections from a scene's pool rather than separate recordings: "Cold and
dead" and "Something is awake" overlap in the middle of the derelict's pool and diverge at
the edges, which is how one scene gets two moods without being scored twice. Scene names
are generic rather than lifted from any published scenario, and they are display strings,
so rename them freely; the ids are what filenames are built from.

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
| `options` | — | `EngineOptions`: `resolveSrc`, `fetchInit`, `maxDecodedBytes`, fade times, `masterVolume`. |
| `open` / `defaultOpen` / `onOpenChange` | uncontrolled | Control the modal from outside. |
| `trigger` | `true` | Render the floating button. |
| `inline` | `false` | Dock the console in the page instead of over an overlay. |
| `showAuthoring` | `false` | Reveal BPM, key and current bus trim in the header. |
| `showVolume` | `false` | Add a master volume slider to the header. |
| `persistKey` | `"ambience-console"` | `localStorage` key, or `false` to stay stateless. |

## Signal flow

```
master ─┬─ music ── deck ── chain ── motif ── intensity level
        ├─ ambience ── bed × n              (bus × 1/√n)
        └─ sfx ── one-shots
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
- `maxDecodedBytes` (default 320 MB) caps decoded audio. Two motifs' worth is the floor;
  everything above that is cache, evicted least recently used. `status.decodedBytes` and
  `status.motifId` report what is actually held and playing.
- Each URL is fetched and decoded once and shared, so a bed used by six themes costs one
  download. A failed URL is dropped from the cache so the next attempt retries.
- The demo takes `?assets=` and `?ext=` on the query string, which is the quickest way to
  point it at a real server: `npm run dev` then `/?assets=https://your-host/audio&ext=mp3`.
- Escape and overlay clicks close the console, focus is trapped while it is open and
  restored on close, and `prefers-reduced-motion` disables the animations.
