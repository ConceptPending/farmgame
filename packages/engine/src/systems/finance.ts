import type { GameState, GameStatus, Notification } from "../state.js";
import { LOAN_LIMIT } from "../state.js";
import type { GoalProgress } from "../entities/goal.js";
import { BUILDING_CATALOG } from "../entities/building.js";
import { EQUIPMENT_CATALOG } from "../entities/equipment.js";
import { animalValue } from "../entities/animal.js";
import { getCropDef } from "../data/crops.js";

// Seasonal cost tuning.
export const LAND_TAX_PER_PLOT = 80;
export const BUILDING_UPKEEP_RATE = 0.02; // per season, of build cost
export const FIELD_OVERHEAD = 5; // per designated field, per season
export const BASE_OVERHEAD = 20; // flat per season
export const SEASONAL_INTEREST_RATE = 0.05; // ~20% APR on outstanding loan

export interface SeasonalExpenses {
  landTax: number;
  upkeep: number; // building upkeep + field overhead + base
  interest: number;
  total: number;
}

function ownedPlotCount(state: GameState): number {
  return state.world.plotOwnership.reduce((n, owned) => (owned ? n + 1 : n), 0);
}

/** What the player will be charged at the next season boundary. */
export function computeSeasonalExpenses(state: GameState): SeasonalExpenses {
  const mult = state.expenseMultiplier ?? 1;
  const landTax = Math.round(ownedPlotCount(state) * LAND_TAX_PER_PLOT * mult);

  let buildingUpkeep = 0;
  for (const b of state.buildings) {
    buildingUpkeep += Math.round(BUILDING_CATALOG[b.type].cost * BUILDING_UPKEEP_RATE);
  }
  for (const e of state.equipment) {
    buildingUpkeep += EQUIPMENT_CATALOG[e.type].upkeepPerSeason;
  }
  const upkeep = Math.round(
    (buildingUpkeep + state.fields.length * FIELD_OVERHEAD + BASE_OVERHEAD) * mult,
  );

  // Interest is a loan term, not scaled by difficulty.
  const interest = Math.round(state.loan * SEASONAL_INTEREST_RATE);

  return { landTax, upkeep, interest, total: landTax + upkeep + interest };
}

/** Average soil quality over a plot's tiles, used to value owned land. */
function plotValue(state: GameState, plotX: number, plotY: number): number {
  const { world } = state;
  const startX = plotX * world.plotSize;
  const startY = plotY * world.plotSize;
  let soilSum = 0;
  for (let dy = 0; dy < world.plotSize; dy++) {
    for (let dx = 0; dx < world.plotSize; dx++) {
      soilSum += world.tiles[(startY + dy) * world.width + (startX + dx)].soilQuality;
    }
  }
  const avgSoil = soilSum / (world.plotSize * world.plotSize);
  return Math.round(200 + avgSoil * 300);
}

/**
 * Total net worth: cash + owned land + buildings + inventory at market value,
 * minus outstanding loan. This is what the win condition is measured against.
 */
export function computeNetWorth(state: GameState): number {
  let total = state.money;

  const plotsPerRow = state.world.width / state.world.plotSize;
  for (let i = 0; i < state.world.plotOwnership.length; i++) {
    if (!state.world.plotOwnership[i]) continue;
    total += plotValue(state, i % plotsPerRow, Math.floor(i / plotsPerRow));
  }

  for (const b of state.buildings) {
    total += BUILDING_CATALOG[b.type].cost;
  }

  for (const a of state.animals) {
    total += animalValue(a);
  }

  for (const e of state.equipment) {
    total += Math.round(EQUIPMENT_CATALOG[e.type].cost * 0.6); // depreciated asset value
  }

  for (const [cropId, qty] of Object.entries(state.inventory)) {
    const price = state.market.prices[cropId] ?? getCropDef(cropId)?.basePrice ?? 0;
    total += qty * price;
  }

  return Math.round(total - state.loan);
}

/**
 * True when the player can no longer dig out: cash is negative and even
 * borrowing to the loan limit wouldn't bring them back above zero.
 */
