/**
 * Headless simulation harness. Runs a fresh game with a `Policy` function
 * deciding the player's commands each turn, collects per-turn snapshots,
 * and returns a `RunReport`. Lets balance work stop being vibes — kick off
 * 100 runs of a scenario and read out win rate, median money, yield-loss
 * breakdown, etc.
 *
 * The default `greedyWheatPolicy` is intentionally simple: designate every
 * owned-dirt block, plow + plant wheat (and clover off-season), harvest
 * when ready, sell everything. It's not optimal play — it's a *baseline*
 * the player should be able to beat. If the default policy bankrupts
 * itself on Normal, the scenario is too hard.
 *
 * Policies are pure (state) → commands, so they're trivially swappable
 * (e.g. a "manure-rotation" policy for testing the legume-loop hypothesis).
 */

import {
  applyCommand,
  createGameState,
  EQUIPMENT_CATALOG,
  laborCost,
  type CreateGameOptions,
  type GameCommand,
  type GameState,
  type EquipmentType,
} from "./index.js";
import { CROP_CATALOG } from "./data/crops.js";
import type { CropId } from "./entities/crop.js";
import type { Cause } from "./entities/cause.js";
import { rivalOwning } from "./entities/rival.js";
import { takeSnapshot, aggregateRun, type RunReport, type TurnSnapshot } from "./telemetry.js";

/** A turn-by-turn decision function. Returns commands to dispatch this turn,
 *  *not* including the closing END_TURN — the harness adds that. */
export type Policy = (state: GameState) => GameCommand[];

export interface SimulateOptions {
  /** Engine config — seed, starting money, goal, rivals, etc. */
  config: CreateGameOptions;
  /** Player policy. Defaults to `greedyWheatPolicy`. */
  policy?: Policy;
  /** Hard cap on turns simulated. Default: 48 (4 years). */
  maxTurns?: number;
  /** Scenario id for the report header. Cosmetic. */
  scenarioId?: string;
}

export function simulateGame(opts: SimulateOptions): RunReport {
  const { config, policy = greedyWheatPolicy, maxTurns = 48, scenarioId } = opts;
  let state = createGameState(config);
  const snapshots: TurnSnapshot[] = [];

  for (let i = 0; i < maxTurns; i++) {
    if (state.status !== "playing") break;

    // Causes from every command this turn — accumulated so the snapshot's
    // outcome counters (harvests, animal births, etc.) reflect work the
    // *commands* did, not just what END_TURN's tick pipeline produced.
    const turnCauses: Cause[] = [];

    // We run the policy twice per turn so a policy that issues HARVEST and
    // SELL in the same call sees the post-harvest inventory before its SELL
    // loop fires. Without this, the first pass's SELL reads stale (often
    // empty) inventory and the just-harvested produce sits unsold for a
    // turn. Most pass-2 commands are no-ops (already plowed / planted) —
    // they fail-silent and that's fine.
    for (let pass = 0; pass < 2; pass++) {
      const commands = policy(state);
      for (const cmd of commands) {
        const r = applyCommand(state, cmd);
        if (r.success) {
          state = r.state;
          if (r.causes) turnCauses.push(...r.causes);
        }
      }
    }

    // Close the turn.
    const endResult = applyCommand(state, { type: "END_TURN" });
    if (endResult.success) {
      state = endResult.state;
      if (endResult.causes) turnCauses.push(...endResult.causes);
      snapshots.push(takeSnapshot(state, turnCauses));
    } else {
      break;
    }
  }

  return aggregateRun({ snapshots, seed: config.seed, scenarioId });
}

/* ----------------------------------------------------------------------- */
/* Default policy: greedy wheat.                                           */
/* ----------------------------------------------------------------------- */

function ownedDirtNotInField(state: GameState): number[] {
  return state.world.tiles
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.owned && t.terrain === "dirt" && t.fieldId === null && t.buildingId === null)
    .map(({ i }) => i);
}

function pickPlantableCrop(state: GameState): CropId | null {
  // Prefer wheat in spring/fall, lettuce in early scenarios for quick cash,
  // clover otherwise (it always grows somewhere). Lettuce loses to wheat
  // long-term but doesn't make this policy outright fail in winter.
  if (CROP_CATALOG.wheat.plantSeasons.includes(state.season)) return "wheat";
  if (CROP_CATALOG.lettuce.plantSeasons.includes(state.season)) return "lettuce";
  if (CROP_CATALOG.clover.plantSeasons.includes(state.season)) return "clover";
  return null;
}

/* ----------------------------------------------------------------------- */
/* Shared sub-policies — used by greedy and expansion baselines.           */
/* ----------------------------------------------------------------------- */

