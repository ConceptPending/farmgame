import { describe, it, expect } from "vitest";
import {
  createGameState,
  applyCommand,
  nextTick,
  createAnimal,
  pennedTiles,
  FENCE_BREACH,
  DAYS_PER_SEASON,
} from "../src/index.js";
import type { GameState } from "../src/index.js";
import { pennedFarm } from "./helpers.js";

/** First open, owned, grazeable tile (no water/field/building). */
function openOwned(s: GameState): number {
  return s.world.tiles.findIndex(
    (t) => t.owned && t.terrain !== "water" && t.fieldId === null && t.buildingId === null,
  );
}

describe("enclosure detection", () => {
  it("encloses a tile ringed by sound fences", () => {
    const { state, pen } = pennedFarm();
    expect(pennedTiles(state).has(pen)).toBe(true);
  });

  it("does not enclose open ground", () => {
    const s = createGameState({ goalNetWorth: 1e12 });
    // A central owned tile with no fences around it is reachable from the border.
    expect(pennedTiles(s).has(openOwned(s))).toBe(false);
  });

  it("a fence worn past breaching opens the pen", () => {
    const { state, pen } = pennedFarm();
    const breached = {
      ...state,
      buildings: state.buildings.map((b) =>
        b.tileIndex === pen - 1 ? { ...b, condition: FENCE_BREACH - 0.01 } : b,
      ),
    };
    expect(pennedTiles(breached).has(pen)).toBe(false);
  });
});

describe("containment & escape", () => {
  it("keeps a penned, fed animal put across seasons", () => {
    const { state, pen } = pennedFarm();
    let s: GameState = {
      ...state,
      animals: [createAnimal(state.nextAnimalId, "sheep", pen)],
      inventory: { wheat: 100000 },
    };
    for (let i = 0; i < DAYS_PER_SEASON * 6; i++) s = nextTick(s).state;
    expect(s.animals).toHaveLength(1);
    expect(s.animals[0].tileIndex).toBe(pen);
  });

  it("a loose, fed animal eventually wanders off and is lost", () => {
    const base = createGameState({ seed: 3, startingMoney: 1000, goalNetWorth: 1e12 });
    let s: GameState = {
      ...base,
      animals: [createAnimal(base.nextAnimalId, "cow", openOwned(base))],
      inventory: { wheat: 100000 }, // fed, so loss is from wandering, not starving
    };
    let wandered = false;
    for (let i = 0; i < DAYS_PER_SEASON * 60 && s.animals.length > 0; i++) {
      const r = nextTick(s);
      s = r.state;
      if (r.notifications.some((n) => /wander/i.test(n.message))) wandered = true;
    }
    expect(wandered).toBe(true);
    expect(s.animals).toHaveLength(0);
  });
});

describe("fence repair", () => {
  it("REPAIR_FENCES restores worn fences and charges for it", () => {
    const { state } = pennedFarm(1000);
    const degraded = {
      ...state,
      buildings: state.buildings.map((b) => (b.type === "fence" ? { ...b, condition: 0.5 } : b)),
    };
    const r = applyCommand(degraded, { type: "REPAIR_FENCES" });
    expect(r.success).toBe(true);
    expect(r.state.buildings.filter((b) => b.type === "fence").every((b) => b.condition === 1)).toBe(true);
    expect(r.state.money).toBeLessThan(degraded.money);
    // Nothing left to repair → no-op failure.
    expect(applyCommand(r.state, { type: "REPAIR_FENCES" }).success).toBe(false);
  });

  it("re-applying the fence tool repairs an existing worn fence", () => {
    let s = createGameState({ startingMoney: 1000, goalNetWorth: 1e12 });
    const tile = openOwned(s);
    s = applyCommand(s, { type: "BUILD", buildingType: "fence", tileIndex: tile }).state;
    const fenceId = s.world.tiles[tile].buildingId!;
    s = { ...s, buildings: s.buildings.map((b) => (b.id === fenceId ? { ...b, condition: 0.5 } : b)) };
    const r = applyCommand(s, { type: "BUILD", buildingType: "fence", tileIndex: tile });
    expect(r.success).toBe(true);
    expect(r.state.buildings.find((b) => b.id === fenceId)!.condition).toBe(1);
  });
});
