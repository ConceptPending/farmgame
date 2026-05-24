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

  function harvest(opts: { weeds?: number; health?: number; nutrients?: number; limitingNutrient?: "n" | "p" | "k" | null; quantity?: number }): Cause {
    return {
      kind: "harvest_complete",
      fieldId: 1,
      cropId: "wheat",
      quantity: opts.quantity ?? 40,
      baseQuantity: 60,
      reductions: { weeds: opts.weeds ?? 0, health: opts.health ?? 0, nutrients: opts.nutrients ?? 0 },
      limitingNutrient: opts.limitingNutrient ?? null,
    };
  }

  it("fires the drought suggestion when growth-lost-to-moisture > 0.3", () => {
    const causes: Cause[] = [
      growthDelayedDrought(0.2),
      growthDelayedDrought(0.2),
    ];
    const totals = summariseSeasonForSuggestions(causes, PRICES);
    expect(deriveSeasonSuggestions(totals).find((s) => s.id === "drought-water-pump")).toBeDefined();
  });

  it("does NOT fire drought when threshold is barely missed", () => {
    const causes: Cause[] = [growthDelayedDrought(0.25)];
    const totals = summariseSeasonForSuggestions(causes, PRICES);
    expect(deriveSeasonSuggestions(totals).find((s) => s.id === "drought-water-pump")).toBeUndefined();
  });

  it("fires weeds suggestion on visible harvest reductions (PR W new metric)", () => {
    // Two harvests, each lost ~40% to weeds. Average 0.4 > 0.25 threshold.
    const causes: Cause[] = [
      harvest({ weeds: 0.4 }),
      harvest({ weeds: 0.4 }),
    ];
    const totals = summariseSeasonForSuggestions(causes, PRICES);
    const suggestion = deriveSeasonSuggestions(totals).find((s) => s.id === "weeds-spray");
    expect(suggestion).toBeDefined();
    expect(suggestion!.headline).toMatch(/40%/);
  });

  it("does NOT fire weeds when average harvest reduction is below 25%", () => {
    const causes: Cause[] = [
      harvest({ weeds: 0.15 }),
      harvest({ weeds: 0.20 }),
    ];
    const totals = summariseSeasonForSuggestions(causes, PRICES);
    expect(deriveSeasonSuggestions(totals).find((s) => s.id === "weeds-spray")).toBeUndefined();
  });

  it("fires pests suggestion on visible harvest health reductions", () => {
    // Health reduction includes pests + frost + other health damage.
    const causes: Cause[] = [
      harvest({ health: 0.25 }),
      harvest({ health: 0.25 }),
    ];
    const totals = summariseSeasonForSuggestions(causes, PRICES);
    expect(deriveSeasonSuggestions(totals).find((s) => s.id === "pests-spray")).toBeDefined();
  });

  it("fires pests suggestion on slow pest_pressure accumulation alone", () => {
    // No harvests this season, but pest-pressure caused 0.16 cumulative
    // health damage — fires on the accumulator path.
    const causes: Cause[] = [
      { kind: "pest_pressure", fieldId: 1, pests: 0.7, healthLost: 0.08 },
      { kind: "pest_pressure", fieldId: 2, pests: 0.7, healthLost: 0.08 },
    ];
    const totals = summariseSeasonForSuggestions(causes, PRICES);
    expect(deriveSeasonSuggestions(totals).find((s) => s.id === "pests-spray")).toBeDefined();
  });

  it("fires soil-rotation suggestion on nutrient-limited harvests", () => {
    const causes: Cause[] = [
      harvest({ nutrients: 0.18, limitingNutrient: "n" }),
      harvest({ nutrients: 0.22, limitingNutrient: "n" }),
    ];
    const totals = summariseSeasonForSuggestions(causes, PRICES);
    const s = deriveSeasonSuggestions(totals).find((x) => x.id === "soil-rotation");
    expect(s).toBeDefined();
    expect(s!.headline).toMatch(/nitrogen/);
  });

  it("does NOT fire nutrient suggestion below the 15% threshold", () => {
    const causes: Cause[] = [harvest({ nutrients: 0.10, limitingNutrient: "k" })];
    const totals = summariseSeasonForSuggestions(causes, PRICES);
    expect(deriveSeasonSuggestions(totals).find((s) => s.id === "soil-rotation")).toBeUndefined();
  });

  it("fires animal-starve suggestion on ≥1 starvation", () => {
    const causes: Cause[] = [
      { kind: "animal_starved", species: "chicken", name: "Cluck" },
    ];
    const totals = summariseSeasonForSuggestions(causes, PRICES);
    expect(deriveSeasonSuggestions(totals).find((s) => s.id === "feed-shortage")).toBeDefined();
  });

  it("fires expense-ratio suggestion when expenses > 50% of harvest revenue", () => {
    const causes: Cause[] = [
      harvest({ quantity: 20 }), // 20 × $15 = $300 revenue
      { kind: "seasonal_expense", landTax: 100, upkeep: 80, interest: 20, total: 200 },
    ];
    const totals = summariseSeasonForSuggestions(causes, PRICES);
    expect(deriveSeasonSuggestions(totals).find((s) => s.id === "expense-ratio")).toBeDefined();
  });

  it("fires no-revenue suggestion when expenses > $200 and revenue = 0", () => {
    const causes: Cause[] = [
      { kind: "seasonal_expense", landTax: 160, upkeep: 60, interest: 0, total: 220 },
    ];
    const totals = summariseSeasonForSuggestions(causes, PRICES);
    expect(deriveSeasonSuggestions(totals).find((s) => s.id === "expense-no-revenue")).toBeDefined();
  });

  it("stays quiet when no thresholds are crossed (a healthy season)", () => {
    const causes: Cause[] = [
      harvest({ weeds: 0.05, health: 0.05, nutrients: 0.05 }),
      { kind: "seasonal_expense", landTax: 100, upkeep: 50, interest: 0, total: 150 },
    ];
    const totals = summariseSeasonForSuggestions(causes, PRICES);
    expect(deriveSeasonSuggestions(totals)).toEqual([]);
  });
});
