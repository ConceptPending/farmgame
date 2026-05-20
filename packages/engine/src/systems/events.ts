import type { GameState, Notification } from "../state.js";
import type { Field } from "../entities/field.js";
import { getCropDef } from "../data/crops.js";
import { nextBool, nextFloat, nextInt } from "../rng.js";

/** Per-tick chance that a random event fires (~1 every ~33 days on average). */
export const EVENT_CHANCE = 0.03;

const ACTIVE_STATES = new Set<Field["state"]>(["planted", "growing", "ready"]);

function cropName(field: Field): string {
  return (field.cropId && getCropDef(field.cropId)?.name) || "crop";
}

/**
 * Random events: disasters that threaten crops/cash and strokes of luck that
 * help. Adds drama and discrete decision points on top of the steady systems.
 */
export function eventSystem(state: GameState): {
  state: GameState;
  notifications: Notification[];
} {
  let rng = state.rng;

  const trigger = nextBool(rng, EVENT_CHANCE);
  rng = trigger.rng;
  if (!trigger.value) {
    return { state: { ...state, rng }, notifications: [] };
  }

  const pick = nextFloat(rng);
  rng = pick.rng;
  const roll = pick.value;

  const activeFieldIdx: number[] = [];
  state.fields.forEach((f, i) => {
    if (ACTIVE_STATES.has(f.state)) activeFieldIdx.push(i);
  });

  const notifications: Notification[] = [];
  let fields = state.fields;
  let money = state.money;

  // Helper to draw an integer in [min, max] while threading rng.
  const draw = (min: number, max: number): number => {
    const r = nextInt(rng, min, max);
    rng = r.rng;
    return r.value;
  };

  if (roll < 0.2 && activeFieldIdx.length > 0) {
    // Locust swarm — pests surge across every active field.
    fields = state.fields.map((f) =>
      ACTIVE_STATES.has(f.state) ? { ...f, pests: Math.min(1, f.pests + 0.4) } : f,
    );
    notifications.push({
      type: "warning",
      message: "Locust swarm! Pests are surging across your fields.",
    });
  } else if (roll < 0.35 && activeFieldIdx.length > 0) {
    // Hailstorm — wipes out one random field's crop.
    const target = activeFieldIdx[draw(0, activeFieldIdx.length - 1)];
    const hit = state.fields[target];
    fields = state.fields.map((f, i) =>
      i === target ? { ...f, state: "dead", health: 0 } : f,
    );
    notifications.push({
      type: "error",
      message: `Hailstorm destroyed the ${cropName(hit)} in field #${hit.id}!`,
    });
  } else if (roll < 0.45 && activeFieldIdx.length > 0) {
    // Crop blight — health hit across active fields.
    fields = state.fields.map((f) =>
      ACTIVE_STATES.has(f.state) ? { ...f, health: Math.max(0, f.health - 0.3) } : f,
    );
    notifications.push({
      type: "warning",
      message: "Blight is spreading — crop health is falling.",
    });
  } else if (roll < 0.65 && activeFieldIdx.length > 0) {
    // Bumper conditions — one growing field thrives.
    const target = activeFieldIdx[draw(0, activeFieldIdx.length - 1)];
    const hit = state.fields[target];
    fields = state.fields.map((f, i) =>
      i === target
        ? { ...f, growth: Math.min(1, f.growth + 0.3), health: Math.min(1, f.health + 0.2) }
        : f,
    );
    notifications.push({
      type: "success",
      message: `Perfect conditions gave the ${cropName(hit)} in field #${hit.id} a bumper boost!`,
    });
  } else if (roll < 0.8) {
    // Government subsidy.
    const amount = draw(300, 1200);
    money += amount;
    notifications.push({
      type: "success",
      message: `Agricultural subsidy granted: +$${amount}.`,
    });
  } else if (roll < 0.9) {
    // Inheritance windfall.
    const amount = draw(1000, 3000);
    money += amount;
    notifications.push({
      type: "success",
      message: `An inheritance arrived: +$${amount}.`,
    });
  } else {
    // Equipment breakdown — repair bill.
    const amount = draw(200, 600);
    money -= amount;
    notifications.push({
      type: "warning",
      message: `Equipment breakdown! Repairs cost $${amount}.`,
    });
  }

  return { state: { ...state, rng, fields, money }, notifications };
}
