import { describe, it, expect } from "vitest";
import {
  createGameState,
  applyCommand,
  computeNetWorth,
  computeSeasonalExpenses,
  workableTiles,
  BASE_WORKABLE_TILES,
  EQUIPMENT_CATALOG,
  EQUIPMENT_SALVAGE,
} from "../src/index.js";
import type { GameState } from "../src/index.js";

function dirt(state: GameState, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < state.world.tiles.length && out.length < n; i++) {
    const t = state.world.tiles[i];
    if (t.owned && t.terrain === "dirt" && t.fieldId === null && t.buildingId === null) out.push(i);
  }
  return out;
}

describe("workable capacity", () => {
  it("starts at the manual base and grows with equipment", () => {
    const s = createGameState({ seed: 1, startingMoney: 5000 });
    expect(workableTiles(s.equipment)).toBe(BASE_WORKABLE_TILES);
    const withTractor = applyCommand(s, { type: "BUY_EQUIPMENT", equipmentType: "tractor" }).state;
    expect(workableTiles(withTractor.equipment)).toBe(
      BASE_WORKABLE_TILES + EQUIPMENT_CATALOG.tractor.workableTiles,
    );
  });
});

describe("plow gate", () => {
  it("allows plowing within capacity and blocks beyond it (machinery cap)", () => {
    // Generous labor budget so we isolate the workable-tile (machinery) gate
    // from the monthly labor gate.
    const s: GameState = {
      ...createGameState({ seed: 1, startingMoney: 5000 }),
      labor: { used: 0, capacity: 200 },
    };
    const small = applyCommand(s, { type: "DESIGNATE_FIELD", tileIndices: dirt(s, 20) }).state;
    const r1 = applyCommand(small, { type: "PLOW_FIELD", fieldId: small.fields[0].id });
    expect(r1.success).toBe(true);

    // 20 already worked + 10 more = 30 > base 24 → blocked
    const more = applyCommand(r1.state, { type: "DESIGNATE_FIELD", tileIndices: dirt(r1.state, 10) }).state;
    const r2 = applyCommand(more, { type: "PLOW_FIELD", fieldId: more.fields[1].id });
    expect(r2.success).toBe(false);
    expect(r2.error).toMatch(/machinery/i);
  });

  it("buying equipment unlocks plowing more land", () => {
    let s: GameState = {
      ...createGameState({ seed: 1, startingMoney: 5000 }),
      labor: { used: 0, capacity: 200 },
    };
    s = applyCommand(s, { type: "BUY_EQUIPMENT", equipmentType: "tractor" }).state; // +50 → 74
    const f = applyCommand(s, { type: "DESIGNATE_FIELD", tileIndices: dirt(s, 40) }).state;
    const r = applyCommand(f, { type: "PLOW_FIELD", fieldId: f.fields[0].id });
    expect(r.success).toBe(true);
  });
});

describe("buy / sell", () => {
  it("buys (deducting cost) and sells (for salvage)", () => {
    const s = createGameState({ seed: 1, startingMoney: 5000 });
    const bought = applyCommand(s, { type: "BUY_EQUIPMENT", equipmentType: "plow" });
    expect(bought.success).toBe(true);
    expect(bought.state.money).toBe(5000 - EQUIPMENT_CATALOG.plow.cost);
    expect(bought.state.equipment).toHaveLength(1);

    const id = bought.state.equipment[0].id;
    const sold = applyCommand(bought.state, { type: "SELL_EQUIPMENT", equipmentId: id });
    expect(sold.success).toBe(true);
    expect(sold.state.equipment).toHaveLength(0);
    expect(sold.state.money).toBe(
      bought.state.money + Math.round(EQUIPMENT_CATALOG.plow.cost * EQUIPMENT_SALVAGE),
    );
  });

  it("rejects buying without funds", () => {
    const s = createGameState({ seed: 1, startingMoney: 100 });
    expect(applyCommand(s, { type: "BUY_EQUIPMENT", equipmentType: "combine" }).success).toBe(false);
  });
});

describe("economics", () => {
  it("counts equipment in net worth and seasonal upkeep", () => {
    const s = createGameState({ seed: 1, startingMoney: 5000 });
    const baseNW = computeNetWorth(s);
    const baseUpkeep = computeSeasonalExpenses(s).upkeep;
    const s1 = applyCommand(s, { type: "BUY_EQUIPMENT", equipmentType: "tractor" }).state;
    // cash -cost, asset +0.6*cost → net worth drops by the 40% depreciation
    expect(computeNetWorth(s1)).toBe(baseNW - Math.round(EQUIPMENT_CATALOG.tractor.cost * 0.4));
    expect(computeSeasonalExpenses(s1).upkeep).toBe(baseUpkeep + EQUIPMENT_CATALOG.tractor.upkeepPerSeason);
  });
});
