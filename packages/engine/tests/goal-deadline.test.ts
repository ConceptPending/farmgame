import { describe, it, expect } from "vitest";
import { createGameState, evaluateGoal, nextTurn, type GameState } from "../src/index.js";

describe("deadline_turns goal modifier", () => {
  function gameWithDeadline(deadline: number, target: number, startingMoney = 1000): GameState {
    const base = createGameState({
      seed: 1,
      startingMoney,
      goal: { type: "net_worth", target, deadlineTurns: deadline },
    });
    return base;
  }

  it("returns playing while inside the deadline", () => {
    const s = gameWithDeadline(12, 999_999_999);
    expect(evaluateGoal(s).status).toBe("playing");
  });

  it("returns lost when tick passes the deadline without the win condition", () => {
    let s = gameWithDeadline(2, 999_999_999, 5000);
    for (let i = 0; i < 3; i++) s = nextTurn(s).state;
    expect(s.status).toBe("lost");
  });

  it("returns won as soon as the underlying goal is hit, even within the deadline", () => {
    const s = gameWithDeadline(12, 1, 5000);
    expect(evaluateGoal(s).status).toBe("won");
  });

  it("sandbox is never deadlined (the type has no deadlineTurns field)", () => {
    const s = createGameState({ seed: 1, startingMoney: 100, goal: { type: "sandbox" } });
    for (let i = 0; i < 50; i++) {
      const r = nextTurn(s);
      // Sandbox + non-bankrupt → always playing, regardless of how long we run.
      if (r.state.money < 0) break;
      expect(r.state.status).toBe("playing");
    }
  });
});
