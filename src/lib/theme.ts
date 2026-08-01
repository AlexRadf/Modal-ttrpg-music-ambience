/** Design tokens. Every colour in the widget comes from here. */
export const T = {
  shell: "#F6F6F7",
  surface: "#FFFFFF",
  inset: "#FAFAFB",
  ink: "#1B1B1F",
  muted: "#8A8A93",
  faint: "#B6B6BD",
  line: "#EAEAEE",
  track: "#EFEFF2",
  combat: "#C4553C",
  font: "ui-sans-serif, -apple-system, 'Segoe UI', Inter, system-ui, sans-serif",
};

export const soft = "0 1px 2px rgba(20,20,26,.04), 0 8px 24px rgba(20,20,26,.06)";
export const softer = "0 1px 2px rgba(20,20,26,.04), 0 4px 12px rgba(20,20,26,.05)";
export const lift = "0 2px 4px rgba(20,20,26,.06), 0 16px 40px rgba(20,20,26,.16)";

/** Cover art for a theme: a real image when there is one, the gradient until then. */
export function coverBackground(theme: { image?: string | null; art?: string }): string {
  return theme.image ? "url(" + theme.image + ") center/cover" : theme.art || T.track;
}
