import type { Season } from "../entities/crop.js";
import type { WeatherCondition, ForecastMonth, WeatherState } from "../entities/weather.js";
import { FORECAST_HORIZON } from "../entities/weather.js";
import type { GameState, Notification } from "../state.js";
import type { RngState } from "../rng.js";
import { nextFloat, nextInt } from "../rng.js";

interface SeasonWeatherProfile {
  tempMin: number;
  tempMax: number;
  rainChance: number;
  stormChance: number;
  frostChance: number;
  droughtChance: number;
}

const SEASON_PROFILES: Record<Season, SeasonWeatherProfile> = {
  spring: {
    tempMin: 50,
    tempMax: 75,
    rainChance: 0.4,
    stormChance: 0.05,
    frostChance: 0.05,
    droughtChance: 0,
  },
  summer: {
    tempMin: 75,
    tempMax: 100,
    rainChance: 0.2,
    stormChance: 0.08,
    frostChance: 0,
    droughtChance: 0.1,
  },
  fall: {
    tempMin: 45,
    tempMax: 70,
    rainChance: 0.3,
    stormChance: 0.05,
    frostChance: 0.1,
    droughtChance: 0,
  },
  winter: {
    tempMin: 20,
    tempMax: 45,
    rainChance: 0.25,
    stormChance: 0.03,
    frostChance: 0.4,
    droughtChance: 0,
  },
};

function generateCondition(rng: RngState, season: Season): { condition: WeatherCondition; rng: RngState } {
  const profile = SEASON_PROFILES[season];
  let r = rng;

  const roll = nextFloat(r);
  r = roll.rng;
  const v = roll.value;

  let condition: WeatherCondition;
  if (v < profile.frostChance) {
    condition = "frost";
  } else if (v < profile.frostChance + profile.droughtChance) {
    condition = "drought";
  } else if (v < profile.frostChance + profile.droughtChance + profile.stormChance) {
    condition = "storm";
  } else if (v < profile.frostChance + profile.droughtChance + profile.stormChance + profile.rainChance) {
    condition = "rain";
  } else if (v < profile.frostChance + profile.droughtChance + profile.stormChance + profile.rainChance + 0.15) {
    condition = "cloudy";
  } else {
    condition = "clear";
  }

  return { condition, rng: r };
}

function generateTemperature(rng: RngState, season: Season): { temp: number; rng: RngState } {
  const profile = SEASON_PROFILES[season];
  const result = nextFloat(rng);
  const temp = Math.round(profile.tempMin + result.value * (profile.tempMax - profile.tempMin));
  return { temp, rng: result.rng };
}

function rainfallForCondition(condition: WeatherCondition): number {
  switch (condition) {
    case "storm":
      return 0.8;
    case "rain":
      return 0.4;
    case "cloudy":
      return 0.05;
    case "frost":
      return 0.1;
    case "clear":
    case "drought":
      return 0;
  }
}

const SEASON_ORDER: Season[] = ["spring", "summer", "fall", "winter"];
const MONTHS_PER_SEASON = 3;

/** The season in effect `monthsAhead` monthly turns from (season, monthOfSeason). */
export function seasonAt(season: Season, monthOfSeason: number, monthsAhead: number): Season {
  const seasonsAhead = Math.floor((monthOfSeason - 1 + monthsAhead) / MONTHS_PER_SEASON);
  // Modulo of a non-empty literal array — always in range.
  return SEASON_ORDER[(SEASON_ORDER.indexOf(season) + seasonsAhead) % SEASON_ORDER.length]!;
}

function generateForecastMonth(
  rng: RngState,
  season: Season,
): { month: ForecastMonth; rng: RngState } {
  const fc = generateCondition(rng, season);
  let r = fc.rng;
  const t1 = generateTemperature(r, season);
  r = t1.rng;
  const t2 = generateTemperature(r, season);
  r = t2.rng;
  return {
    month: {
      condition: fc.condition,
      tempHigh: Math.max(t1.temp, t2.temp),
      tempLow: Math.min(t1.temp, t2.temp),
      rainfall: rainfallForCondition(fc.condition),
    },
    rng: r,
  };
}

/**
 * Draw an initial forecast for a new game, one entry per upcoming monthly
 * turn with each entry using *that month's* season profile. Called from
 * createGameState so the very first turns honor a real forecast instead of
 * the placeholder "clear" entries.
 */
export function primeForecast(
  season: Season,
  monthOfSeason: number,
  rng: RngState,
): { forecast: ForecastMonth[]; rng: RngState } {
  const forecast: ForecastMonth[] = [];
  let r = rng;
  for (let i = 1; i <= FORECAST_HORIZON; i++) {
    const g = generateForecastMonth(r, seasonAt(season, monthOfSeason, i));
    forecast.push(g.month);
    r = g.rng;
  }
  return { forecast, rng: r };
}

export function weatherSystem(state: GameState): {
  state: GameState;
  notifications: Notification[];
} {
  const notifications: Notification[] = [];
  let rng = state.rng;

  // This month's weather honors the standing forecast: the entry at the head
  // of the queue was issued for this month (with this month's season profile),
  // so promoting it is what makes the forecast *predictive* rather than
  // decorative. The temperature lands inside the forecast range.
  const standing = state.weather.forecast;
  let condition: WeatherCondition;
  let temperature: number;
  const due = standing[0];
  if (due !== undefined && standing.length >= FORECAST_HORIZON) {
    condition = due.condition;
    const tempRoll = nextFloat(rng);
    rng = tempRoll.rng;
    temperature = Math.round(due.tempLow + tempRoll.value * (due.tempHigh - due.tempLow));
  } else {
    // Unprimed (legacy save) — draw fresh; the queue refills below.
    const condResult = generateCondition(rng, state.season);
    rng = condResult.rng;
    condition = condResult.condition;
    const tempResult = generateTemperature(rng, state.season);
    rng = tempResult.rng;
    temperature = tempResult.temp;
  }

  const windResult = nextInt(rng, 0, 30);
  rng = windResult.rng;
  const wind = windResult.value;

  const rainfall = rainfallForCondition(condition);

  // Roll the forecast queue: drop the promoted head, append one fresh entry
  // for the month FORECAST_HORIZON turns out — drawn with that month's season
  // profile, so a late-fall forecast correctly shows winter frost odds.
  let forecast = standing.slice(1);
  while (forecast.length < FORECAST_HORIZON) {
    const ahead = forecast.length + 1;
    const g = generateForecastMonth(rng, seasonAt(state.season, state.monthOfSeason, ahead));
    rng = g.rng;
    forecast = [...forecast, g.month];
  }

  const weather: WeatherState = { temperature, rainfall, wind, condition, forecast };

  // Notify on significant weather events
  if (condition === "frost") {
    notifications.push({ type: "warning", message: `Frost warning! Temperature: ${temperature}F` });
  } else if (condition === "storm") {
    notifications.push({ type: "warning", message: `Storm approaching! Heavy rain expected.` });
  } else if (condition === "drought") {
    notifications.push({ type: "warning", message: `Drought conditions! Crops need irrigation.` });
  }

  return {
    state: { ...state, weather, rng },
    notifications,
  };
}
