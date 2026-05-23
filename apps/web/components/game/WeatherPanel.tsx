"use client";

import { useEffect, useRef, useState } from "react";
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

/** Auto-expand for this long after a season change, then collapse back. */
const SEASON_AUTO_EXPAND_MS = 4000;

export function WeatherPanel() {
  const state = useGameStore((s) => s.state);
  const [pinned, setPinned] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [seasonExpandUntil, setSeasonExpandUntil] = useState(0);
  const [, force] = useState(0);
  const lastSeason = useRef<string | null>(null);

  // Re-expand briefly whenever the season changes (also on first mount, which
  // gives the player a moment of orientation).
  useEffect(() => {
    if (!state) return;
    if (lastSeason.current !== state.season) {
      lastSeason.current = state.season;
      setSeasonExpandUntil(performance.now() + SEASON_AUTO_EXPAND_MS);
    }
  }, [state]);

  // While the auto-expand window is open, tick a re-render so we collapse on time.
  useEffect(() => {
    if (seasonExpandUntil === 0) return;
    const remaining = seasonExpandUntil - performance.now();
    if (remaining <= 0) {
      setSeasonExpandUntil(0);
      return;
    }
    const t = setTimeout(() => force((n) => n + 1), remaining + 16);
    return () => clearTimeout(t);
  }, [seasonExpandUntil]);

  if (!state) return null;
  const { weather } = state;

  const seasonExpanded = seasonExpandUntil > performance.now();
  const expanded = pinned || hovering || seasonExpanded;

  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={() => setPinned((p) => !p)}
      title={pinned ? "Click to unpin" : "Click to pin open"}
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        background: "rgba(22, 33, 62, 0.92)",
        border: "1px solid #0f3460",
        borderRadius: 6,
        padding: expanded ? "8px 12px" : "4px 10px",
        fontSize: 12,
        minWidth: expanded ? 180 : undefined,
        zIndex: 10,
        cursor: "pointer",
        userSelect: "none",
        transition: "padding 120ms ease",
      }}
    >
      {/* Current weather — always visible; compact uses a tighter inline form. */}
      {expanded ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 24 }}>{CONDITION_ICONS[weather.condition]}</span>
          <div>
            <div style={{ color: "#eee", fontWeight: 600, fontSize: 14 }}>
              {weather.temperature}°F
            </div>
            <div style={{ color: "#aaa" }}>
              {CONDITION_LABELS[weather.condition]} · Wind {weather.wind} mph
              {pinned && <span style={{ color: "#4ecca3", marginLeft: 6 }}>● pinned</span>}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>{CONDITION_ICONS[weather.condition]}</span>
          <span style={{ color: "#eee", fontWeight: 600, fontSize: 13 }}>{weather.temperature}°</span>
        </div>
      )}

      {/* 5-day forecast — only when expanded; this is what most obscured the map. */}
      {expanded && (
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
      )}
    </div>
  );
}
