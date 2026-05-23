import { describe, it, expect } from "vitest";
import { CROP_CATALOG, ALL_CROP_IDS } from "../src/index.js";

describe("crop archetype metadata", () => {
  it("every crop has a non-empty archetype + tagline", () => {
    for (const id of ALL_CROP_IDS) {
      const def = CROP_CATALOG[id];
      expect(def.archetype, `${id}.archetype`).toBeTruthy();
      expect(def.archetypeTagline, `${id}.archetypeTagline`).toBeTruthy();
      expect(def.archetypeTagline.length, `${id}.archetypeTagline length`).toBeGreaterThan(10);
    }
  });

  it("every archetype tag is unique across crops", () => {
    const seen = new Set<string>();
    for (const id of ALL_CROP_IDS) {
      const a = CROP_CATALOG[id].archetype;
      expect(seen.has(a), `archetype ${a} reused (last on ${id})`).toBe(false);
      seen.add(a);
    }
  });
});

describe("crop strategic tunings", () => {
  // These three were tuned in PR I to sharpen their niches. Pinning the values
  // so a future refactor can't silently revert them without an intentional change.
  it("sunflowers are a low-water drought-tolerant oilseed", () => {
    expect(CROP_CATALOG.sunflowers.waterNeed).toBe(0.25);
    expect(CROP_CATALOG.sunflowers.droughtTolerance).toBe(0.75);
  });
  it("potatoes are a cool-season hardy root", () => {
    expect(CROP_CATALOG.potatoes.frostTolerance).toBe(0.5);
    expect(CROP_CATALOG.potatoes.droughtTolerance).toBe(0.55);
  });
  it("cotton is the heat+dry signature fiber crop", () => {
    expect(CROP_CATALOG.cotton.droughtTolerance).toBe(0.7);
  });
});
