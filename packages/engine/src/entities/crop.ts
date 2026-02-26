export type CropId =
  | "wheat"
  | "corn"
  | "tomato"
  | "soybeans"
  | "potatoes"
  | "strawberries"
  | "cotton"
  | "sunflowers"
  | "peppers"
  | "lettuce"
  | "pumpkins"
  | "grapes";

export type Season = "spring" | "summer" | "fall" | "winter";

export type CropCategory = "grain" | "vegetable" | "fruit" | "fiber";

export interface CropDefinition {
  id: CropId;
  name: string;
  category: CropCategory;
  plantSeasons: readonly Season[];
  growthTicks: number;
  basePrice: number;
  seedCost: number;
  baseYield: number;
  idealTempMin: number;
  idealTempMax: number;
  waterNeed: number;
  frostTolerance: number;
  droughtTolerance: number;
  pestVulnerability: number;
}
