import { describe, it, expect } from "vitest";
import {
  createGameState,
  nextTurn,
  applyCommand,
  computeNetWorth,
  animalValue,
  ANIMAL_CATALOG,
  MONTHS_PER_SEASON,
} from "../src/index.js";
import { withPenned } from "./helpers.js";

describe("buying and selling", () => {
  it("buys an animal on open owned land, deducting its cost", () => {
    const s = createGameState({ startingMoney: 5000, goalNetWorth: 1e12 });
    const r = applyCommand(s, { type: "BUY_ANIMAL", animalType: "pig" });
    expect(r.success).toBe(true);
    expect(r.state.animals).toHaveLength(1);
    expect(r.state.money).toBe(5000 - ANIMAL_CATALOG.pig.cost);
    // It lands on a real, grazeable owned tile.
    const tile = r.state.world.tiles[r.state.animals[0].tileIndex];
    expect(tile.owned).toBe(true);
    expect(tile.terrain).not.toBe("water");
  });

  it("rejects placing on water/fields/buildings", () => {
    const s = createGameState({ startingMoney: 5000, goalNetWorth: 1e12 });
    const waterIdx = s.world.tiles.findIndex((t) => t.terrain === "water");
    const r = applyCommand(s, { type: "BUY_ANIMAL", animalType: "chicken", tileIndex: waterIdx });
    expect(r.success).toBe(false);
  });

  it("fails without enough money", () => {
    const s = createGameState({ startingMoney: 10, goalNetWorth: 1e12 });
    expect(applyCommand(s, { type: "BUY_ANIMAL", animalType: "cow" }).success).toBe(false);
  });

  it("sells an animal for its current value", () => {
    const bought = applyCommand(
      createGameState({ startingMoney: 5000, goalNetWorth: 1e12 }),
      { type: "BUY_ANIMAL", animalType: "chicken" },
    ).state;
    const animal = bought.animals[0];
    const r = applyCommand(bought, { type: "SELL_ANIMAL", animalId: animal.id });
    expect(r.success).toBe(true);
    expect(r.state.animals).toHaveLength(0);
    expect(r.state.money).toBe(bought.money + animalValue(animal));
  });
});

describe("growth, feed, and breeding", () => {
  it("animals grow toward maturity each tick", () => {
    const s = withPenned("cow", 1);
    const after = nextTurn(s).state;
    expect(after.animals[0].age).toBe(1);
    expect(after.animals[0].maturity).toBeGreaterThan(0);
  });

  it("consumes grain feed at a season boundary", () => {
    const s = { ...withPenned("chicken", 2), inventory: { wheat: 100 }, monthOfSeason: MONTHS_PER_SEASON };
    const after = nextTurn(s).state; // season rolls over → feed charged
    expect(after.monthOfSeason).toBe(1);
    expect(after.inventory.wheat).toBe(100 - 2 * ANIMAL_CATALOG.chicken.feedPerSeason);
  });

  it("starves unfed animals over time", () => {
    let s = { ...withPenned("chicken", 1), inventory: {} }; // no grain
    let starved = false;
    for (let i = 0; i < MONTHS_PER_SEASON * 3; i++) {
      const r = nextTurn(s);
      s = r.state;
      if (r.notifications.some((n) => /starved/.test(n.message))) starved = true;
    }
    expect(starved).toBe(true);
    expect(s.animals).toHaveLength(0);
  });
});

describe("identity (name + lifetime)", () => {
  it("created animals get a name from a deterministic per-type pool", () => {
    const s = createGameState({ startingMoney: 5000, goalNetWorth: 1e12 });
    const r1 = applyCommand(s, { type: "BUY_ANIMAL", animalType: "cow" });
    const r2 = applyCommand(s, { type: "BUY_ANIMAL", animalType: "cow" });
    expect(r1.state.animals[0].name).toBeTruthy();
    // Same id (nextAnimalId before each buy) → same name.
    expect(r1.state.animals[0].name).toBe(r2.state.animals[0].name);
  });

  it("lifetime monthsAlive increments every tick", () => {
    const s = withPenned("cow", 1);
    const after = nextTurn(s).state;
    expect(after.animals[0].lifetime.monthsAlive).toBe(1);
  });

  it("lifetime products accumulate after a producing season", () => {
    const base = withPenned("chicken", 1);
    const s = {
      ...base,
      animals: base.animals.map((a) => ({ ...a, maturity: 1 })),
      inventory: { wheat: 100 },
      monthOfSeason: MONTHS_PER_SEASON,
    };
    const after = nextTurn(s).state;
    expect(after.animals[0].lifetime.products).toBe(ANIMAL_CATALOG.chicken.yieldPerSeason);
  });

  it("RENAME_ANIMAL updates the name (trimmed, non-empty required)", () => {
    const s = applyCommand(
      createGameState({ startingMoney: 5000, goalNetWorth: 1e12 }),
      { type: "BUY_ANIMAL", animalType: "pig" },
    ).state;
    const id = s.animals[0].id;
    const r = applyCommand(s, { type: "RENAME_ANIMAL", animalId: id, name: "  Sir Bacon  " });
    expect(r.success).toBe(true);
    expect(r.state.animals[0].name).toBe("Sir Bacon");
    expect(applyCommand(r.state, { type: "RENAME_ANIMAL", animalId: id, name: "   " }).success).toBe(false);
  });
});

describe("net worth", () => {
  it("counts livestock as an asset", () => {
    const base = createGameState({ startingMoney: 5000, goalNetWorth: 1e12 });
    const bought = applyCommand(base, { type: "BUY_ANIMAL", animalType: "cow" }).state;
    // Cash drops by cost, but the animal adds its value back.
    expect(computeNetWorth(base) - computeNetWorth(bought)).toBe(
      ANIMAL_CATALOG.cow.cost - animalValue(bought.animals[0]),
    );
  });
});

describe("determinism", () => {
  it("livestock breeding is reproducible for a seed", () => {
    const build = () => ({ ...withPenned("chicken", 4), inventory: { wheat: 100000 } });
    let a = build();
    let b = build();
    for (let i = 0; i < MONTHS_PER_SEASON * 4; i++) {
      a = nextTurn(a).state;
      b = nextTurn(b).state;
    }
    expect(a.animals.length).toBe(b.animals.length);
    expect(a.money).toBe(b.money);
  });
});
