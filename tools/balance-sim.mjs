// Economy balance simulation. A reasonable crop-farming "player" strategy used
// to measure pacing — solo (net-worth thresholds) and competitive (Tycoon Rush
// win-rate vs rivals, per difficulty).
//
// Usage: build the engine first, then run from the repo root:
//   pnpm --filter @farmgame/engine build && node tools/balance-sim.mjs
import {
  createGameState, nextTick, applyCommand, computeNetWorth, standings,
  CROP_CATALOG, ALL_CROP_IDS,
  EQUIPMENT_CATALOG, workableTiles, cultivatedTiles,
} from "../packages/engine/dist/index.js";

const MAX_DAYS = 2000;
const SELL_PER_DAY = 15;
const TARGET_FIELDS = 8;
const CHUNK = 12;
const seeds = [1, 2, 3, 4, 5];

function ownedEmptyDirt(state) {
  const out = [];
  const t = state.world.tiles;
  for (let i = 0; i < t.length; i++) {
    if (t[i].owned && t[i].terrain === "dirt" && t[i].fieldId === null && t[i].buildingId === null) out.push(i);
  }
  return out;
}

const ranked = [...ALL_CROP_IDS].sort((a, b) => {
  const p = (c) => (28 / CROP_CATALOG[c].growthTicks) * (CROP_CATALOG[c].baseYield * CROP_CATALOG[c].basePrice - CROP_CATALOG[c].seedCost);
  return p(b) - p(a);
});

/** A stateful "competent player": one in-game day of decisions. Returns the
 *  post-command state (caller advances the tick). */
function makePlayer() {
  let cropIdx = 0;
  return function step(state) {
    let s = state;
    const apply = (cmd) => { const r = applyCommand(s, cmd); if (r.success) s = r.state; return r; };

    for (const f of s.fields.filter((f) => f.state === "ready")) apply({ type: "HARVEST_FIELD", fieldId: f.id });

    for (const [good, qty] of Object.entries(s.inventory)) {
      if (qty <= 0) continue;
      const base = CROP_CATALOG[good]?.basePrice;
      if (!base || (s.market.prices[good] ?? base) < base * 0.5) continue;
      apply({ type: "SELL", cropId: good, quantity: Math.min(qty, SELL_PER_DAY) });
    }

    for (const f of s.fields) {
      if (f.state !== "growing" && f.state !== "planted") continue;
      if (f.pests > 0.55) apply({ type: "SPRAY", fieldId: f.id, sprayType: "pesticide" });
      else if (f.weeds > 0.55) apply({ type: "SPRAY", fieldId: f.id, sprayType: "herbicide" });
      else if (f.health < 0.55) apply({ type: "SPRAY", fieldId: f.id, sprayType: "fertilizer" });
    }

    for (const f of s.fields) {
      if (f.state === "fallow") apply({ type: "PLOW_FIELD", fieldId: f.id });
      else if (f.state === "dead") apply({ type: "REMOVE_FIELD", fieldId: f.id });
      else if (f.state === "plowed") {
        for (let k = 0; k < ranked.length; k++) {
          const c = ranked[(cropIdx + k) % ranked.length];
          const def = CROP_CATALOG[c];
          if (!def.plantSeasons.includes(s.season)) continue;
          if (s.money < def.seedCost * f.tileIndices.length) continue;
          if (apply({ type: "PLANT_FIELD", fieldId: f.id, cropId: c }).success) { cropIdx++; break; }
        }
      }
    }

    if (cultivatedTiles(s.fields) + CHUNK > workableTiles(s.equipment)) {
      const have = (t) => s.equipment.filter((e) => e.type === t).length;
      const next = have("plow") === 0 ? "plow" : have("tractor") === 0 ? "tractor" : have("combine") === 0 ? "combine" : null;
      if (next && s.money >= EQUIPMENT_CATALOG[next].cost * 1.5) apply({ type: "BUY_EQUIPMENT", equipmentType: next });
    }

    if (s.fields.length < TARGET_FIELDS) {
      const tiles = ownedEmptyDirt(s);
      if (tiles.length >= CHUNK) apply({ type: "DESIGNATE_FIELD", tileIndices: tiles.slice(0, CHUNK) });
    }

    if (s.money > 2500 && ownedEmptyDirt(s).length < CHUNK * 2) {
      const pr = s.world.width / s.world.plotSize;
      for (let py = 0; py < pr && s.money > 2500; py++)
        for (let px = 0; px < pr; px++) apply({ type: "BUY_PLOT", plotX: px, plotY: py });
    }
    return s;
  };
}

