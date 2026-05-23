"use client";

/**
 * First-session coach card. Pinned bottom-left of the canvas (the notifications
 * area sits bottom-center; the info panel sits right; this corner is otherwise
 * empty). It walks the player through the buy → designate → plow → plant →
 * harvest → sell loop, auto-advancing as the game state changes.
 *
 * Dismissible from the × button. The dismissed flag is persisted in
 * localStorage via the ui-store, so it doesn't pester returning players. The
 * "?" button in the HUD reopens it.
 */

import { useGameStore } from "../../stores/game-store";
import { useUIStore } from "../../stores/ui-store";
import { currentOnboardingStep, onboardingHint } from "../../lib/onboarding";

const ALL_STEPS = ["designate", "plow", "plant", "labor", "wait", "harvest", "sell"] as const;

export function OnboardingCoach() {
  const state = useGameStore((s) => s.state);
  const dismissed = useUIStore((s) => s.onboardingDismissed);
  const dismissOnboarding = useUIStore((s) => s.dismissOnboarding);

  if (!state || dismissed) return null;

  const step = currentOnboardingStep(state);
  const hint = onboardingHint(step);
  const completedCount = step === "done" ? ALL_STEPS.length : ALL_STEPS.indexOf(step as (typeof ALL_STEPS)[number]);
  const pct = Math.round((completedCount / ALL_STEPS.length) * 100);

  return (
    <div
      role="region"
      aria-label="Getting started"
      style={{
        position: "absolute",
        bottom: 16,
        left: 16,
        width: 270,
        padding: "10px 12px 11px",
        background: "rgba(10, 14, 25, 0.94)",
        border: "1px solid #2a3a5a",
        borderLeft: "3px solid #4ecca3",
        borderRadius: 5,
        boxShadow: "0 4px 14px rgba(0, 0, 0, 0.4)",
        color: "#cdd5e0",
        fontSize: 11.5,
        lineHeight: 1.4,
        zIndex: 60,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 9, letterSpacing: 0.6, color: "#7a8a9a", fontWeight: 600 }}>
          GETTING STARTED · {completedCount}/{ALL_STEPS.length}
        </span>
        <button
          onClick={dismissOnboarding}
          aria-label="Dismiss the getting-started card"
          title="Dismiss (reopen from the ? button)"
          style={{
            background: "none",
            border: "none",
            color: "#7a8a9a",
            cursor: "pointer",
            fontSize: 14,
            lineHeight: 1,
            padding: "0 2px",
          }}
        >
          ×
        </button>
      </div>

      {/* Progress strip */}
      <div style={{ height: 3, background: "#1a2540", borderRadius: 2, overflow: "hidden", marginBottom: 8 }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "#4ecca3",
            transition: "width 320ms ease",
          }}
        />
      </div>

      <div style={{ color: "#4ecca3", fontWeight: 600, marginBottom: 2 }}>{hint.title}</div>
      <div>{hint.body}</div>

      {step === "done" && (
        <button
          onClick={dismissOnboarding}
          style={{
            marginTop: 8,
            padding: "3px 10px",
            fontSize: 11,
            border: "1px solid #4ecca3",
            borderRadius: 3,
            background: "#1a4040",
            color: "#4ecca3",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      )}
    </div>
  );
}
