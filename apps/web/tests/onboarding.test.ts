import { describe, it, expect } from "vitest";
import {
  createGameState,
  applyCommand,
  createField,
  type GameState,
  type GameCommand,
} from "@farmgame/engine";
import { currentOnboardingStep } from "../lib/onboarding";

/**
 * Walks a fresh game forward one player action at a time and asserts the
 * coach advances through every step in the documented order. Catches both
 * order regressions ("we now teach plow before designate") and predicate
 * regressions ("plow no longer counts because state.fields[0].state changed").
 */
function step(state: GameState, cmd: GameCommand): GameState {
  const res = applyCommand(state, cmd);
  if (!res.success) throw new Error(`command failed: ${JSON.stringify(cmd)} — ${res.error}`);
  return res.state;
}

describe("onboarding step derivation", () => {
  it("starts on designate for a fresh game (player already owns 2 plots)", () => {
    const s = createGameState({ seed: 1, startingMoney: 5000 });
    expect(currentOnboardingStep(s)).toBe("designate");
  });

  it("advances designate → plow → plant → labor → wait as the player acts", () => {
    let s = createGameState({ seed: 1, startingMoney: 5000 });

    // Pick four owned, workable tiles to mark as a field.
    const ownedTiles = s.world.tiles
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => t.owned && t.terrain !== "water" && t.terrain !== "rock")
      .slice(0, 4)
      .map(({ i }) => i);
    expect(ownedTiles.length).toBeGreaterThan(0);
    s = step(s, { type: "DESIGNATE_FIELD", tileIndices: ownedTiles });
    expect(currentOnboardingStep(s)).toBe("plow");

    const fieldId = s.fields[0].id;
    s = step(s, { type: "PLOW_FIELD", fieldId });
    expect(currentOnboardingStep(s)).toBe("plant");

    s = step(s, { type: "PLANT_FIELD", fieldId, cropId: "wheat" });
    // Planted + labor spent this month → the "mind your labor" step fires
    // before "wait" so the player is told about the budget they just touched.
    expect(currentOnboardingStep(s)).toBe("labor");

    // After ending the turn, labor refreshes to 0 → step advances to "wait".
    s = step(s, { type: "END_TURN" });
    expect(currentOnboardingStep(s)).toBe("wait");
  });

  it("returns harvest when a field is ready, sell when inventory non-empty, done after a sale", () => {
    // Hand-craft tail-of-loop states so we don't need to simulate a full
    // season of ticks.
    const base = createGameState({ seed: 2, startingMoney: 5000 });
    const fld = createField(1, [0]);

    const readyState: GameState = {
      ...base,
      fields: [{ ...fld, state: "ready", cropId: "wheat", growth: 1 }],
    };
    expect(currentOnboardingStep(readyState)).toBe("harvest");

    const harvestedState: GameState = {
      ...readyState,
      fields: [{ ...fld, state: "fallow" }],
      inventory: { wheat: 4 },
    };
    expect(currentOnboardingStep(harvestedState)).toBe("sell");

    const soldState: GameState = {
      ...harvestedState,
      inventory: {},
      seasonSales: { wheat: 4 },
    };
    expect(currentOnboardingStep(soldState)).toBe("done");
  });

  it("stays on done once the player has sold, even with a fresh field cycle", () => {
    // Critical: the coach must not regress to earlier beats. A graduated
    // player who designates a second field shouldn't get yanked back to step 1.
    const base = createGameState({ seed: 3, startingMoney: 5000 });
    const soldThenNewField: GameState = {
      ...base,
      seasonSales: { wheat: 4 },
      fields: [createField(1, [0])], // brand-new fallow field
      inventory: {},
    };
    expect(currentOnboardingStep(soldThenNewField)).toBe("done");
  });
});
