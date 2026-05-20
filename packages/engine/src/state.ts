import type { Season } from "./entities/crop.js";
import type { Field } from "./entities/field.js";
import type { Building } from "./entities/building.js";
import type { Animal } from "./entities/animal.js";
import type { WorldState } from "./entities/world.js";
import type { WeatherState } from "./entities/weather.js";
import type { MarketState } from "./entities/market.js";
import type { RngState } from "./rng.js";
import { createRng } from "./rng.js";
import { createWeatherState } from "./entities/weather.js";
import { createMarketState } from "./entities/market.js";
import { allBasePrices } from "./data/goods.js";
import { generateWorld } from "./data/world-gen.js";

export type GameStatus = "playing" | "won" | "lost";

export interface GameState {
  tick: number;
  season: Season;
  day: number;
  year: number;
  money: number;
  /** Outstanding loan principal owed to the bank. */
  loan: number;
  /** Net-worth target that wins the game. */
  goalNetWorth: number;
  /** "playing" until the player wins (hits the goal) or loses (bankruptcy). */
  status: GameStatus;
  rng: RngState;
  paused: boolean;
  speed: 1 | 2 | 3;
  world: WorldState;
  fields: Field[];
  buildings: Building[];
  animals: Animal[];
  inventory: Record<string, number>;
  inventoryCapacity: number;
  market: MarketState;
  weather: WeatherState;
  nextFieldId: number;
  nextBuildingId: number;
  nextAnimalId: number;
}

export interface Notification {
  type: "info" | "warning" | "success" | "error";
  message: string;
}

export interface TickResult {
  state: GameState;
  notifications: Notification[];
}

export const DAYS_PER_SEASON = 28;
export const SEASONS: readonly Season[] = [
  "spring",
  "summer",
  "fall",
  "winter",
];

export const BASE_INVENTORY_CAPACITY = 100;
export const SILO_CAPACITY_BONUS = 100;

/** Default net-worth target to win the game. */
export const DEFAULT_GOAL_NET_WORTH = 100000;
/** Maximum the player can owe the bank at once. */
export const LOAN_LIMIT = 50000;

export interface CreateGameOptions {
  seed?: number;
  startingMoney?: number;
  goalNetWorth?: number;
}

export function createGameState(options: CreateGameOptions = {}): GameState {
  const {
    seed = Date.now(),
    startingMoney = 500,
    goalNetWorth = DEFAULT_GOAL_NET_WORTH,
  } = options;

  let rng = createRng(seed);
  const worldResult = generateWorld(rng);
  rng = worldResult.rng;

  const basePrices = allBasePrices();

  return {
    tick: 0,
    season: "spring",
    day: 1,
    year: 1,
    money: startingMoney,
    loan: 0,
    goalNetWorth,
    status: "playing",
    rng,
    paused: false,
    speed: 1,
    world: worldResult.world,
    fields: [],
    buildings: [],
    animals: [],
    inventory: {},
    inventoryCapacity: BASE_INVENTORY_CAPACITY,
    market: createMarketState(Object.keys(basePrices), basePrices),
    weather: createWeatherState(),
    nextFieldId: 1,
    nextBuildingId: 1,
    nextAnimalId: 1,
  };
}
