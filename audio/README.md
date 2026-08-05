# Your audio goes here

This is an empty skeleton in the shape the build script expects. Rename
`your genre/` and `your scene/`, drop your files in, and copy the pattern
for as many genres and scenes as you like.

```
audio/
  your genre/                 → a card on the main menu
    about.txt                 → optional; first line is the card's subtitle
    your scene/               → an entry in the scene dropdown
      music/
        explore/              → 5 stems, quietest layer first: 1 …mp3 … 5 …mp3
        combat/               → same, for the combat track
      ambience/               → looping beds, one file each
      oneshots/               → buttons on the One shots tab
  oneshots/                   → one shots shared by every scene everywhere
```

Then, from the project root:

```bash
node build-library.mjs
```

File and folder names become the labels shown in the console —
`03 - deck_plate hum.mp3` reads as **Deck plate hum**. Numbers only set the
order.

Audio files themselves are ignored by git (see `.gitignore`), so this folder
stays light in the repository.

See [../GUIDE.md](../GUIDE.md) for what to write for each of the five layers.
