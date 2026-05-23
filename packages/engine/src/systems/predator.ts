import type { GameState, Notification } from "../state.js";
import type { WeatherCondition } from "../entities/weather.js";
import { ANIMAL_CATALOG } from "../entities/animal.js";
import { pennedTiles } from "./pen.js";
import { nextBool } from "../rng.js";

/** Per-season chance a loose animal is taken by a predator in clear weather. */
const BASE_ATTACK_CHANCE = 0.15;
/** Risk multiplier by weather — storms hide predators, frost stresses prey. */
const WEATHER_MULT: Record<WeatherCondition, number> = {
  clear: 0.85,
  cloudy: 1.0,
  rain: 1.1,
  storm: 1.8,
  frost: 1.4,
  drought: 1.0,
};
/** Animals within this Manhattan radius of an active barn are sheltered. */
const BARN_SHIELD_RADIUS = 4;
/** Multiplier applied when an animal is within barn shelter range. */
const BARN_SHIELD_FACTOR = 0.5;

/**
 * Predator system. Loose (un-penned) animals roll once per season for a
 * predator attack; risk scales with weather, and is halved within a few tiles
 * of an active barn (giving barns a real defensive role). Consumes RNG only
 * for loose animals, so penned-only games stay deterministic.
 */
export function predatorSystem(state: GameState): {
  state: GameState;
  notifications: Notification[];
} {
  if (state.animals.length === 0 || state.monthOfSeason !== 1) {
    return { state, notifications: [] };
  }
  const penned = pennedTiles(state);
  const loose = state.animals.filter((a) => !penned.has(a.tileIndex));
  if (loose.length === 0) {
    return { state, notifications: [] };
  }

  const W = state.world.width;
  const barns = state.buildings
    .filter((b) => b.type === "barn" && b.active !== false)
    .map((b) => ({ x: b.tileIndex % W, y: (b.tileIndex / W) | 0 }));

  const weatherMult = WEATHER_MULT[state.weather.condition] ?? 1.0;
  let rng = state.rng;
  const notifications: Notification[] = [];
  const lostIds = new Set<number>();

  for (const a of loose) {
    const x = a.tileIndex % W;
    const y = (a.tileIndex / W) | 0;
    const nearBarn = barns.some((b) => Math.abs(b.x - x) + Math.abs(b.y - y) <= BARN_SHIELD_RADIUS);
    const chance = BASE_ATTACK_CHANCE * weatherMult * (nearBarn ? BARN_SHIELD_FACTOR : 1);
    const roll = nextBool(rng, chance);
    rng = roll.rng;
    if (roll.value) {
      lostIds.add(a.id);
      notifications.push({
        type: "warning",
        message: `A predator took ${a.name} the ${ANIMAL_CATALOG[a.type].name.toLowerCase()}.`,
      });
    }
  }

  if (lostIds.size === 0) return { state: { ...state, rng }, notifications };
  return {
    state: { ...state, rng, animals: state.animals.filter((a) => !lostIds.has(a.id)) },
    notifications,
  };
}
