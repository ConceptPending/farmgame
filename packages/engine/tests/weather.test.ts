import { describe, it, expect } from "vitest";
import { createGameState, nextTurn, MONTHS_PER_SEASON } from "../src/index.js";

describe("weather system", () => {
  it("generates weather each tick", () => {
    const state = createGameState({ seed: 42 });
    const result = nextTurn(state);
    expect(result.state.weather.temperature).toBeGreaterThan(0);
    expect(["clear", "cloudy", "rain", "storm", "frost", "drought"]).toContain(
      result.state.weather.condition,
    );
  });

  it("generates a 2-month rolling forecast", () => {
    const state = createGameState({ seed: 42 });
    const result = nextTurn(state);
    expect(result.state.weather.forecast.length).toBe(2);
    for (const month of result.state.weather.forecast) {
      expect(month.tempHigh).toBeGreaterThanOrEqual(month.tempLow);
      expect(month.rainfall).toBeGreaterThanOrEqual(0);
    }
  });

  it("the forecast is predictive: forecast[0] becomes next turn's weather", () => {
    // Across many turns and seeds, the head of the forecast queue must match
    // the condition that actually arrives, and the temperature must land in
    // the forecast range. This is the regression test for the old behavior
    // where the forecast was redrawn every turn with no link to reality.
    for (const seed of [1, 42, 777]) {
      let state = createGameState({ seed });
      for (let i = 0; i < 24; i++) {
        const predicted = state.weather.forecast[0];
        state = nextTurn(state).state;
        expect(state.weather.condition).toBe(predicted.condition);
        expect(state.weather.temperature).toBeGreaterThanOrEqual(predicted.tempLow);
        expect(state.weather.temperature).toBeLessThanOrEqual(predicted.tempHigh);
      }
    }
  });

  it("forecast entries use the upcoming month's season profile", () => {
    // Run to late fall (year 1, fall month 3): the 2-ahead forecast entry
    // covers winter month 2. Winter frost odds are 0.4 vs fall's 0.1, so over
    // many seeds the tail entries drawn at fall/winter boundaries must show
    // frost at roughly winter rates — impossible under the old code, which
    // always used the current season's profile.
    let frosty = 0;
    let total = 0;
    for (let seed = 0; seed < 60; seed++) {
      let state = createGameState({ seed });
      // Advance to fall month 3 (8 turns from spring month 1: each turn
      // advances the month first, so turn 8 lands on fall m3).
      for (let i = 0; i < 8; i++) state = nextTurn(state).state;
      expect(state.season).toBe("fall");
      expect(state.monthOfSeason).toBe(3);
      // forecast[1] covers winter month 2.
      total++;
      if (state.weather.forecast[1].condition === "frost") frosty++;
    }
    // Winter profile: 40% frost. Fall profile: 10%. With 60 samples, observing
    // a frost share over 20% cleanly separates the two.
    expect(frosty / total).toBeGreaterThan(0.2);
  });

  it("spring temperatures are in reasonable range", () => {
    let state = createGameState({ seed: 42 });
    expect(state.season).toBe("spring");
    const temps: number[] = [];
    for (let i = 0; i < MONTHS_PER_SEASON; i++) {
      state = nextTurn(state).state;
      temps.push(state.weather.temperature);
    }
    // Spring profile: 50-75F, but season transition tick may use summer profile
    expect(Math.min(...temps)).toBeGreaterThanOrEqual(15);
    expect(Math.max(...temps)).toBeLessThanOrEqual(105);
  });

  it("summer temperatures are higher than winter", () => {
    let state = createGameState({ seed: 42 });
    // Advance to summer
    for (let i = 0; i < MONTHS_PER_SEASON; i++) {
      state = nextTurn(state).state;
    }
    expect(state.season).toBe("summer");
    const summerTemps: number[] = [];
    for (let i = 0; i < MONTHS_PER_SEASON; i++) {
      state = nextTurn(state).state;
      summerTemps.push(state.weather.temperature);
    }
    // Advance to winter
    for (let i = 0; i < MONTHS_PER_SEASON; i++) {
      state = nextTurn(state).state;
    }
    expect(state.season).toBe("winter");
    const winterTemps: number[] = [];
    for (let i = 0; i < MONTHS_PER_SEASON; i++) {
      state = nextTurn(state).state;
      winterTemps.push(state.weather.temperature);
    }

    const avgSummer = summerTemps.reduce((a, b) => a + b, 0) / summerTemps.length;
    const avgWinter = winterTemps.reduce((a, b) => a + b, 0) / winterTemps.length;
    expect(avgSummer).toBeGreaterThan(avgWinter);
  });

  it("frost can occur in winter", () => {
    let state = createGameState({ seed: 42 });
    // Advance to winter
    for (let i = 0; i < MONTHS_PER_SEASON * 3; i++) {
      state = nextTurn(state).state;
    }
    expect(state.season).toBe("winter");

    let hasFrost = false;
    for (let i = 0; i < MONTHS_PER_SEASON; i++) {
      state = nextTurn(state).state;
      if (state.weather.condition === "frost") hasFrost = true;
    }
    // Frost is 40% chance in winter - should happen at least once in 28 days
    expect(hasFrost).toBe(true);
  });

  it("rainfall is zero for clear and drought conditions", () => {
    let state = createGameState({ seed: 42 });
    for (let i = 0; i < 100; i++) {
      state = nextTurn(state).state;
      if (state.weather.condition === "clear" || state.weather.condition === "drought") {
        expect(state.weather.rainfall).toBe(0);
      }
    }
  });

  it("rain/storm conditions produce positive rainfall", () => {
    let state = createGameState({ seed: 42 });
    for (let i = 0; i < 100; i++) {
      state = nextTurn(state).state;
      if (state.weather.condition === "rain" || state.weather.condition === "storm") {
        expect(state.weather.rainfall).toBeGreaterThan(0);
      }
    }
  });

  it("notifies on frost events", () => {
    let state = createGameState({ seed: 42 });
    // Find a tick that produces frost
    for (let i = 0; i < MONTHS_PER_SEASON * 4; i++) {
      const result = nextTurn(state);
      state = result.state;
      if (state.weather.condition === "frost") {
        const frostNotification = result.notifications.find((n) =>
          n.message.toLowerCase().includes("frost"),
        );
        expect(frostNotification).toBeDefined();
        return;
      }
    }
  });
});
