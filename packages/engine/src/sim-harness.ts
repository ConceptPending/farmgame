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
  type CreateGameOptions,
  type GameCommand,
  type GameState,
} from "./index.js";
import { CROP_CATALOG } from "./data/crops.js";
import type { CropId } from "./entities/crop.js";
import type { Cause } from "./entities/cause.js";
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

/**
 * A deliberately-simple baseline policy: claim everything you can, plant a
 * seasonally-valid crop, harvest when ready, sell, repeat. Useful as the
 * "is this scenario even completable" sanity check.
 */
export const greedyWheatPolicy: Policy = (state) => {
  const commands: GameCommand[] = [];

  // 1. Designate any unfielded owned dirt as one big field per call. (Future
  //    versions could chunk by plot for more realistic play.)
  const fallow = ownedDirtNotInField(state);
  if (fallow.length > 0) {
    // Cap each designation at ~16 tiles so a single command doesn't drain
    // the labor budget for the month; remainder gets picked up next turn.
    commands.push({ type: "DESIGNATE_FIELD", tileIndices: fallow.slice(0, 16) });
  }

  // 2. Plow + plant every fallow/plowed field.
  const plantable = pickPlantableCrop(state);
  for (const f of state.fields) {
    if (f.state === "fallow") {
      commands.push({ type: "PLOW_FIELD", fieldId: f.id });
    }
    if (f.state === "plowed" && plantable) {
      commands.push({ type: "PLANT_FIELD", fieldId: f.id, cropId: plantable });
    }
  }

  // 3. Harvest anything ready.
  for (const f of state.fields) {
    if (f.state === "ready") commands.push({ type: "HARVEST_FIELD", fieldId: f.id });
  }

  // 4. Sell everything in the inventory.
  for (const [id, qty] of Object.entries(state.inventory)) {
    if (qty > 0) commands.push({ type: "SELL", cropId: id as CropId, quantity: qty });
  }

  return commands;
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
