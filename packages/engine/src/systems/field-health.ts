import type { Field } from "../entities/field.js";
import { getCropDef } from "../data/crops.js";
import type { GameState, Notification } from "../state.js";
import { tileCoords } from "../entities/world.js";

export function fieldHealthSystem(state: GameState): {
  state: GameState;
  notifications: Notification[];
} {
  const notifications: Notification[] = [];
  const { weather, world } = state;

  // Pre-compute forest tile set for pest proximity
  const forestSet = new Set<string>();
  for (let i = 0; i < world.tiles.length; i++) {
    if (world.tiles[i].terrain === "forest") {
      const { x, y } = tileCoords(i, world.width);
      forestSet.add(`${x},${y}`);
    }
  }

  const fields = state.fields.map((field): Field => {
    if (field.state !== "planted" && field.state !== "growing" && field.state !== "ready") {
      return field;
    }

    let { weeds, pests, health } = field;

    // Weed growth per monthly turn. Pre-scaled from the old per-day values
    // (× ~9) so a season of three turns has roughly the same net pressure
    // as the old 28-day season. PR M will tune.
    let weedGrowth = 0.09;
    if (weather.temperature > 70) weedGrowth += 0.045;
    if (weather.rainfall > 0.2) weedGrowth += 0.045;
    if (state.season === "summer") weedGrowth += 0.045;
    weeds = Math.min(1, weeds + weedGrowth);

    // Pest growth per monthly turn. Same scaling as weeds.
    let pestGrowth = 0.07;
    if (weather.temperature > 75) pestGrowth += 0.045;
    if (state.season === "summer") pestGrowth += 0.025;

    // Check if any field tile is near forest (within 4 tiles)
    let nearForest = false;
    for (const tIdx of field.tileIndices) {
      const { x, y } = tileCoords(tIdx, world.width);
      outer: for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          if (forestSet.has(`${x + dx},${y + dy}`)) {
            nearForest = true;
            break outer;
          }
        }
      }
      if (nearForest) break;
    }
    if (nearForest) pestGrowth += 0.09;

    // Pest vulnerability from crop type
    const def = field.cropId ? getCropDef(field.cropId) : null;
    if (def) {
      pestGrowth *= (0.5 + def.pestVulnerability);
    }

    pests = Math.min(1, pests + pestGrowth);

    // Health degradation from weeds and pests, per monthly turn.
    if (weeds > 0.5) health -= (weeds - 0.5) * 0.18;
    if (pests > 0.5) health -= (pests - 0.5) * 0.27;

    // Pests at critical levels can kill crops
    if (pests > 0.8) {
      health -= 0.45;
    }

    health = Math.max(0, Math.min(1, health));

    // Notify on critical levels
    if (pests > 0.7 && field.pests <= 0.7) {
      notifications.push({
        type: "warning",
        message: `Field #${field.id} has severe pest infestation!`,
      });
    }
    if (weeds > 0.7 && field.weeds <= 0.7) {
      notifications.push({
        type: "warning",
        message: `Field #${field.id} is overrun with weeds!`,
      });
    }

    return { ...field, weeds, pests, health };
  });

  return {
    state: { ...state, fields },
    notifications,
  };
}
