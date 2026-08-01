import type { MotifDef, MusicMode, ThemeDef } from "../types";

/**
 * Scenes for the ALIEN pack.
 *
 * Each scene owns a pool of motifs — short passages of its score, chained in a
 * shuffled order so several minutes pass before the sequence comes round. A
 * motif belongs to one stack: the exploration pool and the combat pool are
 * different music, and switching mode crossfades from one pool into the other.
 *
 * Variants are selections from the pool, not separate recordings. "Cold and
 * dead" and "Something is awake" overlap in the middle of the derelict's pool
 * and diverge at the edges, which is how one scene gets two moods without
 * scoring it twice.
 *
 * Names are deliberately generic rather than lifted from any published
 * scenario, and they are display strings — rename them freely. The ids are what
 * filenames are built from, so changing those means moving files.
 *
 * `bpm`, `key` and `bars` are authoring metadata. The engine never reads them;
 * they exist so everyone bouncing stems for a scene agrees on tempo and length,
 * and they drive the spec in ASSETS.md.
 */

/** A scene's pool: `n` motifs for a stack, all the same length. */
const pool = (mode: MusicMode, n: number, intensities: number, bars: number): MotifDef[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${mode}-${i + 1}`, mode, intensities, bars }));

/** Motif ids `from`..`to` inclusive, for a variant's selection. */
const pick = (mode: MusicMode, from: number, to: number): string[] =>
  Array.from({ length: to - from + 1 }, (_, i) => `${mode}-${from + i}`);

/**
 * Eight exploration motifs and four combat ones per scene. A variant takes six
 * and three of them, so its exploration pool runs about four minutes before the
 * order refreshes.
 */
const scenePool = (intensities: number, bars: number) =>
  pool("explore", 8, intensities, bars)
    .concat(pool("combat", 4, intensities, bars))
    .concat(pool("victory", 1, intensities, bars));
const early = pick("explore", 1, 6).concat(pick("combat", 1, 3), ["victory-1"]);
const late = pick("explore", 3, 8).concat(pick("combat", 2, 4), ["victory-1"]);

export const THEMES: ThemeDef[] = [
  {
    id: "hypersleep",
    name: "Hypersleep Bay",
    accent: "#5E8CA8",
    image: null,
    art: "radial-gradient(120% 90% at 30% 12%, #BFE3F0 0%, rgba(191,227,240,0) 55%), linear-gradient(160deg, #2B4A5E 0%, #0B141C 100%)",
    bpm: 60,
    key: "D minor",
    bars: 11,
    motifs: scenePool(3, 11),
    variants: [
      { id: "long-dark", name: "The long dark", motifs: early, intensities: 3 },
      { id: "wake", name: "Emergency wake", motifs: late, intensities: 3 },
    ],
    ambience: ["cryo-pods", "ship-hum", "air-recycler", "condensation", "vitals-monitor", "low-breathing"],
  },
  {
    id: "derelict",
    name: "The Derelict",
    accent: "#6E8A62",
    image: null,
    art: "radial-gradient(110% 85% at 68% 15%, #A9C48F 0%, rgba(169,196,143,0) 50%), linear-gradient(155deg, #33422C 0%, #0D120C 100%)",
    bpm: 66,
    key: "C minor",
    bars: 12,
    motifs: scenePool(4, 12),
    variants: [
      { id: "cold", name: "Cold and dead", motifs: early },
      { id: "awake", name: "Something is awake", motifs: late },
    ],
    ambience: ["hull-groan", "vent-draught", "condensation", "deck-creak", "resin-creak", "comms-static"],
  },
  {
    id: "colony",
    name: "Colony Habitat",
    accent: "#B07A3C",
    image: null,
    art: "radial-gradient(120% 90% at 25% 18%, #F2C983 0%, rgba(242,201,131,0) 55%), linear-gradient(160deg, #6A4A24 0%, #1E1409 100%)",
    bpm: 84,
    key: "A minor",
    bars: 16,
    motifs: scenePool(4, 16),
    variants: [
      { id: "shift", name: "Shift change", motifs: early },
      { id: "evacuate", name: "Evacuation order", motifs: late },
    ],
    ambience: ["air-recycler", "terminal-chatter", "distant-voices", "klaxon-distant", "power-flicker", "fan-rattle"],
  },
  {
    id: "hive",
    name: "The Hive",
    accent: "#7B4E96",
    image: null,
    art: "radial-gradient(110% 80% at 45% 85%, #C79AE0 0%, rgba(199,154,224,0) 55%), linear-gradient(150deg, #3D2450 0%, #0F0714 100%)",
    bpm: 72,
    key: "F minor",
    bars: 14,
    motifs: scenePool(5, 14),
    variants: [
      { id: "galleries", name: "Resin galleries", motifs: early, intensities: 5 },
      { id: "stirs", name: "The nest stirs", motifs: late, intensities: 5 },
    ],
    ambience: ["resin-creak", "wet-growth", "egg-pulse", "skitter", "tail-drag", "low-breathing"],
  },
  {
    id: "surface",
    name: "Storm Surface",
    accent: "#8F6E4E",
    image: null,
    art: "radial-gradient(120% 90% at 60% 80%, #E4BE8A 0%, rgba(228,190,138,0) 55%), linear-gradient(160deg, #5E4832 0%, #1B1410 100%)",
    bpm: 78,
    key: "G minor",
    bars: 14,
    motifs: scenePool(4, 14),
    variants: [
      { id: "walk", name: "Exosuit walk", motifs: early },
      { id: "whiteout", name: "Whiteout", motifs: late },
    ],
    ambience: ["storm-wind", "grit-on-visor", "suit-breathing", "motion-tracker", "radio-traffic", "distant-thunder"],
  },
  {
    id: "medlab",
    name: "Med Lab",
    accent: "#4E8496",
    image: null,
    art: "radial-gradient(110% 85% at 72% 20%, #CFEAF2 0%, rgba(207,234,242,0) 55%), linear-gradient(155deg, #35525C 0%, #101A1E 100%)",
    bpm: 90,
    key: "B minor",
    bars: 16,
    motifs: scenePool(4, 16),
    variants: [
      { id: "quarantine", name: "Quarantine", motifs: early },
      { id: "breach", name: "Containment breach", motifs: late },
    ],
    ambience: ["vitals-monitor", "incubator-hum", "surgical-servo", "coolant-hiss", "keypad-beeps", "klaxon-close"],
  },
];
