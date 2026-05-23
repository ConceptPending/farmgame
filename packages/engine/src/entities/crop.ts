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
  /** Short tag identifying the crop's strategic role (for code, not display). */
  archetype: CropArchetype;
  /** One-line player-facing description of the crop's role. */
  archetypeTagline: string;
}

/** The strategic roles crops are designed around — surfaced in tooltips. */
export type CropArchetype =
  | "hardy-staple"
  | "heavy-feeder"
  | "fast-fragile-cash"
  | "nitrogen-fixer"
  | "cool-season-root"
  | "luxury-fruit"
  | "long-season-fiber"
  | "drought-oilseed"
  | "premium-summer-veg"
  | "quick-cash"
  | "autumn-gourd"
  | "premium-long-term"
  | "forage-cover";
