import type { ProductType } from "../data/products.js";

export type AnimalType = "chicken" | "pig" | "sheep" | "cow";

export interface AnimalDefinition {
  type: AnimalType;
  name: string;
  /** Purchase price for a young animal. */
  cost: number;
  /** Sale value at full maturity and health. */
  matureValue: number;
  /** Units of grain feed consumed per season. */
  feedPerSeason: number;
  /** Ticks (days) to reach maturity. */
  growthTicks: number;
  /** Per-season chance a mature, well-fed animal produces offspring. */
  breedChance: number;
  /** Product yielded each season by a mature, well-fed animal (if any). */
  product?: ProductType;
  /** Units of product produced per season at full health. */
  yieldPerSeason?: number;
}

export interface Animal {
  id: number;
  type: AnimalType;
  age: number; // ticks lived
  maturity: number; // 0..1 toward fully grown
  health: number; // 0..1, falls when underfed
}

export const ANIMAL_CATALOG: Record<AnimalType, AnimalDefinition> = {
  chicken: {
    type: "chicken",
    name: "Chicken",
    cost: 30,
    matureValue: 70,
    feedPerSeason: 4,
    growthTicks: 18,
    breedChance: 0.35,
    product: "eggs",
    yieldPerSeason: 8,
  },
  pig: {
    type: "pig",
    name: "Pig",
    cost: 120,
    matureValue: 320,
    feedPerSeason: 12,
    growthTicks: 28,
    breedChance: 0.18,
  },
  sheep: {
    type: "sheep",
    name: "Sheep",
    cost: 150,
    matureValue: 360,
    feedPerSeason: 10,
    growthTicks: 36,
    breedChance: 0.14,
    product: "wool",
    yieldPerSeason: 5,
  },
  cow: {
    type: "cow",
    name: "Cow",
    cost: 300,
    matureValue: 850,
    feedPerSeason: 20,
    growthTicks: 48,
    breedChance: 0.1,
    product: "milk",
    yieldPerSeason: 10,
  },
};

export const ALL_ANIMAL_TYPES = Object.keys(ANIMAL_CATALOG) as AnimalType[];

/** Animals each barn can house. */
export const BARN_CAPACITY = 8;

export function createAnimal(id: number, type: AnimalType): Animal {
  return { id, type, age: 0, maturity: 0, health: 1 };
}

/** Current resale / asset value of an animal (scales with maturity and health). */
export function animalValue(animal: Animal): number {
  const def = ANIMAL_CATALOG[animal.type];
  return Math.round(def.matureValue * (0.3 + 0.7 * animal.maturity) * animal.health);
}
