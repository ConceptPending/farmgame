import { createGameState, createBuilding, createAnimal } from "../src/index.js";
import type { GameState, AnimalType } from "../src/index.js";

/**
 * A farm with a 1-tile pen: an interior land tile ringed by four fences, so the
 * outside flood can't reach it and it counts as enclosed. Animals placed on
 * `pen` stay contained, keeping feed/breeding/product tests free of escape RNG.
 */
export function pennedFarm(money = 100_000): { state: GameState; pen: number } {
  let s = createGameState({ seed: 1, startingMoney: money, goalNetWorth: 1e12 });
  const W = s.world.width;
  const t = s.world.tiles;
  let pen = 2 * W + 2;
  search: for (let y = 3; y < s.world.height - 3; y++) {
    for (let x = 3; x < W - 3; x++) {
      const i = y * W + x;
      if ([i, i - 1, i + 1, i - W, i + W].every((k) => t[k].terrain !== "water")) {
        pen = i;
        break search;
      }
    }
  }
  const fences = [pen - 1, pen + 1, pen - W, pen + W].map((idx, k) =>
    createBuilding(500 + k, "fence", idx),
  );
  // Make the pen tile dirt — keeps feed-baseline tests free of incidental
  // pasture bonuses, since the chosen tile might otherwise have been grass.
  const tiles = s.world.tiles.map((t, i) => (i === pen ? { ...t, terrain: "dirt" as const } : t));
  s = {
    ...s,
    world: { ...s.world, tiles },
    buildings: [...s.buildings, ...fences],
    nextBuildingId: 600,
  };
  return { state: s, pen };
}

/** A penned farm with `count` animals of `type` placed inside the pen. */
export function withPenned(type: AnimalType, count: number, money = 100_000): GameState {
  const { state, pen } = pennedFarm(money);
  const animals = Array.from({ length: count }, (_, i) =>
    createAnimal(state.nextAnimalId + i, type, pen),
  );
  return { ...state, animals, nextAnimalId: state.nextAnimalId + count };
}
