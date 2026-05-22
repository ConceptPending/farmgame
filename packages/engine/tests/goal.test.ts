import { describe, it, expect } from "vitest";
import {
  createGameState,
  nextTick,
  goalProgress,
  computeSeasonalExpenses,
  LOAN_LIMIT,
} from "../src/index.js";

describe("goal evaluation", () => {
  it("net_worth wins at target", () => {
    const s = createGameState({ seed: 1, goal: { type: "net_worth", target: 1 } });
    expect(nextTick(s).state.status).toBe("won");
  });

  it("goalNetWorth option is an alias for a net_worth goal", () => {
    const s = createGameState({ seed: 1, goalNetWorth: 1 });
    expect(s.goal).toEqual({ type: "net_worth", target: 1 });
    expect(nextTick(s).state.status).toBe("won");
  });

  it("land_baron wins once enough plots are owned", () => {
    // the player starts owning 2 plots
    const won = createGameState({ seed: 1, goal: { type: "land_baron", plots: 2 } });
    expect(nextTick(won).state.status).toBe("won");
    const notYet = createGameState({ seed: 1, goal: { type: "land_baron", plots: 3 } });
    expect(nextTick(notYet).state.status).toBe("playing");
  });

  it("sandbox never auto-wins", () => {
    const s = createGameState({ seed: 1, startingMoney: 1_000_000_000, goal: { type: "sandbox" } });
    expect(nextTick(s).state.status).toBe("playing");
  });

  it("bankruptcy loses regardless of goal", () => {
    const s = { ...createGameState({ seed: 1, goal: { type: "sandbox" } }), money: -(LOAN_LIMIT + 10000), loan: 0 };
    expect(nextTick(s).state.status).toBe("lost");
  });
});

describe("goalProgress", () => {
  it("reports the right shape per goal type", () => {
    const nw = goalProgress(createGameState({ seed: 1 })); // default net_worth $40k
    expect(nw.label).toBe("Net worth");
    expect(nw.target).toBe(40000);

    const lb = goalProgress(createGameState({ seed: 1, goal: { type: "land_baron", plots: 10 } }));
    expect(lb.label).toBe("Plots owned");
    expect(lb.current).toBe(2);
    expect(lb.target).toBe(10);
  });
});

describe("difficulty", () => {
  it("expenseMultiplier scales seasonal expenses", () => {
    const normal = computeSeasonalExpenses(createGameState({ seed: 1 }));
    const hard = computeSeasonalExpenses(createGameState({ seed: 1, expenseMultiplier: 2 }));
    expect(hard.total).toBe(normal.total * 2); // no loan → interest 0, clean doubling
  });
});
