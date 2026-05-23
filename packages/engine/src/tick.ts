import type { GameState, Notification, TickResult } from "./state.js";
import { BASE_LABOR_CAPACITY } from "./state.js";
import type { Cause } from "./entities/cause.js";
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
    return { state, notifications: [], causes: [] };
  }

  const notifications: Notification[] = [];
  const causes: Cause[] = [];

  // Record any labor the player left on the table this past month — it's
  // emitted *before* the rest of the pipeline so it reflects the turn the
  // player just finished planning, not the one we're about to resolve.
  const unused = state.labor.capacity - state.labor.used;
  if (unused > 0 && state.labor.capacity > 0) {
    causes.push({ kind: "labor_unused", unused, capacity: state.labor.capacity });
  }

  // Advance turn counter
  let current: GameState = { ...state, tick: state.tick + 1 };

  // Each system returns notifications + (optional) causes. We accumulate
  // both into the TickResult so the UI sees one combined stream.
  type SysResult = { state: GameState; notifications: Notification[]; causes?: Cause[] };
  const run = (sys: (s: GameState) => SysResult): void => {
    const r = sys(current);
    current = r.state;
    notifications.push(...r.notifications);
    if (r.causes) causes.push(...r.causes);
  };

  run(seasonSystem);
  run(weatherSystem);
  run(waterSystem);
  run(cropSystem);
  run(fieldHealthSystem);
  run(livestockSystem);
  run(penSystem);
  run(predatorSystem);
  run(rivalSystem);
  run(eventSystem);
  run(marketSystem);
  run(financeSystem);

  // Replenish the monthly labor budget for the player's next turn — and
  // recompute capacity from currently-owned equipment so a newly-bought
  // tractor's bonus shows up on the very next turn.
  const capacity = BASE_LABOR_CAPACITY + equipmentLaborBonus(current.equipment);
  current = { ...current, labor: { used: 0, capacity } };

  return { state: current, notifications, causes };
}
