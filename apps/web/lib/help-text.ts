/**
 * Central catalog of one-line stat explanations surfaced by `HelpHint` tooltips.
 * Keep these short — they show on hover and are not where a manual goes.
 * Each entry should answer "what is this number and what do I do about it?".
 */
export const HELP = {
  // Tile-level
  soilQuality:
    "Soil quality. Long-term fertility of this tile. Slowly drifts down with continuous cropping; spread manure or grow clover to restore it.",
  tileMoisture:
    "Tile moisture. How wet the ground is. Rain raises it, sun and crops lower it. Crops with high water need will wilt below their threshold.",
  soilNPK:
    "Nitrogen / phosphorus / potassium. Each crop draws different mixes; if any one runs low, yield is capped by that nutrient (Liebig's law). Soybeans and clover add nitrogen back.",

  // Field-level
  fieldHealth:
    "Field health. Combined damage from weeds, pests, drought, and frost. Drops yield directly. Spray pesticide/herbicide or improve weather coverage to lift it.",
  fieldMoisture:
    "Field moisture. Average across the field's tiles. Below the crop's drought tolerance it loses health; far below it starts to die.",
  fieldWeeds:
    "Weeds (0–100%). Compete with the crop for water and nutrients. Rise faster on unsprayed fields. Spray herbicide to knock them back.",
  fieldPests:
    "Pests (0–100%). Some crops attract them more (tomato, strawberries). Heavy infestations chew growth. Spray pesticide or rotate to less vulnerable crops.",
  fieldGrowth:
    "Growth progress (0–100%). At 100% the field is ready to harvest. Cold spells, drought, and damage slow it.",

  // Livestock
  penFences:
    "Average condition of your fences. Animals breach pens below 50%. Click 'Repair pens' or rebuild fences from the Build tool.",
  animalComfort:
    "How crowded the herd is in its pen. Cozy animals breed and yield better; cramped ones lose health. Add tiles to the pen or split the herd.",
  feedPerSeason:
    "Grain or hay the herd needs each season. Pasture (clover) and feed troughs cut the bill. A shortfall costs animal health.",
  manureStock:
    "Manure on hand. Spread it on a field (from the field inspector) to restore N-P-K. Animals produce it passively each season.",

  // Equipment
  landCapacity:
    "Workable tiles you can keep under cultivation at once. Each tractor / combine adds capacity. Cultivating over the cap drops health on the excess.",

  // Goal / HUD
  goalProgress:
    "Your current goal. Hit the target to win the scenario. The bar tracks how close you are.",
} as const;

export type HelpKey = keyof typeof HELP;
