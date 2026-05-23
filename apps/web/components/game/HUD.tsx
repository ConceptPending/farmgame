"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { isAudioEnabled, playSound, setAudioEnabled } from "../../lib/sounds";
import { useGameStore } from "../../stores/game-store";
import { useUIStore } from "../../stores/ui-store";
import { TOOL_CATALOG, goalProgress } from "@farmgame/engine";
import { OverlaySelector } from "./OverlaySelector";
import { NOTIFICATION_COLOR, NOTIFICATION_GLYPH } from "./notifications";
import { Icon } from "../ui/Icon";
import { useAnimatedNumber, useNumberPulse, usePulseOnChange } from "./juice-hooks";
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
  const autoplay = useGameStore((s) => s.autoplay);
  const toggleAutoplay = useGameStore((s) => s.toggleAutoplay);
  const autoPauseOnEvents = useGameStore((s) => s.autoPauseOnEvents);
  const setAutoPauseOnEvents = useGameStore((s) => s.setAutoPauseOnEvents);
  const advanceDays = useGameStore((s) => s.advanceDays);
  const advanceToEvent = useGameStore((s) => s.advanceToEvent);
  const selectedTool = useUIStore((s) => s.selectedTool);
  const openPanel = useUIStore((s) => s.openPanel);
  const activePanel = useUIStore((s) => s.activePanel);

  if (!state) return null;

  const seasonColors: Record<string, string> = {
    spring: "#7ddf64",
    summer: "#ffdd57",
    fall: "#ff8c42",
    winter: "#a8dadc",
  };

  const toolDef = TOOL_CATALOG[selectedTool];
  const progress = goalProgress(state);
  const goalPct = Math.round(progress.pct * 100);
  const goalIsMoney = state.goal.type !== "land_baron" && state.goal.type !== "market_leader";
  const fmtGoal = (n: number) => (goalIsMoney ? `$${n.toLocaleString()}` : `${n}`);

  // Juice: animate the money counter to its new value + briefly flash on
  // gain (green) or loss (red). Pulse the season-day label when season ticks.
  const moneyDisplay = useAnimatedNumber(state.money, 450);
  const moneyDir = useNumberPulse(state.money, 700);
  const seasonPulse = usePulseOnChange(state.season, 800);
  const moneyBaseColor = state.money < 0 ? "#ff6b6b" : "#4ecca3";
  const moneyColor = moneyDir === "up" ? "#7ee0b8" : moneyDir === "down" ? "#ff9090" : moneyBaseColor;
  const moneyShadow = moneyDir === "up"
    ? "0 0 8px rgba(126, 224, 184, 0.55)"
    : moneyDir === "down"
      ? "0 0 8px rgba(255, 144, 144, 0.55)"
      : "none";

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
          // Sit above the panel scrim so its buttons stay live — lets you
          // switch panels or close directly without the scrim eating the click.
          position: "relative",
          zIndex: 200,
        }}
      >
        {/* Money — animates to the new value and briefly flashes on change. */}
        <div
          style={{
            fontSize: 18,
            fontWeight: "bold",
            color: moneyColor,
            textShadow: moneyShadow,
            transition: "color 200ms, text-shadow 200ms",
            minWidth: 70,
          }}
        >
          ${moneyDisplay.toLocaleString()}
        </div>

        {/* Goal progress */}
        <button
          onClick={() => openPanel("finance")}
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
            {progress.label.toUpperCase()} <span style={{ color: "#eee" }}>{fmtGoal(progress.current)}</span>
            {progress.target > 0 && <span> / {fmtGoal(progress.target)}</span>}
            {state.loan > 0 && <span style={{ color: "#ff6b6b" }}> · debt ${state.loan.toLocaleString()}</span>}
          </span>
          <div style={{ width: 120, height: 5, background: "#16213e", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${goalPct}%`, height: "100%", background: "#4ecca3" }} />
          </div>
        </button>

        {/* Season/Day/Year — pulses briefly on season change. */}
        <div
          style={{
            color: seasonColors[state.season] ?? "#eee",
            fontWeight: 600,
            filter: seasonPulse ? "brightness(1.55) drop-shadow(0 0 6px currentColor)" : "none",
            transition: "filter 250ms",
          }}
        >
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
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Icon name="skip" size={11} /> Skip
              </span>
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
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Icon name={autoplay ? "pause" : "play"} size={11} filled />
                Auto
              </span>
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
              <Icon name="bell" size={11} />
            </button>
            <AudioToggleButton />
          </div>

          <div style={divider} />

          {/* Panel buttons — open one modal at a time; active one is highlighted. */}
          <div style={{ display: "flex", gap: 4 }}>
            <PanelButton label="Finance" color="#4ecca3" active={activePanel === "finance"} onClick={() => openPanel("finance")} />
            <PanelButton label="Animals" color="#e0a96d" active={activePanel === "livestock"} onClick={() => openPanel("livestock")} />
            <PanelButton label="Equipment" color="#9db4d0" active={activePanel === "equipment"} onClick={() => openPanel("equipment")} />
            {state.rivals.length > 0 && (
              <PanelButton label="Rivals" color="#ff8c42" active={activePanel === "standings"} onClick={() => openPanel("standings")} />
            )}
            <PanelButton label="Market" color="#ffdd57" active={activePanel === "market"} onClick={() => openPanel("market")} />
            <PanelButton label="Log" color="#9db4d0" active={activePanel === "log"} onClick={() => openPanel("log")} />
          </div>
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
          {notifications.slice(-3).map((n, i) => {
            const color = NOTIFICATION_COLOR[n.type];
            const glyph = NOTIFICATION_GLYPH[n.type];
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 6,
                  padding: "5px 10px",
                  borderRadius: 4,
                  borderLeft: `4px solid ${color}`,
                  fontSize: 11,
                  lineHeight: 1.35,
                  maxWidth: 360,
                  background: "rgba(10, 14, 25, 0.94)",
                  color: "#e0e6ed",
                }}
              >
                <span aria-hidden style={{ color, fontWeight: 700, lineHeight: 1.35 }}>{glyph}</span>
                <span>{n.message}</span>
              </div>
            );
          })}
          {notifications.length > 3 && (
            <button
              onClick={() => openPanel("log")}
              style={{
                marginTop: 2,
                padding: "3px 8px",
                fontSize: 10,
                border: "none",
                borderRadius: 3,
                background: "rgba(10, 14, 25, 0.85)",
                color: "#7a8a9a",
                cursor: "pointer",
                pointerEvents: "auto",
              }}
            >
              +{notifications.length - 3} earlier · view log
            </button>
          )}
        </div>
      )}
    </>
  );
}

/** Compact HUD button that opens a modal panel; highlights when its panel is open. */
function PanelButton({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "2px 10px",
        fontSize: 11,
        borderRadius: 3,
        cursor: "pointer",
        border: `1px solid ${active ? color : "#555"}`,
        background: active ? "#1a4040" : "#222",
        color,
      }}
    >
      {label}
    </button>
  );
}

/** Toggle for the synthesised UI sounds. Off by default; persisted in localStorage. */
function AudioToggleButton() {
  const [on, setOn] = useState(false);
  // Hydrate from localStorage on mount (the sounds module already handles this).
  useEffect(() => setOn(isAudioEnabled()), []);
  const toggle = () => {
    const next = !on;
    setAudioEnabled(next);
    setOn(next);
    // Play a sample on enable so the user knows what they just opted into.
    if (next) playSound("plant");
  };
  return (
    <button
      onClick={toggle}
      title={on ? "Sounds on (click to mute)" : "Sounds off (click to enable)"}
      style={{
        padding: "2px 6px",
        fontSize: 11,
        borderRadius: 3,
        cursor: "pointer",
        border: on ? "1px solid #4ecca3" : "1px solid #444",
        background: on ? "#1a4040" : "#222",
        color: on ? "#4ecca3" : "#888",
      }}
    >
      <Icon name={on ? "volume" : "volume-mute"} size={11} />
    </button>
  );
}
