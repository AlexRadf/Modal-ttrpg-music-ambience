# Ambience console

A modular music and ambience player for TTRPG web apps. One floating button opens a
console where you pick a place, a version of that place, how hard the scene is going,
and what the room sounds like underneath.

It is a React component with a Web Audio engine behind it. No Tailwind, no CSS import,
no audio files required to start.

```bash
npm install
npm run dev      # demo at http://localhost:5173
npm run build    # library -> dist/
```

## Drop it in

```tsx
import { AmbienceConsole } from "@ambience/console";

export function App() {
  return (
    <>
      <YourApp />
      <AmbienceConsole />
    </>
  );
}
```

That is the whole integration. The component renders its own floating trigger, provides
its own state, persists to `localStorage`, and ships styles inline — nothing to import
and nothing to configure.

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

## Bring your own audio

Nothing is bundled. Point the engine at your files with `resolveSrc`, either by hand or
with the conventional layout helper:

```tsx
import { AmbienceConsole, assetLayout } from "@ambience/console";

<AmbienceConsole options={{ resolveSrc: assetLayout({ base: "/audio", ext: "ogg" }) }} />;
```

which expects:

```
/audio/ambience/{bedId}.ogg
/audio/music/{themeId}/{variantId}/{explore|combat}-{1..5}.ogg
```

Per-asset URLs win over the resolver, so a half-produced library works — give a bed a
`src` and leave the rest:

```ts
beds: { "hearth-fire": { id: "hearth-fire", name: "Hearth fire", src: "/audio/fire.ogg" } }
```

**Authoring the stems.** All five layers of a stack must be the same musical length and
render from the same performance — bounce them from one session with layers soloed, do
not record them separately. Layer 1 is the floor and is heard alone at intensity 1; layer
5 is the top and is heard only at 5. The combat stack must match the exploration stack's
length exactly or the two will drift apart when you switch.

**Until then, everything is synthesised.** Any source with no URL — or one that 404s —
is generated procedurally from its id: filtered noise and scattered events for beds,
a drone/pad/figure/pulse/lead stack for music, seeded so a given id sounds the same on
every load. It is a stand-in, not a soundtrack, but it means the console is playable and
demoable before a note has been recorded. Turn it off with `synthFallback: false` and
missing files simply stay silent.

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

## Your own content

`themes` and `beds` are plain data. Replace them wholesale:

```tsx
<AmbienceConsole config={{ beds: MY_BEDS, themes: MY_THEMES }} />
```

Beds live in one flat namespace so any theme can borrow any bed — that is what the "Add
more" search is pulling from — and ids double as filenames. A theme lists the beds it
opens with; the rest of the library is one search away. Give a theme `image` for real
cover art, or leave it null and the `art` gradient stands in.

## Props

| Prop | Default | |
|---|---|---|
| `config` | bundled pack | Themes and beds. |
| `options` | — | `EngineOptions`: `resolveSrc`, fade times, `masterVolume`, `synthFallback`. |
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
          loader.ts                  fetch + decode, cached, with fallback
          synth.ts                   procedural stand-in audio
          resolve.ts                 URL layout helper
          util.ts                    seamless looping, scales, ramps
  state/context.tsx                  React state, persistence, engine sync
  ui/                                the console, one file per part
src/demo/                            a host app to try it in
```

## Notes

- Bed levels are −18 / −12 / −6 dB (`LEVEL_GAIN`). Beds sit well under music by design;
  with real assets the music/ambience balance is yours to author at the source.
- Loops are made seamless on the way in: ambience crossfades its tail onto its head,
  music wraps note tails past the loop point back onto the head so the bar grid survives.
- Escape and overlay clicks close the console, focus is trapped while it is open and
  restored on close, and `prefers-reduced-motion` disables the animations.
