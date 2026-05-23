"use client";

import { useState } from "react";
import { useGameStore } from "../../stores/game-store";
import {
  SCENARIOS,
  DIFFICULTIES,
  CUSTOM_GOAL_TYPES,
  buildConfig,
  buildCustomConfig,
  type Difficulty,
} from "../../lib/scenarios";
import type { GoalType } from "@farmgame/engine";
import { Icon } from "../ui/Icon";
import { StartScreenBackdrop } from "./StartScreenBackdrop";

export function StartScreen() {
  const startGame = useGameStore((s) => s.startGame);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [selected, setSelected] = useState<string>("prosperity");

  // custom-game fields
  const [goalType, setGoalType] = useState<GoalType>("net_worth");
  const [target, setTarget] = useState(40000);
  const [cash, setCash] = useState(500);
  const [rivalCount, setRivalCount] = useState(2);
  const [seedText, setSeedText] = useState("");

  const isCustom = selected === "custom";
  const scenario = SCENARIOS.find((s) => s.id === selected);

  function start() {
    const seed = seedText.trim() ? Number(seedText.trim()) || undefined : undefined;
    if (isCustom) {
      startGame(
        buildCustomConfig({
          goalType,
          target,
          startingMoney: cash,
          expenseMultiplier: 1,
          rivals: rivalCount,
          seed,
        }),
      );
    } else if (scenario && scenario.available) {
      startGame(buildConfig(scenario, difficulty, { seed }));
    }
  }

  const canStart = isCustom || (scenario?.available ?? false);

  return (
    <div
      style={{
        position: "relative",
        height: "100vh",
        background: "#0d1b2a",
        color: "#eee",
        fontFamily: "system-ui, sans-serif",
        overflowY: "auto",
      }}
    >
      <StartScreenBackdrop />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          padding: 24,
        }}
      >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ margin: 0, color: "#4ecca3", fontSize: 36, letterSpacing: 1, display: "inline-flex", alignItems: "center", gap: 10 }}>
          <Icon name="wheat" size={32} /> FarmGame
        </h1>
        <p style={{ color: "#7a8a9a", margin: "6px 0 0" }}>Choose how you want to play.</p>
      </div>

      {/* Difficulty */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ color: "#7a8a9a", fontSize: 12 }}>DIFFICULTY</span>
        {DIFFICULTIES.map((d) => (
          <button
            key={d.id}
            onClick={() => setDifficulty(d.id)}
            style={segBtn(difficulty === d.id)}
          >
            {d.name}
          </button>
        ))}
      </div>

      {/* Scenario cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 220px)", gap: 12 }}>
        {SCENARIOS.map((s) => {
          const sel = selected === s.id;
          return (
            <button
              key={s.id}
              onClick={() => s.available && setSelected(s.id)}
              disabled={!s.available}
              style={card(sel, s.available)}
            >
              <div style={{ fontWeight: 700, color: s.available ? "#4ecca3" : "#667", marginBottom: 4 }}>
                {s.name}
              </div>
              <div style={{ fontSize: 12, color: "#9db4d0", marginBottom: 8, lineHeight: 1.35 }}>{s.blurb}</div>
              <div style={{ fontSize: 11, color: "#7a8a9a", display: "flex", alignItems: "center", gap: 5 }}>
                <Icon name="target" size={11} color="#ffdd57" />
                {s.goalSummary({ startingMoney: 0, expenseMultiplier: 0, rivalAggr: 0, targetScale: difficultyScale(difficulty) })}
              </div>
              {s.rivals > 0 && (
                <div style={{ fontSize: 11, color: "#7a8a9a", marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
                  <Icon name="tractor" size={11} color="#ff8c42" />
                  {s.rivals} rivals
                </div>
              )}
            </button>
          );
        })}
        {/* Custom card */}
        <button onClick={() => setSelected("custom")} style={card(isCustom, true)}>
          <div style={{ fontWeight: 700, color: "#ffdd57", marginBottom: 4 }}>Custom</div>
          <div style={{ fontSize: 12, color: "#9db4d0", lineHeight: 1.35 }}>
            Pick your own goal, target, starting cash, and seed.
          </div>
        </button>
      </div>

      {/* Custom form */}
      {isCustom && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "center", maxWidth: 700 }}>
          <label style={lbl}>
            Goal
            <select value={goalType} onChange={(e) => setGoalType(e.target.value as GoalType)} style={input}>
              {CUSTOM_GOAL_TYPES.map((g) => (
                <option key={g.type} value={g.type}>{g.name}</option>
              ))}
            </select>
          </label>
          {goalType !== "sandbox" && (
            <label style={lbl}>
              {goalType === "land_baron" ? "Plots" : goalType === "market_leader" ? "Seasons leading" : "Target $"}
              <input type="number" value={target} min={1} onChange={(e) => setTarget(Math.max(1, Number(e.target.value) || 0))} style={input} />
            </label>
          )}
          <label style={lbl}>
            Rivals
            <input type="number" value={rivalCount} min={0} max={4} onChange={(e) => setRivalCount(Math.max(0, Math.min(4, Number(e.target.value) || 0)))} style={input} />
          </label>
          <label style={lbl}>
            Starting cash $
            <input type="number" value={cash} min={0} onChange={(e) => setCash(Math.max(0, Number(e.target.value) || 0))} style={input} />
          </label>
          <label style={lbl}>
            Seed (optional)
            <input value={seedText} onChange={(e) => setSeedText(e.target.value)} placeholder="random" style={input} />
          </label>
        </div>
      )}

      <button onClick={start} disabled={!canStart} style={startBtn(canStart)}>
        Start Farming →
      </button>
      </div>
    </div>
  );
}

function difficultyScale(d: Difficulty): number {
  return d === "easy" ? 0.8 : d === "hard" ? 1.25 : 1;
}

const segBtn = (active: boolean): React.CSSProperties => ({
  padding: "4px 14px",
  fontSize: 12,
  borderRadius: 4,
  cursor: "pointer",
  border: active ? "1px solid #4ecca3" : "1px solid #2a3a4a",
  background: active ? "#1a4040" : "#16213e",
  color: active ? "#4ecca3" : "#9db4d0",
});

const card = (selected: boolean, available: boolean): React.CSSProperties => ({
  textAlign: "left",
  padding: 14,
  borderRadius: 8,
  cursor: available ? "pointer" : "not-allowed",
  opacity: available ? 1 : 0.5,
  border: selected ? "2px solid #4ecca3" : "1px solid #2a3a4a",
  background: selected ? "#15302e" : "#16213e",
  minHeight: 96,
});

const lbl: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  fontSize: 11,
  color: "#7a8a9a",
};

const input: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: 13,
  background: "#0a1628",
  border: "1px solid #2a3a4a",
  borderRadius: 4,
  color: "#eee",
  width: 140,
};

const startBtn = (enabled: boolean): React.CSSProperties => ({
  padding: "10px 28px",
  fontSize: 15,
  fontWeight: 700,
  borderRadius: 6,
  cursor: enabled ? "pointer" : "not-allowed",
  border: "1px solid #4ecca3",
  background: enabled ? "#1a4040" : "#16213e",
  color: enabled ? "#4ecca3" : "#556",
});