// ---- Solo pacing (net-worth thresholds) ----
const THRESHOLDS = [25000, 50000, 100000];
function runSolo(seed) {
  let state = createGameState({ seed, goal: { type: "sandbox" }, startingMoney: 500 });
  const player = makePlayer();
  const crossed = {};
  for (let day = 0; day < MAX_DAYS; day++) {
    const nw = computeNetWorth(state);
    for (const t of THRESHOLDS) if (crossed[t] === undefined && nw >= t) crossed[t] = day;
    if (crossed[THRESHOLDS[THRESHOLDS.length - 1]] !== undefined) break;
    state = nextTick(player(state)).state;
  }
  return crossed;
}

// ---- Competitive (Tycoon Rush) ----
const DIFF = {
  easy: { cash: 1000, exp: 0.7, scale: 0.8, aggr: 0.45 },
  normal: { cash: 500, exp: 1.0, scale: 1.0, aggr: 0.6 },
  hard: { cash: 300, exp: 1.3, scale: 1.25, aggr: 0.75 },
};
const RIVAL_FOCUS = [["wheat", "corn"], ["tomato", "peppers"], ["soybeans", "potatoes"]];
function makeRivals(count, aggr) {
  return Array.from({ length: count }, (_, i) => ({
    name: `R${i + 1}`, aggressiveness: aggr, startingPlots: 2, focusGoods: RIVAL_FOCUS[i % RIVAL_FOCUS.length],
  }));
}
function runTycoon(seed, diff) {
  const d = DIFF[diff];
  const target = Math.round(40000 * d.scale);
  let state = createGameState({
    seed, startingMoney: d.cash, expenseMultiplier: d.exp,
    goal: { type: "tycoon_race", target }, rivals: makeRivals(3, d.aggr),
  });
  const player = makePlayer();
  let day = 0;
  for (; day < MAX_DAYS; day++) {
    if (state.status !== "playing") break;
    state = nextTick(player(state)).state;
  }
  const table = standings(state);
  const topRival = Math.max(...state.rivals.map((r) => r.netWorth));
  return { status: state.status, day, target, playerNW: computeNetWorth(state), topRival, rank: table.findIndex((t) => t.isHuman) + 1 };
}

console.log("=== Solo pacing (sandbox) ===");
const fmtDay = (d) => (d === undefined ? "  — " : `${(d / 112).toFixed(1)}y`);
const solo = seeds.map(runSolo);
for (const t of THRESHOLDS) {
  const ds = solo.map((c) => c[t]).filter((d) => d !== undefined);
  const avg = ds.length ? Math.round(ds.reduce((a, b) => a + b, 0) / ds.length) : undefined;
  console.log(`  $${t / 1000}k: avg ${fmtDay(avg)}`);
}

console.log("\n=== Tycoon Rush (player vs 3 rivals) ===");
for (const diff of ["easy", "normal", "hard"]) {
  const rs = seeds.map((s) => runTycoon(s, diff));
  const wins = rs.filter((r) => r.status === "won").length;
  const losses = rs.filter((r) => r.status === "lost").length;
  const avgDay = Math.round(rs.reduce((a, r) => a + r.day, 0) / rs.length);
  // when the player wins, how close was the top rival (% of target)?
  const closeness = rs.filter((r) => r.status === "won").map((r) => Math.round((r.topRival / r.target) * 100));
  const avgClose = closeness.length ? Math.round(closeness.reduce((a, b) => a + b, 0) / closeness.length) : 0;
  console.log(`  ${diff.padEnd(6)} target $${rs[0].target}: won ${wins}/5, lost ${losses}/5, avg ${(avgDay / 112).toFixed(1)}y, top rival at ${avgClose}% of target when you win`);
}
