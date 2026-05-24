"use client";

/**
 * One-shot tutorial nudge for the early game. Fires after the player ends
 * Turn 1 of a tutorial-shaped (deadline ≤ 12) scenario IF they've planted
 * something but no 1-month crop (lettuce or clover). The point: a new
 * player who picked wheat first will wait 2 turns before any revenue
 * lands, and the OnboardingCoach + ScenarioIntroCard both mention lettuce
 * in passing without making the "fast cash" pattern click.
 *
 * Persists "don't show again this game" via localStorage so retries
 * don't re-pester.
 */

import { useEffect, useState } from "react";
import { useGameStore } from "../../stores/game-store";
import { getCropDef, type CropId } from "@farmgame/engine";

const STORAGE_KEY = "farmgame.lettuceHint.dismissed";

function shouldFire(state: ReturnType<typeof useGameStore.getState>["state"]): boolean {
  if (!state) return false;
  // Only on tutorial-shaped deadline scenarios (the only scenario where
  // 12 turns matters this much). Skip Quick Challenge etc.; the player
  // there is past the tutorial.
  if (state.goal.type !== "net_worth" || state.goal.deadlineTurns !== 12) return false;
  // Player has planted something — otherwise the nudge to plant lettuce
  // would overlap with the OnboardingCoach's "plant" step.
  const planted = state.fields.filter((f) => f.cropId !== null);
  if (planted.length === 0) return false;
  // Anyone already planted a 1-month crop? Then they get it.
  for (const f of planted) {
    if (!f.cropId) continue;
    const def = getCropDef(f.cropId as CropId);
    if (def && def.growthMonths === 1) return false;
  }
  // Fires right after Turn 1 ends (state.tick === 1 is the post-tick value
  // after one END_TURN). Tutorial sweet spot — past the first move, before
  // the first season's expenses hit.
  return state.tick === 1;
}

export function EarlyLettuceHint() {
  const state = useGameStore((s) => s.state);
  const [dismissed, setDismissed] = useState(true); // default closed; opens on `shouldFire`

  useEffect(() => {
    if (typeof window === "undefined") return;
    const persisted = window.localStorage.getItem(STORAGE_KEY) === "1";
    if (persisted) {
      setDismissed(true);
      return;
    }
    if (shouldFire(state)) setDismissed(false);
  }, [state]);

  if (dismissed || !state) return null;

  const dismiss = (rememberAcrossGames: boolean) => {
    if (rememberAcrossGames && typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "1");
    }
    setDismissed(true);
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(false); }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 175,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(7, 11, 22, 0.5)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          background: "#16213e",
          border: "1px solid #2a3f6a",
          borderRadius: 10,
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.45)",
          width: 440,
          maxWidth: "92vw",
          padding: "16px 20px 14px",
          fontSize: 13,
          color: "#cdd5e0",
          lineHeight: 1.5,
        }}
      >
        <div style={{ color: "#7ddf64", fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
          🥬 Quick tip: plant lettuce alongside the wheat
        </div>
        <div style={{ marginBottom: 12 }}>
          Wheat takes 2 monthly turns; you won't see income until Turn 5
          or 6. Lettuce ripens in 1 turn — plant a small lettuce field on
          your next turn for fast cash flow and to cover the first
          season's expenses.
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={() => dismiss(true)}
            style={{
              background: "none",
              border: "1px solid #3a4a6a",
              borderRadius: 4,
              color: "#9db4d0",
              padding: "4px 10px",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Don't show again
          </button>
          <button
            onClick={() => dismiss(false)}
            style={{
              padding: "4px 14px",
              fontSize: 12,
              fontWeight: 700,
              border: "1px solid #4ecca3",
              background: "#1a4040",
              color: "#4ecca3",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
