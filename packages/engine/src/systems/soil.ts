import type { Tile, SoilNutrients } from "../entities/world.js";
import type { NutrientProfile } from "../entities/crop.js";

/** Per-tick fraction by which a nutrient drifts back toward the soil baseline. */
export const SOIL_RECOVERY = 0.004;

export const NUTRIENT_KEYS = ["n", "p", "k"] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Average N-P-K over a set of tiles. */
export function avgNutrients(tiles: Tile[], indices: number[]): SoilNutrients {
  const sum = { n: 0, p: 0, k: 0 };
  for (const i of indices) {
    sum.n += tiles[i].nutrients.n;
    sum.p += tiles[i].nutrients.p;
    sum.k += tiles[i].nutrients.k;
  }
  const len = indices.length || 1;
  return { n: sum.n / len, p: sum.p / len, k: sum.k / len };
}

/**
 * Liebig's law of the minimum: yield is capped by the scarcest needed nutrient.
 * Returns a factor in [0.3, 1] (depleted soil still yields ~30%).
 */
export function nutrientYieldFactor(avg: SoilNutrients, needs: NutrientProfile): number {
  let factor = 1;
  for (const x of NUTRIENT_KEYS) {
    if (needs[x] > 0) factor = Math.min(factor, avg[x] / needs[x]);
  }
  return Math.max(0.3, Math.min(1, factor));
}

/** The nutrient most limiting for a crop's needs (lowest availability / need). */
export function limitingNutrient(avg: SoilNutrients, needs: NutrientProfile): NutrientKey {
  let worst: NutrientKey = "n";
  let worstRatio = Infinity;
  for (const x of NUTRIENT_KEYS) {
    if (needs[x] <= 0) continue;
    const ratio = avg[x] / needs[x];
    if (ratio < worstRatio) {
      worstRatio = ratio;
      worst = x;
    }
  }
  return worst;
}

/** Apply a crop's draw/fixation to a tile's nutrients (negative consume = adds). */
export function applyConsumption(nutrients: SoilNutrients, consumes: NutrientProfile): SoilNutrients {
  return {
    n: clamp01(nutrients.n - consumes.n),
    p: clamp01(nutrients.p - consumes.p),
    k: clamp01(nutrients.k - consumes.k),
  };
}

/** Add balanced nutrients (fertilizer), clamped. */
export function addNutrients(nutrients: SoilNutrients, amount: number): SoilNutrients {
  return {
    n: clamp01(nutrients.n + amount),
    p: clamp01(nutrients.p + amount),
    k: clamp01(nutrients.k + amount),
  };
}

/** One tick of natural recovery toward the tile's soil-quality baseline. */
export function recoverNutrients(tile: Tile): SoilNutrients {
  const base = tile.soilQuality;
  return {
    n: tile.nutrients.n + (base - tile.nutrients.n) * SOIL_RECOVERY,
    p: tile.nutrients.p + (base - tile.nutrients.p) * SOIL_RECOVERY,
    k: tile.nutrients.k + (base - tile.nutrients.k) * SOIL_RECOVERY,
  };
}

const NUTRIENT_NAMES: Record<NutrientKey, string> = { n: "nitrogen", p: "phosphorus", k: "potassium" };
export function nutrientName(key: NutrientKey): string {
  return NUTRIENT_NAMES[key];
}
