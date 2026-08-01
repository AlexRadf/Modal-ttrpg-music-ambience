import type { AmbienceConfig } from "../types";
import { BEDS } from "./beds";
import { ONE_SHOTS } from "./one-shots";
import { THEMES } from "./themes";

/**
 * The bundled ALIEN content pack: six scenes, two variants each, and a shared
 * ambience library. It is plain data — pass your own `AmbienceConfig` to
 * `AmbienceConsole` or `AmbienceProvider` to replace it wholesale, or spread it
 * to extend it:
 *
 *   { ...ALIEN_PACK, themes: ALIEN_PACK.themes.concat(myScenes) }
 */
export const ALIEN_PACK: AmbienceConfig = { beds: BEDS, themes: THEMES, oneShots: ONE_SHOTS };

/** What the console uses when no config is given. */
export const DEFAULT_CONFIG = ALIEN_PACK;

export { BEDS, THEMES, ONE_SHOTS };
