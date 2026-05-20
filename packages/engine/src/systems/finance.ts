import type { GameState, Notification } from "../state.js";
import { LOAN_LIMIT } from "../state.js";
import { BUILDING_CATALOG } from "../entities/building.js";
import { CROP_CATALOG, getCropDef } from "../data/crops.js";

// Seasonal cost tuning.
export const LAND_TAX_PER_PLOT = 40;
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
  const landTax = ownedPlotCount(state) * LAND_TAX_PER_PLOT;

  let buildingUpkeep = 0;
  for (const b of state.buildings) {
    buildingUpkeep += Math.round(BUILDING_CATALOG[b.type].cost * BUILDING_UPKEEP_RATE);
  }
  const upkeep = buildingUpkeep + state.fields.length * FIELD_OVERHEAD + BASE_OVERHEAD;

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

  // Season just rolled over (the season system sets day back to 1).
  if (current.day === 1) {
    const exp = computeSeasonalExpenses(current);
    if (exp.total > 0) {
      current = { ...current, money: current.money - exp.total };
      notifications.push({
        type: "warning",
        message: `Seasonal expenses: $${exp.total} (tax $${exp.landTax}, upkeep $${exp.upkeep}, interest $${exp.interest})`,
      });
    }
  }

  if (current.status === "playing") {
    const netWorth = computeNetWorth(current);
    if (netWorth >= current.goalNetWorth) {
      current = { ...current, status: "won" };
      notifications.push({
        type: "success",
        message: `You reached a net worth of $${netWorth.toLocaleString()} — you win!`,
      });
    } else if (isBankrupt(current)) {
      current = { ...current, status: "lost" };
      notifications.push({
        type: "error",
        message: `Bankrupt! Your debts have overwhelmed the farm. Game over.`,
      });
    }
  }

  return { state: current, notifications };
}
