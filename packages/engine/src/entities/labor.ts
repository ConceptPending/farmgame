/**
 * Per-turn labor system. Each command that does physical farm work charges
 * labor against the player's monthly budget. Commands that are purely paper /
 * money / metadata charge 0. The cost table is the single source of truth.
 *
 * Hard cap semantics: if `labor.used + cost(cmd) > labor.capacity`, the
 * command-handler rejects the command up front (the action button in the UI
 * also greys out when it can't be afforded). Labor resets to `used = 0` at
 * the start of every turn (see `nextTurn` in tick.ts).
 */

import type { GameCommand } from "../commands.js";

/** Labor cost per command type. Anything not listed is treated as 0. */
const LABOR_COST_TABLE: Partial<Record<GameCommand["type"], number>> = {
  // Heavy farm work
  PLOW_FIELD: 2,
  PLANT_FIELD: 2,
  HARVEST_FIELD: 2,
  SPREAD_MANURE: 2,

  // Light field work
  DESIGNATE_FIELD: 1,
  SPRAY: 1,
  REMOVE_FIELD: 1,

  // Construction
  BUILD: 3,
  DEMOLISH: 2,
  REPAIR_FENCES: 2,

  // Land clearing — a whole 8×8 plot turned into farmland
  BUY_PLOT: 3,

  // Money / paperwork / metadata: zero labor by design
  SELL: 0,
  BUY_ANIMAL: 0,
  SELL_ANIMAL: 0,
  RENAME_ANIMAL: 0,
  BUY_EQUIPMENT: 0,
  SELL_EQUIPMENT: 0,
  TAKE_LOAN: 0,
  REPAY_LOAN: 0,
};

/** Labor a command costs. Lookup is total, not per-tile. */
export function laborCost(command: GameCommand): number {
  return LABOR_COST_TABLE[command.type] ?? 0;
}

/** Whether the command's cost fits in the remaining monthly labor budget. */
export function canAfford(
  laborUsed: number,
  laborCapacity: number,
  command: GameCommand,
): boolean {
  return laborUsed + laborCost(command) <= laborCapacity;
}
