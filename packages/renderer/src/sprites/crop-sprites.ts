import type { CropId } from "@farmgame/engine";
import type { SPRITES } from "./tileset.js";

type SpriteKey = keyof typeof SPRITES;

/** Map each crop to its color variant (green, gold, red, purple). */
const CROP_COLOR_MAP: Record<CropId, "green" | "gold" | "red" | "purple"> = {
  wheat: "gold",
  corn: "gold",
  sunflowers: "gold",
  soybeans: "green",
  potatoes: "green",
  lettuce: "green",
  cotton: "green",
  tomato: "red",
  peppers: "red",
  strawberries: "red",
  pumpkins: "purple",
  grapes: "purple",
  clover: "green",
};

/** Get the sprite key for a crop at a given growth stage. */
export function getCropSpriteKey(cropId: CropId, growth: number, isDead: boolean): SpriteKey {
  if (isDead) return "dead_crop";

  const color = CROP_COLOR_MAP[cropId] ?? "green";

  if (growth < 0.25) return `seedling_${color}` as SpriteKey;
  if (growth < 0.6) return `young_${color}` as SpriteKey;
  if (growth < 0.9) return `mature_${color}` as SpriteKey;
  return `ready_${color}` as SpriteKey;
}
