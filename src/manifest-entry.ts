/**
 * Entry point for scripts/assets.mjs — the manifest side of the library with no
 * React in it, so it can be bundled for Node without pulling in the UI.
 */
export { DEFAULT_CONFIG, ALIEN_PACK } from "./lib/data";
export { assetManifest, manifestSummary, missingAssets } from "./lib/manifest";
export { assetLayout } from "./lib/audio/resolve";
export { layerCount } from "./lib/audio/sources";
