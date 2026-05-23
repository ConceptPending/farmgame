export type GoalType =
  | "net_worth"
  | "tycoon_race"
  | "land_baron"
  | "market_leader"
  | "sandbox";

/**
 * What the player is trying to achieve this game. Any non-sandbox goal can be
 * given a `deadlineTurns` cap — the player must hit the underlying win
 * condition by tick = deadlineTurns or they lose. Sandbox stays open-ended.
 */
export type Goal =
  | { type: "net_worth"; target: number; deadlineTurns?: number }
  | { type: "tycoon_race"; target: number; deadlineTurns?: number } // you or a rival, first to target
  | { type: "land_baron"; plots: number; deadlineTurns?: number }
  | { type: "market_leader"; good: string; seasons: number; deadlineTurns?: number } // top seller K seasons
  | { type: "sandbox" };

/** UI-facing progress toward the active goal. */
export interface GoalProgress {
  label: string;
  current: number;
  target: number; // 0 for sandbox / open-ended
  pct: number; // 0..1
  detail?: string;
}
