"use client";

/**
 * End-of-turn summary panel. Groups the structured Cause records emitted by
 * the engine into readable categories (Weather, Crops, Field Health,
 * Livestock, Market, Finance, Events, Labor) so the player can answer
 * "why did this happen?" without reading the raw notification log.
 *
 * Shows automatically after the player ends a turn whenever there's at least
 * one "notable" cause (we filter out pure noise like routine season changes
 * with no other events). Dismissed by Continue or click-outside. A
 * per-game "don't show again" toggle exists in localStorage for veterans.
 */

import { useEffect, useState } from "react";
import { useGameStore } from "../../stores/game-store";
import {
  causeCategory,
  causeCopy,
  causePriority,
  type Cause,
  type CauseCategory,
} from "@farmgame/engine";

/** Stored in localStorage: skip the panel until the player flips it back on. */
const SUPPRESS_KEY = "farmgame.turnSummary.suppressed";

const CATEGORY_LABEL: Record<CauseCategory, string> = {
  weather_crop: "Weather & Crops",
  harvest: "Harvest",
  field_health: "Field Health",
  livestock: "Livestock",
  pens: "Pens",
  market: "Market",
  finance: "Finance",
  event: "Random Events",
  labor: "Labor",
};

const CATEGORY_COLOR: Record<CauseCategory, string> = {
  weather_crop: "#9fc3e8",
  harvest: "#7ddf64",
  field_health: "#ffa454",
  livestock: "#e0a96d",
  pens: "#ff8c42",
  market: "#ffdd57",
  finance: "#4ecca3",
  event: "#ff6b6b",
  labor: "#9db4d0",
};

/** Categories in the order they appear in the panel. */
const CATEGORY_ORDER: CauseCategory[] = [
  "event",
  "weather_crop",
  "harvest",
  "field_health",
  "livestock",
  "pens",
  "market",
  "finance",
  "labor",
];

function isNotableCause(cause: Cause): boolean {
  // Filter out pure noise — we never want a summary popup whose only
  // contents are "Spring of Year 2 has begun." Most other causes are notable
  // by definition.
  if (cause.kind === "season_change") return false;
  return true;
}

function groupCauses(causes: Cause[]): Map<CauseCategory, Cause[]> {
  const m = new Map<CauseCategory, Cause[]>();
  for (const c of causes) {
    if (!isNotableCause(c)) continue;
    const cat = causeCategory(c);
    const list = m.get(cat) ?? [];
    list.push(c);
    m.set(cat, list);
  }
  // Sort each category's entries by priority (high first).
  for (const list of m.values()) {
    list.sort((a, b) => causePriority(b) - causePriority(a));
  }
  return m;
}

export function TurnSummaryPanel() {
  const causes = useGameStore((s) => s.lastTurnCauses);
  const clear = useGameStore((s) => s.clearTurnSummary);
  const state = useGameStore((s) => s.state);

  const [suppressed, setSuppressed] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setSuppressed(window.localStorage.getItem(SUPPRESS_KEY) === "1");
  }, []);

  const grouped = groupCauses(causes);
  const hasAnything = Array.from(grouped.values()).some((g) => g.length > 0);
  if (!hasAnything || suppressed) return null;

  const toggleSuppress = (next: boolean) => {
    if (typeof window !== "undefined") {
      if (next) window.localStorage.setItem(SUPPRESS_KEY, "1");
      else window.localStorage.removeItem(SUPPRESS_KEY);
    }
    setSuppressed(next);
    if (next) clear();
  };

  // Header reads "Mid Spring · Year 1" using the *current* state (we ran
  // after the turn resolved, so this is the month we're now in).
  const monthLabel = state
    ? `${["Early", "Mid", "Late"][state.monthOfSeason - 1] ?? ""} ${state.season.charAt(0).toUpperCase()}${state.season.slice(1)} · Year ${state.year}`
    : "Turn results";

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) clear();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 150,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(7, 11, 22, 0.55)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          background: "#16213e",
          border: "1px solid #2a3f6a",
          borderRadius: 10,
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.5)",
          width: 540,
          maxWidth: "92vw",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontSize: 13,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid #0f3460",
            background: "#13203c",
          }}
        >
          <h3 style={{ margin: 0, color: "#4ecca3", fontSize: 15 }}>
            {monthLabel} <span style={{ color: "#7a8a9a", fontWeight: 400, fontSize: 12 }}>· what happened</span>
          </h3>
          <button
            onClick={clear}
            aria-label="Dismiss"
            title="Continue (Esc)"
            style={{
              background: "none",
              border: "1px solid #3a4a6a",
              borderRadius: 6,
              color: "#9db4d0",
              cursor: "pointer",
              padding: "2px 9px",
              fontSize: 14,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 14, overflowY: "auto" }}>
          {CATEGORY_ORDER.map((cat) => {
            const list = grouped.get(cat);
            if (!list || list.length === 0) return null;
            return (
              <Section key={cat} label={CATEGORY_LABEL[cat]} accent={CATEGORY_COLOR[cat]}>
                <ul style={{ margin: 0, paddingLeft: 18, color: "#cdd5e0", lineHeight: 1.5 }}>
                  {list.map((c, i) => (
                    <li key={i} style={{ marginBottom: 2 }}>
                      {causeCopy(c)}
                    </li>
                  ))}
                </ul>
              </Section>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 14px",
            borderTop: "1px solid #0f3460",
            background: "#13203c",
          }}
        >
          <label style={{ fontSize: 11, color: "#7a8a9a", display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={suppressed}
              onChange={(e) => toggleSuppress(e.target.checked)}
            />
            Don't show this panel again
          </label>
          <button
            onClick={clear}
            style={{
              padding: "5px 16px",
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 4,
              cursor: "pointer",
              border: "1px solid #4ecca3",
              background: "#1a4040",
              color: "#4ecca3",
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ label, accent, children }: { label: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: 0.6,
          color: accent,
          fontWeight: 700,
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
