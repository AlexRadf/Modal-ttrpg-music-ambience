# Signal — user guide

A music and ambience console for running games at the table or over a call.
It sits in the corner of a web page as a single button; everything else
opens from there.

Two files do the work:

| File | What it is |
| --- | --- |
| `signal.js` | The console. One script tag, no dependencies, no build step. |
| `build-library.mjs` | Reads your `audio/` folder and writes `library.json`. |

You never edit `signal.js` to add music. You drop files into folders and
re-run the build.

---

## 1. Running it

```bash
# from the project folder
python3 -m http.server 8000     # or: npx serve .
```

Open <http://localhost:8000>. Click the note button in the bottom-right.

> Audio has to be served over `http://` or `https://`, not opened as a
> `file://` path — browsers refuse to load audio files that way. The
> command above is all the server you need.

With no audio files present the console runs a **synthesised demo set** so
you can try every control immediately. The moment a `library.json` exists,
your own material replaces the demo entirely.

---

## 2. Adding your own audio

### The folder layout

```
audio/
  sci-fi horror/                  ← a card on the main menu
    about.txt                     ← optional; first line is the card's subtitle
    ship corridors/               ← a scene in the dropdown
      music/
        explore/                  ← the ambient/exploration track
          1 low strings.mp3
          2 high strings.mp3
          3 theme.mp3
          4 figure.mp3
          5 counter.mp3
        combat/                   ← the combat track
          1 pulse.mp3
          2 low brass.mp3
          3 theme.mp3
          4 taiko.mp3
          5 counter.mp3
      ambience/                   ← looping beds, one file each
        vent hiss.mp3
        deck plate hum.mp3
        distant klaxon.mp3
      oneshots/                   ← buttons on the One shots tab
        blast door.mp3
        motion tracker.mp3
    cryo bay/
      ...same shape...
  dark fantasy/
    ...
```

Three levels, and that is the whole configuration:

1. **Genre folder** → a card on the main menu.
2. **Scene folder** → an entry in the dropdown at the top of the board.
3. **`music/` `ambience/` `oneshots/`** → what that scene can play.

### Rebuild after any change

```bash
node build-library.mjs
```

It prints what it found:

```
Wrote library.json — 2 sets, 5 scenes, 71 files.
  Sci-fi horror: Ship corridors, Cryo bay
  Dark fantasy: Crypt, Deep wood, The keep
```

Reload the page. That's the whole loop: **drop files → run the build →
reload**.

### Naming

Names become labels, so write them the way you want them read.
`03 - deck_plate hum.mp3` shows up as **Deck plate hum** — leading numbers,
dashes, underscores and extensions are all stripped. Numbers are only there
to fix the order, and they sort naturally (`10` after `9`).

Formats: `.mp3`, `.ogg`, `.wav`, `.m4a`, `.flac`, `.opus`, `.aac`, `.webm`.
MP3 or OGG at 192kbps is plenty and keeps loading quick.

### Shared material

Sound effects you want everywhere don't need copying into every scene:

- `audio/<genre>/oneshots/` → added to every scene in that genre.
- `audio/<genre>/ambience/` → same, for beds.
- `audio/oneshots/` and `audio/ambience/` → added to every scene, everywhere.

Scene-specific files list first, then genre-wide, then global.

---

## 3. Writing the music

Each track is **five stems that stack**. Intensity 1 plays stem 1; intensity
3 plays stems 1, 2 and 3 together; intensity 5 plays all of them. So every
stem has to work on its own *and* against everything below it.

Practical rules:

- **Same key, same tempo, same length** for all five stems in a track, and
  ideally across explore and combat in a scene, so switching never lurches.
- **Loop cleanly.** Export exact bar counts — 4 or 8 bars is a good length,
  32 bars if you want it to breathe.
- **Export each stem with the others muted**, not as progressive mixes. The
  console does the stacking.
- **Leave room.** Each stem should occupy its own register; if two fight,
  intensity 4 turns to mud.

### The exploration track — five layers

