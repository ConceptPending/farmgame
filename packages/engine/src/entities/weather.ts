export type WeatherCondition = "clear" | "cloudy" | "rain" | "storm" | "frost" | "drought";

/** One entry of the rolling 2-month forecast. Represents the dominant
 *  conditions of an upcoming monthly turn. */
export interface ForecastMonth {
  condition: WeatherCondition;
  tempHigh: number;
  tempLow: number;
  rainfall: number;
}

/**
 * Legacy alias for the day-grained forecast type. Kept exported for now so
 * existing UI imports don't break; consumers should migrate to `ForecastMonth`.
 */
export type ForecastDay = ForecastMonth;

export interface WeatherState {
  temperature: number;
  rainfall: number;
  wind: number;
  condition: WeatherCondition;
  /** Next ~2 monthly turns' dominant conditions. */
  forecast: ForecastMonth[];
}

/** Forecast horizon in monthly turns. Player sees this far ahead. */
export const FORECAST_HORIZON = 2;

export function createWeatherState(): WeatherState {
  return {
    temperature: 65,
    rainfall: 0,
    wind: 5,
    condition: "clear",
    forecast: Array.from({ length: FORECAST_HORIZON }, () => ({
      condition: "clear" as WeatherCondition,
      tempHigh: 70,
      tempLow: 55,
      rainfall: 0,
    })),
  };
}
