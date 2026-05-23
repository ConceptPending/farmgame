import { describe, it, expect } from "vitest";
import {
  createGameState,
  nextTurn,
  takeSnapshot,
  aggregateRun,
  simulateGame,
  simulateBatch,
  greedyWheatPolicy,
} from "../src/index.js";

describe("takeSnapshot", () => {
  it("records the post-turn money, season, and labor state", () => {
    const s = createGameState({ seed: 1, startingMoney: 5000 });
    const after = nextTurn(s);
    const snap = takeSnapshot(after.state, after.causes);
    expect(snap.tick).toBe(after.state.tick);
    expect(snap.money).toBe(after.state.money);
    expect(snap.season).toBe(after.state.season);
    expect(snap.laborCapacity).toBe(after.state.labor.capacity);
    // No actions this turn → labor.used resets to 0 inside nextTurn.
    expect(snap.laborUsed).toBe(0);
  });

  it("counts standout outcomes from the turn's causes", () => {
    const s = createGameState({ seed: 2 });
    const fakeCauses = [
      { kind: "ready_to_harvest" as const, fieldId: 1, cropId: "wheat" as const },
      { kind: "ready_to_harvest" as const, fieldId: 2, cropId: "wheat" as const },
      { kind: "frost_kill" as const, fieldId: 3, cropId: "tomato" as const },
      { kind: "animal_born" as const, species: "chicken" as const, name: "Cluck" },
    ];
    const snap = takeSnapshot(s, fakeCauses);
    expect(snap.outcomes.cropsReady).toBe(2);
    // frost_kill counts both as a death and as frost-loss.
    expect(snap.outcomes.cropDeaths).toBe(1);
    expect(snap.yieldLoss.frost).toBeGreaterThan(0);
    expect(snap.outcomes.animalBirths).toBe(1);
  });
});

describe("aggregateRun", () => {
  it("returns an empty report shape when given no snapshots", () => {
    const r = aggregateRun({ snapshots: [] });
    expect(r.turnCount).toBe(0);
    expect(r.netWorthByTurn).toEqual([]);
  });

  it("sums labor-wasted and counts the run length", () => {
    const s = createGameState({ seed: 3, startingMoney: 5000 });
    // Three turns with no actions → labor wasted = capacity × 3.
    let state = s;
    const snaps = [];
    for (let i = 0; i < 3; i++) {
      const r = nextTurn(state);
      state = r.state;
      snaps.push(takeSnapshot(state, r.causes));
    }
    const report = aggregateRun({ snapshots: snaps });
    expect(report.turnCount).toBe(3);
    expect(report.laborWastedTotal).toBe(state.labor.capacity * 3);
    expect(report.laborUtilisation).toBe(0);
  });
});

describe("simulateGame (greedy wheat baseline)", () => {
  it("is deterministic for a given seed", () => {
    const a = simulateGame({ config: { seed: 42, startingMoney: 5000 }, maxTurns: 24 });
    const b = simulateGame({ config: { seed: 42, startingMoney: 5000 }, maxTurns: 24 });
    expect(a.finalMoney).toBe(b.finalMoney);
    expect(a.finalNetWorth).toBe(b.finalNetWorth);
    expect(a.netWorthByTurn).toEqual(b.netWorthByTurn);
  });

  it("the greedy policy doesn't go bankrupt on Homestead with $5000", () => {
    const r = simulateGame({
      config: { seed: 1, startingMoney: 5000, goal: { type: "sandbox" } },
      policy: greedyWheatPolicy,
      maxTurns: 24,
    });
    expect(r.finalStatus).toBe("playing");
    expect(r.finalMoney).toBeGreaterThan(0);
  });
});

describe("simulateBatch", () => {
  it("returns aggregate stats across deterministic seeded runs", () => {
    const batch = simulateBatch({
      config: { startingMoney: 5000, goal: { type: "sandbox" } },
      runs: 4,
      startSeed: 100,
      maxTurns: 12,
    });
    expect(batch.runs).toBe(4);
    expect(batch.reports).toHaveLength(4);
    expect(batch.winRate + batch.lossRate + batch.unfinishedRate).toBeCloseTo(1, 5);
    expect(batch.medianFinalMoney).toBe(
      [...batch.reports]
        .sort((a, b) => a.finalMoney - b.finalMoney)
        [Math.floor(4 / 2)].finalMoney,
    );
  });

  it("a deadline scenario the greedy baseline cannot meet shows a high loss rate", () => {
    // 12-turn deadline, $1M target — the baseline policy can't possibly hit
    // this. Every run should lose; this pins the deadline-loss path end-to-end.
    const batch = simulateBatch({
      config: {
        startingMoney: 1000,
        goal: { type: "net_worth", target: 1_000_000, deadlineTurns: 12 },
      },
      runs: 5,
      startSeed: 200,
      maxTurns: 14,
    });
    expect(batch.lossRate).toBeGreaterThanOrEqual(0.8);
  });
});