| # | Role | What to write |
| --- | --- | --- |
| 1 | Low strings / bed | Sustained root and fifth. The floor. Should be able to run alone for ten minutes without wearing out. |
| 2 | High strings / air | Slow swells, choir or upper strings. Adds space, not motion. |
| 3 | **Theme** | The melody of the scene. A real tune — this is what your table will remember. |
| 4 | Figure | A repeating arpeggio or ostinato: harp, pizzicato, plucked synth. Adds forward motion. |
| 5 | Counter-melody | A second line answering the theme *in its gaps*, higher up. Not more of the same — an answer. |

### The combat track — five layers

| # | Role | What to write |
| --- | --- | --- |
| 1 | Pulse | Driving eighths or sixteenths: low synth pulse, muted strings, ostinato cello. Sets the heart rate. |
| 2 | Low brass / strings | The weight underneath. Long notes, root movement. |
| 3 | **Theme** | The combat melody. Angular, insistent, in the same key as the explore theme so the two feel related. |
| 4 | Taiko / percussion | Light taiko, toms, low hits. Keep it restrained — this is the *fourth* layer, not the first. |
| 5 | Counter-melody | The lid coming off: a counter-line with cymbal swells, more string movement, or a synth pulse an octave up. |

Layer 5 is the one that should make people sit up. Write it so it only makes
sense arriving late.

### Ambience beds

Long, seamless, no musical pitch centre if you can help it — they have to
sit under any of the tracks above. 60 to 120 seconds is a good length; you
can loop shorter, but the repeat starts to show. Wind, hum, rain, crowd,
machinery, distant weather.

### One shots

Short and dry. Doors, impacts, screeches, chimes, alarms. Anything longer
than a few seconds fights the music.

---

## 4. Using it at the table

**Main menu** — the cards. Pick the genre you're running. Click the arrow at
the top-left to come back and switch.

**Scene dropdown** — where you are in the fiction. Changing it never stops
the music: the cue you're on keeps playing while the new scene's cue comes
up under it, over four seconds. Ambience beds with the same name in both
scenes carry across at the level you had them.

**Off / Explore / Combat** — the two tracks and silence. Switching between
them crossfades over the same four seconds, so combat arrives without a cut.
A greyed-out button means that scene has no stems for it.

**The intensity bars** — the five bars are the slider. Click or drag across
them left to right, or focus them and use the arrow keys. Every step
crossfades over four seconds, so you can ride it up as a scene builds and
nobody hears a layer switch on.

**Ambience** — click a bed's name to toggle it on or off; click one of the
three bars to set it low, medium or high. Clicking the bar that's already
lit turns the bed off too. Beds are independent of the music — layer as many
as you like.

**One shots** — the second tab. One click, one sound.

**Master** and **Silence** — volume, and everything off in under half a
second when the doorbell goes.

Four seconds is the crossfade everywhere, deliberately: it is long enough
that nobody at the table notices a transition, and short enough to respond
to a scene turning.

---

## 5. Putting it in your own site

```html
<script src="/path/to/signal.js"></script>
```

That's it — the console injects itself into the corner of the page and keeps
its styles to itself (it renders in a shadow root, so nothing on your page
can leak into it or vice versa).

If your audio lives somewhere else, say so before the script tag:

```html
<script>
  window.SIGNAL_BASE     = 'https://cdn.example.com/';  // prefix for every audio path
  window.SIGNAL_MANIFEST = 'library.json';              // where the library lives
</script>
<script src="/path/to/signal.js"></script>
```

Hosting on a static host (Netlify, Pages, S3) works as-is: upload
`signal.js`, `library.json` and the `audio/` folder together.

---

## 6. If something doesn't play

| What you see | Usually means |
| --- | --- |
| The demo set instead of yours | No `library.json` next to the page — run `node build-library.mjs`, and check it's being served from the same folder. |
| A set is missing from the menu | That genre folder has no scene folders inside it, only loose files. |
| A scene plays ambience but no music | No `music/explore/` or `music/combat/` folder in it. The build prints this as a warning. |
| Nothing at all, console shows a 404 | Path or spelling — remember the build encodes names, so a renamed file needs a rebuild. |
| Silence until you click | Browsers only start audio after a click. Opening the panel counts. |
| Stems drift apart | The stems in that track aren't the same length. Re-export them to an exact bar count. |

Warnings from the build are advisory — it always writes the file with
whatever it did find.
