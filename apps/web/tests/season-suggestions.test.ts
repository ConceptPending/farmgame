import { describe, it, expect } from "vitest";
import {
  summariseSeasonForSuggestions,
  deriveSeasonSuggestions,
} from "../lib/season-suggestions";
import type { Cause } from "@farmgame/engine";

describe("season suggestions", () => {
  const PRICES = { wheat: 15, lettuce: 10 };

  function growthDelayedDrought(growthBarLost: number): Cause {
    return {
      kind: "growth_delayed",
      fieldId: 1,
      cropId: "wheat",
      totalMultiplier: 0.5,
      fromTemperature: 0,
      fromMoisture: 1,
      fromHealth: 0,
      growthBarLost,
    };
  }

  it("fires the drought suggestion when growth-lost-to-moisture > 0.3", () => {
    const causes: Cause[] = [
      growthDelayedDrought(0.2),
      growthDelayedDrought(0.2), // total 0.4 > 0.3 threshold
    ];
    const totals = summariseSeasonForSuggestions(causes, PRICES);
    const suggestions = deriveSeasonSuggestions(totals);
    expect(suggestions.find((s) => s.id === "drought-water-pump")).toBeDefined();
  });

  it("does NOT fire drought when threshold is barely missed", () => {
    const causes: Cause[] = [growthDelayedDrought(0.25)];
    const totals = summariseSeasonForSuggestions(causes, PRICES);
    const suggestions = deriveSeasonSuggestions(totals);
    expect(suggestions.find((s) => s.id === "drought-water-pump")).toBeUndefined();
  });

  it("fires weed + pest suggestions independently when each threshold is crossed", () => {
    const causes: Cause[] = [
      { kind: "weed_pressure", fieldId: 1, weeds: 0.7, healthLost: 0.5 },
      { kind: "pest_pressure", fieldId: 1, pests: 0.7, healthLost: 0.5 },
    ];
    const totals = summariseSeasonForSuggestions(causes, PRICES);
    const suggestions = deriveSeasonSuggestions(totals);
    expect(suggestions.find((s) => s.id === "weeds-spray")).toBeDefined();
    expect(suggestions.find((s) => s.id === "pests-spray")).toBeDefined();
  });

  it("fires animal-starve suggestion on ≥1 starvation", () => {
    const causes: Cause[] = [
      { kind: "animal_starved", species: "chicken", name: "Cluck" },
    ];
    const totals = summariseSeasonForSuggestions(causes, PRICES);
    const suggestions = deriveSeasonSuggestions(totals);
    expect(suggestions.find((s) => s.id === "feed-shortage")).toBeDefined();
  });

  it("fires expense-ratio suggestion when expenses > 50% of harvest revenue", () => {
    const causes: Cause[] = [
      {
        kind: "harvest_complete",
        fieldId: 1,
        cropId: "wheat",
        quantity: 20, // 20 * $15 = $300 revenue
        baseQuantity: 30,
        reductions: { health: 0, weeds: 0, nutrients: 0 },
        limitingNutrient: null,
      },
      { kind: "seasonal_expense", landTax: 100, upkeep: 80, interest: 20, total: 200 },
    ];
    const totals = summariseSeasonForSuggestions(causes, PRICES);
    const suggestions = deriveSeasonSuggestions(totals);
    expect(suggestions.find((s) => s.id === "expense-ratio")).toBeDefined();
  });

  it("fires no-revenue suggestion when expenses > $200 and revenue = 0", () => {
    const causes: Cause[] = [
      { kind: "seasonal_expense", landTax: 160, upkeep: 60, interest: 0, total: 220 },
    ];
    const totals = summariseSeasonForSuggestions(causes, PRICES);
    const suggestions = deriveSeasonSuggestions(totals);
    expect(suggestions.find((s) => s.id === "expense-no-revenue")).toBeDefined();
  });

  it("stays quiet when no thresholds are crossed (a healthy season)", () => {
    const causes: Cause[] = [
      {
        kind: "harvest_complete",
        fieldId: 1,
        cropId: "wheat",
        quantity: 40,
        baseQuantity: 40,
        reductions: { health: 0, weeds: 0, nutrients: 0 },
        limitingNutrient: null,
      },
      { kind: "seasonal_expense", landTax: 100, upkeep: 50, interest: 0, total: 150 },
    ];
    const totals = summariseSeasonForSuggestions(causes, PRICES);
    expect(deriveSeasonSuggestions(totals)).toEqual([]);
  });
});
