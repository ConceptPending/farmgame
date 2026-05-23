"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { useGameStore } from "../../stores/game-store";
import { useUIStore } from "../../stores/ui-store";
import { TOOL_CATALOG, goalProgress, monthPhase, MONTHS_PER_YEAR, MONTHS_PER_SEASON } from "@farmgame/engine";
import { OverlaySelector } from "./OverlaySelector";
import { NOTIFICATION_COLOR, NOTIFICATION_GLYPH } from "./notifications";
import { Icon } from "../ui/Icon";
import { useAnimatedNumber, useNumberPulse, usePulseOnChange } from "./juice-hooks";
import { autoSave, quickLoad, quickSave } from "../../lib/save-game";
import type { WeatherCondition } from "@farmgame/engine";

const CONDITION_ICONS: Record<WeatherCondition, string> = {
  clear: "☀️",
  cloudy: "⛅",
  rain: "🌧️",
  storm: "⛈️",
  frost: "❄️",
  drought: "🔥",
};

const divider: CSSProperties = { width: 1, height: 18, background: "#0f3460" };

const iconBtnStyle: CSSProperties = {
  padding: "2px 6px",
  fontSize: 11,
  borderRadius: 3,
  cursor: "pointer",
  border: "1px solid #444",
  background: "#222",
  color: "#9db4d0",
};

/** Human-readable "Early/Mid/Late" + capitalized season. */
function calendarLabel(season: string, monthOfSeason: number): string {
  const phase = monthPhase(monthOfSeason);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return `${cap(phase)} ${cap(season)}`;
}

