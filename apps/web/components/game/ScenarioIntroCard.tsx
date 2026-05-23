"use client";

/**
 * One-shot intro for the active scenario. Fires the first turn after the
 * player clicks "Start Farming" on a scenario that opts in (currently
 * First Harvest). The point is *framing*, not tutoring: the OnboardingCoach
 * teaches the mechanics; this card tells the player what they're trying to
 * do and what the obvious first move is.
 *
 * Once dismissed, persisted to localStorage per scenario id so it doesn't
 * fire again on retries — but `Start Farming` again does count as a new
 * playthrough (the flag is keyed on scenario id, not session).
 */

import { useEffect, useState } from "react";
import { useGameStore } from "../../stores/game-store";

interface ScenarioIntroCopy {
  title: string;
  goalLine: string;
  body: string;
  firstMove: string;
}

const INTROS: Record<string, ScenarioIntroCopy> = {
  first_harvest: {
    title: "First Harvest",
    goalLine: "Reach the net-worth target before turn 12 ends.",
    body:
      "You start with two central plots, a small cash cushion, and 12 labor a month. " +
      "One year (12 monthly turns) to prove the farm can pay for itself. " +
      "Wheat takes 2 months to grow and sells well; lettuce takes 1 month and " +
      "is the fastest way to cash flow.",
    firstMove:
      "Suggested first move: pick the Field tool, drag a small (8-12 tile) " +
      "rectangle on your owned dirt, plow it, plant lettuce or wheat.",
  },
};

function storageKey(scenarioId: string): string {
  return `farmgame.scenarioIntro.dismissed.${scenarioId}`;
}

export function ScenarioIntroCard() {
  const state = useGameStore((s) => s.state);
  const lastConfig = useGameStore((s) => s.lastConfig);
  const [open, setOpen] = useState(false);

  // Figure out which scenario this is. lastConfig doesn't carry the scenario
  // id (the engine doesn't care about it), so we derive it by matching on the
  // goal shape. A bit fragile, but fine until scenarios get their own ids on
  // GameState. First Harvest's signature: net_worth + deadlineTurns 12.
  const scenarioId = (() => {
    if (!state) return null;
    const g = state.goal;
    if (g.type === "net_worth" && g.deadlineTurns === 12) return "first_harvest";
    return null;
  })();

  useEffect(() => {
    if (!state || !scenarioId || !INTROS[scenarioId]) return;
    // Only fire on turn 1 of a fresh game. (state.tick = 0 before any End Turn.)
    if (state.tick !== 0) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(storageKey(scenarioId)) === "1") return;
    setOpen(true);
    // We intentionally don't depend on `state` here — we want this to fire
    // once when the player lands on the start of a tutorial scenario, not
    // again as the game state changes. (state.tick === 0 inside the effect
    // body is the gate that keeps this idempotent.)
  }, [scenarioId, lastConfig]);

  const dismiss = (rememberDismissed: boolean) => {
    if (rememberDismissed && scenarioId && typeof window !== "undefined") {
      window.localStorage.setItem(storageKey(scenarioId), "1");
    }
    setOpen(false);
  };

  if (!open || !scenarioId) return null;
  const copy = INTROS[scenarioId];

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss(false);
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 180,
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
          width: 480,
          maxWidth: "92vw",
          padding: "18px 22px 16px",
          fontSize: 13,
          color: "#cdd5e0",
          lineHeight: 1.5,
        }}
      >
        <div style={{ color: "#4ecca3", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
          {copy.title}
        </div>
        <div style={{ color: "#ffdd57", fontWeight: 600, marginBottom: 10 }}>{copy.goalLine}</div>
        <div style={{ marginBottom: 12 }}>{copy.body}</div>
        <div
          style={{
            padding: "8px 10px",
            background: "#0f1a2e",
            border: "1px solid #2a3f6a",
            borderRadius: 4,
            fontSize: 12,
            color: "#7ddf64",
            marginBottom: 14,
          }}
        >
          {copy.firstMove}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={() => dismiss(false)}
            style={{
              background: "none",
              border: "1px solid #3a4a6a",
              borderRadius: 4,
              color: "#9db4d0",
              padding: "5px 12px",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Show me next time
          </button>
          <button
            onClick={() => dismiss(true)}
            style={{
              padding: "5px 16px",
              fontSize: 12,
              fontWeight: 700,
              border: "1px solid #4ecca3",
              background: "#1a4040",
              color: "#4ecca3",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Start →
          </button>
        </div>
      </div>
    </div>
  );
}
