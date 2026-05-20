"use client";

import { useEffect } from "react";
import { useGameStore } from "../../stores/game-store";
import { useUIStore } from "../../stores/ui-store";
import { TOOL_CATALOG } from "@farmgame/engine";
import { OverlaySelector } from "./OverlaySelector";
import type { WeatherCondition } from "@farmgame/engine";

const CONDITION_ICONS: Record<WeatherCondition, string> = {
  clear: "☀️",
  cloudy: "⛅",
  rain: "🌧️",
  storm: "⛈️",
  frost: "❄️",
  drought: "🔥",
};

export function HUD() {
  const state = useGameStore((s) => s.state);
  const notifications = useGameStore((s) => s.notifications);
  const dispatch = useGameStore((s) => s.dispatch);
  const clearNotifications = useGameStore((s) => s.clearNotifications);
  const selectedTool = useUIStore((s) => s.selectedTool);
  const setShowMarketPanel = useUIStore((s) => s.setShowMarketPanel);

  useEffect(() => {
    if (notifications.length > 8) {
      clearNotifications();
    }
  }, [notifications.length, clearNotifications]);

  if (!state) return null;

  const seasonColors: Record<string, string> = {
    spring: "#7ddf64",
    summer: "#ffdd57",
    fall: "#ff8c42",
    winter: "#a8dadc",
  };

  const toolDef = TOOL_CATALOG[selectedTool];

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "8px 16px",
          background: "#16213e",
          borderBottom: "2px solid #0f3460",
          flexShrink: 0,
          fontSize: 13,
        }}
      >
        {/* Money */}
        <div style={{ fontSize: 18, fontWeight: "bold", color: "#4ecca3" }}>
          ${state.money.toLocaleString()}
        </div>

        {/* Season/Day/Year */}
        <div style={{ color: seasonColors[state.season] ?? "#eee", fontWeight: 600 }}>
          Year {state.year} -&nbsp;
          {state.season.charAt(0).toUpperCase() + state.season.slice(1)}&nbsp;
          Day {state.day}
        </div>

        {/* Current tool */}
        <div style={{ color: "#888", fontSize: 11 }}>
          Tool: <span style={{ color: "#4ecca3" }}>{toolDef?.name ?? selectedTool}</span>
        </div>

        {/* Weather icon */}
        <div style={{ fontSize: 16 }}>
          {CONDITION_ICONS[state.weather.condition]}{" "}
          <span style={{ fontSize: 12, color: "#aaa" }}>{state.weather.temperature}°F</span>
        </div>

        {/* Overlays */}
        <OverlaySelector />

        {/* Right side controls */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          {/* Speed controls */}
          {([1, 2, 3] as const).map((speed) => (
            <button
              key={speed}
              onClick={() => dispatch({ type: "SET_SPEED", speed })}
              style={{
                padding: "2px 8px",
                fontSize: 11,
                border: state.speed === speed ? "1px solid #4ecca3" : "1px solid #444",
                borderRadius: 3,
                background: state.speed === speed ? "#1a4040" : "#222",
                color: state.speed === speed ? "#4ecca3" : "#888",
                cursor: "pointer",
              }}
            >
              {speed}x
            </button>
          ))}

          {/* Pause */}
          <button
            onClick={() => dispatch({ type: state.paused ? "RESUME" : "PAUSE" })}
            style={{
              padding: "2px 10px",
              fontSize: 11,
              border: "1px solid #555",
              borderRadius: 3,
              background: state.paused ? "#4a2020" : "#222",
              color: state.paused ? "#ff6b6b" : "#ccc",
              cursor: "pointer",
            }}
          >
            {state.paused ? "Resume" : "Pause"}
          </button>

          {/* Market button */}
          <button
            onClick={() => setShowMarketPanel(true)}
            style={{
              padding: "2px 10px",
              fontSize: 11,
              border: "1px solid #555",
              borderRadius: 3,
              background: "#222",
              color: "#ffdd57",
              cursor: "pointer",
            }}
          >
            Market
          </button>
        </div>
      </div>

      {/* Notifications toast area — bottom-center so it clears the weather
          panel and info panel in the top-right corner. */}
      {notifications.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            zIndex: 50,
            pointerEvents: "none",
          }}
        >
          {notifications.slice(-4).map((n, i) => (
            <div
              key={i}
              style={{
                padding: "4px 10px",
                borderRadius: 4,
                fontSize: 11,
                background:
                  n.type === "error"
                    ? "rgba(74, 32, 32, 0.9)"
                    : n.type === "success"
                      ? "rgba(26, 64, 32, 0.9)"
                      : n.type === "warning"
                        ? "rgba(74, 58, 16, 0.9)"
                        : "rgba(22, 33, 62, 0.9)",
                color:
                  n.type === "error"
                    ? "#ff6b6b"
                    : n.type === "success"
                      ? "#4ecca3"
                      : n.type === "warning"
                        ? "#ffdd57"
                        : "#aaa",
                border: "1px solid rgba(50,50,50,0.5)",
              }}
            >
              {n.message}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
