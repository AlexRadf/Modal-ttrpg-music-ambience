import type { BedDef } from "../types";

/** Global ambience library — one flat folder, ids are filenames. */
const NAMES: Record<string, string> = {
  "hearth-fire": "Hearth fire",
  "crowd-murmur": "Crowd murmur",
  tankards: "Tankards and cutlery",
  lute: "Lute in the corner",
  "rain-shutters": "Rain on the shutters",
  "cellar-drip": "Cellar drip",
  "canopy-wind": "Canopy wind",
  birdsong: "Birdsong",
  creek: "Creek over stones",
  "leaf-footfall": "Footfall on leaves",
  "distant-howl": "Distant howl",
  "insect-drone": "Insect drone",
  "stone-tone": "Stone room tone",
  "water-drip": "Water drip",
  "torch-sputter": "Torch sputter",
  "chain-pulley": "Chain and pulley",
  rats: "Rats",
  "low-breathing": "Low breathing",
  surf: "Swell and surf",
  gulls: "Gulls",
  rigging: "Rigging and rope",
  "hull-creak": "Hull creak",
  "bell-buoy": "Bell buoy",
  "arcane-hum": "Arcane hum",
  "page-turn": "Page turn",
  "brass-mechanism": "Brass mechanism",
  "crystal-resonance": "Crystal resonance",
  "high-wind": "Wind at height",
  whispers: "Whispers",
  "dry-wind": "Dry wind",
  grit: "Grit on stone",
  "distant-thunder": "Distant thunder",
  "metal-groan": "Metal groan",
  "carrion-birds": "Carrion birds",
  embers: "Embers",
  "market-bustle": "Market bustle",
  "cart-wheels": "Cart wheels",
  "temple-bell": "Temple bell",
};

export const BEDS: Record<string, BedDef> = Object.fromEntries(
  Object.keys(NAMES).map((id) => [id, { id, name: NAMES[id] }])
);
