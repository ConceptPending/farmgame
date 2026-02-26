export type WeatherCondition = "clear" | "cloudy" | "rain" | "storm" | "frost" | "drought";

export interface ForecastDay {
  condition: WeatherCondition;
  tempHigh: number;
  tempLow: number;
  rainfall: number;
}

export interface WeatherState {
  temperature: number;
  rainfall: number;
  wind: number;
  condition: WeatherCondition;
  forecast: ForecastDay[];
}

export function createWeatherState(): WeatherState {
  return {
    temperature: 65,
    rainfall: 0,
    wind: 5,
    condition: "clear",
    forecast: Array.from({ length: 5 }, () => ({
      condition: "clear" as WeatherCondition,
      tempHigh: 70,
      tempLow: 55,
      rainfall: 0,
    })),
  };
}
