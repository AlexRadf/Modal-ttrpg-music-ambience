# Signal

A drop-in music and ambience console for running tabletop games in the
browser. One script tag, no dependencies, no build step for the widget
itself.

- Genre cards on the main menu, scenes in a dropdown.
- Two tracks per scene — **Explore** and **Combat** — each built from five
  stems that stack as you raise the intensity slider.
- Everything crossfades over four seconds: starting, switching tracks,
  changing scene, moving the intensity.
- Ambience beds you layer at three levels, and a page of one shots.

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

With no audio files it runs a synthesised demo set, so it works the moment
you open it.

## Adding your own audio

Drop files into a folder tree and run one command:

```
audio/<genre>/<scene>/music/explore/1..5.mp3
audio/<genre>/<scene>/music/combat/1..5.mp3
audio/<genre>/<scene>/ambience/*.mp3
audio/<genre>/<scene>/oneshots/*.mp3
```

```bash
node build-library.mjs
```

Reload the page and your material replaces the demo set. Folder and file
names become the labels.

**[Full guide → GUIDE.md](GUIDE.md)** — layout, naming, what to write for
each of the five layers, and how to embed it in your own site.

## Files

| File | |
| --- | --- |
| `signal.js` | The console — UI, audio engine, and the demo set. |
| `build-library.mjs` | Scans `audio/`, writes `library.json`. |
| `index.html` | A blank page that loads the console. |
| `GUIDE.md` | How to use it and how to write for it. |
