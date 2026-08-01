import type { BedDef } from "../types";

/**
 * Ambience library for the ALIEN pack — one flat folder, ids are filenames.
 *
 * Beds are deliberately global rather than owned by a scene: the console's
 * search pulls from this whole list, so a GM can drop a motion tracker into the
 * med lab or a heartbeat into the cargo deck without anyone having authored it
 * there.
 */
const NAMES: Record<string, string> = {
  /* ship and station */
  "ship-hum": "Ship hum",
  "air-recycler": "Air recycler",
  "reactor-throb": "Reactor throb",
  "engine-rumble": "Engine rumble",
  "coolant-hiss": "Coolant hiss",
  "vent-draught": "Vent draught",
  "fan-rattle": "Fan rattle",
  "steam-vent": "Steam vent",
  "hull-groan": "Hull groan",
  "deck-creak": "Deck plate creak",
  condensation: "Condensation drip",
  "power-flicker": "Power flicker",
  "sparks-shorting": "Shorting cable",
  "electrical-fire": "Electrical fire",

  /* doors, machinery, cargo */
  "door-cycle": "Door cycle",
  "airlock-cycle": "Airlock cycle",
  "servo-whine": "Servo whine",
  "cargo-loader": "Cargo loader",
  "chain-sway": "Chain sway",
  "crate-shift": "Crates shifting",
  "gantry-steps": "Steps on gantry",
  "elevator-cage": "Elevator cage",

  /* signals and alarms */
  "keypad-beeps": "Keypad beeps",
  "terminal-chatter": "Terminal chatter",
  "comms-static": "Comms static",
  "radio-traffic": "Radio traffic",
  "klaxon-distant": "Distant klaxon",
  "klaxon-close": "Klaxon",
  "pressure-alarm": "Pressure alarm",
  "motion-tracker": "Motion tracker",
  "geiger-ticks": "Geiger ticks",

  /* crew */
  "suit-breathing": "Suit breathing",
  heartbeat: "Heartbeat",
  "low-breathing": "Low breathing",
  "distant-voices": "Distant voices",
  "crowd-panic": "Panicked crowd",
  "gunfire-distant": "Distant gunfire",

  /* medical */
  "vitals-monitor": "Vitals monitor",
  "surgical-servo": "Surgical servo",
  "incubator-hum": "Incubator hum",
  "cryo-pods": "Cryo pods",

  /* outside */
  "storm-wind": "Storm wind",
  "grit-on-visor": "Grit on the visor",
  "rain-on-hull": "Rain on the hull",
  "distant-thunder": "Distant thunder",

  /* the other thing */
  "resin-creak": "Resin creak",
  "wet-growth": "Wet growth",
  "egg-pulse": "Egg pulse",
  skitter: "Skittering",
  "tail-drag": "Tail drag",
  "creature-hiss": "Hiss",
  "creature-screech": "Screech",
  "vent-crawl": "Something in the vents",
};

export const BEDS: Record<string, BedDef> = Object.fromEntries(
  Object.keys(NAMES).map((id) => [id, { id, name: NAMES[id] }])
);