function isBankrupt(state: GameState): boolean {
  return state.money < 0 && -state.money > LOAN_LIMIT - state.loan;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export interface Standing {
  name: string;
  netWorth: number;
  plots: number;
  isHuman: boolean;
}

/** All farms (you + rivals) ranked by net worth, for the standings panel. */
export function standings(state: GameState): Standing[] {
  const list: Standing[] = state.rivals.map((r) => ({
    name: r.name,
    netWorth: r.netWorth,
    plots: r.ownedPlots.length,
    isHuman: false,
  }));
  list.push({ name: "You", netWorth: computeNetWorth(state), plots: ownedPlotCount(state), isHuman: true });
  return list.sort((a, b) => b.netWorth - a.netWorth);
}

/**
 * Resolve the active goal into a status. Bankruptcy is the universal loss.
 * (tycoon_race / market_leader gain rival comparisons in Phase B.)
 */
export function evaluateGoal(state: GameState): { status: GameStatus; message?: string } {
  if (isBankrupt(state)) {
    return { status: "lost", message: "Bankrupt! Your debts have overwhelmed the farm. Game over." };
  }
  const goal = state.goal;
  const netWorth = computeNetWorth(state);
  switch (goal.type) {
    case "net_worth":
      if (netWorth >= goal.target) {
        return { status: "won", message: `You reached a net worth of $${netWorth.toLocaleString()} — you win!` };
      }
      break;
    case "tycoon_race": {
      if (netWorth >= goal.target) {
        return { status: "won", message: `You won the race to $${goal.target.toLocaleString()}!` };
      }
      const leader = state.rivals.find((r) => r.netWorth >= goal.target);
      if (leader) {
        return { status: "lost", message: `${leader.name} reached $${goal.target.toLocaleString()} first. You lost the race.` };
      }
      break;
    }
    case "land_baron":
      if (ownedPlotCount(state) >= goal.plots) {
        return { status: "won", message: `You own ${goal.plots} plots — you're the land baron!` };
      }
      break;
    case "market_leader":
      if (state.marketLeadStreak >= goal.seasons) {
        return { status: "won", message: `You led the ${goal.good} market for ${goal.seasons} seasons — you win!` };
      }
      break;
    case "sandbox":
      break;
  }
  return { status: "playing" };
}

/** UI-facing progress toward the active goal. */
export function goalProgress(state: GameState): GoalProgress {
  const goal = state.goal;
  const netWorth = computeNetWorth(state);
  switch (goal.type) {
    case "net_worth":
      return { label: "Net worth", current: netWorth, target: goal.target, pct: clamp01(netWorth / goal.target) };
    case "tycoon_race":
      return { label: "Net worth (race)", current: netWorth, target: goal.target, pct: clamp01(netWorth / goal.target) };
    case "land_baron": {
      const plots = ownedPlotCount(state);
      return { label: "Plots owned", current: plots, target: goal.plots, pct: clamp01(plots / goal.plots) };
    }
    case "market_leader":
      return {
        label: `Top ${goal.good} seller`,
        current: state.marketLeadStreak,
        target: goal.seasons,
        pct: clamp01(state.marketLeadStreak / goal.seasons),
        detail: "consecutive seasons",
      };
    case "sandbox":
      return { label: "Net worth", current: netWorth, target: 0, pct: 0 };
  }
}

/**
 * Finance system — runs last in the tick pipeline. Charges seasonal expenses
 * at each season boundary, then resolves the win/lose conditions.
 */
export function financeSystem(state: GameState): {
  state: GameState;
  notifications: Notification[];
} {
  const notifications: Notification[] = [];
  let current = state;

  // Season just rolled over (the season system sets monthOfSeason back to 1).
  if (current.monthOfSeason === 1) {
    const exp = computeSeasonalExpenses(current);
    if (exp.total > 0) {
      current = { ...current, money: current.money - exp.total };
      notifications.push({
        type: "warning",
        message: `Seasonal expenses: $${exp.total} (tax $${exp.landTax}, upkeep $${exp.upkeep}, interest $${exp.interest})`,
      });
    }

    // Update the market-leader streak from the season's sales, then reset.
    if (current.goal.type === "market_leader") {
      const good = current.goal.good;
      const mine = current.seasonSales[good] ?? 0;
      const topRival = current.rivals.reduce((m, r) => Math.max(m, r.seasonSales[good] ?? 0), 0);
      const leading = mine > 0 && mine >= topRival;
      current = { ...current, marketLeadStreak: leading ? current.marketLeadStreak + 1 : 0 };
    }
    current = { ...current, seasonSales: {} };
  }

  if (current.status === "playing") {
    const result = evaluateGoal(current);
    if (result.status !== "playing") {
      current = { ...current, status: result.status };
      notifications.push({
        type: result.status === "won" ? "success" : "error",
        message: result.message ?? "",
      });
    }
  }

  return { state: current, notifications };
}
