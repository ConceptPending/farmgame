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
  | "grapes"
  | "clover";

export type Season = "spring" | "summer" | "fall" | "winter";

export type CropCategory = "grain" | "vegetable" | "fruit" | "fiber" | "forage";

export interface NutrientProfile {
  n: number;
  p: number;
  k: number;
}

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
  /** Nutrients drawn per harvest (negative = fixed/added, e.g. legume nitrogen). */
  consumes: NutrientProfile;
  /** Nutrient levels (0..1) wanted for full yield (Liebig's limiting factor). */
  needs: NutrientProfile;
}
