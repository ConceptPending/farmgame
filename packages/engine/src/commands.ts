import type { CropId } from "./entities/crop.js";
import type { BuildingType } from "./entities/building.js";
import type { AnimalType } from "./entities/animal.js";

export type SprayType = "fertilizer" | "pesticide" | "herbicide";

export type GameCommand =
  | { type: "BUY_PLOT"; plotX: number; plotY: number }
  | { type: "DESIGNATE_FIELD"; tileIndices: number[] }
  | { type: "PLOW_FIELD"; fieldId: number }
  | { type: "PLANT_FIELD"; fieldId: number; cropId: CropId }
  | { type: "HARVEST_FIELD"; fieldId: number }
  | { type: "REMOVE_FIELD"; fieldId: number }
  | { type: "BUILD"; buildingType: BuildingType; tileIndex: number }
  | { type: "DEMOLISH"; buildingId: number }
  | { type: "SPRAY"; fieldId: number; sprayType: SprayType }
  | { type: "SELL"; cropId: CropId; quantity: number }
  | { type: "BUY_ANIMAL"; animalType: AnimalType }
  | { type: "SELL_ANIMAL"; animalId: number }
  | { type: "TAKE_LOAN"; amount: number }
  | { type: "REPAY_LOAN"; amount: number }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "SET_SPEED"; speed: 1 | 2 | 3 };
