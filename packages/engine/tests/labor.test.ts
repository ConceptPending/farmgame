import { describe, it, expect } from "vitest";
import {
  createGameState,
  applyCommand,
  BASE_LABOR_CAPACITY,
  laborCost,
  canAfford,
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
    expect(result.state.labor.used).toBe(laborCost({ type: "DESIGNATE_FIELD", tileIndices: tiles }));
    s = result.state;
    const plowed = applyCommand(s, { type: "PLOW_FIELD", fieldId: s.fields[0].id });
    expect(plowed.success).toBe(true);
    expect(plowed.state.labor.used).toBe(
      s.labor.used + laborCost({ type: "PLOW_FIELD", fieldId: s.fields[0].id }),
    );
  });

  it("does NOT commit labor when the action fails for an in-handler reason", () => {
    // Plant in a non-existent field — fails before it could consume labor.
    const s = createGameState({ seed: 1, startingMoney: 5000 });
    const r = applyCommand(s, { type: "PLANT_FIELD", fieldId: 99999, cropId: "wheat" });
    expect(r.success).toBe(false);
    expect(r.state.labor.used).toBe(0);
  });

  it("rejects a command up front when the cost would overflow the budget", () => {
    const s = createGameState({ seed: 2, startingMoney: 5000 });
    // Saturate the budget right up to capacity.
    const filled: GameState = { ...s, labor: { used: s.labor.capacity, capacity: s.labor.capacity } };
    const r = applyCommand(filled, { type: "DESIGNATE_FIELD", tileIndices: ownedDirtTiles(s, 4) });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/labor/i);
    expect(r.state).toBe(filled); // unchanged
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
    expect(r.state.labor.used).toBe(s.labor.capacity); // unchanged
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
    expect(canAfford(s.labor.used, s.labor.capacity, cmd)).toBe(true);
    expect(canAfford(s.labor.capacity, s.labor.capacity, cmd)).toBe(false);
  });
});
