import type { Field } from "../entities/field.js";
import type { Cause } from "../entities/cause.js";
import { getCropDef } from "../data/crops.js";
import type { GameState, Notification } from "../state.js";

export function cropSystem(state: GameState): {
  state: GameState;
  notifications: Notification[];
  causes: Cause[];
} {
  const notifications: Notification[] = [];
  const causes: Cause[] = [];
  const { weather } = state;

  const fields = state.fields.map((field): Field => {
    if (
      (field.state !== "planted" && field.state !== "growing") ||
      !field.cropId
    ) {
      return field;
    }

    const def = getCropDef(field.cropId);
    if (!def) return field;

    // Frost check
    if (weather.condition === "frost" || weather.temperature < 32) {
      if (def.frostTolerance < 0.5) {
        const damage = (1 - def.frostTolerance) * 0.3;
        const newHealth = Math.max(0, field.health - damage);
        if (newHealth <= 0.1) {
          notifications.push({
            type: "warning",
            message: `${def.name} in field #${field.id} killed by frost!`,
          });
          causes.push({ kind: "frost_kill", fieldId: field.id, cropId: field.cropId });
          return { ...field, state: "dead", health: 0 };
        }
        notifications.push({
          type: "warning",
          message: `${def.name} in field #${field.id} damaged by frost!`,
        });
        causes.push({
          kind: "frost_damage",
          fieldId: field.id,
          cropId: field.cropId,
          healthLost: damage,
        });
        return { ...field, health: newHealth };
      }
    }

    // Temperature stress / drought stress (informational, even when growing).
    if (weather.temperature > def.idealTempMax + 5) {
      causes.push({
        kind: "heat_stress",
        fieldId: field.id,
        cropId: field.cropId,
        tempDegF: weather.temperature,
      });
    }
    if (field.moisture < def.waterNeed * 0.5) {
      causes.push({
        kind: "drought_stress",
        fieldId: field.id,
        cropId: field.cropId,
        moisture: field.moisture,
        need: def.waterNeed,
      });
    }

    // Growth rate modifiers
    let growthRate = 1.0;

    // Temperature modifier
    const tempDiff = weather.temperature < def.idealTempMin
      ? def.idealTempMin - weather.temperature
      : weather.temperature > def.idealTempMax
        ? weather.temperature - def.idealTempMax
        : 0;
    if (tempDiff > 0) {
      growthRate *= Math.max(0.2, 1 - tempDiff / 40);
    }

    // Moisture modifier
    const moistureDiff = Math.abs(field.moisture - def.waterNeed);
    if (field.moisture < def.waterNeed * 0.5) {
      // Severe drought
      growthRate *= 0.3 + def.droughtTolerance * 0.4;
    } else if (moistureDiff > 0.3) {
      growthRate *= 0.7;
    }

    // Health modifier
    growthRate *= Math.max(0.3, field.health);

    // Compute growth *first* so a crop reaching maturity this turn is allowed
    // to harvest even if its health is low — the yield formula already
    // discounts by health, which is the intended punishment for letting it
    // get sick. (Pre-fix, the death check ran first and could cheat the
    // player out of a crop on the very turn it would have hit "ready".)
    const newGrowthMonths = field.growthMonths + 1;
    const baseProgress = 1 / def.growthMonths;
    const newGrowth = Math.min(1, field.growth + baseProgress * growthRate);

    if (newGrowth >= 1) {
      notifications.push({
        type: "success",
        message: `${def.name} in field #${field.id} is ready to harvest!`,
      });
      causes.push({ kind: "ready_to_harvest", fieldId: field.id, cropId: field.cropId });
      return {
        ...field,
        state: "ready",
        growth: 1,
        growthMonths: newGrowthMonths,
      };
    }

    // Still growing — *now* check whether the field is too damaged to
    // continue. Death is permanent so the threshold is conservative.
    if (field.health < 0.2) {
      notifications.push({
        type: "warning",
        message: `${def.name} in field #${field.id} has died from poor health!`,
      });
      causes.push({ kind: "crop_died_health", fieldId: field.id, cropId: field.cropId });
      return { ...field, state: "dead", health: 0 };
    }

    return {
      ...field,
      state: "growing",
      growth: newGrowth,
      growthMonths: newGrowthMonths,
    };
  });

  return {
    state: { ...state, fields },
    notifications,
    causes,
  };
}