/** Designate up to 16 owned-dirt tiles into a new field. Returns 0-1 commands. */
function farmingDesignateCommands(state: GameState): GameCommand[] {
  const fallow = ownedDirtNotInField(state);
  if (fallow.length === 0) return [];
  return [{ type: "DESIGNATE_FIELD", tileIndices: fallow.slice(0, 16) }];
}

/** Plow + plant + harvest commands for the current field set. */
function farmingFieldCommands(state: GameState): GameCommand[] {
  const commands: GameCommand[] = [];
  const plantable = pickPlantableCrop(state);
  for (const f of state.fields) {
    if (f.state === "fallow") commands.push({ type: "PLOW_FIELD", fieldId: f.id });
    if (f.state === "plowed" && plantable) {
      commands.push({ type: "PLANT_FIELD", fieldId: f.id, cropId: plantable });
    }
  }
  for (const f of state.fields) {
    if (f.state === "ready") commands.push({ type: "HARVEST_FIELD", fieldId: f.id });
  }
  return commands;
}

/** Sell anything in inventory. */
function farmingSellCommands(state: GameState): GameCommand[] {
  const commands: GameCommand[] = [];
  for (const [id, qty] of Object.entries(state.inventory)) {
    if (qty > 0) commands.push({ type: "SELL", cropId: id as CropId, quantity: qty });
  }
  return commands;
}

/**
 * A deliberately-simple baseline policy: claim everything you can, plant a
 * seasonally-valid crop, harvest when ready, sell, repeat. Useful as the
 * "is this scenario even completable without buying a thing" sanity check.
 *
 * Companion: `expansionPolicy` adds plot/equipment purchases on top of this
 * same loop, for scenarios where expansion is part of the intended path.
 */
export const greedyWheatPolicy: Policy = (state) => {
  return [
    ...farmingDesignateCommands(state),
    ...farmingFieldCommands(state),
    ...farmingSellCommands(state),
  ];
};

/* ----------------------------------------------------------------------- */
/* expansionPolicy — greedy + buys plots and equipment when affordable.   */
/* ----------------------------------------------------------------------- */

/** Cheapest unowned plot adjacent to land the player already owns. Returns
 *  the (plotX, plotY) of one candidate, or null if no buyable adjacent plot
 *  exists. Cost-tied ties broken by plot index (deterministic). */
function pickCheapestAdjacentPlot(state: GameState): { plotX: number; plotY: number; cost: number } | null {
  const W = state.world.width;
  const PS = state.world.plotSize;
  const plotsPerRow = W / PS;
  const owned = state.world.plotOwnership;

  const isOwned = (px: number, py: number) =>
    px >= 0 && px < plotsPerRow && py >= 0 && py < plotsPerRow && owned[py * plotsPerRow + px];

  let best: { plotX: number; plotY: number; cost: number } | null = null;
  for (let py = 0; py < plotsPerRow; py++) {
    for (let px = 0; px < plotsPerRow; px++) {
      const idx = py * plotsPerRow + px;
      if (owned[idx]) continue;
      // Don't try to buy plots a rival owns — BUY_PLOT will reject them.
      if (rivalOwning(state.rivals, idx)) continue;
      // Must be adjacent to something owned.
      const adjacent =
        isOwned(px - 1, py) || isOwned(px + 1, py) || isOwned(px, py - 1) || isOwned(px, py + 1);
      if (!adjacent) continue;

      // Cost mirrors handleBuyPlot: 200 + avgSoil*300, rounded.
      let soilSum = 0;
      const startX = px * PS;
      const startY = py * PS;
      for (let dy = 0; dy < PS; dy++) {
        for (let dx = 0; dx < PS; dx++) {
          soilSum += state.world.tiles[(startY + dy) * W + (startX + dx)].soilQuality;
        }
      }
      const cost = Math.round(200 + (soilSum / (PS * PS)) * 300);
      if (best === null || cost < best.cost) best = { plotX: px, plotY: py, cost };
    }
  }
  return best;
}

/** Cheapest piece of equipment the player doesn't already own. */
function pickCheapestEquipment(state: GameState): EquipmentType | null {
  const owned = new Set(state.equipment.map((e) => e.type));
  let best: { type: EquipmentType; cost: number } | null = null;
  for (const [type, def] of Object.entries(EQUIPMENT_CATALOG)) {
    const t = type as EquipmentType;
    if (owned.has(t)) continue;
    if (best === null || def.cost < best.cost) best = { type: t, cost: def.cost };
  }
  return best?.type ?? null;
}

/**
 * Greedy + expansion: same farming loop, plus *one* expansion per turn —
 * equipment first (it raises both the workable-tile cap and the labor
 * budget), then an adjacent plot once the tile cap can actually absorb the
 * new land.
 *
 * Affordability gate: spend only when `money − cost ≥ CASH_FLOOR`. The flat
 * cash floor matters more than a multiplier — it guarantees the bot has at
 * least one season's worth of operating expenses on hand after the buy, so
 * the next seasonal-expense charge doesn't bankrupt it on the same turn.
 *
 * Plot guard: don't buy a new plot if there's still un-farmed land we
 * already own (workable-tile cap already saturated). Adding 64 unfarmable
 * tiles just adds upkeep without revenue.
 */
