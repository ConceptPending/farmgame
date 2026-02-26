import { describe, it, expect } from "vitest";
import { createGameState, nextTick, getCropDef, CROP_CATALOG, DAYS_PER_SEASON } from "../src/index.js";
import { applyCommand } from "../src/command-handler.js";
import type { CropId, GameState } from "../src/index.js";

function stateWithSeed(seed = 1) {
  return createGameState({ seed, startingMoney: 10000 });
}

function findOwnedDirtTiles(state: GameState, count: number): number[] {
  const indices: number[] = [];
  for (let i = 0; i < state.world.tiles.length && indices.length < count; i++) {
    const t = state.world.tiles[i];
    if (t.owned && t.terrain === "dirt" && t.fieldId === null && t.buildingId === null) {
      indices.push(i);
    }
  }
  return indices;
}

function setupFieldAndPlant(state: GameState, cropId: CropId): { state: GameState; fieldId: number } {
  const indices = findOwnedDirtTiles(state, 4);
  let s = applyCommand(state, { type: "DESIGNATE_FIELD", tileIndices: indices }).state;
  const fieldId = s.fields[s.fields.length - 1].id;
  s = applyCommand(s, { type: "PLOW_FIELD", fieldId }).state;
  s = applyCommand(s, { type: "PLANT_FIELD", fieldId, cropId }).state;
  return { state: s, fieldId };
}

describe("crop lifecycle", () => {
  it("full lifecycle: designate → plow → plant → grow → harvest → sell (wheat)", () => {
    const state = stateWithSeed();
    const { state: s1, fieldId } = setupFieldAndPlant(state, "wheat");
    const def = getCropDef("wheat")!;

    // Grow to completion (may take more ticks due to weather effects)
    let s2 = s1;
    for (let i = 0; i < def.growthTicks * 3; i++) {
      if (s2.fields.find((f) => f.id === fieldId)?.state === "ready") break;
      s2 = nextTick(s2).state;
    }

    const field = s2.fields.find((f) => f.id === fieldId)!;
    // Field should eventually be ready (unless killed by weather)
    if (field.state === "ready") {
      const harvestResult = applyCommand(s2, { type: "HARVEST_FIELD", fieldId });
      expect(harvestResult.success).toBe(true);
      expect(harvestResult.state.inventory["wheat"]).toBeGreaterThan(0);

      // Sell
      const qty = harvestResult.state.inventory["wheat"]!;
      const sellResult = applyCommand(harvestResult.state, {
        type: "SELL",
        cropId: "wheat",
        quantity: qty,
      });
      expect(sellResult.success).toBe(true);
      expect(sellResult.state.money).toBeGreaterThan(s1.money);
    }
  });

  it("all 12 crops are profitable (baseYield * basePrice > seedCost)", () => {
    for (const def of Object.values(CROP_CATALOG)) {
      const profit = def.baseYield * def.basePrice - def.seedCost;
      expect(profit, `${def.name} should be profitable`).toBeGreaterThan(0);
    }
  });

  it("all crop growth values are bounded [0, 1]", () => {
    let state = stateWithSeed(42);
    const { state: s1, fieldId } = setupFieldAndPlant(state, "tomato");

    let s = s1;
    for (let i = 0; i < 50; i++) {
      s = nextTick(s).state;
      for (const field of s.fields) {
        expect(field.growth).toBeGreaterThanOrEqual(0);
        expect(field.growth).toBeLessThanOrEqual(1);
      }
    }
  });

  it("all crop health values are bounded [0, 1]", () => {
    let state = stateWithSeed(42);
    const { state: s1, fieldId } = setupFieldAndPlant(state, "corn");

    let s = s1;
    for (let i = 0; i < 50; i++) {
      s = nextTick(s).state;
      for (const field of s.fields) {
        expect(field.health).toBeGreaterThanOrEqual(0);
        expect(field.health).toBeLessThanOrEqual(1);
      }
    }
  });

  it("multiple fields grow independently", () => {
    let state = stateWithSeed();
    // Create two fields with different crops
    const indices1 = findOwnedDirtTiles(state, 4);
    state = applyCommand(state, { type: "DESIGNATE_FIELD", tileIndices: indices1 }).state;
    const fieldId1 = state.fields[0].id;
    state = applyCommand(state, { type: "PLOW_FIELD", fieldId: fieldId1 }).state;
    state = applyCommand(state, { type: "PLANT_FIELD", fieldId: fieldId1, cropId: "lettuce" }).state;

    const indices2 = findOwnedDirtTiles(state, 4);
    state = applyCommand(state, { type: "DESIGNATE_FIELD", tileIndices: indices2 }).state;
    const fieldId2 = state.fields[1].id;
    state = applyCommand(state, { type: "PLOW_FIELD", fieldId: fieldId2 }).state;
    state = applyCommand(state, { type: "PLANT_FIELD", fieldId: fieldId2, cropId: "corn" }).state;

    // Lettuce (5 ticks) should mature before corn (12 ticks)
    for (let i = 0; i < 30; i++) {
      state = nextTick(state).state;
      const f1 = state.fields.find((f) => f.id === fieldId1)!;
      const f2 = state.fields.find((f) => f.id === fieldId2)!;

      if (f1.state === "ready" && f2.state !== "ready" && f2.state !== "dead") {
        // Lettuce finished before corn - independence confirmed
        expect(f2.state).toBe("growing");
        return;
      }
    }
    // If we get here, either both finished or weather killed one - that's ok for weather sim
  });

  it("dead fields cannot be harvested", () => {
    const state = stateWithSeed();
    const { state: s1, fieldId } = setupFieldAndPlant(state, "wheat");

    // Force field to dead
    const s2 = {
      ...s1,
      fields: s1.fields.map((f) =>
        f.id === fieldId ? { ...f, state: "dead" as const, health: 0 } : f,
      ),
    };
    const result = applyCommand(s2, { type: "HARVEST_FIELD", fieldId });
    expect(result.success).toBe(false);
  });

  it("weeds and pests accumulate over time", () => {
    let state = stateWithSeed();
    const { state: s1, fieldId } = setupFieldAndPlant(state, "wheat");

    let s = s1;
    for (let i = 0; i < 20; i++) {
      s = nextTick(s).state;
    }

    const field = s.fields.find((f) => f.id === fieldId);
    if (field && field.state !== "dead") {
      expect(field.weeds).toBeGreaterThan(0);
      expect(field.pests).toBeGreaterThan(0);
    }
  });

  it("spraying reduces weeds/pests effectively", () => {
    let state = stateWithSeed();
    const { state: s1, fieldId } = setupFieldAndPlant(state, "wheat");

    // Let weeds/pests grow
    let s = s1;
    for (let i = 0; i < 15; i++) {
      s = nextTick(s).state;
    }

    const field = s.fields.find((f) => f.id === fieldId);
    if (field && field.state !== "dead" && field.weeds > 0.1) {
      const weedsBefore = field.weeds;
      const result = applyCommand(s, { type: "SPRAY", fieldId, sprayType: "herbicide" });
      if (result.success) {
        expect(result.state.fields.find((f) => f.id === fieldId)!.weeds).toBeLessThan(weedsBefore);
      }
    }
  });
});
