import type { GameState, Notification } from "../state.js";
import { DAYS_PER_SEASON, SEASONS } from "../state.js";

export function seasonSystem(state: GameState): {
  state: GameState;
  notifications: Notification[];
} {
  const notifications: Notification[] = [];
  const nextDay = state.day + 1;

  if (nextDay > DAYS_PER_SEASON) {
    const currentIdx = SEASONS.indexOf(state.season);
    const nextIdx = (currentIdx + 1) % SEASONS.length;
    const nextSeason = SEASONS[nextIdx];
    const newYear = nextIdx === 0 ? state.year + 1 : state.year;

    notifications.push({
      type: "info",
      message: `${nextSeason.charAt(0).toUpperCase() + nextSeason.slice(1)} of Year ${newYear} has arrived!`,
    });

    return {
      state: { ...state, season: nextSeason, day: 1, year: newYear },
      notifications,
    };
  }

  return {
    state: { ...state, day: nextDay },
    notifications,
  };
}
