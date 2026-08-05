#!/usr/bin/env node
/* ======================================================================
   build-library.mjs — turn an audio/ folder into library.json.

   Run it after you add, rename or remove files:

       node build-library.mjs

   You never edit signal.js to add music. The folder structure is the
   configuration:

       audio/
         sci-fi horror/                 ← a card on the main menu
           about.txt                    ← optional one-line blurb
           ship corridors/              ← a scene in the dropdown
             music/
               explore/                 ← 5 stems, quietest layer first
                 1 low strings.mp3
                 2 high strings.mp3
                 3 theme.mp3
                 4 figure.mp3
                 5 counter.mp3
               combat/
                 1 pulse.mp3  ... 5 counter.mp3
             ambience/
               vent hiss.mp3
               deck hum.mp3
             oneshots/
               blast door.mp3

   Shared material: an ambience/ or oneshots/ folder placed directly in a
   genre folder is added to every scene in that genre. The same folders at
   the top of audio/ are added to every scene everywhere.

   Labels come from the file and folder names: numbering prefixes and
   extensions are dropped, dashes and underscores become spaces.
   ====================================================================== */

import { readdirSync, statSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join, relative, sep, extname, basename } from 'node:path';

const AUDIO_DIR = process.argv[2] || 'audio';
const OUT = process.argv[3] || 'library.json';
const EXT = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.flac', '.opus', '.webm', '.aac']);
const MODES = ['explore', 'combat'];

const dirs = (p) => (existsSync(p) ? readdirSync(p)
  .filter((n) => !n.startsWith('.') && !n.startsWith('_'))
  .filter((n) => statSync(join(p, n)).isDirectory())
  .sort(byName) : []);

const files = (p) => (existsSync(p) ? readdirSync(p)
  .filter((n) => !n.startsWith('.'))
  .filter((n) => EXT.has(extname(n).toLowerCase()))
  .filter((n) => statSync(join(p, n)).isFile())
  .sort(byName) : []);

/* "10 ..." sorts after "9 ..." — plain string sort would not. */
function byName(a, b) {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}

/* "03 - deck_plate hum.mp3" -> "Deck plate hum".
   Hyphens only become spaces in kebab-case names, so "sci-fi horror"
   keeps its hyphen and "deep-wood" still reads as "Deep wood". */
function label(name) {
  let text = basename(name, extname(name)).replace(/^[\s0-9]+[-_.)\s]*/, '');
  text = text.replace(/_+/g, ' ');
  if (!/\s/.test(text)) text = text.replace(/-+/g, ' ');
  text = text.replace(/\s+-\s+/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : basename(name, extname(name));
}

/* "Sci-Fi Horror" -> "sciFiHorror", so keys are stable and URL-safe. */
function key(name) {
  const parts = name.replace(/^[\s0-9]+[-_.)\s]*/, '').split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (!parts.length) return 'set';
  return parts[0].toLowerCase() + parts.slice(1)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('');
}

const url = (p) => relative('.', p).split(sep).map(encodeURIComponent).join('/');

function blurb(dir) {
  const f = join(dir, 'about.txt');
  if (!existsSync(f)) return null;
  const line = readFileSync(f, 'utf8').split('\n')[0].trim();
  return line || null;
}

/* A folder of loopable beds. */
function beds(dir, prefix) {
  return files(dir).map((f, i) => ({
    id: prefix + '-' + i,
    label: label(f),
    carry: label(f).toLowerCase(),     // same name in the next scene = carries over
    src: url(join(dir, f)),
    gain: 0.7
  }));
}

/* A folder of one shots. */
function shots(dir) {
  return files(dir).map((f) => ({ label: label(f), src: url(join(dir, f)) }));
}

/* music/<mode>/ — five stems, quietest layer first. Fewer than five is
   fine; the intensity slider just tops out earlier in practice. */
function cue(dir) {
  const list = files(dir);
  if (!list.length) return null;
  if (list.length > 5) warn(`${dir} has ${list.length} files; only the first 5 are used`);
  const used = list.slice(0, 5);
  return { stems: used.map((f) => url(join(dir, f))), gains: used.map(() => 1) };
}

const warnings = [];
const warn = (m) => warnings.push(m);

function musicFor(sceneDir) {
  const root = join(sceneDir, 'music');
  const out = {};
  MODES.forEach((m) => {
    const c = cue(join(root, m));
    if (c) out[m] = c;
  });
  // Files dropped straight into music/ count as the explore cue.
  if (!out.explore) {
    const flat = cue(root);
    if (flat) out.explore = flat;
  }
  return out;
}

function build() {
  if (!existsSync(AUDIO_DIR)) {
    console.error(`No ${AUDIO_DIR}/ folder here. Create one and drop your audio in — see GUIDE.md.`);
    process.exit(1);
  }

  const globalBeds = beds(join(AUDIO_DIR, 'ambience'), 'global');
  const globalShots = shots(join(AUDIO_DIR, 'oneshots'));

  const library = {};
  let sceneCount = 0, fileCount = 0;

  dirs(AUDIO_DIR).forEach((genreDir) => {
    const gPath = join(AUDIO_DIR, genreDir);
    const sceneDirs = dirs(gPath).filter((d) => d !== 'ambience' && d !== 'oneshots');
    if (!sceneDirs.length) return;                 // ambience/ or oneshots/ only

    const genreBeds = beds(join(gPath, 'ambience'), key(genreDir));
    const genreShots = shots(join(gPath, 'oneshots'));

    const scenes = {};
    sceneDirs.forEach((sceneDir) => {
      const sPath = join(gPath, sceneDir);
      const scene = {
        label: label(sceneDir),
        music: musicFor(sPath),
        ambience: beds(join(sPath, 'ambience'), key(sceneDir)).concat(genreBeds, globalBeds),
        oneshots: shots(join(sPath, 'oneshots')).concat(genreShots, globalShots)
      };
      if (!Object.keys(scene.music).length && !scene.ambience.length && !scene.oneshots.length) {
        warn(`${sPath} has no playable audio — skipped`);
        return;
      }
      if (!Object.keys(scene.music).length) warn(`${sPath} has no music/ folder`);
      fileCount += scene.ambience.length + scene.oneshots.length +
        Object.values(scene.music).reduce((n, c) => n + c.stems.length, 0);
      scenes[key(sceneDir)] = scene;
      sceneCount++;
    });

    if (!Object.keys(scenes).length) return;
    library[key(genreDir)] = {
      label: label(genreDir),
      blurb: blurb(gPath) || undefined,
      scenes
    };
  });

  writeFileSync(OUT, JSON.stringify(library, null, 2) + '\n');

  const genres = Object.keys(library).length;
  if (!genres) {
    console.log(`Wrote ${OUT}, but found nothing to play. Check GUIDE.md for the folder layout.`);
  } else {
    console.log(`Wrote ${OUT} — ${genres} set${genres > 1 ? 's' : ''}, ` +
                `${sceneCount} scene${sceneCount > 1 ? 's' : ''}, ${fileCount} files.`);
    Object.keys(library).forEach((g) => {
      const scenes = Object.keys(library[g].scenes);
      console.log(`  ${library[g].label}: ${scenes.map((s) => library[g].scenes[s].label).join(', ')}`);
    });
  }
  if (warnings.length) {
    console.log('\nWorth a look:');
    warnings.forEach((w) => console.log('  - ' + w));
  }
}

build();
