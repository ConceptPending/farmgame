"use client";

/**
 * End-of-season summary panel. Fires on season-rollover turns (when the
 * engine's `season_change` cause shows up) instead of the per-turn
 * TurnSummaryPanel — the two never both fire on the same turn so the
 * player isn't double-modal'd. Shows the same cause groups as the
 * TurnSummaryPanel but aggregated across the three turns of the season,
 * plus a reactive-strategy suggestions block at the bottom.
 *
 * Persists "don't show again this game" to localStorage.
 */

import { useEffect, useState } from "react";
import { useGameStore } from "../../stores/game-store";
import { causeCategory, causeCopy, causePriority, type Cause, type CauseCategory } from "@farmgame/engine";
import {
  summariseSeasonForSuggestions,
  deriveSeasonSuggestions,
} from "../../lib/season-suggestions";

const SUPPRESS_KEY = "farmgame.seasonSummary.suppressed";

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

/** Collapse the season's hundreds of per-turn causes into a few summary
 *  lines per category. e.g. 12 drought_stress causes → one "Drought hit
 *  your fields on 12 monthly turns" line. */
function summariseCategory(cat: CauseCategory, causes: Cause[]): string[] {
  if (causes.length === 0) return [];
  if (cat === "harvest") {
    // One line per harvest — short enough at the season scale (≤ 3 turns).
    return causes
      .filter((c) => c.kind === "harvest_complete")
      .sort((a, b) => causePriority(b) - causePriority(a))
      .map((c) => causeCopy(c));
  }
  if (cat === "weather_crop") {
    // Count + show distinct kinds.
    const lines: string[] = [];
    const drought = causes.filter((c) => c.kind === "drought_stress").length;
    const heat = causes.filter((c) => c.kind === "heat_stress").length;
    const frostDamage = causes.filter((c) => c.kind === "frost_damage").length;
    const frostKill = causes.filter((c) => c.kind === "frost_kill").length;
    const ready = causes.filter((c) => c.kind === "ready_to_harvest").length;
    const died = causes.filter((c) => c.kind === "crop_died_health").length;
    // PR V copy fix: "Drought hit your fields N×" read as "all fields, N times"
    // in playtest. The metric is field-turn events; "N field-turns of drought"
    // is the honest framing. Same for heat.
    if (drought > 0) lines.push(`${drought} field-turn${drought === 1 ? "" : "s"} of drought stress.`);
    if (heat > 0) lines.push(`${heat} field-turn${heat === 1 ? "" : "s"} of heat stress.`);
    if (frostDamage > 0) lines.push(`Frost damaged ${frostDamage} field${frostDamage === 1 ? "" : "s"}.`);
    if (frostKill > 0) lines.push(`Frost killed ${frostKill} field${frostKill === 1 ? "" : "s"}.`);
    if (ready > 0) lines.push(`${ready} field${ready === 1 ? "" : "s"} reached harvest.`);
    if (died > 0) lines.push(`${died} field${died === 1 ? "" : "s"} died from poor health.`);
    return lines;
  }
  if (cat === "field_health") {
    const weedsCrit = causes.filter((c) => c.kind === "weeds_critical").length;
    const pestsCrit = causes.filter((c) => c.kind === "pests_critical").length;
    const lines: string[] = [];
    if (weedsCrit > 0) lines.push(`Weeds crossed critical on ${weedsCrit} field${weedsCrit === 1 ? "" : "s"}.`);
    if (pestsCrit > 0) lines.push(`Pests crossed critical on ${pestsCrit} field${pestsCrit === 1 ? "" : "s"}.`);
    return lines;
  }
  if (cat === "livestock") {
    const born = causes.filter((c) => c.kind === "animal_born").length;
    const starved = causes.filter((c) => c.kind === "animal_starved").length;
    const lost = causes.filter((c) => c.kind === "animal_lost_predator" || c.kind === "animal_lost_wandered").length;
    const cramped = causes.filter((c) => c.kind === "animal_lost_crowding").length;
    const manure = causes
      .filter((c) => c.kind === "manure_produced")
      .reduce((sum, c) => sum + (c.kind === "manure_produced" ? c.amount : 0), 0);
    const lines: string[] = [];
    if (born > 0) lines.push(`${born} animal${born === 1 ? "" : "s"} born.`);
    if (starved > 0) lines.push(`${starved} starved for lack of feed.`);
    if (lost > 0) lines.push(`${lost} lost to predators or escape.`);
    if (cramped > 0) lines.push(`${cramped} died in cramped pens.`);
    if (manure > 0) lines.push(`+${manure} manure produced.`);
    return lines;
  }
  if (cat === "finance") {
    // Should be exactly one seasonal_expense per season.
    return causes
      .filter((c) => c.kind === "seasonal_expense" || c.kind === "interest_charged")
      .map(causeCopy);
  }
  if (cat === "market") {
    // Just the events; rival-pressure causes fire every turn and are noisy.
    return causes
      .filter((c) => c.kind === "market_event_spike" || c.kind === "market_event_crash")
      .map(causeCopy);
  }
  // Default: just list everything.
  return causes
    .sort((a, b) => causePriority(b) - causePriority(a))
    .map(causeCopy);
}

