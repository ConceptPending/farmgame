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
  /** Monthly turns to reach maturity (one turn = one in-game month). */
  growthMonths: number;
  /** Per-season chance a mature, well-fed animal produces offspring. */
  breedChance: number;
  /** Product yielded each season by a mature, well-fed animal (if any). */
  product?: ProductType;
  /** Units of product produced per season at full health. */
  yieldPerSeason?: number;
  /** Manure produced per season at full health (bigger animals give more). */
  manurePerSeason: number;
}

export interface AnimalLifetime {
  /** Total product (eggs/milk/wool) produced over the animal's life. */
  products: number;
  /** Total manure attributed to this animal. */
  manure: number;
  /** Monthly turns the animal has been alive. */
  monthsAlive: number;
}

export interface Animal {
  id: number;
  type: AnimalType;
  age: number; // monthly turns lived
  maturity: number; // 0..1 toward fully grown
  health: number; // 0..1, falls when underfed
  tileIndex: number; // the tile the animal currently occupies / grazes on
  name: string;
  lifetime: AnimalLifetime;
}

export const ANIMAL_CATALOG: Record<AnimalType, AnimalDefinition> = {
  chicken: {
    type: "chicken",
    name: "Chicken",
    cost: 30,
    matureValue: 70,
    feedPerSeason: 4,
    growthMonths: 5,
    breedChance: 0.35,
    product: "eggs",
    yieldPerSeason: 8,
    manurePerSeason: 1,
  },
  pig: {
    type: "pig",
    name: "Pig",
    cost: 120,
    matureValue: 320,
    feedPerSeason: 9,
    growthMonths: 7,
    breedChance: 0.18,
    manurePerSeason: 3,
  },
  sheep: {
    type: "sheep",
    name: "Sheep",
    cost: 150,
    matureValue: 360,
    feedPerSeason: 8,
    growthMonths: 9,
    breedChance: 0.14,
    product: "wool",
    yieldPerSeason: 6,
    manurePerSeason: 3,
  },
  cow: {
    type: "cow",
    name: "Cow",
    cost: 300,
    matureValue: 850,
    feedPerSeason: 12,
    growthMonths: 12,
    breedChance: 0.1,
    product: "milk",
    yieldPerSeason: 14,
    manurePerSeason: 6,
  },
};

export const ALL_ANIMAL_TYPES = Object.keys(ANIMAL_CATALOG) as AnimalType[];

/** Per-type name pool — deterministic by id so a herd keeps the same names. */
const ANIMAL_NAMES: Record<AnimalType, readonly string[]> = {
  cow: ["Bessie", "Daisy", "Bossy", "Buttercup", "Clover", "Brownie", "Pepper", "Patches", "Belle", "Moo", "Hazel", "Maggie"],
  pig: ["Wilbur", "Babe", "Hamlet", "Truffle", "Porky", "Rosie", "Petunia", "Snort", "Oinky", "Curly", "Squeaky", "Pickles"],
  sheep: ["Wooly", "Lambchop", "Cotton", "Cloud", "Snowy", "Fluffy", "Curly", "Baa", "Marshmallow", "Nimbus", "Pebbles", "Mochi"],
  chicken: ["Henrietta", "Cluck", "Foghorn", "Pecky", "Drumstick", "Yolko", "Coco", "Nugget", "Goldie", "Plucky", "Biscuit", "Roxy"],
};

/** Pick a name for `type` deterministically from `id`. */
export function pickAnimalName(type: AnimalType, id: number): string {
  const pool = ANIMAL_NAMES[type];
  return pool[Math.abs(id) % pool.length];
}

export function createAnimal(id: number, type: AnimalType, tileIndex: number): Animal {
  return {
    id,
    type,
    age: 0,
    maturity: 0,
    health: 1,
    tileIndex,
    name: pickAnimalName(type, id),
    lifetime: { products: 0, manure: 0, monthsAlive: 0 },
  };
}

/** Current resale / asset value of an animal (scales with maturity and health). */
export function animalValue(animal: Animal): number {
  const def = ANIMAL_CATALOG[animal.type];
  return Math.round(def.matureValue * (0.3 + 0.7 * animal.maturity) * animal.health);
}
