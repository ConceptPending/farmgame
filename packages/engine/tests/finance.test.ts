import { describe, it, expect } from "vitest";
import {
  createGameState,
  nextTick,
  applyCommand,
  computeNetWorth,
  computeSeasonalExpenses,
  DAYS_PER_SEASON,
  LOAN_LIMIT,
} from "../src/index.js";

function freshState(overrides: Parameters<typeof createGameState>[0] = {}) {
  return createGameState({ seed: 1, startingMoney: 1000, ...overrides });
}

describe("net worth", () => {
  it("counts cash plus inventory at market value", () => {
    const s = freshState();
    const base = computeNetWorth(s);
    const price = s.market.prices.wheat;
    const withStock = { ...s, inventory: { wheat: 10 } };
    expect(computeNetWorth(withStock) - base).toBeGreaterThanOrEqual(10 * price - 1);
  });

  it("is unchanged by borrowing (cash up, debt up)", () => {
    const s = freshState();
    const base = computeNetWorth(s);
    const after = applyCommand(s, { type: "TAKE_LOAN", amount: 1000 }).state;
    expect(after.money).toBe(s.money + 1000);
    expect(after.loan).toBe(1000);
    expect(Math.abs(computeNetWorth(after) - base)).toBeLessThanOrEqual(1);
  });
});

describe("seasonal expenses", () => {
  it("computes a positive total (at least base overhead)", () => {
    const exp = computeSeasonalExpenses(freshState());
    expect(exp.total).toBeGreaterThan(0);
    expect(exp.total).toBe(exp.landTax + exp.upkeep + exp.interest);
  });

  it("scales interest with outstanding loan", () => {
    const s = freshState();
    const before = computeSeasonalExpenses(s).interest;
    const borrowed = applyCommand(s, { type: "TAKE_LOAN", amount: 10000 }).state;
    expect(computeSeasonalExpenses(borrowed).interest).toBeGreaterThan(before);
  });

  it("charges expenses at a season boundary", () => {
    let s = freshState({ startingMoney: 100000, goalNetWorth: 1e12 });
    let fired = false;
    for (let i = 0; i < DAYS_PER_SEASON; i++) {
      const r = nextTick(s);
      s = r.state;
      if (r.notifications.some((n) => /Seasonal expenses/.test(n.message))) fired = true;
    }
    expect(s.day).toBe(1); // a new season began
    expect(fired).toBe(true);
  });
});

describe("win / lose", () => {
  it("declares victory when net worth reaches the goal", () => {
    const s = freshState({ goalNetWorth: 1 });
    const r = nextTick(s);
    expect(r.state.status).toBe("won");
    expect(r.notifications.some((n) => /win/i.test(n.message))).toBe(true);
  });

  it("stops advancing once the game is over", () => {
    const won = nextTick(freshState({ goalNetWorth: 1 })).state;
    const again = nextTick(won);
    expect(again.state).toBe(won); // early-return returns the same state
    expect(again.notifications).toHaveLength(0);
  });

  it("declares bankruptcy when debt exceeds borrowing capacity", () => {
    const s = { ...freshState(), money: -(LOAN_LIMIT + 10000), loan: 0 };
    const r = nextTick(s);
    expect(r.state.status).toBe("lost");
    expect(r.notifications.some((n) => /bankrupt/i.test(n.message))).toBe(true);
  });

  it("does not declare bankruptcy while borrowing could still cover the gap", () => {
    const s = { ...freshState(), money: -1000, loan: 0, goalNetWorth: 1e12 };
    const r = nextTick(s);
    expect(r.state.status).toBe("playing");
  });
});

describe("loan commands", () => {
  it("borrows up to the limit and rejects beyond it", () => {
    const s = freshState();
    const ok = applyCommand(s, { type: "TAKE_LOAN", amount: LOAN_LIMIT });
    expect(ok.success).toBe(true);
    expect(ok.state.loan).toBe(LOAN_LIMIT);
    const over = applyCommand(ok.state, { type: "TAKE_LOAN", amount: 1 });
    expect(over.success).toBe(false);
  });

  it("repays debt and rejects over-repayment or insufficient cash", () => {
    const borrowed = applyCommand(freshState(), { type: "TAKE_LOAN", amount: 5000 }).state;
    const repaid = applyCommand(borrowed, { type: "REPAY_LOAN", amount: 2000 });
    expect(repaid.success).toBe(true);
    expect(repaid.state.loan).toBe(3000);
    expect(repaid.state.money).toBe(borrowed.money - 2000);

    expect(applyCommand(repaid.state, { type: "REPAY_LOAN", amount: 99999 }).success).toBe(false);
    const broke = { ...repaid.state, money: 0 };
    expect(applyCommand(broke, { type: "REPAY_LOAN", amount: 1000 }).success).toBe(false);
  });
});
