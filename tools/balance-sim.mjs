// Economy balance simulation. Plays a reasonable crop-farming strategy and
// reports pacing (days to reach net-worth thresholds), income, and expenses.
//
// Usage: build the engine first, then run from the repo root:
//   pnpm --filter @farmgame/engine build && node tools/balance-sim.mjs
import {
  createGameState, nextTick, applyCommand, computeNetWorth,
  CROP_CATALOG, ALL_CROP_IDS,
} from "../packages/engine/dist/index.js";

const THRESHOLDS = [25000, 50000, 100000, 150000, 200000];
const MAX_DAYS = 1500;
const SELL_PER_DAY = 15;     // units per good per day (avoid crashing price)
const TARGET_FIELDS = 8;
const CHUNK = 12;            // tiles per designated field

function ownedEmptyDirt(state) {
  const out = [];
  const t = state.world.tiles;
  for (let i = 0; i < t.length; i++) {
    if (t[i].owned && t[i].terrain === "dirt" && t[i].fieldId === null && t[i].buildingId === null) out.push(i);
  }
  return out;
}

// crops ranked by profit/tile/season, used for planting choices
const ranked = [...ALL_CROP_IDS].sort((a, b) => {
  const pa = (28 / CROP_CATALOG[a].growthTicks) * (CROP_CATALOG[a].baseYield * CROP_CATALOG[a].basePrice - CROP_CATALOG[a].seedCost);
  const pb = (28 / CROP_CATALOG[b].growthTicks) * (CROP_CATALOG[b].baseYield * CROP_CATALOG[b].basePrice - CROP_CATALOG[b].seedCost);
  return pb - pa;
});

function run(seed) {
  let state = createGameState({ seed, goalNetWorth: THRESHOLDS[THRESHOLDS.length - 1] });
  let cropIdx = 0;
  let revenue = 0, spentSeed = 0, spentSpray = 0, spentLand = 0;
  const crossed = {}; // threshold -> day

  for (let day = 0; day < MAX_DAYS; day++) {
    const nw = computeNetWorth(state);
    for (const t of THRESHOLDS) if (crossed[t] === undefined && nw >= t) crossed[t] = day;
    if (crossed[THRESHOLDS[THRESHOLDS.length - 1]] !== undefined) return { day, crossed, state, revenue, spentSeed, spentSpray, spentLand };
    if (state.status !== "playing") return { day, crossed, state, revenue, spentSeed, spentSpray, spentLand };

    const apply = (cmd) => { const r = applyCommand(state, cmd); if (r.success) state = r.state; return r; };

    // 1. Harvest ready fields
    for (const f of state.fields.filter((f) => f.state === "ready")) apply({ type: "HARVEST_FIELD", fieldId: f.id });

    // 2. Sell a batch of each good — but hold when the market is depressed
    //    (a sensible player waits for demand to recover rather than dumping).
    for (const [good, qty] of Object.entries(state.inventory)) {
      if (qty <= 0) continue;
      const base = CROP_CATALOG[good]?.basePrice;
      if (!base) continue;
      if ((state.market.prices[good] ?? base) < base * 0.5) continue;
      const sell = Math.min(qty, SELL_PER_DAY);
      const before = state.money;
      const r = apply({ type: "SELL", cropId: good, quantity: sell });
      if (r.success) revenue += state.money - before;
    }

    // 3. Spray to keep fields healthy
    for (const f of state.fields) {
      if (f.state !== "growing" && f.state !== "planted") continue;
      const before = state.money;
      if (f.pests > 0.55) { apply({ type: "SPRAY", fieldId: f.id, sprayType: "pesticide" }); spentSpray += before - state.money; }
      else if (f.weeds > 0.55) { apply({ type: "SPRAY", fieldId: f.id, sprayType: "herbicide" }); spentSpray += before - state.money; }
      else if (f.health < 0.55) { apply({ type: "SPRAY", fieldId: f.id, sprayType: "fertilizer" }); spentSpray += before - state.money; }
    }

    // 4. Plow / plant / clear fields
    for (const f of state.fields) {
      if (f.state === "fallow") apply({ type: "PLOW_FIELD", fieldId: f.id });
      else if (f.state === "dead") apply({ type: "REMOVE_FIELD", fieldId: f.id });
      else if (f.state === "plowed") {
        // pick the best in-season crop we can afford to seed
        for (let k = 0; k < ranked.length; k++) {
          const c = ranked[(cropIdx + k) % ranked.length];
          const def = CROP_CATALOG[c];
          if (!def.plantSeasons.includes(state.season)) continue;
          if (state.money < def.seedCost * f.tileIndices.length) continue;
          const before = state.money;
          const r = apply({ type: "PLANT_FIELD", fieldId: f.id, cropId: c });
          if (r.success) { spentSeed += before - state.money; cropIdx++; break; }
        }
      }
    }

    // 5. Designate new fields from spare owned dirt
    if (state.fields.length < TARGET_FIELDS) {
      const tiles = ownedEmptyDirt(state);
      if (tiles.length >= CHUNK) apply({ type: "DESIGNATE_FIELD", tileIndices: tiles.slice(0, CHUNK) });
    }

    // 6. Expand only when running low on farmable land (avoids paying tax on
    //    idle plots — a competent player buys land they'll actually farm).
    if (state.money > 2500 && ownedEmptyDirt(state).length < CHUNK * 2) {
      const pr = state.world.width / state.world.plotSize;
      for (let py = 0; py < pr && state.money > 2500; py++) {
        for (let px = 0; px < pr; px++) {
          const before = state.money;
          const r = apply({ type: "BUY_PLOT", plotX: px, plotY: py });
          if (r.success) { spentLand += before - state.money; }
        }
      }
    }

    state = nextTick(state).state;
  }
  return { day: MAX_DAYS, crossed, state, revenue, spentSeed, spentSpray, spentLand };
}

const seeds = [1, 2, 3, 4, 5];
const results = seeds.map(run);
const fmtDay = (d) => (d === undefined ? "  —  " : `${String(d).padStart(4)}d/${(d / 112).toFixed(1)}y`);
console.log("days to reach each net-worth threshold:");
console.log("  " + THRESHOLDS.map((t) => `$${t / 1000}k`.padStart(10)).join(""));
for (const r of results) {
  console.log("  " + THRESHOLDS.map((t) => fmtDay(r.crossed[t]).padStart(10)).join(""));
}
const avgFor = (t) => {
  const ds = results.map((r) => r.crossed[t]).filter((d) => d !== undefined);
  return ds.length ? Math.round(ds.reduce((a, b) => a + b, 0) / ds.length) : undefined;
};
console.log("avg:" + THRESHOLDS.map((t) => fmtDay(avgFor(t)).padStart(10)).join(""));
const last = results[0];
console.log(`\nsample(seed1): plots=${last.state.world.plotOwnership.filter(Boolean).length} rev=$${Math.round(last.revenue)} seed=$${Math.round(last.spentSeed)} spray=$${Math.round(last.spentSpray)} land=$${Math.round(last.spentLand)}`);