export const expansionPolicy: Policy = (state) => {
  const expansion: GameCommand[] = [];
  const CASH_FLOOR = 600; // one season of expenses for a mid-sized farm

  // Pick the cheapest unowned equipment that we can buy without dropping
  // below the safety floor.
  const equipment = pickCheapestEquipment(state);
  if (equipment) {
    const cost = EQUIPMENT_CATALOG[equipment].cost;
    const labor = laborCost({ type: "BUY_EQUIPMENT", equipmentType: equipment }, state);
    if (
      state.money - cost >= CASH_FLOOR &&
      state.labor.used + labor <= state.labor.capacity
    ) {
      expansion.push({ type: "BUY_EQUIPMENT", equipmentType: equipment });
    }
  }

  // Only buy land when the tile-cap can hold more cultivation. (Counting
  // already-cultivated tiles cheaply: any field that's past fallow.)
  const cultivated = state.fields
    .filter((f) => f.state !== "fallow")
    .reduce((sum, f) => sum + f.tileIndices.length, 0);
  const workableCap =
    24 /* BASE_WORKABLE_TILES */ +
    state.equipment.reduce((sum, e) => sum + EQUIPMENT_CATALOG[e.type].workableTiles, 0);
  const haveHeadroom = cultivated < workableCap - 8; // at least one more 8-tile field's worth

  if (haveHeadroom && expansion.length === 0) {
    const plot = pickCheapestAdjacentPlot(state);
    if (plot) {
      const labor = laborCost({ type: "BUY_PLOT", plotX: plot.plotX, plotY: plot.plotY }, state);
      if (
        state.money - plot.cost >= CASH_FLOOR &&
        state.labor.used + labor <= state.labor.capacity
      ) {
        expansion.push({ type: "BUY_PLOT", plotX: plot.plotX, plotY: plot.plotY });
      }
    }
  }

  return [
    ...expansion,
    ...farmingDesignateCommands(state),
    ...farmingFieldCommands(state),
    ...farmingSellCommands(state),
  ];
};

/* ----------------------------------------------------------------------- */
/* Batch runner — N seeds per config, aggregated stats.                    */
/* ----------------------------------------------------------------------- */

export interface BatchReport {
  scenarioId: string | undefined;
  runs: number;
  winRate: number;
  lossRate: number;
  unfinishedRate: number;
  medianFinalNetWorth: number;
  medianFinalMoney: number;
  bankruptcyRate: number;
  averageLaborUtilisation: number;
  reports: RunReport[];
}

export interface BatchOptions {
  config: Omit<CreateGameOptions, "seed">;
  policy?: Policy;
  maxTurns?: number;
  scenarioId?: string;
  /** Number of seeded runs. */
  runs: number;
  /** First seed; subsequent runs use seed+1, seed+2, ... for reproducibility. */
  startSeed?: number;
}

export function simulateBatch(opts: BatchOptions): BatchReport {
  const { runs, startSeed = 1, ...rest } = opts;
  const reports: RunReport[] = [];
  for (let i = 0; i < runs; i++) {
    reports.push(
      simulateGame({
        ...rest,
        config: { ...rest.config, seed: startSeed + i },
      }),
    );
  }

  const wins = reports.filter((r) => r.finalStatus === "won").length;
  const losses = reports.filter((r) => r.finalStatus === "lost").length;
  const unfinished = reports.length - wins - losses;
  const bankruptcies = reports.filter((r) => r.finalStatus === "lost" && r.finalMoney < 0).length;
  const sortedNw = [...reports].sort((a, b) => a.finalNetWorth - b.finalNetWorth);
  const sortedMoney = [...reports].sort((a, b) => a.finalMoney - b.finalMoney);

  return {
    scenarioId: opts.scenarioId,
    runs,
    winRate: runs === 0 ? 0 : wins / runs,
    lossRate: runs === 0 ? 0 : losses / runs,
    unfinishedRate: runs === 0 ? 0 : unfinished / runs,
    medianFinalNetWorth: sortedNw[Math.floor(sortedNw.length / 2)]?.finalNetWorth ?? 0,
    medianFinalMoney: sortedMoney[Math.floor(sortedMoney.length / 2)]?.finalMoney ?? 0,
    bankruptcyRate: runs === 0 ? 0 : bankruptcies / runs,
    averageLaborUtilisation:
      runs === 0 ? 0 : reports.reduce((s, r) => s + r.laborUtilisation, 0) / runs,
    reports,
  };
}
