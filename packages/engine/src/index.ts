// Core
export { nextTurn } from "./tick.js";
export {
  createGameState,
  MONTHS_PER_SEASON,
  MONTHS_PER_YEAR,
  MONTH_PHASES,
  BASE_LABOR_CAPACITY,
  SEASONS,
  BASE_INVENTORY_CAPACITY,
  SILO_CAPACITY_BONUS,
  DEFAULT_GOAL_NET_WORTH,
  LOAN_LIMIT,
  monthPhase,
  absoluteMonth,
  type GameState,
  type GameStatus,
  type LaborBudget,
  type MonthPhase,
  type Notification,
  type TickResult,
  type CreateGameOptions,
} from "./state.js";
export { laborCost, canAfford } from "./entities/labor.js";

// Goals
export type { Goal, GoalType, GoalProgress } from "./entities/goal.js";

// Rivals
export type { RivalFarm, RivalConfig } from "./entities/rival.js";
export { rivalOwning, plotOwner } from "./entities/rival.js";

// Finance
export {
  computeNetWorth,
  computeSeasonalExpenses,
  evaluateGoal,
  goalProgress,
  standings,
  type SeasonalExpenses,
  type Standing,
} from "./systems/finance.js";

// Commands
export { applyCommand, type CommandResult } from "./command-handler.js";
export type { GameCommand, SprayType } from "./commands.js";

// Entities
export type {
  CropId,
  CropDefinition,
  CropCategory,
  CropArchetype,
  NutrientProfile,
  Season,
} from "./entities/crop.js";

export type {
  TerrainType,
  Tile,
  SoilNutrients,
  WorldState,
} from "./entities/world.js";

// Soil nutrients & rotation
export {
  avgNutrients,
  nutrientYieldFactor,
  limitingNutrient,
  nutrientName,
  NUTRIENT_KEYS,
  SOIL_RECOVERY,
  type NutrientKey,
} from "./systems/soil.js";
export {
  createTile,
  tileIndex,
  tileCoords,
  plotIndex,
  plotCoords,
} from "./entities/world.js";

export type {
  FieldState,
  Field,
} from "./entities/field.js";
export { createField } from "./entities/field.js";

export type {
  BuildingType,
  BuildingDefinition,
  Building,
} from "./entities/building.js";
export { createBuilding, BUILDING_CATALOG } from "./entities/building.js";

export type {
  WeatherCondition,
  ForecastDay,
  WeatherState,
} from "./entities/weather.js";
export { createWeatherState } from "./entities/weather.js";

export type {
  PriceSnapshot,
  MarketState,
} from "./entities/market.js";
export { createMarketState } from "./entities/market.js";

export type { ToolId, ToolDefinition } from "./entities/tools.js";
export { TOOL_CATALOG } from "./entities/tools.js";

export type { AnimalType, AnimalDefinition, Animal, AnimalLifetime } from "./entities/animal.js";
export { ANIMAL_CATALOG, ALL_ANIMAL_TYPES, animalValue, createAnimal, pickAnimalName } from "./entities/animal.js";
export {
  pennedTiles,
  findPen,
  pastureGrazingOffset,
  animalAmenities,
  animalComfort,
  FENCE_BREACH,
  FENCE_DECAY,
  PASTURE_YIELD,
  FEED_TROUGH_FACTOR,
  WATER_TROUGH_BREED_BONUS,
} from "./systems/pen.js";
export type { ComfortTier, ComfortInfo } from "./systems/pen.js";
export { predatorSystem } from "./systems/predator.js";

export type { EquipmentType, EquipmentDefinition, Equipment } from "./entities/equipment.js";
export {
  EQUIPMENT_CATALOG, ALL_EQUIPMENT_TYPES, BASE_WORKABLE_TILES, EQUIPMENT_SALVAGE,
  createEquipment, workableTiles, cultivatedTiles,
} from "./entities/equipment.js";

// Data
export { CROP_CATALOG, ALL_CROP_IDS, getCropDef } from "./data/crops.js";
export type { ProductType, ProductDefinition } from "./data/products.js";
export { PRODUCT_CATALOG, ALL_PRODUCT_IDS, getProductDef } from "./data/products.js";
export { getGoodInfo } from "./data/goods.js";

// RNG
export {
  createRng,
  nextFloat,
  nextInt,
  nextBool,
  pickRandom,
  type RngState,
} from "./rng.js";
