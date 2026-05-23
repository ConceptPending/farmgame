import { describe, it, expect } from "vitest";
import { simulateBatch } from "../src/index.js";

/**
 * Balance pins for First Harvest, tuned in PR Q against the headless greedy
 * baseline policy. Each run is 30 seeds. The bounds are intentionally wide:
 * we want to catch a tuning regression that drops the win rate by 30+%,
 * not a 5% drift.
 *
 * Source of truth for the tuning numbers — if the scenario's `buildGoal` or
 * `startingMoneyOverride` change, these tests must change with them.
 */

const RUNS = 30;
const MAX_TURNS = 14; // 12-turn deadline + 2 turns of headroom

interface FirstHarvestConfig {
  startingMoney: number;
  expenseMultiplier: number;
  target: number;
}

function runBatch(c: FirstHarvestConfig) {
  return simulateBatch({
    config: {
      startingMoney: c.startingMoney,
      expenseMultiplier: c.expenseMultiplier,
      goal: { type: "net_worth", target: c.target, deadlineTurns: 12 },
    },
    runs: RUNS,
    startSeed: 1,
    maxTurns: MAX_TURNS,
  });
}

describe("First Harvest (PR Q tuning)", () => {
  it("Easy: greedy baseline wins ≥80% — tutorial completion is near-guaranteed", () => {
    // Easy: startingMoney 1500, expenseMultiplier 0.7, target 1600 (=2000*0.8)
    const batch = runBatch({ startingMoney: 1500, expenseMultiplier: 0.7, target: 1600 });
    expect(batch.winRate).toBeGreaterThanOrEqual(0.8);
    expect(batch.bankruptcyRate).toBeLessThanOrEqual(0.05);
  });

  it("Normal: greedy baseline wins 20-50% — humans target 50-60%", () => {
    // Normal: startingMoney 750, expenseMultiplier 1.0, target 2000 (=2000*1.0)
    const batch = runBatch({ startingMoney: 750, expenseMultiplier: 1.0, target: 2000 });
    expect(batch.winRate).toBeGreaterThanOrEqual(0.2);
    expect(batch.winRate).toBeLessThanOrEqual(0.5);
    expect(batch.bankruptcyRate).toBeLessThanOrEqual(0.1);
  });

  it("Hard: greedy baseline wins 5-30% — punishing but completable", () => {
    // Hard: startingMoney 800, expenseMultiplier 1.3, target 2500 (=2000*1.25)
    const batch = runBatch({ startingMoney: 800, expenseMultiplier: 1.3, target: 2500 });
    expect(batch.winRate).toBeGreaterThanOrEqual(0.05);
    expect(batch.winRate).toBeLessThanOrEqual(0.3);
    // Critical regression: a tutorial-adjacent scenario should not be a
    // bankruptcy trap even at the highest difficulty.
    expect(batch.bankruptcyRate).toBeLessThanOrEqual(0.15);
  });

  it("loss mode on Hard is deadline-driven, not bankruptcy-driven", () => {
    const batch = runBatch({ startingMoney: 800, expenseMultiplier: 1.3, target: 2500 });
    // Most losses should be from the deadline, not from going broke.
    // bankruptcy / loss ratio < 30%.
    if (batch.lossRate > 0) {
      expect(batch.bankruptcyRate / batch.lossRate).toBeLessThan(0.3);
    }
  });
});
