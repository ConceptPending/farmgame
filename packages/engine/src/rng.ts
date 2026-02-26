/**
 * Seedable PRNG using Mulberry32 algorithm.
 * Deterministic: same seed + same calls = same results.
 */
export interface RngState {
  seed: number;
}

export function createRng(seed: number): RngState {
  return { seed: seed >>> 0 };
}

/** Returns [0, 1) float and advances state. */
export function nextFloat(rng: RngState): { value: number; rng: RngState } {
  let t = (rng.seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, rng: { seed: (rng.seed + 1) >>> 0 } };
}

/** Returns integer in [min, max] inclusive. */
export function nextInt(
  rng: RngState,
  min: number,
  max: number,
): { value: number; rng: RngState } {
  const { value, rng: next } = nextFloat(rng);
  return { value: min + Math.floor(value * (max - min + 1)), rng: next };
}

/** Returns true with given probability [0, 1]. */
export function nextBool(
  rng: RngState,
  probability: number,
): { value: boolean; rng: RngState } {
  const { value, rng: next } = nextFloat(rng);
  return { value: value < probability, rng: next };
}

/** Pick a random element from an array. */
export function pickRandom<T>(
  rng: RngState,
  items: readonly T[],
): { value: T; rng: RngState } {
  const { value: idx, rng: next } = nextInt(rng, 0, items.length - 1);
  return { value: items[idx], rng: next };
}
