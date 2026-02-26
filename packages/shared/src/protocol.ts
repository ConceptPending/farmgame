/** WebSocket protocol message types for Phase 3+. Stubs for now. */

export type ServerMessage =
  | { type: "STATE_SYNC"; payload: unknown }
  | { type: "NOTIFICATION"; message: string };

export type ClientMessage =
  | { type: "COMMAND"; payload: unknown }
  | { type: "REQUEST_SYNC" };
