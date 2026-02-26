import type { Season } from "./entities/crop.js";
import type { Field } from "./entities/field.js";
import type { Building } from "./entities/building.js";
import type { WorldState } from "./entities/world.js";
import type { WeatherState } from "./entities/weather.js";
import type { MarketState } from "./entities/market.js";
import type { RngState } from "./rng.js";
import { createRng } from "./rng.js";
import { createWeatherState } from "./entities/weather.js";
import { createMarketState } from "./entities/market.js";
import { ALL_CROP_IDS, CROP_CATALOG } from "./data/crops.js";
import { generateWorld } from "./data/world-gen.js";

export interface GameState {
  tick: number;
  season: Season;
  day: number;
  year: number;
  money: number;
  rng: RngState;
  paused: boolean;
  speed: 1 | 2 | 3;
  world: WorldState;
  fields: Field[];
  buildings: Building[];
  inventory: Record<string, number>;
  inventoryCapacity: number;
  market: MarketState;
  weather: WeatherState;
  nextFieldId: number;
  nextBuildingId: number;
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

export interface CreateGameOptions {
  seed?: number;
  startingMoney?: number;
}

export function createGameState(options: CreateGameOptions = {}): GameState {
  const { seed = Date.now(), startingMoney = 500 } = options;

  let rng = createRng(seed);
  const worldResult = generateWorld(rng);
  rng = worldResult.rng;

  const basePrices: Record<string, number> = {};
  for (const def of Object.values(CROP_CATALOG)) {
    basePrices[def.id] = def.basePrice;
  }

  return {
    tick: 0,
    season: "spring",
    day: 1,
    year: 1,
    money: startingMoney,
    rng,
    paused: false,
    speed: 1,
    world: worldResult.world,
    fields: [],
    buildings: [],
    inventory: {},
    inventoryCapacity: BASE_INVENTORY_CAPACITY,
    market: createMarketState(ALL_CROP_IDS, basePrices),
    weather: createWeatherState(),
    nextFieldId: 1,
    nextBuildingId: 1,
  };
}