export function HUD() {
  const state = useGameStore((s) => s.state);
  const notifications = useGameStore((s) => s.notifications);
  const endTurn = useGameStore((s) => s.endTurn);
  const loadGameState = useGameStore((s) => s.loadGameState);
  const addNotification = useGameStore((s) => s.addNotification);
  const selectedTool = useUIStore((s) => s.selectedTool);
  const openPanel = useUIStore((s) => s.openPanel);
  const activePanel = useUIStore((s) => s.activePanel);
  const onboardingDismissed = useUIStore((s) => s.onboardingDismissed);
  const reopenOnboarding = useUIStore((s) => s.reopenOnboarding);

  // Autosave on every season change. Primes the ref on the first render so a
  // fresh game doesn't write before any transition.
  const lastSeasonRef = useRef<string | null>(null);
  useEffect(() => {
    if (!state) {
      lastSeasonRef.current = null;
      return;
    }
    const key = `${state.year}-${state.season}`;
    if (lastSeasonRef.current === null) {
      lastSeasonRef.current = key;
      return;
    }
    if (lastSeasonRef.current !== key) {
      lastSeasonRef.current = key;
      autoSave(state);
    }
  }, [state]);

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

  // Juice
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

  // Labor display + pulse on remaining-units change.
  const laborRemaining = state.labor.capacity - state.labor.used;
  const laborPulse = usePulseOnChange(state.labor.used, 350);
  const laborColor = laborRemaining === 0 ? "#ff8c42" : laborRemaining < 3 ? "#ffdd57" : "#9db4d0";

  // Turn position within the year, for the "Turn N / 12" label.
  const turnInYear = ((state.season === "spring" ? 0
    : state.season === "summer" ? 1
      : state.season === "fall" ? 2 : 3) * MONTHS_PER_SEASON) + state.monthOfSeason;

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
          position: "relative",
          zIndex: 200,
        }}
      >
        {/* Money */}
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

        {/* Calendar — "Year 1 · Early Spring" + "Turn N / 12" */}
        <div
          style={{
            color: seasonColors[state.season] ?? "#eee",
            fontWeight: 600,
            filter: seasonPulse ? "brightness(1.55) drop-shadow(0 0 6px currentColor)" : "none",
            transition: "filter 250ms",
            display: "flex",
            flexDirection: "column",
            lineHeight: 1.15,
          }}
        >
          <span>Year {state.year} · {calendarLabel(state.season, state.monthOfSeason)}</span>
          <span style={{ fontSize: 10, color: "#7a8a9a", fontWeight: 400 }}>
            Turn {turnInYear} / {MONTHS_PER_YEAR}
          </span>
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
          {/* Labor budget pip — pulses when it changes. */}
          <div
            title="Monthly labor budget — actions consume labor and refresh when you end the turn."
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              borderRadius: 4,
              border: `1px solid ${laborColor}`,
              background: "#0a1628",
              color: laborColor,
              fontSize: 11,
              fontWeight: 600,
              filter: laborPulse ? "brightness(1.4)" : "none",
              transition: "filter 250ms",
            }}
          >
            <Icon name="tractor" size={11} color={laborColor} />
            Labor {laborRemaining}/{state.labor.capacity}
          </div>

          {/* End Turn — the primary game-loop button. */}
          <button
            onClick={endTurn}
            title="Resolve the month — crops grow, weather changes, labor refreshes."
            style={{
              padding: "6px 16px",
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 4,
              cursor: "pointer",
              border: "1px solid #4ecca3",
              background: "#1a4040",
              color: "#4ecca3",
            }}
          >
            End Turn →
          </button>

          <div style={divider} />

          {/* Quicksave / Quickload */}
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={() => {
                const meta = quickSave(state);
                addNotification({
                  type: meta ? "success" : "error",
                  message: meta ? "Quicksaved." : "Could not quicksave — storage may be full.",
                });
              }}
              title="Quicksave (writes to the quicksave slot)"
              aria-label="Quicksave"
              style={iconBtnStyle}
            >
              <Icon name="save" size={12} />
            </button>
            <button
              onClick={() => {
                const r = quickLoad();
                if (!r.ok) {
                  addNotification({
                    type: "warning",
                    message:
                      r.error.kind === "not_found"
                        ? "No quicksave to load."
                        : r.error.kind === "version_mismatch"
                          ? "Quicksave is from an older version."
                          : "Quicksave is unreadable.",
                  });
                  return;
                }
                loadGameState(r.payload.state);
                addNotification({ type: "info", message: "Quicksave loaded." });
              }}
              title="Quickload (loads the quicksave slot)"
              aria-label="Quickload"
              style={iconBtnStyle}
            >
              <Icon name="load" size={12} />
            </button>
          </div>

          <div style={divider} />

          {/* Panel buttons */}
          <div style={{ display: "flex", gap: 4 }}>
            <PanelButton label="Finance" color="#4ecca3" active={activePanel === "finance"} onClick={() => openPanel("finance")} />
            <PanelButton label="Animals" color="#e0a96d" active={activePanel === "livestock"} onClick={() => openPanel("livestock")} />
            <PanelButton label="Equipment" color="#9db4d0" active={activePanel === "equipment"} onClick={() => openPanel("equipment")} />
            {state.rivals.length > 0 && (
              <PanelButton label="Rivals" color="#ff8c42" active={activePanel === "standings"} onClick={() => openPanel("standings")} />
            )}
            <PanelButton label="Market" color="#ffdd57" active={activePanel === "market"} onClick={() => openPanel("market")} />
            <PanelButton label="Log" color="#9db4d0" active={activePanel === "log"} onClick={() => openPanel("log")} />
            {onboardingDismissed && (
              <button
                onClick={reopenOnboarding}
                title="Reopen the getting-started tips"
                aria-label="Reopen the getting-started tips"
                style={{
                  padding: "2px 8px",
                  fontSize: 11,
                  borderRadius: 3,
                  cursor: "pointer",
                  border: "1px solid #555",
                  background: "#222",
                  color: "#7a8a9a",
                  fontWeight: 700,
                }}
              >
                ?
              </button>
            )}
            <button
              onClick={() => openPanel("settings")}
              title="Settings (save, load, audio, preferences)"
              aria-label="Settings"
              style={{
                ...iconBtnStyle,
                ...(activePanel === "settings"
                  ? { border: "1px solid #9db4d0", background: "#1a4040", color: "#9db4d0" }
                  : {}),
              }}
            >
              <Icon name="settings" size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Notifications toast area */}
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
