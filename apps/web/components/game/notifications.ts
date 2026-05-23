import type { Notification } from "@farmgame/engine";

/** Shared visual grammar for notifications — used by HUD toasts, the event
 *  log, and the inspector's "Recent" card so they all read as one system. */
// Warning is a warm orange — separate from gold (#ffdd57), which is reserved
// for money / harvest-ready / opportunity signals. Using yellow for both was
// muddying the colour grammar.
export const NOTIFICATION_COLOR: Record<Notification["type"], string> = {
  success: "#4ecca3",
  warning: "#ffa454",
  error: "#ff6b6b",
  info: "#9db4d0",
};

export const NOTIFICATION_GLYPH: Record<Notification["type"], string> = {
  success: "✓",
  warning: "⚠",
  error: "✕",
  info: "ℹ",
};
