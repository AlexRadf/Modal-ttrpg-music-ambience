import type { OneShotDef } from "../types";

/**
 * Stingers the GM fires by hand. They play once over the top of whatever is
 * running, on their own bus, so the ambience bus trim never ducks them.
 */
const NAMES: Record<string, [string, string]> = {
  "airlock-blow": ["Airlock blows", "Impacts"],
  explosion: ["Explosion", "Impacts"],
  "hull-breach": ["Hull breach", "Impacts"],
  "bulkhead-slam": ["Bulkhead slam", "Impacts"],
  "glass-shatter": ["Glass shatters", "Impacts"],
  "power-cut": ["Power cuts out", "Systems"],
  "power-restore": ["Power restored", "Systems"],
  "alarm-trip": ["Alarm trips", "Systems"],
  "terminal-deny": ["Access denied", "Systems"],
  "terminal-grant": ["Access granted", "Systems"],
  "self-destruct": ["Self-destruct armed", "Systems"],
  "pulse-rifle": ["Pulse rifle burst", "Weapons"],
  "shotgun-blast": ["Shotgun", "Weapons"],
  "flamethrower": ["Flamethrower", "Weapons"],
  "tracker-contact": ["Tracker contact", "Weapons"],
  screech: ["Screech", "Creature"],
  "acid-splash": ["Acid splash", "Creature"],
  "tail-strike": ["Tail strike", "Creature"],
  "egg-open": ["Egg opens", "Creature"],
  "body-drop": ["Body drops", "Creature"],
  "stinger-dread": ["Dread stinger", "Score"],
  "stinger-reveal": ["Reveal stinger", "Score"],
  "stinger-shock": ["Shock stinger", "Score"],
};

export const ONE_SHOTS: Record<string, OneShotDef> = Object.fromEntries(
  Object.keys(NAMES).map((id) => [id, { id, name: NAMES[id][0], group: NAMES[id][1] }])
);
