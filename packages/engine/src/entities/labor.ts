/**
 * Per-turn labor system. Each command that does physical farm work charges
 * labor against the player's monthly budget. Commands that are purely paper /
 * money / metadata charge 0. This file is the single source of truth for the
 * cost rules; both the command-handler gate and the UI badges read from
 * `laborCost(...)`.
 *
 * Costs come in two shapes:
 *
 * - **Flat** — one number, regardless of field size (BUILD, BUY_PLOT, …).
 *   These actions either don't target a field or have a natural unit (one
 *   building, one plot).
 * - **Per-tile** — actions that scale with the field's tile count. The
 *   formula is `max(1, ceil(tiles / chunk))`, so a 4-tile field is cheap and
 *   a 64-tile field is genuinely expensive. Heavy crop verbs (plow / plant /
 *   harvest / manure) bill at chunk=4; lighter verbs (spray / remove /
 *   designate) bill at chunk=8.
 *
 * Hard cap semantics: if `labor.used + cost(cmd) > labor.capacity`, the
 * command-handler rejects the command up front (the action button in the UI
 * also greys out when it can't be afforded). Labor resets to `used = 0` at
 * the end of every turn (see `nextTurn` in tick.ts) and capacity is
 * recomputed from BASE_LABOR_CAPACITY + equipment bonuses at the same time.
 */

import type { GameCommand } from "../commands.js";
import type { GameState } from "../state.js";

/** Heavy crop work — 1 labor per 4 tiles. */
const HEAVY_TILE_CHUNK = 4;
/** Light field work — 1 labor per 8 tiles. */
const LIGHT_TILE_CHUNK = 8;

/** Cost given a per-tile chunk size. DESIGNATE_FIELD carries its own tile list
 *  so it works without state; field-targeting commands look up the field's
 *  tile count and fall back to 1 if state isn't available. */
function perTileCost(cmd: GameCommand, state: GameState | undefined, chunk: number): number {
  if (cmd.type === "DESIGNATE_FIELD") {
    return Math.max(1, Math.ceil(cmd.tileIndices.length / chunk));
  }
  if (!state) return 1;
  if (
    cmd.type === "PLOW_FIELD" ||
    cmd.type === "PLANT_FIELD" ||
    cmd.type === "HARVEST_FIELD" ||
    cmd.type === "SPRAY" ||
    cmd.type === "SPREAD_MANURE" ||
    cmd.type === "REMOVE_FIELD"
  ) {
    const field = state.fields.find((f) => f.id === cmd.fieldId);
    if (!field) return 1;
    return Math.max(1, Math.ceil(field.tileIndices.length / chunk));
  }
  return 1;
}

/**
 * Labor a command costs in the player's monthly budget. When the command
 * targets a field, pass the current state so the per-tile scale can read the
 * field's tile count — UI palettes that don't yet know which field the player
 * will click can call with no state and get a representative minimum.
 */
export function laborCost(command: GameCommand, state?: GameState): number {
  switch (command.type) {
    // Heavy crop work — 1 labor per 4 tiles, min 1.
    case "PLOW_FIELD":
    case "PLANT_FIELD":
    case "HARVEST_FIELD":
    case "SPREAD_MANURE":
      return perTileCost(command, state, HEAVY_TILE_CHUNK);

    // Light field work — 1 labor per 8 tiles, min 1.
    case "SPRAY":
    case "REMOVE_FIELD":
    case "DESIGNATE_FIELD":
      return perTileCost(command, state, LIGHT_TILE_CHUNK);

    // Construction — flat per action.
    case "BUILD":
      return 3;
    case "DEMOLISH":
      return 2;
    case "REPAIR_FENCES":
      return 2;

    // Land clearing — one plot = one purchase action.
    case "BUY_PLOT":
      return 3;

    // Money / paperwork / metadata: zero labor by design.
    case "SELL":
    case "BUY_ANIMAL":
    case "SELL_ANIMAL":
    case "RENAME_ANIMAL":
    case "BUY_EQUIPMENT":
    case "SELL_EQUIPMENT":
    case "TAKE_LOAN":
    case "REPAY_LOAN":
    case "END_TURN":
      return 0;
  }
}

/** Whether the command's cost fits in the remaining monthly labor budget. */
export function canAfford(
  laborUsed: number,
  laborCapacity: number,
  command: GameCommand,
  state?: GameState,
): boolean {
  return laborUsed + laborCost(command, state) <= laborCapacity;
}

/**
 * Lower-bound cost for UI palette badges that don't know which field the
 * player will click. Returns the minimum any field of any size could cost —
 * i.e. the per-tile floor for field-targeting commands and the flat cost for
 * everything else.
 */
export function minLaborCost(command: GameCommand): number {
  // For per-tile commands, state-less laborCost already returns the floor (1).
  return laborCost(command);
}
