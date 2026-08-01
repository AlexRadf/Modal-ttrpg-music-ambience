import type { ThemeDef } from "../types";

/** Swap `image` for a real URL and the gradient falls away. */
export const THEMES: ThemeDef[] = [
  {
    id: "tavern",
    name: "The Crooked Tankard",
    accent: "#B07338",
    image: null,
    art: "radial-gradient(120% 90% at 25% 15%, #F0C077 0%, rgba(240,192,119,0) 55%), linear-gradient(160deg, #6B4423 0%, #33200F 100%)",
    bpm: 92,
    key: "G minor",
    variants: [
      { id: "warm", name: "Before the fire went out" },
      { id: "ruined", name: "Burned out" },
    ],
    ambience: ["hearth-fire", "crowd-murmur", "tankards", "lute", "rain-shutters", "cellar-drip"],
  },
  {
    id: "deepwood",
    name: "Hollow Deepwood",
    accent: "#4E7A5A",
    image: null,
    art: "radial-gradient(110% 80% at 70% 10%, #A9D4A5 0%, rgba(169,212,165,0) 50%), linear-gradient(150deg, #2E4E38 0%, #12261A 100%)",
    bpm: 84,
    key: "E minor",
    variants: [
      { id: "daylight", name: "Under the canopy" },
      { id: "hunted", name: "Something is following" },
    ],
    ambience: ["canopy-wind", "birdsong", "creek", "leaf-footfall", "distant-howl", "insect-drone"],
  },
  {
    id: "undercroft",
    name: "The Undercroft",
    accent: "#6C6E86",
    image: null,
    art: "radial-gradient(100% 80% at 30% 85%, #9AA0C4 0%, rgba(154,160,196,0) 55%), linear-gradient(155deg, #3A3D52 0%, #17181F 100%)",
    bpm: 72,
    key: "C minor",
    variants: [
      { id: "sealed", name: "Sealed corridors" },
      { id: "flooded", name: "Flooded galleries" },
    ],
    ambience: ["stone-tone", "water-drip", "torch-sputter", "chain-pulley", "rats", "low-breathing"],
  },
  {
    id: "harbour",
    name: "Saltmere Harbour",
    accent: "#3E7186",
    image: null,
    art: "radial-gradient(110% 85% at 75% 20%, #9FD3E4 0%, rgba(159,211,228,0) 55%), linear-gradient(160deg, #2C5A6E 0%, #10262F 100%)",
    bpm: 88,
    key: "D minor",
    variants: [
      { id: "morning", name: "Morning dock" },
      { id: "storm", name: "Storm coming in" },
    ],
    ambience: ["surf", "gulls", "rigging", "hull-creak", "crowd-murmur", "bell-buoy"],
  },
  {
    id: "spire",
    name: "The Ember Spire",
    accent: "#8A5AA6",
    image: null,
    art: "radial-gradient(110% 80% at 40% 12%, #D9A8F0 0%, rgba(217,168,240,0) 55%), linear-gradient(150deg, #4B2C61 0%, #1B1026 100%)",
    bpm: 104,
    key: "A minor",
    variants: [
      { id: "study", name: "The reading room" },
      { id: "breach", name: "Containment failure" },
    ],
    ambience: ["arcane-hum", "page-turn", "brass-mechanism", "crystal-resonance", "high-wind", "whispers"],
  },
  {
    id: "waste",
    name: "Ash Waste",
    accent: "#9A6449",
    image: null,
    art: "radial-gradient(120% 90% at 60% 80%, #E8B98C 0%, rgba(232,185,140,0) 55%), linear-gradient(160deg, #6A4632 0%, #241710 100%)",
    bpm: 96,
    key: "F minor",
    variants: [
      { id: "open", name: "The open flat" },
      { id: "buried", name: "The buried city" },
    ],
    ambience: ["dry-wind", "grit", "distant-thunder", "metal-groan", "carrion-birds", "embers"],
  },
];
