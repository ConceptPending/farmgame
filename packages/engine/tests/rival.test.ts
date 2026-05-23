import { describe, it, expect } from "vitest";
import {
  createGameState,
  nextTurn,
  applyCommand,
  standings,
  rivalOwning,
  MONTHS_PER_SEASON,
} from "../src/index.js";
import type { RivalConfig } from "../src/index.js";

const rival = (over: Partial<RivalConfig> = {}): RivalConfig => ({
  name: "Rival A",
  aggressiveness: 0.8,
  startingPlots: 2,
  focusGoods: ["wheat"],
  ...over,
});

describe("rival setup", () => {
  it("claims distinct starting plots, none of them the player's", () => {
    const s = createGameState({
      seed: 5,
      rivals: [rival({ name: "A", startingPlots: 2 }), rival({ name: "B", startingPlots: 1, focusGoods: ["corn"] })],
    });
    expect(s.rivals).toHaveLength(2);
    const claimed = [...s.rivals[0].ownedPlots, ...s.rivals[1].ownedPlots];
    expect(new Set(claimed).size).toBe(claimed.length); // distinct
    const human = s.world.plotOwnership.map((o, i) => (o ? i : -1)).filter((i) => i >= 0);
    expect(claimed.some((p) => human.includes(p))).toBe(false);
  });

  it("no rivals => no rng consumption (unchanged state)", () => {
    const a = createGameState({ seed: 5 });
    const b = createGameState({ seed: 5 });
    expect(a.rng).toEqual(b.rng);
    expect(a.rivals).toHaveLength(0);
  });
});

describe("land contention", () => {
  it("rejects buying a rival-owned plot", () => {
    const s = createGameState({ seed: 5, startingMoney: 100000, rivals: [rival({ startingPlots: 1 })] });
    const plot = s.rivals[0].ownedPlots[0];
    const ppr = s.world.width / s.world.plotSize;
    const r = applyCommand(s, { type: "BUY_PLOT", plotX: plot % ppr, plotY: Math.floor(plot / ppr) });
    expect(r.success).toBe(false);
    expect(rivalOwning(s.rivals, plot)?.name).toBe("Rival A");
  });
});

describe("rival behavior over a season", () => {
  it("grows net worth and depresses its focus good's price", () => {
    let s = createGameState({ seed: 5, goal: { type: "sandbox" }, rivals: [rival({ startingPlots: 3 })] });
    const nwBefore = s.rivals[0].netWorth;
    for (let i = 0; i < MONTHS_PER_SEASON + 2; i++) s = nextTurn(s).state;
    expect(s.rivals[0].netWorth).toBeGreaterThan(nwBefore);
    // sustained pressure keeps wheat's demand (price) below the no-rival ceiling
    expect(s.market.demand.wheat).toBeLessThan(0.97);
  });
});

describe("competitive goals", () => {
  it("tycoon_race: lost when a rival reaches the target first", () => {
    const base = createGameState({ seed: 5, goal: { type: "tycoon_race", target: 10000 }, rivals: [rival()] });
    const s = { ...base, rivals: base.rivals.map((r) => ({ ...r, netWorth: 20000 })) };
    expect(nextTurn(s).state.status).toBe("lost");
  });

  it("tycoon_race: won when you reach the target", () => {
    const s = createGameState({ seed: 5, startingMoney: 50000, goal: { type: "tycoon_race", target: 1 }, rivals: [rival()] });
    expect(nextTurn(s).state.status).toBe("won");
  });

  it("market_leader: leading the good for enough seasons wins", () => {
    // rival focuses corn, so any wheat the player sells leads that market
    let s = createGameState({
      seed: 5,
      startingMoney: 5000,
      goal: { type: "market_leader", good: "wheat", seasons: 2 },
      rivals: [rival({ focusGoods: ["corn"] })],
    });
    s = { ...s, inventory: { wheat: 1000 } };
    for (let season = 0; season < 3 && s.status === "playing"; season++) {
      s = applyCommand(s, { type: "SELL", cropId: "wheat", quantity: 10 }).state;
      for (let i = 0; i < MONTHS_PER_SEASON; i++) s = nextTurn(s).state;
    }
    expect(s.status).toBe("won");
  });
});

describe("standings & determinism", () => {
  it("ranks the player among rivals", () => {
    const s = createGameState({ seed: 5, rivals: [rival({ name: "A" }), rival({ name: "B" })] });
    const table = standings(s);
    expect(table).toHaveLength(3);
    expect(table.some((t) => t.isHuman)).toBe(true);
    for (let i = 1; i < table.length; i++) expect(table[i - 1].netWorth).toBeGreaterThanOrEqual(table[i].netWorth);
  });

  it("is reproducible for a seed", () => {
    const build = () => createGameState({ seed: 9, goal: { type: "sandbox" }, rivals: [rival({ startingPlots: 2 })] });
    let a = build();
    let b = build();
    for (let i = 0; i < MONTHS_PER_SEASON * 3; i++) {
      a = nextTurn(a).state;
      b = nextTurn(b).state;
    }
    expect(a.rivals[0].netWorth).toBe(b.rivals[0].netWorth);
    expect(a.rivals[0].ownedPlots).toEqual(b.rivals[0].ownedPlots);
  });
});
