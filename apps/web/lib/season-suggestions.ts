/**
 * Reactive strategy suggestions derived from a season's causes. The
 * SeasonSummaryPanel runs the causes through these triggers and shows
 * any that fire as inline callouts at the bottom of the modal.
 *
 * Each suggestion is opt-in: it only fires when its threshold was
 * actually crossed *this season*. Quiet otherwise — we never want to
 * nag a player who isn't having that problem.
 */

import type { Cause } from "@farmgame/engine";

export interface Suggestion {
  /** Stable id — useful for keys, never shown to the player. */
  id: string;
  /** Short headline; bolded in the UI. */
  headline: string;
  /** One-line body explaining what to do. */
  body: string;
}

interface SeasonTotals {
  /** Growth-bar fraction lost to drought this season. */
  growthLostMoisture: number;
  /** Cumulative weed-pressure health damage. */
  weedHealthLost: number;
  /** Cumulative pest-pressure health damage. */
  pestHealthLost: number;
  /** Animals lost to starvation. */
  animalsStarved: number;
  /** Seasonal expense charged this season. */
  seasonalExpense: number;
  /** Revenue earned from harvests this season (sum of harvest_complete values). */
  harvestRevenue: number;
}

/** Compute the totals the triggers compare against, from one season's causes. */
export function summariseSeasonForSuggestions(causes: Cause[], pricesPerUnit: Record<string, number>): SeasonTotals {
  const totals: SeasonTotals = {
    growthLostMoisture: 0,
    weedHealthLost: 0,
    pestHealthLost: 0,
    animalsStarved: 0,
    seasonalExpense: 0,
    harvestRevenue: 0,
  };
  for (const c of causes) {
    switch (c.kind) {
      case "growth_delayed":
        totals.growthLostMoisture += c.fromMoisture * c.growthBarLost;
        break;
      case "weed_pressure":
        totals.weedHealthLost += c.healthLost;
        break;
      case "pest_pressure":
        totals.pestHealthLost += c.healthLost;
        break;
      case "animal_starved":
        totals.animalsStarved += 1;
        break;
      case "seasonal_expense":
        totals.seasonalExpense += c.total;
        break;
      case "harvest_complete": {
        const price = pricesPerUnit[c.cropId] ?? 0;
        totals.harvestRevenue += c.quantity * price;
        break;
      }
    }
  }
  return totals;
}

/** The five triggers the user asked for in PR U. Each returns a Suggestion
 *  when its threshold is crossed for this season, null otherwise. */
export function deriveSeasonSuggestions(totals: SeasonTotals): Suggestion[] {
  const out: Suggestion[] = [];

  // 1. Drought
  if (totals.growthLostMoisture > 0.3) {
    out.push({
      id: "drought-water-pump",
      headline: `Drought cost ~${(totals.growthLostMoisture).toFixed(1)} of a crop cycle this season.`,
      body: "Build a Water Pump ($300, 5-tile radius) or a Windmill ($800, 8-tile radius) near your fields.",
    });
  }

  // 2. Weeds
  if (totals.weedHealthLost > 0.4) {
    out.push({
      id: "weeds-spray",
      headline: `Weeds knocked ~${Math.round(totals.weedHealthLost * 100)}% off field health this season.`,
      body: "Use the Spray tool with herbicide on affected fields to reset weeds.",
    });
  }

  // 3. Pests
  if (totals.pestHealthLost > 0.4) {
    out.push({
      id: "pests-spray",
      headline: `Pests knocked ~${Math.round(totals.pestHealthLost * 100)}% off field health this season.`,
      body: "Spray pesticide on affected fields. Pest-tolerant crops (wheat, sunflowers) also help if you're near a forest.",
    });
  }

  // 4. Starving livestock
  if (totals.animalsStarved >= 1) {
    out.push({
      id: "feed-shortage",
      headline: `${totals.animalsStarved} animal${totals.animalsStarved === 1 ? "" : "s"} starved this season.`,
      body: "Plant a clover field (forage cover) — it feeds livestock and restores nitrogen, and it grows in 1 month.",
    });
  }

  // 5. Expenses > 50% of revenue
  if (totals.harvestRevenue > 0 && totals.seasonalExpense > totals.harvestRevenue * 0.5) {
    const pct = Math.round((totals.seasonalExpense / totals.harvestRevenue) * 100);
    out.push({
      id: "expense-ratio",
      headline: `Seasonal expenses were ${pct}% of harvest revenue.`,
      body: "Consider consolidating fields (fewer field-overhead charges) or selling underused equipment to cut upkeep.",
    });
  } else if (totals.harvestRevenue === 0 && totals.seasonalExpense > 200) {
    // Zero-revenue season with real expenses → almost certainly bleeding cash.
    out.push({
      id: "expense-no-revenue",
      headline: `No harvest revenue this season — expenses were $${totals.seasonalExpense}.`,
      body: "Plant a quick crop (lettuce, 1 month) to cover next season's expenses.",
    });
  }

  return out;
}
