import type { GameState, Notification, TickResult } from "./state.js";
import { seasonSystem } from "./systems/season.js";
import { weatherSystem } from "./systems/weather.js";
import { waterSystem } from "./systems/water.js";
import { cropSystem } from "./systems/crop.js";
import { fieldHealthSystem } from "./systems/field-health.js";
import { livestockSystem } from "./systems/livestock.js";
import { rivalSystem } from "./systems/rival.js";
import { eventSystem } from "./systems/events.js";
import { marketSystem } from "./systems/market.js";
import { financeSystem } from "./systems/finance.js";

/**
 * Core tick function. Pure: same state in = same state out.
 * Pipeline: season → weather → water → crops → fieldHealth → livestock → rivals → events → market → finance
 */
export function nextTick(state: GameState): TickResult {
  // Don't advance while paused or after the game has ended.
  if (state.paused || state.status !== "playing") {
    return { state, notifications: [] };
  }

  const notifications: Notification[] = [];

  // Advance tick counter
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

  return { state: current, notifications };
}
