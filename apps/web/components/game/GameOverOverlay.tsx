"use client";

import { useGameStore } from "../../stores/game-store";
import { computeNetWorth } from "@farmgame/engine";

export function GameOverOverlay() {
  const state = useGameStore((s) => s.state);
  const startGame = useGameStore((s) => s.startGame);
  const returnToMenu = useGameStore((s) => s.returnToMenu);
  const lastConfig = useGameStore((s) => s.lastConfig);

  if (!state || state.status === "playing") return null;

  const won = state.status === "won";
  const netWorth = computeNetWorth(state);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(5, 10, 20, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
      }}
    >
      <div
        style={{
          background: "#16213e",
          border: `2px solid ${won ? "#4ecca3" : "#ff6b6b"}`,
          borderRadius: 10,
          padding: "28px 36px",
          textAlign: "center",
          minWidth: 320,
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 8 }}>{won ? "🏆" : "💸"}</div>
        <h2 style={{ margin: "0 0 6px", color: won ? "#4ecca3" : "#ff6b6b" }}>
          {won ? "You Win!" : "Bankrupt"}
        </h2>
        <p style={{ color: "#aaa", margin: "0 0 4px", fontSize: 13 }}>
          {won
            ? "You built a farm worth a fortune."
            : "Your debts overwhelmed the farm."}
        </p>
        <p style={{ color: "#eee", margin: "0 0 18px", fontSize: 13 }}>
          Final net worth: <strong style={{ color: "#4ecca3" }}>${netWorth.toLocaleString()}</strong>
          <br />
          <span style={{ color: "#888" }}>
            Year {state.year}, {state.season.charAt(0).toUpperCase() + state.season.slice(1)} Day {state.day}
          </span>
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={() => startGame(lastConfig ?? {})}
            style={{
              padding: "8px 24px",
              fontSize: 14,
              border: "1px solid #4ecca3",
              borderRadius: 5,
              background: "#1a4040",
              color: "#4ecca3",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Play Again
          </button>
          <button
            onClick={() => returnToMenu()}
            style={{
              padding: "8px 24px",
              fontSize: 14,
              border: "1px solid #555",
              borderRadius: 5,
              background: "#222",
              color: "#ccc",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
