import type { CropId } from "@farmgame/engine";

/** Visual archetype + palette for a crop, consumed by the tileset generator. */
export interface CropVisual {
  kind:
    | "grain" // wheat — golden seed head
    | "corn" // tall stalk + cob
    | "sunflower" // tall stalk + flower head
    | "leafy" // bushy greens (lettuce, soybeans, potatoes)
    | "cover" // low ground cover (clover)
    | "cotton" // green bush + white bolls
    | "fruitbush" // bush bearing colored fruit (tomato, peppers)
    | "strawberry" // low bush + berries
    | "gourd" // sprawling leaves + gourd (pumpkins)
    | "vine"; // climbing vine + clusters (grapes)
  /** Ripe payoff color (grain head, fruit, gourd, …). */
  primary: number;
  /** Foliage color. */
  accent: number;
}

export const CROP_VISUALS: Record<CropId, CropVisual> = {
  wheat: { kind: "grain", primary: 0xe0bb3e, accent: 0x6cae54 },
  corn: { kind: "corn", primary: 0xf2c14e, accent: 0x5ba33f },
  sunflowers: { kind: "sunflower", primary: 0xf4c20d, accent: 0x4f9a3e },
  soybeans: { kind: "leafy", primary: 0x6cae54, accent: 0x9bd178 },
  potatoes: { kind: "leafy", primary: 0x4f9a3e, accent: 0x7ec45a },
  lettuce: { kind: "leafy", primary: 0x7ec850, accent: 0xa6e072 },
  clover: { kind: "cover", primary: 0x4caf50, accent: 0xff6b9d },
  cotton: { kind: "cotton", primary: 0xf5f5f5, accent: 0x5ba33f },
  tomato: { kind: "fruitbush", primary: 0xe23b2e, accent: 0x4f9a3e },
  peppers: { kind: "fruitbush", primary: 0xe8552d, accent: 0x4f9a3e },
  strawberries: { kind: "strawberry", primary: 0xe8324a, accent: 0x4f9a3e },
  pumpkins: { kind: "gourd", primary: 0xe8821e, accent: 0x4f9a3e },
  grapes: { kind: "vine", primary: 0x7d3c98, accent: 0x4f9a3e },
};

/** Texture key for a crop at a given growth stage (matches the generated sheet). */
export function getCropSpriteKey(cropId: CropId, growth: number, isDead: boolean): string {
  if (isDead) return "dead_crop";
  const stage = growth < 0.25 ? 0 : growth < 0.6 ? 1 : growth < 0.9 ? 2 : 3;
  return `crop_${cropId}_${stage}`;
}
