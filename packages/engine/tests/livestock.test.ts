import { describe, it, expect } from "vitest";
import {
  createGameState,
  nextTick,
  applyCommand,
  createBuilding,
  computeNetWorth,
  computeLivestockCapacity,
  animalValue,
  ANIMAL_CATALOG,
  BARN_CAPACITY,
  DAYS_PER_SEASON,
} from "../src/index.js";
import type { GameState } from "../src/index.js";

function withBarn(money = 5000): GameState {
  const s = createGameState({ seed: 1, startingMoney: money, goalNetWorth: 1e12 });
  return { ...s, buildings: [createBuilding(1, "barn", 0)] };
}

describe("livestock capacity", () => {
  it("is zero without a barn and 8 per barn", () => {
    expect(computeLivestockCapacity(createGameState())).toBe(0);
    expect(computeLivestockCapacity(withBarn())).toBe(BARN_CAPACITY);
  });
});

describe("buying and selling", () => {
  it("requires a barn to buy", () => {
    const s = createGameState({ startingMoney: 5000 });
    expect(applyCommand(s, { type: "BUY_ANIMAL", animalType: "chicken" }).success).toBe(false);
  });

  it("buys an animal, deducting its cost", () => {
    const r = applyCommand(withBarn(), { type: "BUY_ANIMAL", animalType: "pig" });
    expect(r.success).toBe(true);
    expect(r.state.animals).toHaveLength(1);
    expect(r.state.money).toBe(5000 - ANIMAL_CATALOG.pig.cost);
  });

  it("cannot exceed barn capacity", () => {
    let s = withBarn(100000);
    for (let i = 0; i < BARN_CAPACITY; i++) {
      s = applyCommand(s, { type: "BUY_ANIMAL", animalType: "chicken" }).state;
    }
    expect(s.animals).toHaveLength(BARN_CAPACITY);
    expect(applyCommand(s, { type: "BUY_ANIMAL", animalType: "chicken" }).success).toBe(false);
  });

  it("sells an animal for its current value", () => {
    const bought = applyCommand(withBarn(), { type: "BUY_ANIMAL", animalType: "chicken" }).state;
    const animal = bought.animals[0];
    const r = applyCommand(bought, { type: "SELL_ANIMAL", animalId: animal.id });
    expect(r.success).toBe(true);
    expect(r.state.animals).toHaveLength(0);
    expect(r.state.money).toBe(bought.money + animalValue(animal));
  });
});

describe("growth, feed, and breeding", () => {
  it("animals grow toward maturity each tick", () => {
    const s = applyCommand(withBarn(), { type: "BUY_ANIMAL", animalType: "cow" }).state;
    const after = nextTick(s).state;
    expect(after.animals[0].age).toBe(1);
    expect(after.animals[0].maturity).toBeGreaterThan(0);
  });

  it("consumes grain feed at a season boundary", () => {
    let s = applyCommand(withBarn(), { type: "BUY_ANIMAL", animalType: "chicken" }).state;
    s = applyCommand(s, { type: "BUY_ANIMAL", animalType: "chicken" }).state;
    s = { ...s, inventory: { wheat: 100 }, day: DAYS_PER_SEASON };
    const after = nextTick(s).state; // season rolls over → feed charged
    expect(after.day).toBe(1);
    expect(after.inventory.wheat).toBe(100 - 2 * ANIMAL_CATALOG.chicken.feedPerSeason);
  });

  it("starves unfed animals over time", () => {
    let s = applyCommand(withBarn(), { type: "BUY_ANIMAL", animalType: "chicken" }).state;
    s = { ...s, inventory: {} }; // no grain
    let starved = false;
    for (let i = 0; i < DAYS_PER_SEASON * 3; i++) {
      const r = nextTick(s);
      s = r.state;
      if (r.notifications.some((n) => /starved/.test(n.message))) starved = true;
    }
    expect(starved).toBe(true);
    expect(s.animals).toHaveLength(0);
  });
});

describe("net worth", () => {
  it("counts livestock as an asset", () => {
    const base = computeNetWorth(withBarn());
    const bought = applyCommand(withBarn(), { type: "BUY_ANIMAL", animalType: "cow" }).state;
    // cash drops by cost, but the animal adds its value back
    expect(base - computeNetWorth(bought)).toBe(ANIMAL_CATALOG.cow.cost - animalValue(bought.animals[0]));
  });
});

describe("determinism", () => {
  it("livestock breeding is reproducible for a seed", () => {
    const build = () => {
      let s = withBarn(100000);
      for (let i = 0; i < 4; i++) s = applyCommand(s, { type: "BUY_ANIMAL", animalType: "chicken" }).state;
      return { ...s, inventory: { wheat: 100000 } };
    };
    let a = build();
    let b = build();
    for (let i = 0; i < DAYS_PER_SEASON * 4; i++) {
      a = nextTick(a).state;
      b = nextTick(b).state;
    }
    expect(a.animals.length).toBe(b.animals.length);
    expect(a.money).toBe(b.money);
  });
});
