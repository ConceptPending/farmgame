import { describe, it, expect } from "vitest";
import { createGameState, nextTurn, applyCommand } from "../src/index.js";
import type { GameState } from "../src/index.js";

const EVENT_RE = /Locust|Hailstorm|Blight|bumper|subsidy|inheritance|breakdown/i;

function plantAField(state: GameState): GameState {
  const indices: number[] = [];
  for (let i = 0; i < state.world.tiles.length && indices.length < 4; i++) {
    const t = state.world.tiles[i];
    if (t.owned && t.terrain === "dirt" && t.fieldId === null && t.buildingId === null) {
      indices.push(i);
    }
  }
  let s = applyCommand(state, { type: "DESIGNATE_FIELD", tileIndices: indices }).state;
  const fieldId = s.fields[0].id;
  s = applyCommand(s, { type: "PLOW_FIELD", fieldId }).state;
  s = applyCommand(s, { type: "PLANT_FIELD", fieldId, cropId: "wheat" }).state;
  return s;
}

describe("random events", () => {
  it("fire over time and keep field/money state within invariants", () => {
    // High cash + unreachable goal so neither win nor bankruptcy ends the run early.
    let s = plantAField(createGameState({ seed: 7, startingMoney: 100000, goalNetWorth: 1e12 }));

    let sawEvent = false;
    for (let i = 0; i < 400 && s.status === "playing"; i++) {
      const r = nextTurn(s);
      s = r.state;
      if (r.notifications.some((n) => EVENT_RE.test(n.message))) sawEvent = true;

      expect(Number.isFinite(s.money)).toBe(true);
      for (const f of s.fields) {
        expect(f.pests).toBeGreaterThanOrEqual(0);
        expect(f.pests).toBeLessThanOrEqual(1);
        expect(f.health).toBeGreaterThanOrEqual(0);
        expect(f.health).toBeLessThanOrEqual(1);
      }
    }

    expect(sawEvent).toBe(true);
  });

  it("is deterministic for a given seed", () => {
    const opts = { seed: 123, startingMoney: 100000, goalNetWorth: 1e12 } as const;
    let a = plantAField(createGameState(opts));
    let b = plantAField(createGameState(opts));
    const msgsA: string[] = [];
    const msgsB: string[] = [];
    for (let i = 0; i < 120; i++) {
      const ra = nextTurn(a);
      a = ra.state;
      msgsA.push(...ra.notifications.filter((n) => EVENT_RE.test(n.message)).map((n) => n.message));
      const rb = nextTurn(b);
      b = rb.state;
      msgsB.push(...rb.notifications.filter((n) => EVENT_RE.test(n.message)).map((n) => n.message));
    }
    expect(msgsA).toEqual(msgsB);
    expect(a.money).toBe(b.money);
  });
});
