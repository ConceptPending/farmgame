import type { Season } from "../entities/crop.js";
import type { WeatherCondition, ForecastDay, WeatherState } from "../entities/weather.js";
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

export function weatherSystem(state: GameState): {
  state: GameState;
  notifications: Notification[];
} {
  const notifications: Notification[] = [];
  let rng = state.rng;

  // Generate today's weather
  const condResult = generateCondition(rng, state.season);
  rng = condResult.rng;
  const condition = condResult.condition;

  const tempResult = generateTemperature(rng, state.season);
  rng = tempResult.rng;
  const temperature = tempResult.temp;

  const windResult = nextInt(rng, 0, 30);
  rng = windResult.rng;
  const wind = windResult.value;

  const rainfall = rainfallForCondition(condition);

  // Generate 5-day forecast
  const forecast: ForecastDay[] = [];
  for (let i = 0; i < 5; i++) {
    const fc = generateCondition(rng, state.season);
    rng = fc.rng;
    const fTemp = generateTemperature(rng, state.season);
    rng = fTemp.rng;
    const fTemp2 = generateTemperature(rng, state.season);
    rng = fTemp2.rng;

    forecast.push({
      condition: fc.condition,
      tempHigh: Math.max(fTemp.temp, fTemp2.temp),
      tempLow: Math.min(fTemp.temp, fTemp2.temp),
      rainfall: rainfallForCondition(fc.condition),
    });
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
