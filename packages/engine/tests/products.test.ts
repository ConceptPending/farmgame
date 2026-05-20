import { describe, it, expect } from "vitest";
import {
  createGameState,
  nextTick,
  applyCommand,
  createBuilding,
  computeNetWorth,
  getGoodInfo,
  ANIMAL_CATALOG,
  PRODUCT_CATALOG,
  DAYS_PER_SEASON,
} from "../src/index.js";
import type { GameState } from "../src/index.js";

function withBarn(money = 5000): GameState {
  const s = createGameState({ seed: 1, startingMoney: money, goalNetWorth: 1e12 });
  return { ...s, buildings: [createBuilding(1, "barn", 0)] };
}

describe("animal products in the market", () => {
  it("initializes prices for every product", () => {
    const m = createGameState().market.prices;
    expect(m.eggs).toBeGreaterThan(0);
    expect(m.milk).toBeGreaterThan(0);
    expect(m.wool).toBeGreaterThan(0);
  });

  it("treats products as sellable goods", () => {
    expect(getGoodInfo("eggs")?.name).toBe("Eggs");
    expect(getGoodInfo("wheat")?.name).toBe("Wheat");
    expect(getGoodInfo("nope")).toBeUndefined();
  });
});

describe("production", () => {
  it("mature, fed animals yield product at a season boundary", () => {
    let s = applyCommand(withBarn(), { type: "BUY_ANIMAL", animalType: "chicken" }).state;
    s = {
      ...s,
      animals: s.animals.map((a) => ({ ...a, maturity: 1 })),
      inventory: { wheat: 20 },
      day: DAYS_PER_SEASON,
    };
    const after = nextTick(s).state;
    expect(after.day).toBe(1);
    expect(after.inventory.eggs).toBe(ANIMAL_CATALOG.chicken.yieldPerSeason);
    expect(after.inventory.wheat).toBe(20 - ANIMAL_CATALOG.chicken.feedPerSeason);
  });

  it("immature animals do not produce", () => {
    let s = applyCommand(withBarn(), { type: "BUY_ANIMAL", animalType: "chicken" }).state;
    s = { ...s, animals: s.animals.map((a) => ({ ...a, maturity: 0.1 })), inventory: { wheat: 20 }, day: DAYS_PER_SEASON };
    const after = nextTick(s).state;
    expect(after.inventory.eggs).toBeUndefined();
  });
});

describe("selling products", () => {
  it("sells a product for cash near the market price", () => {
    const s = { ...withBarn(), inventory: { eggs: 10 } };
    const price = s.market.prices.eggs;
    const r = applyCommand(s, { type: "SELL", cropId: "eggs", quantity: 10 });
    expect(r.success).toBe(true);
    const gained = r.state.money - s.money;
    // Revenue tracks the market price, minus a little selling slippage.
    expect(gained).toBeGreaterThan(10 * price * 0.9);
    expect(gained).toBeLessThanOrEqual(10 * price);
    expect(r.state.inventory.eggs).toBeUndefined();
  });

  it("counts product stock toward net worth", () => {
    const base = computeNetWorth(withBarn());
    const withEggs = { ...withBarn(), inventory: { milk: 20 } };
    expect(computeNetWorth(withEggs)).toBeGreaterThan(base + 20 * PRODUCT_CATALOG.milk.basePrice - 1);
  });
});
