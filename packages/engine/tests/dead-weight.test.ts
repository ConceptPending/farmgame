import { describe, it, expect } from "vitest";
import {
  createGameState,
  applyCommand,
  createField,
  laborCost,
  isFieldRoadConnected,
  nextTurn,
  createBuilding,
  type GameState,
  type Field,
} from "../src/index.js";

function ownedDirt(state: GameState, n: number): number[] {
  return state.world.tiles
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.owned && t.terrain === "dirt" && t.fieldId === null && t.buildingId === null)
    .slice(0, n)
    .map(({ i }) => i);
}

function placeRoadAt(state: GameState, tileIndex: number): GameState {
  return {
    ...state,
    buildings: [...state.buildings, createBuilding(state.nextBuildingId, "road", tileIndex)],
    nextBuildingId: state.nextBuildingId + 1,
  };
}

describe("road labor discount (PR O)", () => {
  function stateWithField(size: number): { state: GameState; field: Field } {
    const base = createGameState({ seed: 42, startingMoney: 5000 });
    const field = createField(1, ownedDirt(base, size));
    const state: GameState = { ...base, fields: [field], nextFieldId: 2 };
    return { state, field };
  }

  it("a field with no adjacent road is not road-connected", () => {
    const { state, field } = stateWithField(16);
    expect(isFieldRoadConnected(state, field)).toBe(false);
  });

  it("a road tile adjacent to a field tile flips it to road-connected", () => {
    const { state, field } = stateWithField(16);
    // Find a tile that's *next to* one of the field tiles but not in the field.
    const fieldSet = new Set(field.tileIndices);
    const W = state.world.width;
    let neighbour = -1;
    for (const idx of field.tileIndices) {
      const x = idx % W;
      const y = Math.floor(idx / W);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const ni = (y + dy) * W + (x + dx);
        if (!fieldSet.has(ni) && ni >= 0 && ni < state.world.tiles.length) {
          neighbour = ni;
          break;
        }
      }
      if (neighbour >= 0) break;
    }
    expect(neighbour).toBeGreaterThanOrEqual(0);
    const withRoad = placeRoadAt(state, neighbour);
    expect(isFieldRoadConnected(withRoad, field)).toBe(true);
  });

  it("road-connected fields shave 1 off the per-tile labor cost (min 1)", () => {
    const { state, field } = stateWithField(16); // plow base = ceil(16/4) = 4
    const noRoadCost = laborCost({ type: "PLOW_FIELD", fieldId: 1 }, state);
    expect(noRoadCost).toBe(4);

    // Drop a road next to the field.
    const fieldSet = new Set(field.tileIndices);
    const W = state.world.width;
    let neighbour = -1;
    for (const idx of field.tileIndices) {
      const x = idx % W;
      const y = Math.floor(idx / W);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const ni = (y + dy) * W + (x + dx);
        if (!fieldSet.has(ni) && ni >= 0 && ni < state.world.tiles.length) { neighbour = ni; break; }
      }
      if (neighbour >= 0) break;
    }
    const withRoad = placeRoadAt(state, neighbour);
    const roadCost = laborCost({ type: "PLOW_FIELD", fieldId: 1 }, withRoad);
    expect(roadCost).toBe(3);
  });

  it("the discount never takes cost below 1", () => {
    const { state, field } = stateWithField(2); // plow base = 1 already
    const fieldSet = new Set(field.tileIndices);
    const W = state.world.width;
    let neighbour = -1;
    for (const idx of field.tileIndices) {
      const x = idx % W;
      const y = Math.floor(idx / W);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const ni = (y + dy) * W + (x + dx);
        if (!fieldSet.has(ni) && ni >= 0 && ni < state.world.tiles.length) { neighbour = ni; break; }
      }
      if (neighbour >= 0) break;
    }
    const withRoad = placeRoadAt(state, neighbour);
    expect(laborCost({ type: "PLOW_FIELD", fieldId: 1 }, withRoad)).toBe(1);
  });
});

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
