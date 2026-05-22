import type { GameState, Notification } from "../state.js";
import type { RivalFarm } from "../entities/rival.js";
import { getGoodInfo } from "../data/goods.js";
import { nextBool, nextFloat, nextInt } from "../rng.js";

/** Net-worth growth per owned plot per season at full aggressiveness. */
export const RIVAL_PLOT_PRODUCTIVITY = 700;
/** Units of each focus good a rival sells per plot per season. */
export const RIVAL_SELL_PER_PLOT = 3;

function plotXY(plotIdx: number, plotsPerRow: number) {
  return { px: plotIdx % plotsPerRow, py: Math.floor(plotIdx / plotsPerRow) };
}

function adjacentToAny(plotIdx: number, owned: number[], plotsPerRow: number): boolean {
  const { px, py } = plotXY(plotIdx, plotsPerRow);
  return owned.some((o) => {
    const { px: ox, py: oy } = plotXY(o, plotsPerRow);
    return Math.abs(px - ox) + Math.abs(py - oy) === 1;
  });
}

/**
 * Rival system — abstracted computer farms. At each season boundary they grow
 * net worth (from owned plots, dampened by depressed prices), occasionally
 * claim an unowned plot (land scarcity), and record their focus-good output
 * (for the market_leader race). Their sustained price pressure is applied in
 * the market system. No RNG is consumed when there are no rivals.
 */
export function rivalSystem(state: GameState): {
  state: GameState;
  notifications: Notification[];
} {
  if (state.rivals.length === 0 || state.day !== 1) {
    return { state, notifications: [] };
  }

  const notifications: Notification[] = [];
  let rng = state.rng;
  const plotsPerRow = state.world.width / state.world.plotSize;
  const totalPlots = state.world.plotOwnership.length;

  // Plots already claimed by the human or any rival.
  const taken = new Set<number>();
  state.world.plotOwnership.forEach((o, i) => { if (o) taken.add(i); });
  for (const r of state.rivals) for (const p of r.ownedPlots) taken.add(p);

  const newRivals: RivalFarm[] = state.rivals.map((r) => {
    // Their focus goods' price health dampens income (they feel saturation too).
    let marketFactor = 1;
    if (r.focusGoods.length > 0) {
      let sum = 0;
      let n = 0;
      for (const g of r.focusGoods) {
        const info = getGoodInfo(g);
        if (info) {
          sum += (state.market.prices[g] ?? info.basePrice) / info.basePrice;
          n++;
        }
      }
      marketFactor = n > 0 ? sum / n : 1;
    }

    // Grow net worth.
    const income = Math.round(r.ownedPlots.length * RIVAL_PLOT_PRODUCTIVITY * r.aggressiveness * marketFactor);
    const noiseRoll = nextFloat(rng);
    rng = noiseRoll.rng;
    const noise = Math.round(income * (noiseRoll.value - 0.5) * 0.3);
    const netWorth = Math.max(0, r.netWorth + income + noise);

    // Race tension: warn when a rival nears the tycoon-race target.
    if (state.goal.type === "tycoon_race") {
      const t = state.goal.target;
      const crossed = (frac: number) => r.netWorth < t * frac && netWorth >= t * frac;
      if (crossed(0.75)) {
        notifications.push({ type: "warning", message: `${r.name} is closing in on the goal — 75% of the way there!` });
      } else if (crossed(0.5)) {
        notifications.push({ type: "info", message: `${r.name} is halfway to the goal.` });
      }
    }

    // Record this season's focus-good output (for the market_leader race).
    const seasonSales: Record<string, number> = {};
    for (const g of r.focusGoods) {
      const vol = Math.round(r.ownedPlots.length * RIVAL_SELL_PER_PLOT * r.aggressiveness);
      if (vol > 0) seasonSales[g] = vol;
    }

    // Expand onto a free plot.
    let ownedPlots = r.ownedPlots;
    const expandRoll = nextBool(rng, r.aggressiveness * 0.5);
    rng = expandRoll.rng;
    if (expandRoll.value) {
      const free: number[] = [];
      for (let p = 0; p < totalPlots; p++) if (!taken.has(p)) free.push(p);
      if (free.length > 0) {
        const adj = free.filter((p) => adjacentToAny(p, r.ownedPlots, plotsPerRow));
        const pool = adj.length > 0 ? adj : free;
        const pick = nextInt(rng, 0, pool.length - 1);
        rng = pick.rng;
        const plot = pool[pick.value];
        taken.add(plot);
        ownedPlots = [...r.ownedPlots, plot];
        notifications.push({ type: "info", message: `${r.name} expanded onto a new plot.` });
      }
    }

    return { ...r, netWorth, ownedPlots, seasonSales };
  });

  return {
    state: { ...state, rng, rivals: newRivals },
    notifications,
  };
}
