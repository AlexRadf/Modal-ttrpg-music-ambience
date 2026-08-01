import type { AmbienceConfig } from "../types";
import { BEDS } from "./beds";
import { THEMES } from "./themes";

/** The bundled content pack. Pass your own `AmbienceConfig` to replace it wholesale. */
export const DEFAULT_CONFIG: AmbienceConfig = { beds: BEDS, themes: THEMES };

export { BEDS, THEMES };
