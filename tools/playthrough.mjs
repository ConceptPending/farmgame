// Playtest autopilot: drives the REAL browser game to completion with a
// competent AI, printing a season-by-season trace and saving a screenshot
// filmstrip. Surfaces polish/UX issues across a full playthrough.
//
// Usage: dev server on :3003, engine built, then:
//   node tools/playthrough.mjs
import puppeteer from "puppeteer-core";
import {
  CROP_CATALOG, ALL_CROP_IDS, getGoodInfo, ANIMAL_CATALOG,
  EQUIPMENT_CATALOG, workableTiles, cultivatedTiles,
  avgNutrients, nutrientYieldFactor, computeNetWorth,
} from "../packages/engine/dist/index.js";

const isFeed = (id) => { const c = CROP_CATALOG[id]?.category; return c === "grain" || c === "forage"; };
// Stay lean: with market depth capping income and overhead scaling with land,
// a small market-matched farm beats sprawl. ~8 fields matches a plow+tractor.
const fieldTarget = () => 8;

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = "/tmp/farmshots";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CONFIG = { seed: 7, startingMoney: 500, goal: { type: "net_worth", target: 30000 },
  expenseMultiplier: 1, rivals: [
    { name: "Hollow Creek Farm", aggressiveness: 0.6, startingPlots: 2, focusGoods: ["wheat", "corn"] },
    { name: "Golden Acres", aggressiveness: 0.6, startingPlots: 2, focusGoods: ["tomato", "peppers"] },
  ] };

const profit = (c) => { const d = CROP_CATALOG[c]; return (28 / d.growthTicks) * (d.baseYield * d.basePrice - d.seedCost); };
const ranked = [...ALL_CROP_IDS].sort((a, b) => profit(b) - profit(a));

function ownedEmptyDirt(s) {
  const out = [];
  for (let i = 0; i < s.world.tiles.length; i++) {
    const t = s.world.tiles[i];
    if (t.owned && t.terrain === "dirt" && t.fieldId === null && t.buildingId === null) out.push(i);
  }
  return out;
}

