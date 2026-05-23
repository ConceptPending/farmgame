import { describe, it, expect } from "vitest";
import { createGameState } from "../src/state.js";
import { applyCommand } from "../src/command-handler.js";
import type { GameState } from "../src/state.js";
import { BUILDING_CATALOG } from "../src/entities/building.js";

function stateWithSeed(seed = 42): GameState {
  return createGameState({ seed, startingMoney: 5000 });
}

function findOwnedDirtTile(state: GameState): number {
  for (let i = 0; i < state.world.tiles.length; i++) {
    const t = state.world.tiles[i];
    if (t.owned && t.terrain === "dirt" && t.fieldId === null && t.buildingId === null) {
      return i;
    }
  }
  throw new Error("No owned dirt tile found");
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

function createTestField(state: GameState, tileCount = 4): { state: GameState; fieldId: number } {
  const indices = findOwnedDirtTiles(state, tileCount);
  const result = applyCommand(state, { type: "DESIGNATE_FIELD", tileIndices: indices });
  expect(result.success).toBe(true);
  return { state: result.state, fieldId: result.state.fields[result.state.fields.length - 1].id };
}

describe("BUY_PLOT", () => {
  it("buys adjacent unowned plot", () => {
    const state = stateWithSeed();
    const result = applyCommand(state, { type: "BUY_PLOT", plotX: 4, plotY: 2 });
    expect(result.success).toBe(true);
    expect(result.state.money).toBeLessThan(state.money);
    const plotsPerRow = state.world.width / state.world.plotSize;
    expect(result.state.world.plotOwnership[2 * plotsPerRow + 4]).toBe(true);
  });

  it("rejects non-adjacent plot", () => {
    const state = stateWithSeed();
    const result = applyCommand(state, { type: "BUY_PLOT", plotX: 0, plotY: 0 });
    expect(result.success).toBe(false);
    expect(result.error).toContain("adjacent");
  });

  it("rejects already owned plot", () => {
    const state = stateWithSeed();
    const result = applyCommand(state, { type: "BUY_PLOT", plotX: 2, plotY: 2 });
    expect(result.success).toBe(false);
    expect(result.error).toContain("already own");
  });

  it("rejects out-of-bounds plot", () => {
    const state = stateWithSeed();
    const result = applyCommand(state, { type: "BUY_PLOT", plotX: 99, plotY: 0 });
    expect(result.success).toBe(false);
    expect(result.error).toContain("out of bounds");
  });

  it("rejects if not enough money", () => {
    const state = { ...stateWithSeed(), money: 1 };
    const result = applyCommand(state, { type: "BUY_PLOT", plotX: 4, plotY: 2 });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Not enough money");
  });

  it("marks purchased plot tiles as owned", () => {
    const state = stateWithSeed();
    const result = applyCommand(state, { type: "BUY_PLOT", plotX: 4, plotY: 2 });
    const plotSize = state.world.plotSize;
    const startX = 4 * plotSize;
    const startY = 2 * plotSize;
    for (let dy = 0; dy < plotSize; dy++) {
      for (let dx = 0; dx < plotSize; dx++) {
        const idx = (startY + dy) * state.world.width + (startX + dx);
        expect(result.state.world.tiles[idx].owned).toBe(true);
      }
    }
  });
});

describe("DESIGNATE_FIELD", () => {
  it("designates field on owned tiles", () => {
    const state = stateWithSeed();
    const { state: newState, fieldId } = createTestField(state);
    expect(newState.fields.length).toBe(1);
    const field = newState.fields.find((f) => f.id === fieldId)!;
    expect(field.state).toBe("fallow");
    expect(field.tileIndices.length).toBe(4);
  });

  it("sets tile fieldId references", () => {
    const state = stateWithSeed();
    const { state: newState, fieldId } = createTestField(state);
    const field = newState.fields.find((f) => f.id === fieldId)!;
    for (const idx of field.tileIndices) {
      expect(newState.world.tiles[idx].fieldId).toBe(fieldId);
    }
  });

  it("rejects empty tile list", () => {
    const state = stateWithSeed();
    const result = applyCommand(state, { type: "DESIGNATE_FIELD", tileIndices: [] });
    expect(result.success).toBe(false);
  });

  it("rejects unowned tiles", () => {
    const state = stateWithSeed();
    const unownedIdx = state.world.tiles.findIndex((t) => !t.owned);
    const result = applyCommand(state, { type: "DESIGNATE_FIELD", tileIndices: [unownedIdx] });
    expect(result.success).toBe(false);
    expect(result.error).toContain("owned");
  });

  it("rejects tiles already in a field", () => {
    const state = stateWithSeed();
    const { state: newState } = createTestField(state);
    const usedIdx = newState.fields[0].tileIndices[0];
    const result = applyCommand(newState, { type: "DESIGNATE_FIELD", tileIndices: [usedIdx] });
    expect(result.success).toBe(false);
    expect(result.error).toContain("already belongs");
  });

  it("rejects water tiles", () => {
    const state = stateWithSeed();
    const waterIdx = state.world.tiles.findIndex((t) => t.terrain === "water" && t.owned);
    if (waterIdx >= 0) {
      const result = applyCommand(state, { type: "DESIGNATE_FIELD", tileIndices: [waterIdx] });
      expect(result.success).toBe(false);
    }
  });

  it("increments nextFieldId", () => {
    const state = stateWithSeed();
    const { state: s1 } = createTestField(state);
    expect(s1.nextFieldId).toBe(state.nextFieldId + 1);
  });
});

describe("PLOW_FIELD", () => {
  it("plows a fallow field", () => {
    const state = stateWithSeed();
    const { state: s1, fieldId } = createTestField(state);
    const result = applyCommand(s1, { type: "PLOW_FIELD", fieldId });
    expect(result.success).toBe(true);
    expect(result.state.fields.find((f) => f.id === fieldId)!.state).toBe("plowed");
  });

  it("rejects non-fallow field", () => {
    const state = stateWithSeed();
    const { state: s1, fieldId } = createTestField(state);
    const s2 = applyCommand(s1, { type: "PLOW_FIELD", fieldId }).state;
    const result = applyCommand(s2, { type: "PLOW_FIELD", fieldId });
    expect(result.success).toBe(false);
    expect(result.error).toContain("fallow");
  });

  it("rejects unknown field", () => {
    const state = stateWithSeed();
    const result = applyCommand(state, { type: "PLOW_FIELD", fieldId: 999 });
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });
});

describe("PLANT_FIELD", () => {
  it("plants crop in plowed field", () => {
    const state = stateWithSeed();
    const { state: s1, fieldId } = createTestField(state);
    const s2 = applyCommand(s1, { type: "PLOW_FIELD", fieldId }).state;
    const result = applyCommand(s2, { type: "PLANT_FIELD", fieldId, cropId: "wheat" });
    expect(result.success).toBe(true);
    const field = result.state.fields.find((f) => f.id === fieldId)!;
    expect(field.state).toBe("planted");
    expect(field.cropId).toBe("wheat");
  });

  it("deducts seed cost per tile", () => {
    const state = stateWithSeed();
    const { state: s1, fieldId } = createTestField(state);
    const s2 = applyCommand(s1, { type: "PLOW_FIELD", fieldId }).state;
    const moneyBefore = s2.money;
    const result = applyCommand(s2, { type: "PLANT_FIELD", fieldId, cropId: "wheat" });
    const field = result.state.fields.find((f) => f.id === fieldId)!;
    expect(moneyBefore - result.state.money).toBe(5 * field.tileIndices.length);
  });

  it("rejects wrong season", () => {
    const state = { ...stateWithSeed(), season: "winter" as const };
    const { state: s1, fieldId } = createTestField(state);
    const s2 = applyCommand(s1, { type: "PLOW_FIELD", fieldId }).state;
    const result = applyCommand(s2, { type: "PLANT_FIELD", fieldId, cropId: "wheat" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("cannot be planted");
  });

  it("rejects insufficient funds", () => {
    const state = { ...stateWithSeed(), money: 1 };
    const { state: s1, fieldId } = createTestField(state);
    const s2 = applyCommand(s1, { type: "PLOW_FIELD", fieldId }).state;
    const result = applyCommand(s2, { type: "PLANT_FIELD", fieldId, cropId: "wheat" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Not enough money");
  });

  it("rejects unplowed field", () => {
    const state = stateWithSeed();
    const { state: s1, fieldId } = createTestField(state);
    const result = applyCommand(s1, { type: "PLANT_FIELD", fieldId, cropId: "wheat" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("plowed");
  });

  it("rejects unknown crop", () => {
    const state = stateWithSeed();
    const { state: s1, fieldId } = createTestField(state);
    const s2 = applyCommand(s1, { type: "PLOW_FIELD", fieldId }).state;
    const result = applyCommand(s2, {
      type: "PLANT_FIELD",
      fieldId,
      cropId: "banana" as any,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown crop");
  });
});

describe("HARVEST_FIELD", () => {
  it("rejects non-ready field", () => {
    const state = stateWithSeed();
    const { state: s1, fieldId } = createTestField(state);
    const s2 = applyCommand(s1, { type: "PLOW_FIELD", fieldId }).state;
    const s3 = applyCommand(s2, { type: "PLANT_FIELD", fieldId, cropId: "wheat" }).state;
    const result = applyCommand(s3, { type: "HARVEST_FIELD", fieldId });
    expect(result.success).toBe(false);
    expect(result.error).toContain("not ready");
  });

  it("harvests ready field and adds to inventory", () => {
    const state = stateWithSeed();
    const { state: s1, fieldId } = createTestField(state);
    let s2 = applyCommand(s1, { type: "PLOW_FIELD", fieldId }).state;
    s2 = applyCommand(s2, { type: "PLANT_FIELD", fieldId, cropId: "wheat" }).state;
    s2 = {
      ...s2,
      fields: s2.fields.map((f) =>
        f.id === fieldId ? { ...f, state: "ready" as const, growth: 1 } : f,
      ),
    };
    const result = applyCommand(s2, { type: "HARVEST_FIELD", fieldId });
    expect(result.success).toBe(true);
    expect(result.state.inventory["wheat"]).toBeGreaterThan(0);
    expect(result.state.fields.find((f) => f.id === fieldId)!.state).toBe("plowed");
  });

  it("rejects harvest when no storage capacity", () => {
    const state = { ...stateWithSeed(), inventoryCapacity: 0 };
    const { state: s1, fieldId } = createTestField(state);
    let s2 = applyCommand(s1, { type: "PLOW_FIELD", fieldId }).state;
    s2 = applyCommand(s2, { type: "PLANT_FIELD", fieldId, cropId: "wheat" }).state;
    s2 = {
      ...s2,
      fields: s2.fields.map((f) =>
        f.id === fieldId ? { ...f, state: "ready" as const, growth: 1 } : f,
      ),
      inventoryCapacity: 0,
    };
    const result = applyCommand(s2, { type: "HARVEST_FIELD", fieldId });
    expect(result.success).toBe(false);
    expect(result.error).toContain("storage");
  });
});

describe("REMOVE_FIELD", () => {
  it("removes a field and clears tile references", () => {
    const state = stateWithSeed();
    const { state: s1, fieldId } = createTestField(state);
    const tileIndices = s1.fields[0].tileIndices;
    const result = applyCommand(s1, { type: "REMOVE_FIELD", fieldId });
    expect(result.success).toBe(true);
    expect(result.state.fields.length).toBe(0);
    for (const idx of tileIndices) {
      expect(result.state.world.tiles[idx].fieldId).toBeNull();
    }
  });

  it("rejects unknown field", () => {
    const state = stateWithSeed();
    const result = applyCommand(state, { type: "REMOVE_FIELD", fieldId: 999 });
    expect(result.success).toBe(false);
  });
});

describe("BUILD / DEMOLISH", () => {
  it("builds on owned land", () => {
    const state = stateWithSeed();
    const tileIdx = findOwnedDirtTile(state);
    const result = applyCommand(state, { type: "BUILD", buildingType: "silo", tileIndex: tileIdx });
    expect(result.success).toBe(true);
    expect(result.state.buildings.length).toBe(1);
    expect(result.state.money).toBe(state.money - BUILDING_CATALOG.silo.cost);
    expect(result.state.world.tiles[tileIdx].buildingId).toBe(result.state.buildings[0].id);
  });

  it("silo increases inventory capacity", () => {
    const state = stateWithSeed();
    const tileIdx = findOwnedDirtTile(state);
    const result = applyCommand(state, { type: "BUILD", buildingType: "silo", tileIndex: tileIdx });
    expect(result.state.inventoryCapacity).toBe(state.inventoryCapacity + 100);
  });

  it("rejects building on unowned land", () => {
    const state = stateWithSeed();
    const unownedIdx = state.world.tiles.findIndex((t) => !t.owned && t.terrain !== "water");
    const result = applyCommand(state, { type: "BUILD", buildingType: "fence", tileIndex: unownedIdx });
    expect(result.success).toBe(false);
    expect(result.error).toContain("owned");
  });

  it("rejects building on occupied tile", () => {
    const state = stateWithSeed();
    const tileIdx = findOwnedDirtTile(state);
    const s1 = applyCommand(state, { type: "BUILD", buildingType: "silo", tileIndex: tileIdx }).state;
    // A different building can't share the tile (re-applying the fence tool to a
    // fence is a special repair case, covered in pen.test.ts).
    const result = applyCommand(s1, { type: "BUILD", buildingType: "fence", tileIndex: tileIdx });
    expect(result.success).toBe(false);
    expect(result.error).toContain("already has a building");
  });

  it("rejects building on field tile", () => {
    const state = stateWithSeed();
    const { state: s1 } = createTestField(state);
    const fieldTileIdx = s1.fields[0].tileIndices[0];
    const result = applyCommand(s1, { type: "BUILD", buildingType: "fence", tileIndex: fieldTileIdx });
    expect(result.success).toBe(false);
    expect(result.error).toContain("field");
  });

  it("rejects if insufficient funds", () => {
    const state = { ...stateWithSeed(), money: 1 };
    const tileIdx = findOwnedDirtTile(state);
    const result = applyCommand(state, { type: "BUILD", buildingType: "silo", tileIndex: tileIdx });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Not enough money");
  });

  it("demolishes building", () => {
    const state = stateWithSeed();
    const tileIdx = findOwnedDirtTile(state);
    const s1 = applyCommand(state, { type: "BUILD", buildingType: "fence", tileIndex: tileIdx }).state;
    const buildingId = s1.buildings[0].id;
    const result = applyCommand(s1, { type: "DEMOLISH", buildingId });
    expect(result.success).toBe(true);
    expect(result.state.buildings.length).toBe(0);
    expect(result.state.world.tiles[tileIdx].buildingId).toBeNull();
  });

  it("demolishing silo reduces inventory capacity", () => {
    const state = stateWithSeed();
    const tileIdx = findOwnedDirtTile(state);
    const s1 = applyCommand(state, { type: "BUILD", buildingType: "silo", tileIndex: tileIdx }).state;
    const result = applyCommand(s1, { type: "DEMOLISH", buildingId: s1.buildings[0].id });
    expect(result.state.inventoryCapacity).toBe(state.inventoryCapacity);
  });

  it("rejects demolishing unknown building", () => {
    const state = stateWithSeed();
    const result = applyCommand(state, { type: "DEMOLISH", buildingId: 999 });
    expect(result.success).toBe(false);
  });
});

describe("SPRAY", () => {
  it("sprays herbicide to reduce weeds", () => {
    const state = stateWithSeed();
    const { state: s1, fieldId } = createTestField(state);
    const s2 = {
      ...s1,
      fields: s1.fields.map((f) =>
        f.id === fieldId ? { ...f, state: "planted" as const, cropId: "wheat" as const, weeds: 0.8 } : f,
      ),
    };
    const result = applyCommand(s2, { type: "SPRAY", fieldId, sprayType: "herbicide" });
    expect(result.success).toBe(true);
    expect(result.state.fields.find((f) => f.id === fieldId)!.weeds).toBeLessThan(0.8);
    expect(result.state.money).toBeLessThan(s2.money);
  });

  it("sprays pesticide to reduce pests", () => {
    const state = stateWithSeed();
    const { state: s1, fieldId } = createTestField(state);
    const s2 = {
      ...s1,
      fields: s1.fields.map((f) =>
        f.id === fieldId ? { ...f, state: "planted" as const, cropId: "wheat" as const, pests: 0.7 } : f,
      ),
    };
    const result = applyCommand(s2, { type: "SPRAY", fieldId, sprayType: "pesticide" });
    expect(result.success).toBe(true);
    expect(result.state.fields.find((f) => f.id === fieldId)!.pests).toBeLessThan(0.7);
  });

  it("sprays fertilizer to increase health", () => {
    const state = stateWithSeed();
    const { state: s1, fieldId } = createTestField(state);
    const s2 = {
      ...s1,
      fields: s1.fields.map((f) =>
        f.id === fieldId ? { ...f, state: "planted" as const, cropId: "wheat" as const, health: 0.5 } : f,
      ),
    };
    const result = applyCommand(s2, { type: "SPRAY", fieldId, sprayType: "fertilizer" });
    expect(result.success).toBe(true);
    expect(result.state.fields.find((f) => f.id === fieldId)!.health).toBeGreaterThan(0.5);
  });

  it("rejects if insufficient funds", () => {
    const state = { ...stateWithSeed(), money: 0 };
    const { state: s1, fieldId } = createTestField(state);
    const result = applyCommand(s1, { type: "SPRAY", fieldId, sprayType: "herbicide" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Not enough money");
  });
});

describe("SELL", () => {
  it("sells crop from inventory", () => {
    const state = { ...stateWithSeed(), inventory: { wheat: 10 } };
    const result = applyCommand(state, { type: "SELL", cropId: "wheat", quantity: 5 });
    expect(result.success).toBe(true);
    expect(result.state.inventory["wheat"]).toBe(5);
    expect(result.state.money).toBeGreaterThan(state.money);
  });

  it("removes crop key when selling all", () => {
    const state = { ...stateWithSeed(), inventory: { wheat: 5 } };
    const result = applyCommand(state, { type: "SELL", cropId: "wheat", quantity: 5 });
    expect(result.success).toBe(true);
    expect(result.state.inventory["wheat"]).toBeUndefined();
  });

  it("rejects selling more than available", () => {
    const state = { ...stateWithSeed(), inventory: { wheat: 2 } };
    const result = applyCommand(state, { type: "SELL", cropId: "wheat", quantity: 5 });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Not enough");
  });

  it("depresses market price when selling", () => {
    const state = { ...stateWithSeed(), inventory: { wheat: 50 } };
    const priceBefore = state.market.prices["wheat"];
    const result = applyCommand(state, { type: "SELL", cropId: "wheat", quantity: 50 });
    expect(result.state.market.prices["wheat"]).toBeLessThan(priceBefore);
  });

  it("uses market price not base price for revenue", () => {
    const state = { ...stateWithSeed(), inventory: { wheat: 10 } };
    // Set market price well above base; revenue should track it (minus a little
    // slippage), not fall back to the $15 base price.
    const s2 = {
      ...state,
      market: { ...state.market, prices: { ...state.market.prices, wheat: 25 } },
    };
    const result = applyCommand(s2, { type: "SELL", cropId: "wheat", quantity: 10 });
    const gained = result.state.money - s2.money;
    expect(gained).toBeGreaterThan(10 * 15); // clearly above base-price revenue
    expect(gained).toBeLessThanOrEqual(10 * 25); // never above the shown price
  });
});

describe("END_TURN", () => {
  it("advances the calendar by one monthly turn", () => {
    const state = stateWithSeed();
    const r = applyCommand(state, { type: "END_TURN" });
    expect(r.success).toBe(true);
    // monthOfSeason advances from 1 → 2 (no season rollover yet at turn 1).
    expect(r.state.monthOfSeason).toBe(2);
    expect(r.state.season).toBe(state.season);
    expect(r.state.tick).toBe(state.tick + 1);
  });

  it("resets the labor budget", () => {
    const state = stateWithSeed();
    // Consume some labor with a real action first.
    const tiles = state.world.tiles
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => t.owned && t.terrain !== "water" && t.terrain !== "rock")
      .slice(0, 4)
      .map(({ i }) => i);
    const s = applyCommand(state, { type: "DESIGNATE_FIELD", tileIndices: tiles }).state;
    expect(s.labor.used).toBeGreaterThan(0);
    const ended = applyCommand(s, { type: "END_TURN" });
    expect(ended.state.labor.used).toBe(0);
    expect(ended.state.labor.capacity).toBe(s.labor.capacity);
  });
});
