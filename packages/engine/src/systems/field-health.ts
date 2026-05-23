import type { Field } from "../entities/field.js";
import type { Cause } from "../entities/cause.js";
import { getCropDef } from "../data/crops.js";
import type { GameState, Notification } from "../state.js";
import { tileCoords } from "../entities/world.js";

export function fieldHealthSystem(state: GameState): {
  state: GameState;
  notifications: Notification[];
  causes: Cause[];
} {
  const notifications: Notification[] = [];
  const causes: Cause[] = [];
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

    // Weed growth per monthly turn. PR N tuning pass softened these from
    // the initial ×9 conversion (PR L); a 3-month crop near a forest in
    // summer was hitting critical pest damage in turn 4-5, dying before
    // the harvest window. Damage thresholds also softened below.
    let weedGrowth = 0.06;
    if (weather.temperature > 70) weedGrowth += 0.03;
    if (weather.rainfall > 0.2) weedGrowth += 0.03;
    if (state.season === "summer") weedGrowth += 0.03;
    weeds = Math.min(1, weeds + weedGrowth);

    // Pest growth per monthly turn.
    let pestGrowth = 0.05;
    if (weather.temperature > 75) pestGrowth += 0.03;
    if (state.season === "summer") pestGrowth += 0.02;

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
    if (nearForest) pestGrowth += 0.05;

    // Pest vulnerability from crop type
    const def = field.cropId ? getCropDef(field.cropId) : null;
    if (def) {
      pestGrowth *= (0.5 + def.pestVulnerability);
    }

    pests = Math.min(1, pests + pestGrowth);

    // Health degradation from weeds and pests, per monthly turn. We record
    // the *amount of health lost this turn* so the inspector + summary can
    // show "lost 12% to weeds" rather than just "weeds high". Critical
    // pest damage was −0.45/turn in PR L which could kill a 3+ month crop
    // before maturity; softened to −0.18 here.
    const healthBefore = health;
    if (weeds > 0.5) health -= (weeds - 0.5) * 0.12;
    if (pests > 0.5) health -= (pests - 0.5) * 0.18;
    if (pests > 0.8) health -= 0.18;
    const weedLoss = weeds > 0.5 ? (weeds - 0.5) * 0.12 : 0;
    const pestLoss = (pests > 0.5 ? (pests - 0.5) * 0.18 : 0) + (pests > 0.8 ? 0.18 : 0);
    if (weedLoss > 0.001) {
      causes.push({ kind: "weed_pressure", fieldId: field.id, weeds, healthLost: weedLoss });
    }
    if (pestLoss > 0.001) {
      causes.push({ kind: "pest_pressure", fieldId: field.id, pests, healthLost: pestLoss });
    }
    void healthBefore;

    health = Math.max(0, Math.min(1, health));

    // Notify on critical levels (crossing the 0.7 threshold this turn).
    if (pests > 0.7 && field.pests <= 0.7) {
      notifications.push({
        type: "warning",
        message: `Field #${field.id} has severe pest infestation!`,
      });
      causes.push({ kind: "pests_critical", fieldId: field.id, pests });
    }
    if (weeds > 0.7 && field.weeds <= 0.7) {
      notifications.push({
        type: "warning",
        message: `Field #${field.id} is overrun with weeds!`,
      });
      causes.push({ kind: "weeds_critical", fieldId: field.id, weeds });
    }

    return { ...field, weeds, pests, health };
  });

  return {
    state: { ...state, fields },
    notifications,
    causes,
  };
}
