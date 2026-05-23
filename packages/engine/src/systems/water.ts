import type { GameState, Notification } from "../state.js";
import { tileCoords, tileIndex } from "../entities/world.js";
import { recoverNutrients } from "./soil.js";

export function waterSystem(state: GameState): {
  state: GameState;
  notifications: Notification[];
} {
  const { world, weather, buildings } = state;
  const newTiles = [...world.tiles];

  // Base evaporation rate per monthly turn. Tuned so 3 turns of clear
  // weather drains roughly the same as a full old-game season did (28 days
  // × 0.02). PR M will play-test and adjust.
  let evapRate = 0.18;
  if (state.season === "summer") evapRate = 0.36;
  if (weather.wind > 15) evapRate += 0.09;
  if (weather.condition === "drought") evapRate = 0.55;

  // Rainfall over the month adds moisture. Weather.rainfall is now the
  // month's averaged intensity, so the multiplier doesn't need scaling.
  const rainAdd = weather.rainfall * 0.3;

  // Collect water pump positions for irrigation
  const pumpPositions: { x: number; y: number }[] = [];
  for (const b of buildings) {
    if (b.type === "water_pump" && b.active) {
      const coords = tileCoords(b.tileIndex, world.width);
      pumpPositions.push(coords);
    }
  }

  // Collect irrigation ditch positions
  const ditchSet = new Set<number>();
  for (const b of buildings) {
    if (b.type === "irrigation_ditch" && b.active) {
      ditchSet.add(b.tileIndex);
    }
  }

  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const idx = tileIndex(x, y, world.width);
      const tile = newTiles[idx];

      // Water tiles always at 1.0
      if (tile.terrain === "water") continue;

      let moisture = tile.moisture;

      // Evaporation
      moisture -= evapRate;

      // Rainfall
      moisture += rainAdd;

      // Proximity to water tiles (natural seepage)
      // (Already factored into initial moisture; skip per-tick for performance)

      // Water pump effect: maintain high moisture in radius 5
      for (const pump of pumpPositions) {
        const dist = Math.abs(x - pump.x) + Math.abs(y - pump.y);
        if (dist <= 5) {
          const pumpBoost = (1 - dist / 6) * 0.3;
          moisture += pumpBoost;
        }
      }

      // Irrigation ditch: propagate moisture from pump along the ditch network
      if (ditchSet.has(idx)) {
        // Ditches connected to pump radius get a moisture boost
        for (const pump of pumpPositions) {
          const dist = Math.abs(x - pump.x) + Math.abs(y - pump.y);
          if (dist <= 10) {
            moisture += 0.15;
            break;
          }
        }
        // Ditch tiles share moisture with adjacent non-ditch tiles
        moisture = Math.max(moisture, 0.5);
      }

      // Adjacent to irrigation ditch gets small boost
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= world.width || ny < 0 || ny >= world.height) continue;
        const nIdx = tileIndex(nx, ny, world.width);
        if (ditchSet.has(nIdx)) {
          moisture += 0.05;
          break;
        }
      }

      newTiles[idx] = {
        ...tile,
        moisture: Math.max(0, Math.min(1, moisture)),
        nutrients: recoverNutrients(tile),
      };
    }
  }

  // Update field moisture from their tile averages
  const newFields = state.fields.map((field) => {
    let sum = 0;
    for (const idx of field.tileIndices) {
      sum += newTiles[idx].moisture;
    }
    return { ...field, moisture: sum / field.tileIndices.length };
  });

  return {
    state: {
      ...state,
      world: { ...world, tiles: newTiles },
      fields: newFields,
    },
    notifications: [],
  };
}
