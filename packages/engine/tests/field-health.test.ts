import { describe, it, expect } from "vitest";
import { createGameState, nextTick } from "../src/index.js";
import { applyCommand } from "../src/command-handler.js";
import type { GameState } from "../src/index.js";

function stateWithField(seed = 42): { state: GameState; fieldId: number } {
  let state = createGameState({ seed, startingMoney: 5000 });
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
  return { state, fieldId };
}

describe("field health system", () => {
  it("weeds accumulate over time on planted fields", () => {
    const { state, fieldId } = stateWithField();
    let s = state;
    for (let i = 0; i < 15; i++) {
      s = nextTick(s).state;
    }
    const field = s.fields.find((f) => f.id === fieldId);
    if (field && field.state !== "dead") {
      expect(field.weeds).toBeGreaterThan(0);
    }
  });

  it("pests accumulate over time on planted fields", () => {
    const { state, fieldId } = stateWithField();
    let s = state;
    for (let i = 0; i < 15; i++) {
      s = nextTick(s).state;
    }
    const field = s.fields.find((f) => f.id === fieldId);
    if (field && field.state !== "dead") {
      expect(field.pests).toBeGreaterThan(0);
    }
  });

  it("weeds are bounded [0, 1]", () => {
    const { state } = stateWithField();
    let s = state;
    for (let i = 0; i < 100; i++) {
      s = nextTick(s).state;
      for (const field of s.fields) {
        expect(field.weeds).toBeGreaterThanOrEqual(0);
        expect(field.weeds).toBeLessThanOrEqual(1);
      }
    }
  });

  it("pests are bounded [0, 1]", () => {
    const { state } = stateWithField();
    let s = state;
    for (let i = 0; i < 100; i++) {
      s = nextTick(s).state;
      for (const field of s.fields) {
        expect(field.pests).toBeGreaterThanOrEqual(0);
        expect(field.pests).toBeLessThanOrEqual(1);
      }
    }
  });

  it("health degrades when weeds and pests are high", () => {
    const { state, fieldId } = stateWithField();
    // Force high weeds and pests
    let s = {
      ...state,
      fields: state.fields.map((f) =>
        f.id === fieldId ? { ...f, weeds: 0.8, pests: 0.8 } : f,
      ),
    };
    s = nextTick(s).state;
    const field = s.fields.find((f) => f.id === fieldId);
    if (field) {
      expect(field.health).toBeLessThan(1);
    }
  });

  it("herbicide spray reduces weeds", () => {
    const { state, fieldId } = stateWithField();
    const s = {
      ...state,
      fields: state.fields.map((f) =>
        f.id === fieldId ? { ...f, weeds: 0.7 } : f,
      ),
    };
    const result = applyCommand(s, { type: "SPRAY", fieldId, sprayType: "herbicide" });
    expect(result.success).toBe(true);
    expect(result.state.fields.find((f) => f.id === fieldId)!.weeds).toBeLessThan(0.7);
  });

  it("pesticide spray reduces pests", () => {
    const { state, fieldId } = stateWithField();
    const s = {
      ...state,
      fields: state.fields.map((f) =>
        f.id === fieldId ? { ...f, pests: 0.7 } : f,
      ),
    };
    const result = applyCommand(s, { type: "SPRAY", fieldId, sprayType: "pesticide" });
    expect(result.success).toBe(true);
    expect(result.state.fields.find((f) => f.id === fieldId)!.pests).toBeLessThan(0.7);
  });

  it("fertilizer improves health", () => {
    const { state, fieldId } = stateWithField();
    const s = {
      ...state,
      fields: state.fields.map((f) =>
        f.id === fieldId ? { ...f, health: 0.5 } : f,
      ),
    };
    const result = applyCommand(s, { type: "SPRAY", fieldId, sprayType: "fertilizer" });
    expect(result.success).toBe(true);
    expect(result.state.fields.find((f) => f.id === fieldId)!.health).toBeGreaterThan(0.5);
  });

  it("fallow fields do not accumulate weeds/pests", () => {
    let state = createGameState({ seed: 42, startingMoney: 5000 });
    const indices: number[] = [];
    for (let i = 0; i < state.world.tiles.length && indices.length < 4; i++) {
      const t = state.world.tiles[i];
      if (t.owned && t.terrain === "dirt" && t.fieldId === null && t.buildingId === null) {
        indices.push(i);
      }
    }
    state = applyCommand(state, { type: "DESIGNATE_FIELD", tileIndices: indices }).state;
    const fieldId = state.fields[0].id;
    // Leave as fallow (don't plow or plant)

    let s = state;
    for (let i = 0; i < 20; i++) {
      s = nextTick(s).state;
    }
    const field = s.fields.find((f) => f.id === fieldId)!;
    expect(field.weeds).toBe(0);
    expect(field.pests).toBe(0);
  });
});
