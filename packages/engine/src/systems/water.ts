import type { GameState, Notification } from "../state.js";
import { tileCoords, tileIndex } from "../entities/world.js";
import { recoverNutrients } from "./soil.js";

export function waterSystem(state: GameState): {
  state: GameState;
  notifications: Notification[];
} {
  const { world, weather, buildings } = state;
  const newTiles = [...world.tiles];

  // Base evaporation rate per monthly turn. Initial PR L values were
  // tuned for round-trip equivalence with the old per-day system; PR V
  // playtest showed they made drought a near-constant pressure (≈1 crop
  // cycle of growth lost per season). Numbers below are ~25% gentler.
  let evapRate = 0.135;
  if (state.season === "summer") evapRate = 0.27;
  if (weather.wind > 15) evapRate += 0.07;
  if (weather.condition === "drought") evapRate = 0.41;

  // Rainfall over the month adds moisture. Bumped from 0.3 → 0.55 in PR V
  // alongside the evap reductions and the initial-moisture lift; pre-fix,
  // a rain turn in spring added 0.12 vs the 0.135 evap of that same turn,
  // so fields could never net-recover moisture without a storm.
  const rainAdd = weather.rainfall * 0.55;

  // Collect moisture sources — pumps and windmills both push water out, with
  // their own radii and ditch-network reach. A windmill is a strict upgrade
  // over a pump: ~2.6× the area for ~2.7× the price ($800 vs $300).
  interface MoistureSource {
    x: number;
    y: number;
    radius: number;
    boost: number;
    ditchReach: number;
  }
  const sources: MoistureSource[] = [];
  for (const b of buildings) {
    if (!b.active) continue;
    if (b.type === "water_pump") {
      const c = tileCoords(b.tileIndex, world.width);
      sources.push({ x: c.x, y: c.y, radius: 5, boost: 0.3, ditchReach: 10 });
    } else if (b.type === "windmill") {
      const c = tileCoords(b.tileIndex, world.width);
      sources.push({ x: c.x, y: c.y, radius: 8, boost: 0.35, ditchReach: 18 });
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

      // Moisture-source effect: each pump/windmill within radius pushes
      // a falloff boost. Multiple sources can stack on the same tile.
      for (const src of sources) {
        const dist = Math.abs(x - src.x) + Math.abs(y - src.y);
        if (dist <= src.radius) {
          moisture += (1 - dist / (src.radius + 1)) * src.boost;
        }
      }

      // Irrigation ditch: propagate moisture from any source along the ditch
      // network. Windmills extend the reach much further than pumps do.
      if (ditchSet.has(idx)) {
        for (const src of sources) {
          const dist = Math.abs(x - src.x) + Math.abs(y - src.y);
          if (dist <= src.ditchReach) {
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
