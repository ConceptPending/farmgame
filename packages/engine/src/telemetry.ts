/**
 * Telemetry / balance-report layer.
 *
 * Two complementary shapes:
 *
 * - `TurnSnapshot` — a frozen record of one End-Turn's state + the causes
 *   emitted during that turn. Cheap to produce; the live game can record
 *   one per turn when telemetry is enabled, and a debug panel renders the
 *   sequence as a per-turn trace.
 *
 * - `RunReport` — an aggregate over an entire run's snapshots. Drives the
 *   actual balance work: net-worth-by-turn curves, labor-wasted totals,
 *   yield-lost-by-cause breakdown, finish status. The headless batch
 *   simulator (`sim-harness.ts`) returns one of these per simulated game.
 *
 * The collector reads state + causes only — it doesn't add fields to
 * GameState, so disabling telemetry is genuinely zero-cost.
 */

import type { GameState, GameStatus } from "./state.js";
import type { Cause } from "./entities/cause.js";
import { computeNetWorth } from "./systems/finance.js";
import { CROP_CATALOG } from "./data/crops.js";
import { PRODUCT_CATALOG } from "./data/products.js";

/** A single turn's recorded state + the causes that turn produced. */
export interface TurnSnapshot {
  /** Monotonic turn counter (state.tick after the turn resolved). */
  tick: number;
  year: number;
  season: string;
  monthOfSeason: number;

  /** Cash on hand. */
  money: number;
  /** Outstanding loan principal. */
  loan: number;
  /** Cash + assets - loan. */
  netWorth: number;

  /** Counts of major asset categories. */
  plotsOwned: number;
  fieldCount: number;
  animalCount: number;
  buildingCount: number;
  equipmentCount: number;

  /** Inventory's mark-to-market value at current prices. */
  inventoryValue: number;
  /** Median of all goods' prices — captures overall market level. */
  marketMedianPrice: number;

  /** Labor consumed and capacity *just before* this turn was resolved. */
  laborUsed: number;
  laborCapacity: number;

  /** Game's win/lose state after this turn. */
  status: GameStatus;

  /** Count of pressure events (turns where each stressor fired). Useful for
   *  "how often did this happen", separate from how much damage it did. */
  pressureTurns: {
    frost: number;
    drought: number;
    heat: number;
    weeds: number;
    pests: number;
  };

  /** Actual growth-bar fraction lost to each cause this turn (proportional
   *  attribution from `growth_delayed`). Sum across a run = real growth-lost
   *  measured in crop-cycle equivalents. */
  growthLost: {
    temperature: number;
    moisture: number;
    health: number;
  };

  /** Counts of standout outcomes this turn. */
  outcomes: {
    cropDeaths: number;
    cropsReady: number;
    harvests: number;
    animalDeaths: number;
    animalBirths: number;
    marketEvents: number;
    randomEvents: number;
  };
}

/** Aggregate over an entire run. */
export interface RunReport {
  seed: number | undefined;
  scenarioId: string | undefined;

  /** Final status: did the player win, lose, or run out of turns playing? */
  finalStatus: GameStatus;
  /** Total monthly turns advanced. */
  turnCount: number;

  /** Net worth at each turn (length = turnCount). */
  netWorthByTurn: number[];
  /** Cash at each turn. */
  moneyByTurn: number[];

  /** Total labor units left unspent across the whole run. */
  laborWastedTotal: number;
  /** Average per-turn labor utilisation, 0..1. */
  laborUtilisation: number;

  /** Pressure-event counts across the run, by stressor. */
  pressureTurnTotals: {
    frost: number;
    drought: number;
    heat: number;
    weeds: number;
    pests: number;
  };

  /** Real growth-bar loss across the run (sum of per-turn `growth_delayed`
   *  attributions). Measured in crop-cycle equivalents — e.g. 0.5 = lost
   *  half a wheat cycle's worth of growth. */
  growthLostTotals: {
    temperature: number;
    moisture: number;
    health: number;
  };

  /** Standout outcome totals. */
  outcomes: {
    cropDeaths: number;
    cropsReady: number;
    harvests: number;
    animalDeaths: number;
    animalBirths: number;
    marketEvents: number;
    randomEvents: number;
  };

