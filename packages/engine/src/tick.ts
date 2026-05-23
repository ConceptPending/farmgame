import type { GameState, Notification, TickResult } from "./state.js";
import { BASE_LABOR_CAPACITY } from "./state.js";
import { equipmentLaborBonus } from "./entities/equipment.js";
import { seasonSystem } from "./systems/season.js";
import { weatherSystem } from "./systems/weather.js";
import { waterSystem } from "./systems/water.js";
import { cropSystem } from "./systems/crop.js";
import { fieldHealthSystem } from "./systems/field-health.js";
import { livestockSystem } from "./systems/livestock.js";
import { penSystem } from "./systems/pen.js";
import { predatorSystem } from "./systems/predator.js";
import { rivalSystem } from "./systems/rival.js";
import { eventSystem } from "./systems/events.js";
import { marketSystem } from "./systems/market.js";
import { financeSystem } from "./systems/finance.js";

/**
 * Resolves one monthly turn. Pure: same state in = same state out.
 *
 * Pipeline: season → weather → water → crops → fieldHealth → livestock → pens
 * → predators → rivals → events → market → finance. Then the labor budget
 * resets — the next turn starts with a fresh `labor.used = 0`.
 */
export function nextTurn(state: GameState): TickResult {
  // Don't advance after the game has ended.
  if (state.status !== "playing") {
    return { state, notifications: [] };
  }

  const notifications: Notification[] = [];

  // Advance turn counter
  let current: GameState = { ...state, tick: state.tick + 1 };

  // Season system (advance day, handle season/year transitions)
  const seasonResult = seasonSystem(current);
  current = seasonResult.state;
  notifications.push(...seasonResult.notifications);

  // Weather system (generate daily weather + forecast)
  const weatherResult = weatherSystem(current);
  current = weatherResult.state;
  notifications.push(...weatherResult.notifications);

  // Water system (moisture simulation: rain, evaporation, irrigation)
  const waterResult = waterSystem(current);
  current = waterResult.state;
  notifications.push(...waterResult.notifications);

  // Crop system (growth affected by weather, moisture, health)
  const cropResult = cropSystem(current);
  current = cropResult.state;
  notifications.push(...cropResult.notifications);

  // Field health system (weeds, pests, disease)
  const healthResult = fieldHealthSystem(current);
  current = healthResult.state;
  notifications.push(...healthResult.notifications);

  // Livestock system (growth, feed, breeding)
  const livestockResult = livestockSystem(current);
  current = livestockResult.state;
  notifications.push(...livestockResult.notifications);

  // Pen system (fence wear + livestock containment/escape)
  const penResult = penSystem(current);
  current = penResult.state;
  notifications.push(...penResult.notifications);

  // Predator system (loose animals may be taken — barns shelter; weather scales risk)
  const predResult = predatorSystem(current);
  current = predResult.state;
  notifications.push(...predResult.notifications);

  // Rival farms (expansion + market competition)
  const rivalResult = rivalSystem(current);
  current = rivalResult.state;
  notifications.push(...rivalResult.notifications);

  // Random events (disasters + strokes of luck)
  const eventResult = eventSystem(current);
  current = eventResult.state;
  notifications.push(...eventResult.notifications);

  // Market system (price fluctuation)
  const marketResult = marketSystem(current);
  current = marketResult.state;
  notifications.push(...marketResult.notifications);

  // Finance system (seasonal expenses, interest, win/lose resolution)
  const financeResult = financeSystem(current);
  current = financeResult.state;
  notifications.push(...financeResult.notifications);

  // Replenish the monthly labor budget for the player's next turn — and
  // recompute capacity from currently-owned equipment so a newly-bought
  // tractor's bonus shows up on the very next turn.
  const capacity = BASE_LABOR_CAPACITY + equipmentLaborBonus(current.equipment);
  current = { ...current, labor: { used: 0, capacity } };

  return { state: current, notifications };
}
