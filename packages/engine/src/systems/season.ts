import type { GameState, Notification } from "../state.js";
import { MONTHS_PER_SEASON, SEASONS } from "../state.js";

/**
 * Advances the calendar by one monthly turn. Rolls over the season once we
 * pass the third (late) month, and the year when winter rolls back to spring.
 */
export function seasonSystem(state: GameState): {
  state: GameState;
  notifications: Notification[];
} {
  const notifications: Notification[] = [];
  const nextMonth = state.monthOfSeason + 1;

  if (nextMonth > MONTHS_PER_SEASON) {
    const currentIdx = SEASONS.indexOf(state.season);
    const nextIdx = (currentIdx + 1) % SEASONS.length;
    const nextSeason = SEASONS[nextIdx];
    const newYear = nextIdx === 0 ? state.year + 1 : state.year;

    notifications.push({
      type: "info",
      message: `${nextSeason.charAt(0).toUpperCase() + nextSeason.slice(1)} of Year ${newYear} has arrived!`,
    });

    return {
      state: { ...state, season: nextSeason, monthOfSeason: 1, year: newYear },
      notifications,
    };
  }

  return {
    state: { ...state, monthOfSeason: nextMonth },
    notifications,
  };
}
