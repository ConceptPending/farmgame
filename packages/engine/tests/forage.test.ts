import { describe, it, expect } from "vitest";
import {
  createGameState,
  applyCommand,
  nextTick,
  createBuilding,
  DAYS_PER_SEASON,
  ANIMAL_CATALOG,
} from "../src/index.js";
import type { GameState, SoilNutrients } from "../src/index.js";

function dirtTiles(state: GameState, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < state.world.tiles.length && out.length < n; i++) {
    const t = state.world.tiles[i];
    if (t.owned && t.terrain === "dirt" && t.fieldId === null && t.buildingId === null) out.push(i);
  }
  return out;
}

function plowedField(nutrients: SoilNutrients) {
  let s = createGameState({ seed: 1, startingMoney: 1_000_000, goal: { type: "sandbox" } });
  const idx = dirtTiles(s, 4);
  s = {
    ...s,
    world: { ...s.world, tiles: s.world.tiles.map((t, i) => (idx.includes(i) ? { ...t, nutrients: { ...nutrients } } : t)) },
  };
  s = applyCommand(s, { type: "DESIGNATE_FIELD", tileIndices: idx }).state;
  const fieldId = s.fields[0].id;
  s = applyCommand(s, { type: "PLOW_FIELD", fieldId }).state;
  return { s, fieldId, idx };
}

function withBarnAndAnimals(count: number) {
  let s = createGameState({ seed: 1, startingMoney: 1_000_000, goal: { type: "sandbox" } });
  s = { ...s, buildings: [createBuilding(1, "barn", 0)] };
  for (let i = 0; i < count; i++) s = applyCommand(s, { type: "BUY_ANIMAL", animalType: "chicken" }).state;
  return s;
}

describe("clover (forage cover crop)", () => {
  it("fixes a large amount of nitrogen when harvested", () => {
    const { s, fieldId, idx } = plowedField({ n: 0.3, p: 0.9, k: 0.9 });
    let g = applyCommand(s, { type: "PLANT_FIELD", fieldId, cropId: "clover" }).state;
    g = { ...g, fields: g.fields.map((f) => (f.id === fieldId ? { ...f, state: "ready", growth: 1, health: 1, weeds: 0 } : f)) };
    const after = applyCommand(g, { type: "HARVEST_FIELD", fieldId }).state;
    expect(after.world.tiles[idx[0]].nutrients.n).toBeCloseTo(0.48, 5); // 0.3 + 0.18
  });

  it("can be fed to animals like grain", () => {
    let s = withBarnAndAnimals(2);
    s = { ...s, inventory: { clover: 100 }, day: DAYS_PER_SEASON };
    const after = nextTick(s).state;
    expect(after.inventory.clover).toBe(100 - 2 * ANIMAL_CATALOG.chicken.feedPerSeason);
    expect(after.animals).toHaveLength(2); // fed, none starved
  });
});

describe("manure", () => {
  it("is produced by the herd each season (scaled by health)", () => {
    let s = withBarnAndAnimals(3);
    s = { ...s, inventory: { wheat: 100 }, day: DAYS_PER_SEASON }; // fed -> full health
    const after = nextTick(s).state;
    expect(after.manure).toBe(3 * ANIMAL_CATALOG.chicken.manurePerSeason);
  });

  it("SPREAD_MANURE replenishes a field's nutrients and is herd-limited", () => {
    const { s, fieldId, idx } = plowedField({ n: 0.3, p: 0.3, k: 0.3 });
    const stocked = { ...s, manure: 100 };
    const r = applyCommand(stocked, { type: "SPREAD_MANURE", fieldId });
    expect(r.success).toBe(true);
    expect(r.state.world.tiles[idx[0]].nutrients.n).toBeCloseTo(0.45, 5); // +0.15
    expect(r.state.manure).toBe(100 - 2 * 4); // 2 per tile, 4 tiles

    const broke = applyCommand({ ...s, manure: 0 }, { type: "SPREAD_MANURE", fieldId });
    expect(broke.success).toBe(false);
    expect(broke.error).toMatch(/manure/i);
  });
});
