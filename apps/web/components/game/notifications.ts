import type { Notification } from "@farmgame/engine";

/** Shared visual grammar for notifications — used by HUD toasts, the event
 *  log, and the inspector's "Recent" card so they all read as one system. */
export const NOTIFICATION_COLOR: Record<Notification["type"], string> = {
  success: "#4ecca3",
  warning: "#ffdd57",
  error: "#ff6b6b",
  info: "#9db4d0",
};

export const NOTIFICATION_GLYPH: Record<Notification["type"], string> = {
  success: "✓",
  warning: "⚠",
  error: "✕",
  info: "ℹ",
};
