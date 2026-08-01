/**
 * Entry point for scripts/assets.mjs — the manifest side of the library with no
 * React in it, so it can be bundled for Node without pulling in the UI.
 */
export { DEFAULT_CONFIG, ALIEN_PACK } from "./lib/data";
export { SCENE_BRIEFS, BED_NOTES, ONE_SHOT_NOTES } from "./lib/data/briefs";
export { assetManifest, manifestSummary, missingAssets, motifSeconds, poolSeconds } from "./lib/manifest";
export { assetLayout } from "./lib/audio/resolve";
export { intensityCount, variantMotifs } from "./lib/audio/sources";
