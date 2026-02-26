import { describe, it, expect } from "vitest";
import { createGameState, nextTick, CROP_CATALOG } from "../src/index.js";
import { applyCommand } from "../src/command-handler.js";

describe("market system", () => {
  it("prices fluctuate over time", () => {
    let state = createGameState({ seed: 42 });
    const initialPrices = { ...state.market.prices };
    for (let i = 0; i < 20; i++) {
      state = nextTick(state).state;
    }
    const someChanged = Object.keys(initialPrices).some(
      (k) => state.market.prices[k] !== initialPrices[k],
    );
    expect(someChanged).toBe(true);
  });

  it("prices stay within bounds (30% to 300% of base)", () => {
    let state = createGameState({ seed: 42 });
    for (let i = 0; i < 200; i++) {
      state = nextTick(state).state;
      for (const [cropId, price] of Object.entries(state.market.prices)) {
        const def = CROP_CATALOG[cropId as keyof typeof CROP_CATALOG];
        if (def) {
          expect(price).toBeGreaterThanOrEqual(def.basePrice * 0.3 - 0.01);
          expect(price).toBeLessThanOrEqual(def.basePrice * 3 + 0.01);
        }
      }
    }
  });

  it("prices are always positive", () => {
    let state = createGameState({ seed: 42 });
    for (let i = 0; i < 200; i++) {
      state = nextTick(state).state;
      for (const price of Object.values(state.market.prices)) {
        expect(price).toBeGreaterThan(0);
      }
    }
  });

  it("selling depresses price", () => {
    let state = createGameState({ seed: 42, startingMoney: 5000 });
    state = { ...state, inventory: { wheat: 100 } };
    const priceBefore = state.market.prices["wheat"];
    const result = applyCommand(state, { type: "SELL", cropId: "wheat", quantity: 100 });
    expect(result.state.market.prices["wheat"]).toBeLessThan(priceBefore);
  });

  it("records price history up to max", () => {
    let state = createGameState({ seed: 42 });
    for (let i = 0; i < 110; i++) {
      state = nextTick(state).state;
    }
    // History capped at 100
    expect(state.market.priceHistory.length).toBeLessThanOrEqual(100);
    expect(state.market.priceHistory.length).toBeGreaterThan(50);
  });

  it("price history snapshots have tick and prices", () => {
    let state = createGameState({ seed: 42 });
    for (let i = 0; i < 5; i++) {
      state = nextTick(state).state;
    }
    for (const snapshot of state.market.priceHistory) {
      expect(snapshot.tick).toBeGreaterThan(0);
      expect(Object.keys(snapshot.prices).length).toBeGreaterThan(0);
    }
  });

  it("demand recovers toward 1.0 over time", () => {
    let state = createGameState({ seed: 42, startingMoney: 5000 });
    state = { ...state, inventory: { wheat: 100 } };
    // Sell to depress demand
    state = applyCommand(state, { type: "SELL", cropId: "wheat", quantity: 100 }).state;
    const demandAfterSell = state.market.demand["wheat"];
    expect(demandAfterSell).toBeLessThan(1);

    // Tick to let demand recover
    for (let i = 0; i < 50; i++) {
      state = nextTick(state).state;
    }
    expect(state.market.demand["wheat"]).toBeGreaterThan(demandAfterSell);
  });
});
