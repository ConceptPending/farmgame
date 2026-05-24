import { describe, it, expect } from "vitest";
import { simulateBatch, expansionPolicy } from "../src/index.js";

/**
 * Balance pins for the long-scenario Hard tuning landed in PR T. Each
 * scenario opted into a per-scenario `expenseMultiplierOverride` (1.15 vs
 * the global 1.3) and a `startingMoneyOverride` ($800 or $1000 vs global
 * $300) on Hard only, after a sweep showed the multiplier × duration
 * compounded into a bankruptcy trap.
 *
 * Pins catch a regression where someone reverts the overrides or future
 * tuning shifts Hard's identity globally. They use the smarter
 * expansionPolicy baseline because these scenarios all expect the player
 * to buy plots / equipment to win — greedy isn't a meaningful floor here.
 *
 * Pins are intentionally wide. Goal isn't to catch 5% drift; it's to
 * catch "Hard reverted to 60% bankruptcy" or "Hard accidentally won by
 * doing nothing."
 */

const RIVAL_AGGR_HARD = 0.75;
const RIVALS = (n: number, focusGoods: string[][] = [["wheat","corn"],["tomato","peppers"],["soybeans","potatoes"]]) =>
  Array.from({ length: n }, (_, i) => ({
    name: `R${i + 1}`,
    aggressiveness: RIVAL_AGGR_HARD,
    startingPlots: 2,
    focusGoods: focusGoods[i % focusGoods.length],
  }));

const RUNS = 25;

describe("Long-scenario Hard overrides (PR T)", () => {
  // Hard's overrides for each long scenario: { mult, money } pulled from
  // apps/web/lib/scenarios.ts. Keep in sync if those change.
  const HARD = { mult: 1.15, money: 800 };
  const HARD_HEAVY = { mult: 1.15, money: 1000 };

  it("Prosperity Hard: median NW stays well above zero (no slow bleed)", () => {
    const b = simulateBatch({
      config: {
        startingMoney: HARD.money,
        expenseMultiplier: HARD.mult,
        goal: { type: "net_worth", target: 50000 },
      },
      runs: RUNS, startSeed: 1, maxTurns: 60, policy: expansionPolicy,
    });
    // Pre-PR-T this was $194 (basically broke). Post-tune should be > $2K.
    expect(b.medianFinalNetWorth).toBeGreaterThan(2000);
    expect(b.bankruptcyRate).toBeLessThanOrEqual(0.1);
  });

  it("Land Baron Hard: median NW recovers (was barely positive)", () => {
    const b = simulateBatch({
      config: {
        startingMoney: HARD.money,
        expenseMultiplier: HARD.mult,
        goal: { type: "land_baron", plots: 18 },
        rivals: RIVALS(2),
      },
      runs: RUNS, startSeed: 1, maxTurns: 48, policy: expansionPolicy,
    });
    expect(b.medianFinalNetWorth).toBeGreaterThan(1500);
    expect(b.bankruptcyRate).toBeLessThanOrEqual(0.1);
  });

  it("Tycoon Rush Hard: median NW positive (was negative)", () => {
    const b = simulateBatch({
      config: {
        startingMoney: HARD_HEAVY.money,
        expenseMultiplier: HARD_HEAVY.mult,
        goal: { type: "tycoon_race", target: 50000 },
        rivals: RIVALS(3),
      },
      runs: RUNS, startSeed: 1, maxTurns: 48, policy: expansionPolicy,
    });
    expect(b.medianFinalNetWorth).toBeGreaterThan(1000);
    expect(b.bankruptcyRate).toBeLessThanOrEqual(0.1);
  });

  it("Quick Challenge Hard: bankruptcy under 25% (was 47%)", () => {
    const b = simulateBatch({
      config: {
        startingMoney: HARD.money,
        expenseMultiplier: HARD.mult,
        goal: { type: "net_worth", target: 18750, deadlineTurns: 24 },
      },
      runs: RUNS, startSeed: 1, maxTurns: 26, policy: expansionPolicy,
    });
    expect(b.bankruptcyRate).toBeLessThanOrEqual(0.25);
  });

  it("Race the Clock Hard: bankruptcy under 25% (was 60%)", () => {
    const b = simulateBatch({
      config: {
        startingMoney: HARD_HEAVY.money,
        expenseMultiplier: HARD_HEAVY.mult,
        goal: { type: "tycoon_race", target: 50000, deadlineTurns: 36 },
        rivals: RIVALS(3),
      },
      runs: RUNS, startSeed: 1, maxTurns: 38, policy: expansionPolicy,
    });
    expect(b.bankruptcyRate).toBeLessThanOrEqual(0.25);
  });
});