// Decide one in-game day of commands from the current state.
function makeStrategy() {
  let cropIdx = 0;
  return function decide(s) {
    const cmds = [];
    // feed bookkeeping: keep a buffer of grain/forage to feed the herd
    const feedNeed = s.animals.reduce((sum, a) => sum + ANIMAL_CATALOG[a.type].feedPerSeason, 0);
    const feedStock = Object.entries(s.inventory).reduce((sum, [id, q]) => sum + (isFeed(id) ? q : 0), 0);
    const feedReserve = feedNeed * 2;

    // harvest ready fields
    for (const f of s.fields) if (f.state === "ready") cmds.push({ type: "HARVEST_FIELD", fieldId: f.id });
    // sell goods at a decent price — but reserve feed for the herd
    for (const [good, qty] of Object.entries(s.inventory)) {
      if (qty <= 0) continue;
      const base = getGoodInfo(good)?.basePrice;
      if (!base || (s.market.prices[good] ?? base) < base * 0.5) continue;
      let sellable = qty;
      if (isFeed(good) && feedNeed > 0) sellable = Math.max(0, qty - Math.max(0, feedReserve - (feedStock - qty)));
      if (sellable > 0) cmds.push({ type: "SELL", cropId: good, quantity: Math.min(sellable, 15) });
    }
    // spray
    for (const f of s.fields) {
      if (f.state !== "growing" && f.state !== "planted") continue;
      if (f.pests > 0.55) cmds.push({ type: "SPRAY", fieldId: f.id, sprayType: "pesticide" });
      else if (f.weeds > 0.55) cmds.push({ type: "SPRAY", fieldId: f.id, sprayType: "herbicide" });
      else if (f.health < 0.55) cmds.push({ type: "SPRAY", fieldId: f.id, sprayType: "fertilizer" });
    }
    // spread manure on the field that needs it most
    if (s.manure > 8 && s.fields.length > 0) {
      const target = s.fields[0];
      cmds.push({ type: "SPREAD_MANURE", fieldId: target.id });
    }
    // plow / clear / plant (rotating; skip crops a field can't support)
    let money = s.money;
    for (const f of s.fields) {
      if (f.state === "fallow") cmds.push({ type: "PLOW_FIELD", fieldId: f.id });
      else if (f.state === "dead") cmds.push({ type: "REMOVE_FIELD", fieldId: f.id });
      else if (f.state === "plowed") {
        const avg = avgNutrients(s.world.tiles, f.tileIndices);
        for (let k = 0; k < ranked.length; k++) {
          const c = ranked[(cropIdx + k) % ranked.length];
          const def = CROP_CATALOG[c];
          if (!def.plantSeasons.includes(s.season)) continue;
          if (money < def.seedCost * f.tileIndices.length) continue;
          if (nutrientYieldFactor(avg, def.needs) < 0.55) continue;
          cmds.push({ type: "PLANT_FIELD", fieldId: f.id, cropId: c });
          money -= def.seedCost * f.tileIndices.length;
          cropIdx++;
          break;
        }
      }
    }
    // mechanize when cultivation-capped
    if (cultivatedTiles(s.fields) + 12 > workableTiles(s.equipment)) {
      const have = (t) => s.equipment.filter((e) => e.type === t).length;
      const next = have("plow") === 0 ? "plow" : have("tractor") === 0 ? "tractor" : have("combine") === 0 ? "combine" : null;
      if (next && money >= EQUIPMENT_CATALOG[next].cost * 1.5) cmds.push({ type: "BUY_EQUIPMENT", equipmentType: next });
    }
    // livestock once established — only grow the herd when feed covers it,
    // so animals don't starve (and their manure feeds the soil).
    const barns = s.buildings.filter((b) => b.type === "barn").length;
    if (barns === 0 && money > 4000) {
      const spot = ownedEmptyDirt(s).slice(-1)[0];
      if (spot !== undefined) cmds.push({ type: "BUILD", buildingType: "barn", tileIndex: spot });
    } else if (barns > 0 && s.animals.length < 4 && money > 2000 && feedStock >= feedNeed + 8) {
      // A modest herd alongside lean crop-farming (the strongest play): exercises
      // livestock + the manure loop while keeping the run a representative win.
      cmds.push({ type: "BUY_ANIMAL", animalType: "chicken" });
    }
    // designate new fields from spare land, up to what equipment can work
    const free = ownedEmptyDirt(s);
    const target = fieldTarget();
    if (s.fields.length < target && free.length >= 12) {
      cmds.push({ type: "DESIGNATE_FIELD", tileIndices: free.slice(0, 12) });
    }
    // expand land when we want more fields but have no room for one
    if (s.fields.length < target && free.length < 12 && money > 2000) {
      const pr = s.world.width / s.world.plotSize;
      for (let py = 0; py < pr; py++) for (let px = 0; px < pr; px++) cmds.push({ type: "BUY_PLOT", plotX: px, plotY: py });
    }
    return cmds;
  };
}

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--window-size=1440,900"],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto("http://localhost:3003/", { waitUntil: "networkidle2" });
await page.waitForFunction("!!window.farmStore", { timeout: 15000 });
await page.evaluate((cfg) => window.farmStore.getState().startGame(cfg), CONFIG);
await page.waitForSelector("canvas", { timeout: 15000 });
await sleep(3500);

const decide = makeStrategy();
const readState = () => page.evaluate(() => window.farmStore.getState().state);
const dispatchAll = (cmds) => page.evaluate((cs) => { const d = window.farmStore.getState().dispatch; for (const c of cs) d(c); }, cmds);
const advance = () => page.evaluate(() => window.farmStore.getState().advanceToEvent(60));

let shot = 0;
let lastYear = 0, lastSeason = "";
let final = null;
for (let cycle = 0; cycle < 400; cycle++) {
  const s = await readState();
  if (!s || s.status !== "playing") { final = s; break; }
  const nw = computeNetWorth(s);

  // season-change trace + screenshot
  if (s.year !== lastYear || s.season !== lastSeason) {
    lastYear = s.year; lastSeason = s.season;
    const inv = Object.entries(s.inventory).filter(([, q]) => q > 0).map(([g, q]) => `${g}:${q}`).join(",") || "-";
    console.log(
      `Y${s.year} ${s.season.padEnd(6)} d${s.day}  nw=$${nw}  cash=$${s.money}  plots=${s.world.plotOwnership.filter(Boolean).length}` +
      `  fields=${s.fields.length}  equip=${s.equipment.length}  animals=${s.animals.length}  manure=${s.manure}  inv=[${inv}]`,
    );
    await page.screenshot({ path: `${OUT}/play-${String(shot).padStart(2, "0")}-y${s.year}${s.season}.png` });
    shot++;
  }

  await dispatchAll(decide(s));
  await advance();
  await sleep(120);
}

if (final) {
  console.log(`\nRESULT: ${final.status.toUpperCase()} on Y${final.year} ${final.season} d${final.day}, net worth $${computeNetWorth(final)}`);
  await page.screenshot({ path: `${OUT}/play-${String(shot).padStart(2, "0")}-${final.status}.png` });
} else {
  console.log("\nRESULT: did not finish within cycle cap");
}
console.log("PAGE ERRORS:", errs.length, errs.slice(0, 5));
await browser.close();
