import { describe, it, expect } from "vitest";
import {
  createGameState,
  applyCommand,
  nextTurn,
  createField,
  causeCategory,
  causeCopy,
  causePriority,
  type Cause,
  type GameState,
} from "../src/index.js";
import { cropSystem } from "../src/systems/crop.js";

function ownedDirt(state: GameState, n: number): number[] {
  return state.world.tiles
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.owned && t.terrain === "dirt" && t.fieldId === null && t.buildingId === null)
    .slice(0, n)
    .map(({ i }) => i);
}

describe("cause emission", () => {
  it("nextTurn returns a causes array on a fresh game", () => {
    const s = createGameState({ seed: 1, startingMoney: 5000 });
    const r = nextTurn(s);
    expect(Array.isArray(r.causes)).toBe(true);
  });

  it("a season-rollover turn emits season_change + seasonal_expense", () => {
    // Walk 3 turns from a fresh game → monthOfSeason rolls 1→2→3→1 (= summer).
    let s = createGameState({ seed: 1, startingMoney: 5000 });
    const allCauses: Cause[] = [];
    for (let i = 0; i < 3; i++) {
      const r = nextTurn(s);
      s = r.state;
      allCauses.push(...r.causes);
    }
    const kinds = allCauses.map((c) => c.kind);
    expect(kinds).toContain("season_change");
    expect(kinds).toContain("seasonal_expense");
  });

  it("frost on a frost-vulnerable crop emits frost_damage or frost_kill", () => {
    // Drive the cropSystem directly with hand-set weather — nextTurn's
    // weather system would otherwise re-roll conditions before crops resolve.
    const base = createGameState({ seed: 2, startingMoney: 5000 });
    const fld = {
      ...createField(1, ownedDirt(base, 4)),
      state: "growing" as const,
      cropId: "tomato" as const,
      growth: 0.5,
      health: 0.9,
    };
    const frozen: GameState = {
      ...base,
      fields: [fld],
      weather: { ...base.weather, condition: "frost", temperature: 25 },
    };
    const r = cropSystem(frozen);
    const kinds = r.causes.map((c) => c.kind);
    expect(kinds.some((k) => k === "frost_damage" || k === "frost_kill")).toBe(true);
  });

  it("HARVEST_FIELD command emits a harvest_complete cause with breakdown", () => {
    const base = createGameState({ seed: 3, startingMoney: 5000 });
    const tiles = ownedDirt(base, 4);
    const fld = {
      ...createField(1, tiles),
      state: "ready" as const,
      cropId: "wheat" as const,
      growth: 1,
      health: 1,
    };
    const s: GameState = { ...base, fields: [fld] };
    const r = applyCommand(s, { type: "HARVEST_FIELD", fieldId: 1 });
    expect(r.success).toBe(true);
    expect(r.causes).toBeDefined();
    const harvest = r.causes!.find((c) => c.kind === "harvest_complete");
    expect(harvest).toBeDefined();
    if (harvest && harvest.kind === "harvest_complete") {
      expect(harvest.fieldId).toBe(1);
      expect(harvest.cropId).toBe("wheat");
      expect(harvest.quantity).toBeGreaterThan(0);
      expect(harvest.baseQuantity).toBeGreaterThanOrEqual(harvest.quantity);
      // Reductions are fractions in [0, 1].
      expect(harvest.reductions.health).toBeGreaterThanOrEqual(0);
      expect(harvest.reductions.weeds).toBeGreaterThanOrEqual(0);
      expect(harvest.reductions.nutrients).toBeGreaterThanOrEqual(0);
    }
  });

  it("labor_unused fires when the player ends the turn without spending", () => {
    const s = createGameState({ seed: 4, startingMoney: 5000 });
    const r = nextTurn(s);
    const unused = r.causes.find((c) => c.kind === "labor_unused");
    expect(unused).toBeDefined();
    if (unused && unused.kind === "labor_unused") {
      expect(unused.unused).toBe(s.labor.capacity);
      expect(unused.capacity).toBe(s.labor.capacity);
    }
  });

  it("labor_unused does NOT fire when the player spent every unit", () => {
    let s = createGameState({ seed: 5, startingMoney: 5000 });
    // Burn the budget down to zero on light actions.
    s = { ...s, labor: { used: s.labor.capacity, capacity: s.labor.capacity } };
    const r = nextTurn(s);
    expect(r.causes.find((c) => c.kind === "labor_unused")).toBeUndefined();
  });
});

