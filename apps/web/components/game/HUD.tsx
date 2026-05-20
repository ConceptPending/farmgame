"use client";

import { useEffect, type CSSProperties } from "react";
import { useGameStore } from "../../stores/game-store";
import { useUIStore } from "../../stores/ui-store";
import { TOOL_CATALOG, computeNetWorth } from "@farmgame/engine";
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

const stepBtnStyle: CSSProperties = {
  padding: "2px 8px",
  fontSize: 11,
  border: "1px solid #555",
  borderRadius: 3,
  background: "#222",
  color: "#ccc",
  cursor: "pointer",
};

const divider: CSSProperties = { width: 1, height: 18, background: "#0f3460" };

export function HUD() {
  const state = useGameStore((s) => s.state);
  const notifications = useGameStore((s) => s.notifications);
  const dispatch = useGameStore((s) => s.dispatch);
  const clearNotifications = useGameStore((s) => s.clearNotifications);
  const autoplay = useGameStore((s) => s.autoplay);
  const toggleAutoplay = useGameStore((s) => s.toggleAutoplay);
  const autoPauseOnEvents = useGameStore((s) => s.autoPauseOnEvents);
  const setAutoPauseOnEvents = useGameStore((s) => s.setAutoPauseOnEvents);
  const advanceDays = useGameStore((s) => s.advanceDays);
  const advanceToEvent = useGameStore((s) => s.advanceToEvent);
  const selectedTool = useUIStore((s) => s.selectedTool);
  const setShowMarketPanel = useUIStore((s) => s.setShowMarketPanel);
  const setShowFinancePanel = useUIStore((s) => s.setShowFinancePanel);

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
  const netWorth = computeNetWorth(state);
  const goalPct = Math.min(100, Math.round((netWorth / state.goalNetWorth) * 100));

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
        <div style={{ fontSize: 18, fontWeight: "bold", color: state.money < 0 ? "#ff6b6b" : "#4ecca3" }}>
          ${state.money.toLocaleString()}
        </div>

        {/* Net worth vs. goal */}
        <button
          onClick={() => setShowFinancePanel(true)}
          title="Open finances"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            border: "1px solid #0f3460",
            background: "#0a1628",
            borderRadius: 4,
            padding: "3px 8px",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 10, color: "#7a8a9a" }}>
            NET WORTH <span style={{ color: "#eee" }}>${netWorth.toLocaleString()}</span>
            {state.loan > 0 && <span style={{ color: "#ff6b6b" }}> · debt ${state.loan.toLocaleString()}</span>}
          </span>
          <div style={{ width: 120, height: 5, background: "#16213e", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${goalPct}%`, height: "100%", background: "#4ecca3" }} />
          </div>
        </button>

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
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          {/* Manual stepping (turn-based) */}
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 9, color: "#7a8a9a" }}>STEP</span>
            <button onClick={() => advanceDays(1)} style={stepBtnStyle} title="Advance one day">
              +1d
            </button>
            <button onClick={() => advanceDays(7)} style={stepBtnStyle} title="Advance one week">
              +1wk
            </button>
            <button
              onClick={() => advanceToEvent()}
              style={stepBtnStyle}
              title="Fast-forward until something needs your attention"
            >
              ⏩ Skip
            </button>
          </div>

          <div style={divider} />

          {/* Auto-advance */}
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <button
              onClick={toggleAutoplay}
              title={autoplay ? "Pause auto-advance" : "Resume auto-advance"}
              style={{
                padding: "2px 10px",
                fontSize: 11,
                borderRadius: 3,
                cursor: "pointer",
                border: autoplay ? "1px solid #4ecca3" : "1px solid #555",
                background: autoplay ? "#1a4040" : "#222",
                color: autoplay ? "#4ecca3" : "#ccc",
              }}
            >
              {autoplay ? "⏸ Auto" : "▶ Auto"}
            </button>
            {([1, 2, 3] as const).map((speed) => (
              <button
                key={speed}
                onClick={() => dispatch({ type: "SET_SPEED", speed })}
                title={`Auto-advance speed ${speed}×`}
                style={{
                  padding: "2px 8px",
                  fontSize: 11,
                  borderRadius: 3,
                  cursor: "pointer",
                  border: state.speed === speed ? "1px solid #4ecca3" : "1px solid #444",
                  background: state.speed === speed ? "#1a4040" : "#222",
                  color: state.speed === speed ? "#4ecca3" : "#888",
                  opacity: autoplay ? 1 : 0.5,
                }}
              >
                {speed}×
              </button>
            ))}
            <button
              onClick={() => setAutoPauseOnEvents(!autoPauseOnEvents)}
              title="Auto-pause when something needs attention"
              style={{
                padding: "2px 6px",
                fontSize: 11,
                borderRadius: 3,
                cursor: "pointer",
                border: autoPauseOnEvents ? "1px solid #4ecca3" : "1px solid #444",
                background: autoPauseOnEvents ? "#1a4040" : "#222",
                color: autoPauseOnEvents ? "#4ecca3" : "#888",
              }}
            >
              🔔
            </button>
          </div>

          <div style={divider} />

          {/* Finance + Market buttons */}
          <button
            onClick={() => setShowFinancePanel(true)}
            style={{
              padding: "2px 10px",
              fontSize: 11,
              border: "1px solid #555",
              borderRadius: 3,
              background: "#222",
              color: "#4ecca3",
              cursor: "pointer",
            }}
          >
            Finance
          </button>
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
