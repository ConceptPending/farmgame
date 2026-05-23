/**
 * Road connectivity for field-targeting commands. A field is "road-connected"
 * if at least one of its tiles is orthogonally adjacent to a road building.
 * Road-connected fields enjoy a small per-action labor discount (see
 * `laborCost` in entities/labor.ts) — the cost of hauling tools and produce
 * is lower when there's a road right next to the field.
 *
 * Pure: given a field and the world's building list, returns a yes/no with
 * no side effects. The labor system passes state in, so this stays a simple
 * lookup.
 */

import type { GameState } from "../state.js";
import type { Field } from "./field.js";
import { tileCoords, tileIndex } from "./world.js";

/** True if any tile in `field` is orthogonally adjacent to a road tile. */
export function isFieldRoadConnected(state: GameState, field: Field): boolean {
  const roadIndices = new Set<number>();
  for (const b of state.buildings) {
    if (b.type === "road" && b.active) roadIndices.add(b.tileIndex);
  }
  if (roadIndices.size === 0) return false;
  const W = state.world.width;
  const H = state.world.height;
  for (const idx of field.tileIndices) {
    const { x, y } = tileCoords(idx, W);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      if (roadIndices.has(tileIndex(nx, ny, W))) return true;
    }
  }
  return false;
}