describe("crop-death timing (PR M tuning fix)", () => {
  it("a crop reaching maturity this turn harvests rather than dying", () => {
    // Hand-craft a 2-month wheat field that would have hit growth=1 this
    // turn, with health just under the death threshold from accumulated
    // damage. Before the fix the death check ran first and the crop died
    // mid-air; after the fix it gets promoted to "ready".
    const base = createGameState({ seed: 9, startingMoney: 5000 });
    const fld = {
      ...createField(1, ownedDirt(base, 4)),
      state: "growing" as const,
      cropId: "wheat" as const,
      growth: 0.95, // one tick away from ready
      growthMonths: 1,
      health: 0.18, // below the 0.2 death threshold
      // Calm weather so the growth modifier doesn't drop below 0.05.
      weeds: 0,
      pests: 0,
      moisture: 0.3,
    };
    const s: GameState = {
      ...base,
      fields: [fld],
      weather: { ...base.weather, condition: "clear", temperature: 60 },
    };
    const r = cropSystem(s);
    expect(r.state.fields[0].state).toBe("ready");
    expect(r.causes.some((c) => c.kind === "ready_to_harvest")).toBe(true);
    expect(r.causes.some((c) => c.kind === "crop_died_health")).toBe(false);
  });
});

describe("cause helpers", () => {
  it("causeCategory routes every kind to a group", () => {
    const samples: Cause[] = [
      { kind: "frost_damage", fieldId: 1, cropId: "wheat", healthLost: 0.2 },
      { kind: "harvest_complete", fieldId: 1, cropId: "wheat", quantity: 5, baseQuantity: 8, reductions: { health: 0, weeds: 0.1, nutrients: 0.2 }, limitingNutrient: "n" },
      { kind: "weeds_critical", fieldId: 1, weeds: 0.8 },
      { kind: "animal_born", species: "chicken", name: "Cluck" },
      { kind: "fence_breach", tileIndex: 0 },
      { kind: "market_event_spike", good: "wheat", pct: 0.3 },
      { kind: "seasonal_expense", landTax: 80, upkeep: 25, interest: 0, total: 105 },
      { kind: "event_subsidy", amount: 500 },
      { kind: "labor_unused", unused: 6, capacity: 12 },
    ];
    const categories = new Set(samples.map(causeCategory));
    expect(categories.size).toBe(samples.length);
  });

  it("causeCopy returns non-empty player-facing text for every kind", () => {
    const samples: Cause[] = [
      { kind: "frost_kill", fieldId: 3, cropId: "tomato" },
      { kind: "ready_to_harvest", fieldId: 1, cropId: "wheat" },
      { kind: "harvest_complete", fieldId: 1, cropId: "wheat", quantity: 5, baseQuantity: 8, reductions: { health: 0.1, weeds: 0.2, nutrients: 0.3 }, limitingNutrient: "k" },
      { kind: "rival_supply_pressure", good: "wheat", pressure: 0.12 },
      { kind: "labor_unused", unused: 4, capacity: 12 },
      { kind: "season_change", season: "summer", year: 2 },
    ];
    for (const c of samples) {
      const copy = causeCopy(c);
      expect(copy.length).toBeGreaterThan(8);
    }
  });

  it("causePriority puts kills/losses above informational events", () => {
    const kill: Cause = { kind: "frost_kill", fieldId: 1, cropId: "wheat" };
    const info: Cause = { kind: "labor_unused", unused: 1, capacity: 12 };
    expect(causePriority(kill)).toBeGreaterThan(causePriority(info));
  });
});
