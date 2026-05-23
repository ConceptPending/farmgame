import { describe, it, expect } from "vitest";
import {
  createGameState,
  applyCommand,
  nextTick,
  createAnimal,
  createBuilding,
  pennedTiles,
  findPen,
  pastureGrazingOffset,
  animalAmenities,
  animalComfort,
  FENCE_BREACH,
  FEED_TROUGH_FACTOR,
  ANIMAL_CATALOG,
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

describe("findPen", () => {
  it("returns the enclosed component containing a tile", () => {
    const { state, pen } = pennedFarm();
    const region = findPen(state, pen);
    expect(region.has(pen)).toBe(true);
    // The pen is a single interior tile; not the wall tiles.
    expect(region.size).toBe(1);
    for (const f of state.buildings.filter((b) => b.type === "fence")) {
      expect(region.has(f.tileIndex)).toBe(false);
    }
  });

  it("returns empty for open ground", () => {
    const s = createGameState({ goalNetWorth: 1e12 });
    expect(findPen(s, openOwned(s)).size).toBe(0);
  });
});

describe("pasture grazing", () => {
  it("reduces feed consumption when grass is inside the pen", () => {
    // Force the 1-tile pen to be grass so the chicken can graze it.
    const { state, pen } = pennedFarm();
    const tiles = state.world.tiles.map((t, i) => (i === pen ? { ...t, terrain: "grass" as const } : t));
    const grazed: GameState = {
      ...state,
      world: { ...state.world, tiles },
      animals: [createAnimal(state.nextAnimalId, "chicken", pen)],
      inventory: { wheat: 100 },
      day: DAYS_PER_SEASON,
    };
    const ungrazed = {
      ...grazed,
      world: { ...grazed.world, tiles: state.world.tiles },
    };
    const grazedAfter = nextTick(grazed).state;
    const ungrazedAfter = nextTick(ungrazed).state;
    // Pasture should have left at least one extra unit of wheat unused.
    expect(grazedAfter.inventory.wheat ?? 0).toBeGreaterThan(ungrazedAfter.inventory.wheat ?? 0);
    expect(pastureGrazingOffset(grazed).get(grazed.animals[0].id) ?? 0).toBeGreaterThan(0);
  });
});

describe("amenity bonuses", () => {
  it("a feed trough in the pen cuts feed consumption", () => {
    const { state, pen } = pennedFarm();
    const trough = createBuilding(900, "feed_trough", pen);
    // Use a non-penned animal tile elsewhere to compare apples-to-apples? Simpler:
    // contrast feed used by penned animals with/without the trough.
    const animalsAt = createAnimal(state.nextAnimalId, "chicken", pen);
    const baseFeed = ANIMAL_CATALOG.chicken.feedPerSeason;
    const withTrough: GameState = {
      ...state,
      buildings: [...state.buildings, trough],
      animals: [animalsAt],
      inventory: { wheat: 100 },
      day: DAYS_PER_SEASON,
    };
    const without = { ...withTrough, buildings: state.buildings };
    const a = nextTick(withTrough).state.inventory.wheat ?? 0;
    const b = nextTick(without).state.inventory.wheat ?? 0;
    expect(a).toBeGreaterThan(b);
    // Roughly the trough should save ~25% of the base feed.
    expect(a - b).toBeGreaterThanOrEqual(Math.floor(baseFeed * (1 - FEED_TROUGH_FACTOR)));
  });

  it("animalAmenities reports troughs in the same pen", () => {
    const { state, pen } = pennedFarm();
    const water = createBuilding(901, "water_trough", pen);
    const animal = createAnimal(state.nextAnimalId, "cow", pen);
    const s = { ...state, buildings: [...state.buildings, water], animals: [animal] };
    expect(animalAmenities(s).get(animal.id)?.water).toBe(true);
  });
});

describe("comfort & density", () => {
  it("a single animal in a 1-tile pen is comfortable (density 1.0)", () => {
    const { state, pen } = pennedFarm();
    const s = { ...state, animals: [createAnimal(state.nextAnimalId, "cow", pen)] };
    const info = animalComfort(s).get(s.animals[0].id);
    expect(info?.tier).toBe("comfortable");
    expect(info?.density).toBeCloseTo(1, 5);
  });

  it("packing many animals into one tile is cramped", () => {
    const { state, pen } = pennedFarm();
    const animals = Array.from({ length: 4 }, (_, i) =>
      createAnimal(state.nextAnimalId + i, "chicken", pen),
    );
    const s = { ...state, animals };
    for (const a of animals) {
      expect(animalComfort(s).get(a.id)?.tier).toBe("cramped");
    }
  });

  it("loose animals are omitted from the comfort map", () => {
    const base = createGameState({ goalNetWorth: 1e12 });
    const open = base.world.tiles.findIndex(
      (t) => t.owned && t.terrain !== "water" && t.fieldId === null && t.buildingId === null,
    );
    const s = { ...base, animals: [createAnimal(base.nextAnimalId, "sheep", open)] };
    expect(animalComfort(s).has(s.animals[0].id)).toBe(false);
  });

  it("cramping kills animals from stress even when fed", () => {
    const { state, pen } = pennedFarm();
    // 4 chickens crammed in a 1-tile pen → cramped (density 4.0). Start them
    // at low health so stress drift finishes them quickly even while fed.
    const animals = Array.from({ length: 4 }, (_, i) => ({
      ...createAnimal(state.nextAnimalId + i, "chicken", pen),
      health: 0.05,
    }));
    let s = { ...state, animals, inventory: { wheat: 1000 }, day: DAYS_PER_SEASON };
    let stressDeaths = 0;
    for (let i = 0; i < DAYS_PER_SEASON * 3 && s.animals.length > 0; i++) {
      const r = nextTick(s);
      s = r.state;
      stressDeaths += r.notifications.filter((n) => /cramped pen/i.test(n.message)).length;
    }
    expect(stressDeaths).toBeGreaterThan(0);
  });
});

describe("water trough placement", () => {
  it("rejects placement away from any water source", () => {
    const s = createGameState({ startingMoney: 1000, goalNetWorth: 1e12 });
    // Find an owned grazeable tile with no water within the 3-tile radius the
    // handler checks — placement there should be rejected.
    const W = s.world.width;
    const H = s.world.height;
    let tile = -1;
    for (let i = s.world.tiles.length - 1; i >= 0 && tile < 0; i--) {
      const t = s.world.tiles[i];
      if (!t.owned || t.terrain === "water" || t.fieldId !== null || t.buildingId !== null) continue;
      const x = i % W;
      const y = (i / W) | 0;
      let nearWater = false;
      check: for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > 3) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (s.world.tiles[ny * W + nx].terrain === "water") {
            nearWater = true;
            break check;
          }
        }
      }
      if (!nearWater) tile = i;
    }
    expect(tile).toBeGreaterThanOrEqual(0); // sanity
    const r = applyCommand(s, { type: "BUILD", buildingType: "water_trough", tileIndex: tile });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/water/i);
  });

  it("accepts placement next to a water pump", () => {
    let s = createGameState({ startingMoney: 1000, goalNetWorth: 1e12 });
    const tile = openOwned(s);
    // Place a pump right next to our target tile, then drop the trough.
    s = applyCommand(s, { type: "BUILD", buildingType: "water_pump", tileIndex: tile + 1 }).state;
    const r = applyCommand(s, { type: "BUILD", buildingType: "water_trough", tileIndex: tile });
    expect(r.success).toBe(true);
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
