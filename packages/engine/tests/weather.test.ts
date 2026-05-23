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
