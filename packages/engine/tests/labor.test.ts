import { describe, it, expect } from "vitest";
import {
  createGameState,
  applyCommand,
  nextTurn,
  BASE_LABOR_CAPACITY,
  laborCost,
  canAfford,
  equipmentLaborBonus,
  EQUIPMENT_CATALOG,
  createField,
  type GameState,
} from "../src/index.js";

function ownedDirtTiles(state: GameState, n: number): number[] {
  return state.world.tiles
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.owned && t.terrain === "dirt" && t.fieldId === null && t.buildingId === null)
    .slice(0, n)
    .map(({ i }) => i);
}

describe("labor budget", () => {
  it("starts with the base monthly capacity and zero used", () => {
    const s = createGameState({ seed: 1, startingMoney: 5000 });
    expect(s.labor.capacity).toBe(BASE_LABOR_CAPACITY);
    expect(s.labor.used).toBe(0);
  });

  it("commits labor when an action succeeds", () => {
    let s = createGameState({ seed: 1, startingMoney: 5000 });
    const tiles = ownedDirtTiles(s, 4);
    const result = applyCommand(s, { type: "DESIGNATE_FIELD", tileIndices: tiles });
    expect(result.success).toBe(true);
    expect(result.state.labor.used).toBe(
      laborCost({ type: "DESIGNATE_FIELD", tileIndices: tiles }, s),
    );
    s = result.state;
    const plowCmd = { type: "PLOW_FIELD" as const, fieldId: s.fields[0].id };
    const plowed = applyCommand(s, plowCmd);
    expect(plowed.success).toBe(true);
    expect(plowed.state.labor.used).toBe(s.labor.used + laborCost(plowCmd, s));
  });

  it("does NOT commit labor when the action fails for an in-handler reason", () => {
    const s = createGameState({ seed: 1, startingMoney: 5000 });
    const r = applyCommand(s, { type: "PLANT_FIELD", fieldId: 99999, cropId: "wheat" });
    expect(r.success).toBe(false);
    expect(r.state.labor.used).toBe(0);
  });

  it("rejects a command up front when the cost would overflow the budget", () => {
    const s = createGameState({ seed: 2, startingMoney: 5000 });
    const filled: GameState = { ...s, labor: { used: s.labor.capacity, capacity: s.labor.capacity } };
    const r = applyCommand(filled, { type: "DESIGNATE_FIELD", tileIndices: ownedDirtTiles(s, 4) });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/labor/i);
    expect(r.state).toBe(filled);
  });

  it("zero-cost commands (SELL, BUY_ANIMAL, ...) work even with zero labor left", () => {
    const s = createGameState({ seed: 3, startingMoney: 5000 });
    const filled: GameState = {
      ...s,
      labor: { used: s.labor.capacity, capacity: s.labor.capacity },
      inventory: { wheat: 5 },
    };
    const r = applyCommand(filled, { type: "SELL", cropId: "wheat", quantity: 5 });
    expect(r.success).toBe(true);
    expect(r.state.labor.used).toBe(s.labor.capacity);
  });

  it("END_TURN refreshes labor.used to 0", () => {
    let s = createGameState({ seed: 4, startingMoney: 5000 });
    s = applyCommand(s, { type: "DESIGNATE_FIELD", tileIndices: ownedDirtTiles(s, 4) }).state;
    expect(s.labor.used).toBeGreaterThan(0);
    s = applyCommand(s, { type: "END_TURN" }).state;
    expect(s.labor.used).toBe(0);
  });

  it("canAfford agrees with the gate inside applyCommand", () => {
    const s = createGameState({ seed: 5, startingMoney: 5000 });
    const cmd = { type: "DESIGNATE_FIELD" as const, tileIndices: ownedDirtTiles(s, 4) };
    expect(canAfford(s.labor.used, s.labor.capacity, cmd, s)).toBe(true);
    expect(canAfford(s.labor.capacity, s.labor.capacity, cmd, s)).toBe(false);
  });
});

describe("per-tile scaling", () => {
  function stateWithField(size: number): { state: GameState; fieldId: number } {
    const base = createGameState({ seed: 7, startingMoney: 5000 });
    const field = createField(1, ownedDirtTiles(base, size));
    const state: GameState = { ...base, fields: [field], nextFieldId: 2 };
    return { state, fieldId: 1 };
  }

  it("plow / plant / harvest / manure use chunks of 4 tiles (min 1)", () => {
    const { state: s4 } = stateWithField(4);
    const { state: s16 } = stateWithField(16);
    const { state: s32 } = stateWithField(32);
    expect(laborCost({ type: "PLOW_FIELD", fieldId: 1 }, s4)).toBe(1);
    expect(laborCost({ type: "PLOW_FIELD", fieldId: 1 }, s16)).toBe(4);
    expect(laborCost({ type: "PLOW_FIELD", fieldId: 1 }, s32)).toBe(8);
    expect(laborCost({ type: "HARVEST_FIELD", fieldId: 1 }, s16)).toBe(4);
    expect(laborCost({ type: "SPREAD_MANURE", fieldId: 1 }, s16)).toBe(4);
  });

  it("spray / remove / designate use chunks of 8 tiles (lighter work)", () => {
    const { state: s8 } = stateWithField(8);
    const { state: s32 } = stateWithField(32);
    expect(laborCost({ type: "SPRAY", fieldId: 1, sprayType: "herbicide" }, s8)).toBe(1);
    expect(laborCost({ type: "SPRAY", fieldId: 1, sprayType: "herbicide" }, s32)).toBe(4);
    expect(laborCost({ type: "REMOVE_FIELD", fieldId: 1 }, s32)).toBe(4);
    expect(
      laborCost({ type: "DESIGNATE_FIELD", tileIndices: new Array(32).fill(0) }),
    ).toBe(4);
  });

  it("flat-cost commands are unaffected by field size", () => {
    expect(laborCost({ type: "BUILD", buildingType: "silo", tileIndex: 0 })).toBe(3);
    expect(laborCost({ type: "BUY_PLOT", plotX: 0, plotY: 0 })).toBe(3);
    expect(laborCost({ type: "REPAIR_FENCES" })).toBe(2);
    expect(laborCost({ type: "SELL", cropId: "wheat", quantity: 1 })).toBe(0);
  });
});

describe("equipment labor bonus", () => {
  it("equipmentLaborBonus sums each owned piece's contribution", () => {
    expect(equipmentLaborBonus([])).toBe(0);
    expect(equipmentLaborBonus([{ id: 1, type: "tractor" }])).toBe(
      EQUIPMENT_CATALOG.tractor.laborBonus,
    );
    expect(
      equipmentLaborBonus([
        { id: 1, type: "tractor" },
        { id: 2, type: "combine" },
      ]),
    ).toBe(EQUIPMENT_CATALOG.tractor.laborBonus + EQUIPMENT_CATALOG.combine.laborBonus);
  });

  it("nextTurn recomputes labor.capacity from owned equipment", () => {
    let s = createGameState({ seed: 8, startingMoney: 5000 });
    expect(s.labor.capacity).toBe(BASE_LABOR_CAPACITY);
    s = applyCommand(s, { type: "BUY_EQUIPMENT", equipmentType: "tractor" }).state;
    // Capacity isn't applied until the next turn rolls over — that's the
    // contract: the new tractor shows up next month.
    expect(s.labor.capacity).toBe(BASE_LABOR_CAPACITY);
    s = nextTurn(s).state;
    expect(s.labor.capacity).toBe(BASE_LABOR_CAPACITY + EQUIPMENT_CATALOG.tractor.laborBonus);
  });
});
