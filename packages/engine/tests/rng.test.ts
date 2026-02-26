import { describe, it, expect } from "vitest";
import { createRng, nextFloat, nextInt, nextBool, pickRandom } from "../src/rng.js";

describe("RNG", () => {
  it("is deterministic - same seed produces same sequence", () => {
    const rng1 = createRng(42);
    const rng2 = createRng(42);

    const a1 = nextFloat(rng1);
    const a2 = nextFloat(rng2);
    expect(a1.value).toBe(a2.value);

    const b1 = nextFloat(a1.rng);
    const b2 = nextFloat(a2.rng);
    expect(b1.value).toBe(b2.value);
  });

  it("different seeds produce different sequences", () => {
    const a = nextFloat(createRng(1));
    const b = nextFloat(createRng(2));
    expect(a.value).not.toBe(b.value);
  });

  it("nextFloat returns values in [0, 1)", () => {
    let rng = createRng(123);
    for (let i = 0; i < 1000; i++) {
      const result = nextFloat(rng);
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThan(1);
      rng = result.rng;
    }
  });

  it("nextInt returns values in [min, max] inclusive", () => {
    let rng = createRng(456);
    for (let i = 0; i < 500; i++) {
      const result = nextInt(rng, 1, 6);
      expect(result.value).toBeGreaterThanOrEqual(1);
      expect(result.value).toBeLessThanOrEqual(6);
      rng = result.rng;
    }
  });

  it("nextBool with probability 0 always returns false", () => {
    let rng = createRng(789);
    for (let i = 0; i < 100; i++) {
      const result = nextBool(rng, 0);
      expect(result.value).toBe(false);
      rng = result.rng;
    }
  });

  it("nextBool with probability 1 always returns true", () => {
    let rng = createRng(789);
    for (let i = 0; i < 100; i++) {
      const result = nextBool(rng, 1);
      expect(result.value).toBe(true);
      rng = result.rng;
    }
  });

  it("pickRandom selects from the array", () => {
    const items = ["a", "b", "c"] as const;
    let rng = createRng(101);
    for (let i = 0; i < 100; i++) {
      const result = pickRandom(rng, items);
      expect(items).toContain(result.value);
      rng = result.rng;
    }
  });

  it("state is immutable - original rng unchanged after calls", () => {
    const rng = createRng(42);
    const result = nextFloat(rng);
    expect(rng.seed).toBe(42);
    expect(result.rng.seed).not.toBe(42);
  });
});
