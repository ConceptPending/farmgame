import { describe, it, expect } from "vitest";
import { createGameState } from "../src/state.js";

describe("world generation", () => {
  it("creates a 48x48 world", () => {
    const state = createGameState({ seed: 42 });
    expect(state.world.width).toBe(48);
    expect(state.world.height).toBe(48);
    expect(state.world.tiles.length).toBe(48 * 48);
  });

  it("has river (water tiles)", () => {
    const state = createGameState({ seed: 42 });
    const waterCount = state.world.tiles.filter((t) => t.terrain === "water").length;
    expect(waterCount).toBeGreaterThan(40); // river should span the map
  });

  it("has forest tiles", () => {
    const state = createGameState({ seed: 42 });
    const forestCount = state.world.tiles.filter((t) => t.terrain === "forest").length;
    expect(forestCount).toBeGreaterThan(10);
  });

  it("has varying soil quality", () => {
    const state = createGameState({ seed: 42 });
    const nonWaterTiles = state.world.tiles.filter(
      (t) => t.terrain !== "water" && t.terrain !== "rock",
    );
    const qualities = nonWaterTiles.map((t) => t.soilQuality);
    const min = Math.min(...qualities);
    const max = Math.max(...qualities);
    expect(max - min).toBeGreaterThan(0.2); // significant variation
  });

  it("soil quality is in [0, 1]", () => {
    const state = createGameState({ seed: 42 });
    for (const tile of state.world.tiles) {
      expect(tile.soilQuality).toBeGreaterThanOrEqual(0);
      expect(tile.soilQuality).toBeLessThanOrEqual(1);
    }
  });

  it("moisture is in [0, 1]", () => {
    const state = createGameState({ seed: 42 });
    for (const tile of state.world.tiles) {
      expect(tile.moisture).toBeGreaterThanOrEqual(0);
      expect(tile.moisture).toBeLessThanOrEqual(1);
    }
  });

  it("water tiles have moisture 1.0", () => {
    const state = createGameState({ seed: 42 });
    for (const tile of state.world.tiles) {
      if (tile.terrain === "water") {
        expect(tile.moisture).toBe(1.0);
      }
    }
  });

  it("player starts owning 2 plots", () => {
    const state = createGameState({ seed: 42 });
    const ownedPlots = state.world.plotOwnership.filter(Boolean).length;
    expect(ownedPlots).toBe(2);
  });

  it("owned plots are the central plots (2,2) and (3,2)", () => {
    const state = createGameState({ seed: 42 });
    const plotsPerRow = state.world.width / state.world.plotSize;
    expect(state.world.plotOwnership[2 * plotsPerRow + 2]).toBe(true);
    expect(state.world.plotOwnership[2 * plotsPerRow + 3]).toBe(true);
  });

  it("owned tile terrain is dirt (not grass/forest)", () => {
    const state = createGameState({ seed: 42 });
    for (const tile of state.world.tiles) {
      if (tile.owned && tile.terrain !== "water" && tile.terrain !== "rock") {
        expect(tile.terrain).toBe("dirt");
      }
    }
  });

  it("has 36 total plots in plotOwnership array", () => {
    const state = createGameState({ seed: 42 });
    expect(state.world.plotOwnership.length).toBe(36);
  });

  it("deterministic: same seed generates identical world", () => {
    const a = createGameState({ seed: 123 });
    const b = createGameState({ seed: 123 });
    expect(a.world.tiles.map((t) => t.terrain)).toEqual(b.world.tiles.map((t) => t.terrain));
    expect(a.world.tiles.map((t) => t.soilQuality)).toEqual(b.world.tiles.map((t) => t.soilQuality));
  });

  it("different seeds generate different worlds", () => {
    const a = createGameState({ seed: 1 });
    const b = createGameState({ seed: 999 });
    const aTerrain = a.world.tiles.map((t) => t.terrain).join("");
    const bTerrain = b.world.tiles.map((t) => t.terrain).join("");
    expect(aTerrain).not.toBe(bTerrain);
  });
});