function isNotable(cause: Cause): boolean {
  // Skip the bookkeeping causes that fire every turn but aren't player-actionable.
  if (cause.kind === "season_change") return false;
  if (cause.kind === "rival_supply_pressure") return false;
  if (cause.kind === "labor_unused") return false; // shown in DebugReport; noisy in a season view
  if (cause.kind === "growth_delayed") return false; // suggestions surface the aggregate
  return true;
}

function groupCauses(causes: Cause[]): Map<CauseCategory, Cause[]> {
  const m = new Map<CauseCategory, Cause[]>();
  for (const c of causes) {
    if (!isNotable(c)) continue;
    const cat = causeCategory(c);
    const list = m.get(cat) ?? [];
    list.push(c);
    m.set(cat, list);
  }
  return m;
}

export function SeasonSummaryPanel() {
  const causes = useGameStore((s) => s.lastSeasonCauses);
  const clear = useGameStore((s) => s.clearSeasonSummary);
  const state = useGameStore((s) => s.state);
  const seenSuggestionIds = useGameStore((s) => s.seenSuggestionIds);
  const markSuggestionsSeen = useGameStore((s) => s.markSuggestionsSeen);

  const [suppressed, setSuppressed] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setSuppressed(window.localStorage.getItem(SUPPRESS_KEY) === "1");
  }, []);

  if (suppressed || causes.length === 0) return null;

  const grouped = groupCauses(causes);
  // After the season-rollover tick, `state.season` is the NEW season's name.
  // The summary describes the season that JUST FINISHED, so derive its label
  // from the embedded `season_change` cause if present, fallback to prev-of-current.
  const sc = causes.find((c) => c.kind === "season_change");
  // sc.season is the NEW season (engine emits it that way). Walk back to find the previous.
  const SEASON_ORDER = ["spring", "summer", "fall", "winter"];
  const idx = sc && sc.kind === "season_change" ? SEASON_ORDER.indexOf(sc.season) : -1;
  const prev = idx >= 0 ? SEASON_ORDER[(idx + SEASON_ORDER.length - 1) % SEASON_ORDER.length] : (state?.season ?? "season");
  const prevYear = sc && sc.kind === "season_change" && idx === 0 ? sc.year - 1 : (sc && sc.kind === "season_change" ? sc.year : state?.year ?? 1);
  const header = `${prev.charAt(0).toUpperCase() + prev.slice(1)} of Year ${prevYear}`;

  // Compute suggestions, then filter out any the player has already been
  // shown this game. "Once" is the PR V agreement: a single nudge per
  // problem, then trust them to act on it. Reset on new game / load.
  const prices = state?.market.prices ?? {};
  const totals = summariseSeasonForSuggestions(causes, prices);
  const allSuggestions = deriveSeasonSuggestions(totals);
  const suggestions = allSuggestions.filter((s) => !seenSuggestionIds.includes(s.id));

  const toggleSuppress = (next: boolean) => {
    if (typeof window !== "undefined") {
      if (next) window.localStorage.setItem(SUPPRESS_KEY, "1");
      else window.localStorage.removeItem(SUPPRESS_KEY);
    }
    setSuppressed(next);
    if (next) clear();
  };

  // When Continue is clicked (or panel dismissed), mark every visible
  // suggestion as seen so it doesn't repeat next season.
  const dismiss = () => {
    if (suggestions.length > 0) markSuggestionsSeen(suggestions.map((s) => s.id));
    clear();
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) clear(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 160,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(7, 11, 22, 0.6)", backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          background: "#16213e",
          border: "1px solid #2a3f6a",
          borderRadius: 10,
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.55)",
          width: 620, maxWidth: "92vw", maxHeight: "88vh",
          display: "flex", flexDirection: "column", overflow: "hidden",
          fontSize: 13,
        }}
      >
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid #0f3460", background: "#13203c",
          }}
        >
          <h3 style={{ margin: 0, color: "#ffdd57", fontSize: 15 }}>
            {header} <span style={{ color: "#7a8a9a", fontWeight: 400, fontSize: 12 }}>· season summary</span>
          </h3>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            title="Continue (Esc)"
            style={{
              background: "none", border: "1px solid #3a4a6a", borderRadius: 6,
              color: "#9db4d0", cursor: "pointer", padding: "2px 9px", fontSize: 14,
            }}
          >✕</button>
        </div>

        <div style={{ padding: 14, overflowY: "auto" }}>
          {CATEGORY_ORDER.map((cat) => {
            const list = grouped.get(cat) ?? [];
            const lines = summariseCategory(cat, list);
            if (lines.length === 0) return null;
            return (
              <Section key={cat} label={CATEGORY_LABEL[cat]} accent={CATEGORY_COLOR[cat]}>
                <ul style={{ margin: 0, paddingLeft: 18, color: "#cdd5e0", lineHeight: 1.5 }}>
                  {lines.map((line, i) => <li key={i} style={{ marginBottom: 2 }}>{line}</li>)}
                </ul>
              </Section>
            );
          })}

          {suggestions.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #1a2540" }}>
              <div
                style={{
                  fontSize: 10, letterSpacing: 0.6, color: "#7ddf64",
                  fontWeight: 700, textTransform: "uppercase", marginBottom: 8,
                }}
              >
                Suggestions
              </div>
              {suggestions.map((s) => (
                <div
                  key={s.id}
                  style={{
                    padding: "8px 10px", marginBottom: 6,
                    background: "#0f1a2e", borderLeft: "3px solid #7ddf64", borderRadius: 4,
                  }}
                >
                  <div style={{ color: "#cdd5e0", fontWeight: 600, marginBottom: 2 }}>{s.headline}</div>
                  <div style={{ color: "#9db4d0", fontSize: 12 }}>{s.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 14px", borderTop: "1px solid #0f3460", background: "#13203c",
          }}
        >
          <label style={{ fontSize: 11, color: "#7a8a9a", display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={suppressed}
              onChange={(e) => toggleSuppress(e.target.checked)}
            />
            Don't show season summaries again this game
          </label>
          <button
            onClick={dismiss}
            style={{
              padding: "5px 16px", fontSize: 12, fontWeight: 700, borderRadius: 4, cursor: "pointer",
              border: "1px solid #4ecca3", background: "#1a4040", color: "#4ecca3",
            }}
          >Continue</button>
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
          fontSize: 10, letterSpacing: 0.6, color: accent, fontWeight: 700,
          textTransform: "uppercase", marginBottom: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}
