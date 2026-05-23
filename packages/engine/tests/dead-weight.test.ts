import { describe, it, expect } from "vitest";
import {
  createGameState,
  nextTurn,
  createBuilding,
  type GameState,
} from "../src/index.js";

describe("windmill water source (PR O)", () => {
  it("a windmill raises moisture on tiles inside its 8-tile radius (vs pump's 5)", () => {
    // Place a windmill in the middle of a fresh world; run one turn; tiles
    // at distance 7 (well past the old pump radius of 5) should still see
    // a moisture boost relative to a baseline turn with no windmill.
    const base = createGameState({ seed: 7, startingMoney: 5000 });
    const W = base.world.width;
    const center = Math.floor(W / 2) + Math.floor(W / 2) * W;
    const withWindmill: GameState = {
      ...base,
      buildings: [...base.buildings, createBuilding(base.nextBuildingId, "windmill", center)],
      nextBuildingId: base.nextBuildingId + 1,
    };

    // Same RNG seed → same weather rolls; only difference is the windmill.
    const a = nextTurn(base).state;
    const b = nextTurn(withWindmill).state;

    // Pick a tile 7 Manhattan-distance from the windmill — outside the old
    // pump radius but inside the windmill's. It should be wetter in `b`.
    const targetX = (center % W) + 7;
    const targetY = Math.floor(center / W);
    const targetIdx = targetY * W + targetX;
    expect(b.world.tiles[targetIdx].moisture).toBeGreaterThan(
      a.world.tiles[targetIdx].moisture,
    );
  });
});