  /** Final values for the high-level dashboard. */
  finalMoney: number;
  finalNetWorth: number;
  finalLoan: number;
}

/* ----------------------------------------------------------------------- */
/* Snapshot collection.                                                    */
/* ----------------------------------------------------------------------- */

function medianPrice(prices: Record<string, number>): number {
  const xs = Object.values(prices);
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function inventoryMarkToMarket(state: GameState): number {
  let total = 0;
  for (const [id, qty] of Object.entries(state.inventory)) {
    const cropPrice = state.market.prices[id];
    if (cropPrice != null) {
      total += qty * cropPrice;
      continue;
    }
    // Fall back to catalog base price (shouldn't normally happen).
    const def = CROP_CATALOG[id as keyof typeof CROP_CATALOG] ?? PRODUCT_CATALOG[id as keyof typeof PRODUCT_CATALOG];
    if (def) total += qty * def.basePrice;
  }
  return Math.round(total);
}

function countOwnedPlots(state: GameState): number {
  return state.world.plotOwnership.reduce((n, owned) => (owned ? n + 1 : n), 0);
}

/** Build a TurnSnapshot from the post-tick state + the causes that turn fired. */
export function takeSnapshot(state: GameState, causes: Cause[]): TurnSnapshot {
  const pressureTurns = { frost: 0, drought: 0, heat: 0, weeds: 0, pests: 0 };
  const growthLost = { temperature: 0, moisture: 0, health: 0 };
  const outcomes = {
    cropDeaths: 0,
    cropsReady: 0,
    harvests: 0,
    animalDeaths: 0,
    animalBirths: 0,
    marketEvents: 0,
    randomEvents: 0,
  };

  // The `labor_unused` cause is emitted at turn-start with the just-finished
  // turn's pre-refresh budget — that's how we recover what the player *spent*
  // last month, since `state.labor.used` has already been reset to 0 by the
  // time we snapshot the post-nextTurn state.
  let laborUsed = 0;
  let laborCapacity = state.labor.capacity;
  let laborSeen = false;

  for (const c of causes) {
    if (c.kind === "labor_unused") {
      laborUsed = c.capacity - c.unused;
      laborCapacity = c.capacity;
      laborSeen = true;
    }
    switch (c.kind) {
      case "frost_damage": pressureTurns.frost++; break;
      case "frost_kill": pressureTurns.frost++; outcomes.cropDeaths++; break;
      case "drought_stress": pressureTurns.drought++; break;
      case "heat_stress": pressureTurns.heat++; break;
      case "weed_pressure": pressureTurns.weeds++; break;
      case "pest_pressure": pressureTurns.pests++; break;
      case "growth_delayed":
        // Attribute the turn's lost bar to the dominant inputs. The shares
        // are absolute fractions of 1.0 growth bar; sum to growthBarLost.
        growthLost.temperature += c.fromTemperature * c.growthBarLost;
        growthLost.moisture += c.fromMoisture * c.growthBarLost;
        growthLost.health += c.fromHealth * c.growthBarLost;
        break;
      case "crop_died_health": outcomes.cropDeaths++; break;
      case "ready_to_harvest": outcomes.cropsReady++; break;
      case "harvest_complete": outcomes.harvests++; break;
      case "animal_born": outcomes.animalBirths++; break;
      case "animal_starved":
      case "animal_lost_predator":
      case "animal_lost_wandered":
      case "animal_lost_crowding":
        outcomes.animalDeaths++;
        break;
      case "market_event_spike":
      case "market_event_crash":
        outcomes.marketEvents++;
        break;
      case "event_locust":
      case "event_hail":
      case "event_blight":
      case "event_bumper":
      case "event_subsidy":
      case "event_inheritance":
      case "event_breakdown":
        outcomes.randomEvents++;
        break;
    }
  }

  return {
    tick: state.tick,
    year: state.year,
    season: state.season,
    monthOfSeason: state.monthOfSeason,
    money: state.money,
    loan: state.loan,
    netWorth: computeNetWorth(state),
    plotsOwned: countOwnedPlots(state),
    fieldCount: state.fields.length,
    animalCount: state.animals.length,
    buildingCount: state.buildings.length,
    equipmentCount: state.equipment.length,
    inventoryValue: inventoryMarkToMarket(state),
    marketMedianPrice: medianPrice(state.market.prices),
    // If no labor_unused cause fired this turn, the player burned the
    // entire monthly budget — record full utilisation.
    laborUsed: laborSeen ? laborUsed : laborCapacity,
    laborCapacity,
    status: state.status,
    pressureTurns,
    growthLost,
    outcomes,
  };
}

/* ----------------------------------------------------------------------- */
/* Run aggregation.                                                        */
/* ----------------------------------------------------------------------- */

export interface RunReportInput {
  snapshots: TurnSnapshot[];
  seed?: number;
  scenarioId?: string;
}

export function aggregateRun(input: RunReportInput): RunReport {
  const { snapshots, seed, scenarioId } = input;
  if (snapshots.length === 0) {
    return {
      seed, scenarioId,
      finalStatus: "playing",
      turnCount: 0,
      netWorthByTurn: [],
      moneyByTurn: [],
      laborWastedTotal: 0,
      laborUtilisation: 0,
      pressureTurnTotals: { frost: 0, drought: 0, heat: 0, weeds: 0, pests: 0 },
      growthLostTotals: { temperature: 0, moisture: 0, health: 0 },
      outcomes: { cropDeaths: 0, cropsReady: 0, harvests: 0, animalDeaths: 0, animalBirths: 0, marketEvents: 0, randomEvents: 0 },
      finalMoney: 0, finalNetWorth: 0, finalLoan: 0,
    };
  }

  const last = snapshots[snapshots.length - 1];

  const pressureTurnTotals = { frost: 0, drought: 0, heat: 0, weeds: 0, pests: 0 };
  const growthLostTotals = { temperature: 0, moisture: 0, health: 0 };
  const outcomes = {
    cropDeaths: 0, cropsReady: 0, harvests: 0,
    animalDeaths: 0, animalBirths: 0,
    marketEvents: 0, randomEvents: 0,
  };
  let laborWastedTotal = 0;
  let laborCapacityTotal = 0;
  let laborUsedTotal = 0;

  for (const snap of snapshots) {
    pressureTurnTotals.frost += snap.pressureTurns.frost;
    pressureTurnTotals.drought += snap.pressureTurns.drought;
    pressureTurnTotals.heat += snap.pressureTurns.heat;
    pressureTurnTotals.weeds += snap.pressureTurns.weeds;
    pressureTurnTotals.pests += snap.pressureTurns.pests;
    growthLostTotals.temperature += snap.growthLost.temperature;
    growthLostTotals.moisture += snap.growthLost.moisture;
    growthLostTotals.health += snap.growthLost.health;
    outcomes.cropDeaths += snap.outcomes.cropDeaths;
    outcomes.cropsReady += snap.outcomes.cropsReady;
    outcomes.harvests += snap.outcomes.harvests;
    outcomes.animalDeaths += snap.outcomes.animalDeaths;
    outcomes.animalBirths += snap.outcomes.animalBirths;
    outcomes.marketEvents += snap.outcomes.marketEvents;
    outcomes.randomEvents += snap.outcomes.randomEvents;
    laborWastedTotal += Math.max(0, snap.laborCapacity - snap.laborUsed);
    laborCapacityTotal += snap.laborCapacity;
    laborUsedTotal += snap.laborUsed;
  }

  return {
    seed,
    scenarioId,
    finalStatus: last.status,
    turnCount: snapshots.length,
    netWorthByTurn: snapshots.map((s) => s.netWorth),
    moneyByTurn: snapshots.map((s) => s.money),
    laborWastedTotal,
    laborUtilisation: laborCapacityTotal === 0 ? 0 : laborUsedTotal / laborCapacityTotal,
    pressureTurnTotals,
    growthLostTotals,
    outcomes,
    finalMoney: last.money,
    finalNetWorth: last.netWorth,
    finalLoan: last.loan,
  };
}
