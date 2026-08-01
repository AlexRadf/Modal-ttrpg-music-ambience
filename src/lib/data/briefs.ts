/**
 * Creative direction for the ALIEN pack.
 *
 * Authoring metadata only — the engine never reads this. It exists so that
 * ASSETS.md is a brief a composer and a sound designer can work from, rather
 * than a list of filenames. Edit it here and re-run `npm run assets`.
 */

export interface SceneBrief {
  /** One line on what the scene is. */
  premise: string;
  /** Instruments and treatments this scene draws on, and what it never uses. */
  palette: string;
  /** What each intensity level adds, innermost first. */
  levels: string[];
  /** How the combat pool departs from the exploration pool. */
  combat: string;
}

export const SCENE_BRIEFS: Record<string, SceneBrief> = {
  hypersleep: {
    premise: "Twelve people asleep in a cold room, and the ship minding them. Nothing has gone wrong yet.",
    palette:
      "Sine sub, bowed glass, filtered breath, a music box. No percussion at any level, and no note shorter than a bar — the room is asleep and the score should be too.",
    levels: [
      "Sub drone on the root, and one held glass tone a fifth above. Almost nothing.",
      "Bowed cello enters underneath, swelling once per phrase and answering the glass.",
      "A four-note music-box figure, high and sparse, that never resolves back to the root.",
    ],
    combat:
      "Same instruments, no new ones. The sub gains a slow tremolo, the cello plays semitone clusters instead of fifths, and the music box is struck twice as often and slightly sharp.",
  },
  derelict: {
    premise: "Something that stopped being a ship a long time ago. Cold, airless, and not entirely empty.",
    palette:
      "Prepared piano, bowed cymbal and metal, detuned double bass, contrabass clarinet. Room tone with a long tail. Nothing with a pulse — no drums anywhere in the exploration pool.",
    levels: [
      "Double bass drone, detuned a few cents against itself so it beats slowly.",
      "Bowed metal above it — cymbal, saw blade, whatever rings — entering and dying away without rhythm.",
      "Prepared piano: single struck notes, damped, spaced several bars apart.",
      "Contrabass clarinet holds a line under everything, moving by semitone only.",
    ],
    combat:
      "The pulse arrives: a low struck heartbeat on the beat, and the prepared piano becomes a repeated two-note figure. Keep the metal — it is what makes it the same place.",
  },
  colony: {
    premise: "Somewhere people actually live. Strip lights, recycled air, a shift about to end.",
    palette:
      "Upright bass, brushed kit, a lone trumpet with a lot of room on it, cheap synth pad. The only scene with anything like a groove — play it worn and slightly behind the beat.",
    levels: [
      "Upright bass walking slowly, brushes on a snare, barely there.",
      "Synth pad underneath, warm and a little detuned, like the lighting.",
      "Trumpet takes a short unaccompanied phrase and lets the room answer it.",
      "The kit fills out — ride, kick on one — and the bass doubles its pace.",
    ],
    combat:
      "The groove breaks rather than accelerates: bass goes to repeated eighths on one note, brushes to sticks, and the trumpet plays one long distorted tone instead of a phrase.",
  },
  hive: {
    premise: "Not a room any more. Resin over everything, and the walls are breathing.",
    palette:
      "Contrabass clarinet, taiko and frame drums, close choir clusters, wet organic foley pitched into the score. The most instruments of any scene, and the least melody.",
    levels: [
      "A pitched breath — choir on the edge of a whisper, one note, unmeasured.",
      "Contrabass clarinet below, moving in semitones under the breath.",
      "Frame drum, one soft strike every two bars, in no fixed pattern.",
      "The choir opens into a cluster: root, minor second, tritone. Hold it.",
      "Pitched wet foley — dripping, splitting, shifting — played as an instrument on top.",
    ],
    combat:
      "Taiko takes over: driving, not on the grid, accelerating within each motif and resetting at the join. The choir cluster becomes a shout on the downbeat.",
  },
  surface: {
    premise: "Outside, in a storm, in a suit. Visibility three metres and the beacon is somewhere ahead.",
    palette:
      "Granular noise pads built from wind, low brass, distant snare rolls, bowed double bass harmonics. Everything sounds like it is arriving through something.",
    levels: [
      "Granular wind pad, pitched to the root, no attack at all.",
      "Low brass swells beneath it — trombone, tuba — once per phrase.",
      "Snare roll far away, rising and falling, never resolving into a beat.",
      "Bowed harmonics on the double bass, high and thin, cutting through the wind.",
    ],
    combat:
      "The snare comes close and becomes a march that will not settle, and the brass moves from swells to short stabs. Keep the wind pad exactly as it is.",
  },
  medlab: {
    premise: "Clean, lit, and organised — until whatever is on the table stops cooperating.",
    palette:
      "Pulsing synth sixteenths, glass harmonica, string harmonics, prepared piano. The most rhythmic scene, but clinical rather than driving.",
    levels: [
      "A synth pulse in sixteenths, filtered almost shut, more felt than heard.",
      "Glass harmonica holds two notes a whole tone apart, beating against each other.",
      "String harmonics enter high above, one note per bar.",
      "The pulse opens up and gains a second, offset pulse — the same tempo, wrong phase.",
    ],
    combat:
      "The two pulses fall out of phase deliberately and the glass harmonica bends down a quarter tone across each motif. Nothing new is added — it is the same room going wrong.",
  },
};

