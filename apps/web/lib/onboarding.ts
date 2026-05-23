/**
 * Onboarding step derivation. Pure function over GameState so the coach card
 * can render the right hint without owning any state of its own — and so we
 * can unit-test the progression without mounting React.
 *
 * The loop we teach (in order). Players start owning two central plots, so
 * `buy_land` is *not* the first beat — the first thing they need to do is
 * designate a field on land they already own.
 *
 *   1. designate    — mark a field from owned tiles
 *   2. plow         — ready a field for planting
 *   3. plant        — pick a crop and plant it
 *   4. wait         — let it grow (handled by the simulation)
 *   5. harvest      — collect when ready
 *   6. sell         — turn inventory into money
 *   7. done         — completed the loop
 */

import type { GameState } from "@farmgame/engine";

export type OnboardingStep =
  | "designate"
  | "plow"
  | "plant"
  | "labor"
  | "wait"
  | "harvest"
  | "sell"
  | "done";

export interface OnboardingHint {
  step: OnboardingStep;
  /** Bold heading for the coach card. */
  title: string;
  /** One-line body explaining the action. */
  body: string;
}

const HINTS: Record<OnboardingStep, Omit<OnboardingHint, "step">> = {
  designate: {
    title: "1. Mark a field",
    body: "You start owning two central plots. Pick the Field tool and click or drag across them to mark a field — a group of tiles you'll farm together.",
  },
  plow: {
    title: "2. Plow the field",
    body: "Pick the Plow tool and click the field. Plowed ground is ready for seed.",
  },
  plant: {
    title: "3. Plant a crop",
    body: "Pick the Plant tool, choose a crop in the sub-palette (the tagline tells you its role), then click the plowed field.",
  },
  labor: {
    title: "4. Mind your labor",
    body: "Every action spends from your monthly Labor budget (top-right). Heavy work like plowing scales with field size. End Turn refreshes it.",
  },
  wait: {
    title: "5. Let it grow",
    body: "Click 'End Turn' in the top bar to advance one month. Each turn refreshes your labor budget and lets crops grow.",
  },
  harvest: {
    title: "6. Harvest",
    body: "When the field reads 'ready', pick the Harvest tool and click it. The yield drops into your inventory.",
  },
  sell: {
    title: "7. Sell at the market",
    body: "Open the inspector on the right and hit Sell on a stored crop — or open the Market panel from the top bar.",
  },
  done: {
    title: "You've got the loop",
    body: "Designate → plow → plant → harvest → sell. From here: buy more land (Buy Land tool, adjacent only), add livestock, and chase your goal. The ? in the bar reopens this card.",
  },
};

/**
 * Pick the earliest unfinished step. We re-evaluate every state change, so the
 * card always reflects what to do *next* — and quietly self-advances as you
 * complete each step.
 */
export function currentOnboardingStep(state: GameState): OnboardingStep {
  // Late-game beats first: a sale completes the loop, inventory means
  // they've harvested and still need to sell. We check these *before* the
  // earlier predicates because after harvest a field can drop back to fallow
  // — we don't want the coach to reverse-advance from "sell" to "plow".
  const hasSoldThisSeason = Object.values(state.seasonSales).some((v) => v > 0);
  if (hasSoldThisSeason && Object.values(state.inventory).every((q) => q === 0)) {
    return "done";
  }
  const hasInventory = Object.values(state.inventory).some((qty) => qty > 0);
  if (hasInventory) return "sell";
  const hasReady = state.fields.some((f) => f.state === "ready");
  if (hasReady) return "harvest";

  // Early-game beats: walk the player into the first sowing.
  const hasField = state.fields.length > 0;
  if (!hasField) return "designate";

  const hasPlowed = state.fields.some(
    (f) => f.state === "plowed" || f.state === "planted" || f.state === "growing",
  );
  if (!hasPlowed) return "plow";

  const hasPlanted = state.fields.some((f) => f.cropId !== null);
  if (!hasPlanted) return "plant";

  // Labor step shows once the player has planted, on the first turn where
  // they've actually spent some labor. After they end the turn (labor.used
  // resets to 0) we advance to "wait".
  if (state.labor.used > 0) return "labor";
  return "wait";
}

export function onboardingHint(step: OnboardingStep): OnboardingHint {
  return { step, ...HINTS[step] };
}
