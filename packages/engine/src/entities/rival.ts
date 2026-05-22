import type { GameState } from "../state.js";

export interface RivalFarm {
  id: number;
  name: string;
  netWorth: number;
  ownedPlots: number[]; // plot indices
  focusGoods: string[]; // crops/products they produce & sell
  aggressiveness: number; // 0..1 — expansion + selling rate
  seasonSales: Record<string, number>; // last season's volume per good
}

export interface RivalConfig {
  name: string;
  aggressiveness: number;
  startingPlots: number; // claimed at game start
  focusGoods: string[];
}

export function createRival(id: number, config: RivalConfig, plots: number[]): RivalFarm {
  return {
    id,
    name: config.name,
    netWorth: 1000 + plots.length * 400, // starting cash + land value
    ownedPlots: plots,
    focusGoods: config.focusGoods,
    aggressiveness: config.aggressiveness,
    seasonSales: {},
  };
}

/** Per-plot, per-aggressiveness contribution to sustained market pressure. */
export const RIVAL_SUPPLY_FACTOR = 0.03;

/**
 * How much rivals depress a good's demand ceiling (0..). Rivals focused on a
 * good keep its price suppressed; the more land they hold, the harder.
 */
export function rivalSupplyPressure(rivals: RivalFarm[], good: string): number {
  let p = 0;
  for (const r of rivals) {
    if (r.focusGoods.includes(good)) p += r.ownedPlots.length * r.aggressiveness * RIVAL_SUPPLY_FACTOR;
  }
  return p;
}

/** The rival that owns a plot, if any. */
export function rivalOwning(rivals: RivalFarm[], plotIdx: number): RivalFarm | undefined {
  return rivals.find((r) => r.ownedPlots.includes(plotIdx));
}

/** Who owns a plot: the human, a rival id, or nobody. */
export function plotOwner(state: GameState, plotIdx: number): "human" | number | null {
  if (state.world.plotOwnership[plotIdx]) return "human";
  const r = rivalOwning(state.rivals, plotIdx);
  return r ? r.id : null;
}
