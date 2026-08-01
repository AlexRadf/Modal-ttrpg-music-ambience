import type { ThemeDef } from "../types";

/**
 * Scenes for the ALIEN pack.
 *
 * Names are deliberately generic rather than lifted from any published
 * scenario, so the same six scenes carry a homebrew game as well as a
 * pre-written one — and they are display strings, so rename them freely. The
 * ids are what filenames are built from; changing those means moving files.
 *
 * `bpm`, `key` and `bars` are authoring metadata. The engine never reads them;
 * they exist so everyone bouncing stems for a scene agrees on tempo and length,
 * and they drive the spec in ASSETS.md.
 *
 * Swap `image` for real cover art and the gradient falls away.
 */
export const THEMES: ThemeDef[] = [
  {
    id: "hypersleep",
    name: "Hypersleep Bay",
    accent: "#5E8CA8",
    image: null,
    art: "radial-gradient(120% 90% at 30% 12%, #BFE3F0 0%, rgba(191,227,240,0) 55%), linear-gradient(160deg, #2B4A5E 0%, #0B141C 100%)",
    bpm: 60,
    key: "D minor",
    bars: 8,
    variants: [
      { id: "long-dark", name: "The long dark", layers: 3 },
      { id: "wake", name: "Emergency wake", layers: 3 },
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
    bars: 8,
    variants: [
      { id: "cold", name: "Cold and dead", layers: 4 },
      { id: "awake", name: "Something is awake", layers: 4 },
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
    bars: 8,
    variants: [
      { id: "shift", name: "Shift change", layers: 4 },
      { id: "evacuate", name: "Evacuation order", layers: 4 },
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
    bars: 8,
    variants: [
      { id: "galleries", name: "Resin galleries", layers: 5 },
      { id: "stirs", name: "The nest stirs", layers: 5 },
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
    bars: 8,
    variants: [
      { id: "walk", name: "Exosuit walk", layers: 4 },
      { id: "whiteout", name: "Whiteout", layers: 4 },
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
    bars: 8,
    variants: [
      { id: "quarantine", name: "Quarantine", layers: 4 },
      { id: "breach", name: "Containment breach", layers: 4 },
    ],
    ambience: ["vitals-monitor", "incubator-hum", "surgical-servo", "coolant-hiss", "keypad-beeps", "klaxon-close"],
  },
];
