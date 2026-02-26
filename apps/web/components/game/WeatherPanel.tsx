"use client";

import { useGameStore } from "../../stores/game-store";
import type { WeatherCondition } from "@farmgame/engine";

const CONDITION_ICONS: Record<WeatherCondition, string> = {
  clear: "☀️",
  cloudy: "⛅",
  rain: "🌧️",
  storm: "⛈️",
  frost: "❄️",
  drought: "🔥",
};

const CONDITION_LABELS: Record<WeatherCondition, string> = {
  clear: "Clear",
  cloudy: "Cloudy",
  rain: "Rain",
  storm: "Storm",
  frost: "Frost",
  drought: "Drought",
};

export function WeatherPanel() {
  const state = useGameStore((s) => s.state);
  if (!state) return null;

  const { weather } = state;

  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        background: "rgba(22, 33, 62, 0.9)",
        border: "1px solid #0f3460",
        borderRadius: 6,
        padding: "8px 12px",
        fontSize: 12,
        minWidth: 180,
        zIndex: 10,
      }}
    >
      {/* Current weather */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 24 }}>{CONDITION_ICONS[weather.condition]}</span>
        <div>
          <div style={{ color: "#eee", fontWeight: 600, fontSize: 14 }}>
            {weather.temperature}°F
          </div>
          <div style={{ color: "#aaa" }}>
            {CONDITION_LABELS[weather.condition]} | Wind: {weather.wind}mph
          </div>
        </div>
      </div>

      {/* 5-day forecast */}
      <div
        style={{
          display: "flex",
          gap: 4,
          borderTop: "1px solid #333",
          paddingTop: 6,
        }}
      >
        {weather.forecast.map((day, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 10,
              color: "#aaa",
            }}
          >
            <div style={{ fontSize: 14 }}>{CONDITION_ICONS[day.condition]}</div>
            <div>{day.tempHigh}°</div>
            <div style={{ color: "#666" }}>{day.tempLow}°</div>
          </div>
        ))}
      </div>
    </div>
  );
}