/**
 * Sound design notes for the beds that need them. Beds not listed here are what
 * their name says; these are the ones with a trap in them.
 */
export const BED_NOTES: Record<string, string> = {
  "motion-tracker": "The ping everyone knows. Steady interval, about 1.2 s — record it holding, not approaching, so the GM decides when it closes.",
  "suit-breathing": "Inside the helmet: regulator click on the inhale, slight resonance on the out. Twelve breaths a minute, no faster.",
  "cryo-pods": "Refrigeration hum plus a slow bellows, and a heart monitor so far under it you only notice when it stops.",
  "hull-groan": "Long metal stress, 20–40 s apart. Vary the gaps or the loop announces itself.",
  "vitals-monitor": "Steady blip around 60 per minute. Do not tune it to any scene tempo — it should sit against the music, not with it.",
  "klaxon-distant": "Two-tone, through a bulkhead. Leave the gaps long; the silence between is what does the work.",
  "klaxon-close": "Same alarm, same room. Hot enough to be uncomfortable but still able to sit under dialogue.",
  "comms-static": "Carrier hiss with occasional squelch. No intelligible words — a GM will talk over this.",
  "radio-traffic": "Clipped and unintelligible, heavily band-limited. Voices, not words.",
  "distant-voices": "A crowd through a wall. Nothing recognisable as language.",
  "air-recycler": "The bed most scenes lean on. Wide, steady, and boring on purpose — it must survive an hour.",
  "ship-hum": "Low tonal drone. Pick a pitch that does not clash with the scene keys — E or A works against most of them.",
  "condensation": "Individual drops with long, uneven gaps. Randomise the intervals or it becomes a rhythm.",
  "resin-creak": "Wet, organic, under strain. Somewhere between leather and cartilage.",
  "egg-pulse": "Slow, fleshy, about one every four seconds. Low enough to feel.",
  skitter: "Many small feet on metal, arriving and leaving. Keep it panned wide and never centred.",
  "tail-drag": "Heavy, wet, dragging. Sparse — three or four passes in a minute is plenty.",
  "creature-screech": "Wet and above the music. This is the one bed allowed to break the mix.",
  "storm-wind": "Granular and full-band. Layer three separate wind takes so the loop point is impossible to find.",
  "grit-on-visor": "Fine particles on curved glass, close and dry. Sits directly against suit-breathing.",
  "power-flicker": "Electrical stutter with a moment of near-silence in it. Those gaps are the effect.",
  "terminal-chatter": "Keys, drive seeks, and confirmation tones. Period-correct: mechanical, not touchscreen.",
  "low-breathing": "Not the players' breathing. Slower than a person's, and never quite regular.",
};

/** How the one-shots should be cut, by group. */
export const ONE_SHOT_NOTES: Record<string, string> = {
  Impacts: "Under 3 s including tail. Loud, wide, and with the low end intact — these are meant to make people jump.",
  Systems: "1–2 s. Diegetic and dry; they should sound like they came from the room rather than the score.",
  Weapons: "Under 2 s. Close-mic'd with a short room tail, no reverb wash.",
  Creature: "1–4 s. Wet, close, and allowed to be the loudest thing in the mix.",
  Score: "2–5 s with a natural tail. These are musical — write them in a key that works against every scene, or write one per scene key.",
};
