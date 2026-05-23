import type { Season } from "./entities/crop.js";
import type { Cause } from "./entities/cause.js";
import type { Field } from "./entities/field.js";
import type { Building } from "./entities/building.js";
import type { Animal } from "./entities/animal.js";
import type { Equipment } from "./entities/equipment.js";
import type { Goal } from "./entities/goal.js";
import type { RivalFarm, RivalConfig } from "./entities/rival.js";
import { createRival } from "./entities/rival.js";
import type { WorldState } from "./entities/world.js";
import type { WeatherState } from "./entities/weather.js";
import type { MarketState } from "./entities/market.js";
import type { RngState } from "./rng.js";
import { createRng, nextInt } from "./rng.js";
import { createWeatherState } from "./entities/weather.js";
import { createMarketState } from "./entities/market.js";
import { allBasePrices } from "./data/goods.js";
import { generateWorld } from "./data/world-gen.js";

export type GameStatus = "playing" | "won" | "lost";

/** Position within a season (early/mid/late = monthOfSeason 1/2/3). */
export type MonthPhase = "early" | "mid" | "late";

/** Monthly labor budget — replenished at the start of every turn. */
export interface LaborBudget {
  /** Labor units already committed to actions this turn. */
  used: number;
  /** Max labor available per turn (base + equipment bonuses, applied at turn start). */
  capacity: number;
}

export interface GameState {
  /** Monotonic turn counter (one tick per month). Kept as `tick` for backcompat
   *  with market price-history snapshots; conceptually it is now "turns elapsed". */
  tick: number;
  season: Season;
  /** Position within the current season: 1=early, 2=mid, 3=late. */
  monthOfSeason: number;
  year: number;
  money: number;
  /** Outstanding loan principal owed to the bank. */
  loan: number;
  /** The objective this game (net worth, land baron, sandbox, ...). */
  goal: Goal;
  /** Difficulty multiplier applied to seasonal expenses. */
  expenseMultiplier: number;
  /** "playing" until the player wins (hits the goal) or loses (bankruptcy). */
  status: GameStatus;
  rng: RngState;
  /** Labor budget for the current turn (resets each turn). */
  labor: LaborBudget;
  world: WorldState;
  fields: Field[];
  buildings: Building[];
  animals: Animal[];
  equipment: Equipment[];
  rivals: RivalFarm[];
  /** Human's sales of each good this season (for market_leader goal). */
  seasonSales: Record<string, number>;
  /** Consecutive seasons leading the market_leader good. */
  marketLeadStreak: number;
  inventory: Record<string, number>;
  /** Manure stock from livestock, spread on fields as organic fertilizer. */
  manure: number;
  inventoryCapacity: number;
  market: MarketState;
  weather: WeatherState;
  nextFieldId: number;
  nextBuildingId: number;
  nextAnimalId: number;
  nextEquipmentId: number;
}

export interface Notification {
  type: "info" | "warning" | "success" | "error";
  message: string;
}

export interface TickResult {
  state: GameState;
  notifications: Notification[];
  /** Structured cause records from this turn. UI groups + translates these
   *  into the end-of-turn summary panel and field-inspector breadcrumbs. */
  causes: Cause[];
}

/** Three monthly turns per season (Early / Mid / Late). */
export const MONTHS_PER_SEASON = 3;
/** Twelve turns per year (4 seasons × 3 months). */
export const MONTHS_PER_YEAR = MONTHS_PER_SEASON * 4;
export const SEASONS: readonly Season[] = [
  "spring",
  "summer",
  "fall",
  "winter",
];
export const MONTH_PHASES: readonly MonthPhase[] = ["early", "mid", "late"];

/** Base monthly labor capacity before equipment bonuses. */
export const BASE_LABOR_CAPACITY = 12;

/** Map a 1..3 month-of-season to the phase tag. */
export function monthPhase(monthOfSeason: number): MonthPhase {
  return MONTH_PHASES[Math.max(0, Math.min(MONTH_PHASES.length - 1, monthOfSeason - 1))];
}

/** Absolute month 1..12 from a (season, monthOfSeason) pair. */
export function absoluteMonth(season: Season, monthOfSeason: number): number {
  const seasonIdx = SEASONS.indexOf(season);
  return seasonIdx * MONTHS_PER_SEASON + monthOfSeason;
}

export const BASE_INVENTORY_CAPACITY = 100;
export const SILO_CAPACITY_BONUS = 100;

/** Default net-worth target to win the game. */
export const DEFAULT_GOAL_NET_WORTH = 40000;
/** Maximum the player can owe the bank at once. */
export const LOAN_LIMIT = 50000;

export interface CreateGameOptions {
  seed?: number;
  startingMoney?: number;
  goal?: Goal;
  /** Scales seasonal expenses (difficulty). 1.0 = normal. */
  expenseMultiplier?: number;
  /** Computer-run rival farms (land + market competition). */
  rivals?: RivalConfig[];
  /** @deprecated Convenience alias for `goal: { type: "net_worth", target }`. */
  goalNetWorth?: number;
}

export function createGameState(options: CreateGameOptions = {}): GameState {
  const {
    seed = Date.now(),
    startingMoney = 500,
    expenseMultiplier = 1,
  } = options;
  const goal: Goal =
    options.goal ??
    { type: "net_worth", target: options.goalNetWorth ?? DEFAULT_GOAL_NET_WORTH };

  let rng = createRng(seed);
  const worldResult = generateWorld(rng);
  rng = worldResult.rng;

  // Rivals claim starting plots from the unclaimed grid (no RNG when none).
  const rivals: RivalFarm[] = [];
  const rivalConfigs = options.rivals ?? [];
  if (rivalConfigs.length > 0) {
    const taken = new Set<number>();
    worldResult.world.plotOwnership.forEach((owned, i) => { if (owned) taken.add(i); });
    const totalPlots = worldResult.world.plotOwnership.length;
    rivalConfigs.forEach((cfg, idx) => {
      const plots: number[] = [];
      for (let k = 0; k < cfg.startingPlots; k++) {
        const free: number[] = [];
        for (let p = 0; p < totalPlots; p++) if (!taken.has(p)) free.push(p);
        if (free.length === 0) break;
        const pick = nextInt(rng, 0, free.length - 1);
        rng = pick.rng;
        const plot = free[pick.value];
        taken.add(plot);
        plots.push(plot);
      }
      rivals.push(createRival(idx + 1, cfg, plots));
    });
  }

  const basePrices = allBasePrices();

  return {
    tick: 0,
    season: "spring",
    monthOfSeason: 1,
    year: 1,
    money: startingMoney,
    loan: 0,
    goal,
    expenseMultiplier,
    status: "playing",
    rng,
    labor: { used: 0, capacity: BASE_LABOR_CAPACITY },
    world: worldResult.world,
    fields: [],
    buildings: [],
    animals: [],
    equipment: [],
    rivals,
    seasonSales: {},
    marketLeadStreak: 0,
    inventory: {},
    manure: 0,
    inventoryCapacity: BASE_INVENTORY_CAPACITY,
    market: createMarketState(Object.keys(basePrices), basePrices),
    weather: createWeatherState(),
    nextFieldId: 1,
    nextBuildingId: 1,
    nextAnimalId: 1,
    nextEquipmentId: 1,
  };
}
