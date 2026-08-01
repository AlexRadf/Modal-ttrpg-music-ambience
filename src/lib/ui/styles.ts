import { T } from "../theme";

/**
 * The widget carries its own styling so a host app needs no Tailwind, no CSS
 * import and no build step. Everything that inline styles can express is inline;
 * this sheet covers the rest — resets, pseudo-classes, scrollbars, keyframes.
 */
const CSS = `
.amb-root, .amb-root * { box-sizing: border-box; }
.amb-btn {
  appearance: none; -webkit-appearance: none;
  border: 0; margin: 0; padding: 0;
  background: none; font: inherit; color: inherit;
  cursor: pointer; text-align: inherit;
}
.amb-btn:disabled { cursor: default; }
.amb-root :focus-visible {
  outline: 2px solid ${T.ink};
  outline-offset: 2px;
  border-radius: 8px;
}
.amb-scroll { scrollbar-width: thin; scrollbar-color: ${T.faint} transparent; }
.amb-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
.amb-scroll::-webkit-scrollbar-thumb {
  background: ${T.line}; border-radius: 999px;
  border: 3px solid transparent; background-clip: content-box;
}
.amb-scroll::-webkit-scrollbar-thumb:hover { background: ${T.faint}; background-clip: content-box; }
.amb-scroll::-webkit-scrollbar-track { background: transparent; }
.amb-slider { -webkit-appearance: none; appearance: none; background: transparent; }
.amb-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 20%; height: 100%; opacity: 0; }
.amb-slider::-moz-range-thumb { width: 1px; height: 100%; opacity: 0; border: 0; }
.amb-select { font: inherit; }
@keyframes amb-fade-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes amb-rise { from { opacity: 0; transform: translateY(8px) scale(.985) } to { opacity: 1; transform: none } }
@keyframes amb-pulse { 0%, 100% { opacity: .35 } 50% { opacity: 1 } }
@media (prefers-reduced-motion: reduce) {
  .amb-root *, .amb-overlay, .amb-dialog { animation: none !important; transition: none !important; }
}
`;

let injected = false;

/** Idempotent, and safe to call during render on the server (it no-ops). */
export function injectStyles() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const el = document.createElement("style");
  el.setAttribute("data-ambience-console", "");
  el.textContent = CSS;
  document.head.appendChild(el);
}
