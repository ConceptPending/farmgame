import { describe, it, expect } from "vitest";
import { createGameState, applyCommand, nextTurn } from "../src/index.js";
import type { GameState, SoilNutrients } from "../src/index.js";

function dirtTiles(state: GameState, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < state.world.tiles.length && out.length < n; i++) {
    const t = state.world.tiles[i];
    if (t.owned && t.terrain === "dirt" && t.fieldId === null && t.buildingId === null) out.push(i);
  }
  return out;
}

/** Owned 4-tile field, plowed, with the given nutrients set on its tiles. */
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

/** Plant a crop on a (plowed) field, force it ready, harvest; returns yield + state. */
function harvestYield(s: GameState, fieldId: number, cropId: Parameters<typeof applyCommand>[1] extends infer _ ? string : never) {
  s = applyCommand(s, { type: "PLANT_FIELD", fieldId, cropId: cropId as never }).state;
  s = {
    ...s,
    inventory: {},
    fields: s.fields.map((f) => (f.id === fieldId ? { ...f, state: "ready", growth: 1, health: 1, weeds: 0 } : f)),
  };
  const r = applyCommand(s, { type: "HARVEST_FIELD", fieldId });
  return { s: r.state, qty: r.state.inventory[cropId as string] ?? 0, notes: r.notifications };
}

describe("nutrient depletion & fixation", () => {
  it("harvesting a crop draws down the nutrients it consumes", () => {
    const { s, fieldId, idx } = plowedField({ n: 0.9, p: 0.9, k: 0.9 });
    const after = harvestYield(s, fieldId, "corn").s; // corn consumes n: 0.1
    expect(after.world.tiles[idx[0]].nutrients.n).toBeCloseTo(0.8, 5);
  });

  it("harvesting a legume FIXES nitrogen", () => {
    const { s, fieldId, idx } = plowedField({ n: 0.3, p: 0.9, k: 0.9 });
    const after = harvestYield(s, fieldId, "soybeans").s; // soybeans consume n: -0.1
    expect(after.world.tiles[idx[0]].nutrients.n).toBeCloseTo(0.4, 5);
  });
});

describe("Liebig yield", () => {
  it("a starved nutrient caps yield (~30%) even with the others full", () => {
    const full = harvestYield(plowedField({ n: 1, p: 1, k: 1 }).s, 1, "corn").qty;
    const lowN = harvestYield(plowedField({ n: 0.2, p: 1, k: 1 }).s, 1, "corn").qty;
    expect(lowN).toBeLessThan(full);
    expect(lowN / full).toBeLessThan(0.4);
    expect(lowN / full).toBeGreaterThan(0.2);
  });

  it("emits a depletion hint when soil is poor", () => {
    const { s, fieldId } = plowedField({ n: 0.2, p: 1, k: 1 });
    const { notes } = harvestYield(s, fieldId, "corn");
    expect(notes.some((nf) => /nitrogen is running low/.test(nf.message))).toBe(true);
  });
});

describe("crop rotation", () => {
  it("corn after soybeans out-yields corn after corn", () => {
    // corn → corn (corn drained nitrogen)
    const a = plowedField({ n: 0.5, p: 0.9, k: 0.9 });
    const cornDrained = harvestYield(a.s, a.fieldId, "corn").s; // n 0.5 -> 0.4
    const cornAfterCorn = harvestYield(cornDrained, a.fieldId, "corn").qty;

    // soybeans → corn (soybeans fixed nitrogen)
    const b = plowedField({ n: 0.5, p: 0.9, k: 0.9 });
    const soyFixed = harvestYield(b.s, b.fieldId, "soybeans").s; // n 0.5 -> 0.6
    const cornAfterSoy = harvestYield(soyFixed, b.fieldId, "corn").qty;

    expect(cornAfterSoy).toBeGreaterThan(cornAfterCorn);
  });
});

describe("recovery & fertilizer", () => {
  it("rested soil recovers toward its quality baseline", () => {
    let s = createGameState({ seed: 1, goal: { type: "sandbox" } });
    const i = dirtTiles(s, 1)[0];
    s = {
      ...s,
      world: { ...s.world, tiles: s.world.tiles.map((t, j) => (j === i ? { ...t, soilQuality: 0.7, nutrients: { n: 0.2, p: 0.2, k: 0.2 } } : t)) },
    };
    for (let k = 0; k < 30; k++) s = nextTurn(s).state;
    expect(s.world.tiles[i].nutrients.n).toBeGreaterThan(0.22);
  });

  it("fertilizer replenishes N-P-K", () => {
    const { s, fieldId, idx } = plowedField({ n: 0.3, p: 0.3, k: 0.3 });
    const after = applyCommand(s, { type: "SPRAY", fieldId, sprayType: "fertilizer" }).state;
    expect(after.world.tiles[idx[0]].nutrients.n).toBeCloseTo(0.5, 5);
  });
});
