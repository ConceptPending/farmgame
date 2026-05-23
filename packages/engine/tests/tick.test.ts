import { describe, it, expect } from "vitest";
import { createGameState, nextTurn, MONTHS_PER_SEASON } from "../src/index.js";
import { applyCommand } from "../src/command-handler.js";

function stateWithSeed(seed = 1) {
  return createGameState({ seed, startingMoney: 5000 });
}

describe("nextTurn", () => {
  it("increments tick counter", () => {
    const state = stateWithSeed();
    const result = nextTurn(state);
    expect(result.state.tick).toBe(1);
  });

  it("advances day each tick", () => {
    const state = stateWithSeed();
    const r1 = nextTurn(state);
    expect(r1.state.monthOfSeason).toBe(2);
    const r2 = nextTurn(r1.state);
    expect(r2.state.monthOfSeason).toBe(3);
  });

  it("does nothing when the game has ended", () => {
    const state = stateWithSeed();
    const ended = { ...state, status: "lost" as const };
    const result = nextTurn(ended);
    expect(result.state.tick).toBe(0);
    expect(result.state.monthOfSeason).toBe(1);
  });

  it("transitions season after MONTHS_PER_SEASON", () => {
    let state = stateWithSeed();
    for (let i = 0; i < MONTHS_PER_SEASON; i++) {
      state = nextTurn(state).state;
    }
    expect(state.season).toBe("summer");
    expect(state.monthOfSeason).toBe(1);
  });

  it("cycles through all four seasons", () => {
    let state = stateWithSeed();
    const seasons: string[] = [state.season];

    for (let i = 0; i < MONTHS_PER_SEASON * 4; i++) {
      const prev = state.season;
      state = nextTurn(state).state;
      if (state.season !== prev) {
        seasons.push(state.season);
      }
    }

    expect(seasons).toEqual(["spring", "summer", "fall", "winter", "spring"]);
  });

  it("increments year after full cycle", () => {
    let state = stateWithSeed();
    expect(state.year).toBe(1);
    for (let i = 0; i < MONTHS_PER_SEASON * 4; i++) {
      state = nextTurn(state).state;
    }
    expect(state.year).toBe(2);
  });

  it("notifies on season change", () => {
    let state = stateWithSeed();
    for (let i = 0; i < MONTHS_PER_SEASON - 1; i++) {
      state = nextTurn(state).state;
    }
    const result = nextTurn(state);
    expect(result.notifications.some((n) => n.message.includes("Summer"))).toBe(true);
  });

  it("updates weather each tick", () => {
    const state = stateWithSeed();
    const r1 = nextTurn(state);
    // Weather should be generated
    expect(r1.state.weather.temperature).toBeGreaterThan(0);
    expect(r1.state.weather.forecast.length).toBe(2);
  });

  it("updates market prices each tick", () => {
    let state = stateWithSeed();
    const pricesBefore = { ...state.market.prices };
    // Run enough ticks for prices to change
    for (let i = 0; i < 10; i++) {
      state = nextTurn(state).state;
    }
    // At least one price should have changed
    const someChanged = Object.keys(pricesBefore).some(
      (k) => state.market.prices[k] !== pricesBefore[k],
    );
    expect(someChanged).toBe(true);
  });

  it("records price history", () => {
    let state = stateWithSeed();
    for (let i = 0; i < 5; i++) {
      state = nextTurn(state).state;
    }
    expect(state.market.priceHistory.length).toBe(5);
  });

  it("pipeline order: season → weather → water → crops → fieldHealth → market", () => {
    // Just ensure all systems run without error on a state with fields
    let state = stateWithSeed();
    // Create a field and plant
    const indices: number[] = [];
    for (let i = 0; i < state.world.tiles.length && indices.length < 4; i++) {
      const t = state.world.tiles[i];
      if (t.owned && t.terrain === "dirt" && t.fieldId === null && t.buildingId === null) {
        indices.push(i);
      }
    }
    state = applyCommand(state, { type: "DESIGNATE_FIELD", tileIndices: indices }).state;
    const fieldId = state.fields[0].id;
    state = applyCommand(state, { type: "PLOW_FIELD", fieldId }).state;
    state = applyCommand(state, { type: "PLANT_FIELD", fieldId, cropId: "wheat" }).state;

    // Tick multiple times - all systems should run
    for (let i = 0; i < 20; i++) {
      const result = nextTurn(state);
      state = result.state;
      expect(state.money).not.toBeNaN();
      expect(Number.isFinite(state.money)).toBe(true);
    }
  });

  it("money never becomes NaN through ticking", () => {
    let state = stateWithSeed(42);
    for (let i = 0; i < 200; i++) {
      state = nextTurn(state).state;
      expect(state.money).not.toBeNaN();
      expect(Number.isFinite(state.money)).toBe(true);
    }
  });

  it("growth values always stay in [0, 1]", () => {
    let state = stateWithSeed(42);
    // Create a field and plant
    const indices: number[] = [];
    for (let i = 0; i < state.world.tiles.length && indices.length < 4; i++) {
      const t = state.world.tiles[i];
      if (t.owned && t.terrain === "dirt" && t.fieldId === null && t.buildingId === null) {
        indices.push(i);
      }
    }
    state = applyCommand(state, { type: "DESIGNATE_FIELD", tileIndices: indices }).state;
    const fieldId = state.fields[0].id;
    state = applyCommand(state, { type: "PLOW_FIELD", fieldId }).state;
    state = applyCommand(state, { type: "PLANT_FIELD", fieldId, cropId: "wheat" }).state;

    for (let i = 0; i < 100; i++) {
      state = nextTurn(state).state;
      for (const field of state.fields) {
        expect(field.growth).toBeGreaterThanOrEqual(0);
        expect(field.growth).toBeLessThanOrEqual(1);
      }
    }
  });

  it("moisture values always stay in [0, 1]", () => {
    let state = stateWithSeed(42);
    for (let i = 0; i < 50; i++) {
      state = nextTurn(state).state;
      for (const tile of state.world.tiles) {
        expect(tile.moisture).toBeGreaterThanOrEqual(0);
        expect(tile.moisture).toBeLessThanOrEqual(1);
      }
    }
  });

  it("market prices always positive", () => {
    let state = stateWithSeed(42);
    for (let i = 0; i < 200; i++) {
      state = nextTurn(state).state;
      for (const price of Object.values(state.market.prices)) {
        expect(price).toBeGreaterThan(0);
      }
    }
  });
});
