/**
 * Reactive strategy suggestions derived from a season's causes. The
 * SeasonSummaryPanel runs the causes through these triggers and shows
 * any that fire as inline callouts at the bottom of the modal.
 *
 * Each suggestion is opt-in: it only fires when its threshold was
 * actually crossed *this season*. Quiet otherwise — we never want to
 * nag a player who isn't having that problem.
 *
 * Threshold philosophy: every metric must reflect *visible* player damage,
 * not slow internal accumulators. The PR W tuning split: weed/pest/
 * nutrient suggestions now read from `harvest_complete.reductions` (the
 * actual yield fractions the player sees in their harvest line), not
 * from per-turn health-pressure events that rarely accumulate enough to
 * fire over a single season.
 */

import type { Cause, NutrientKey } from "@farmgame/engine";

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
  /** Cumulative weed-pressure health damage (kept for telemetry / debug). */
  weedHealthLost: number;
  /** Cumulative pest-pressure health damage (kept for telemetry / debug). */
  pestHealthLost: number;
  /** Number of harvests this season. */
  harvestCount: number;
  /** Average yield-fraction lost to weeds across this season's harvests. */
  avgHarvestWeedLoss: number;
  /** Average yield-fraction lost to non-weed health (pests, frost, …). */
  avgHarvestHealthLoss: number;
  /** Average yield-fraction lost to nutrient depletion. */
  avgHarvestNutrientLoss: number;
  /** The nutrient that was limiting most often this season, if any. */
  dominantLimitingNutrient: NutrientKey | null;
  /** Animals lost to starvation. */
  animalsStarved: number;
  /** Seasonal expense charged this season. */
  seasonalExpense: number;
  /** Revenue earned from harvests this season (sum of harvest_complete values). */
  harvestRevenue: number;
}

/** Compute the totals the triggers compare against, from one season's causes. */
export function summariseSeasonForSuggestions(
  causes: Cause[],
  pricesPerUnit: Record<string, number>,
): SeasonTotals {
  const totals: SeasonTotals = {
    growthLostMoisture: 0,
    weedHealthLost: 0,
    pestHealthLost: 0,
    harvestCount: 0,
    avgHarvestWeedLoss: 0,
    avgHarvestHealthLoss: 0,
    avgHarvestNutrientLoss: 0,
    dominantLimitingNutrient: null,
    animalsStarved: 0,
    seasonalExpense: 0,
    harvestRevenue: 0,
  };

  const nutrientCount: Record<NutrientKey, number> = { n: 0, p: 0, k: 0 };
  let sumWeedLoss = 0;
  let sumHealthLoss = 0;
  let sumNutrientLoss = 0;

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
        totals.harvestCount += 1;
        sumWeedLoss += c.reductions.weeds;
        sumHealthLoss += c.reductions.health;
        sumNutrientLoss += c.reductions.nutrients;
        if (c.limitingNutrient) nutrientCount[c.limitingNutrient] += 1;
        break;
      }
    }
  }

  if (totals.harvestCount > 0) {
    totals.avgHarvestWeedLoss = sumWeedLoss / totals.harvestCount;
    totals.avgHarvestHealthLoss = sumHealthLoss / totals.harvestCount;
    totals.avgHarvestNutrientLoss = sumNutrientLoss / totals.harvestCount;
    // Pick the nutrient that limited the most harvests.
    let topKey: NutrientKey | null = null;
    let topVal = 0;
    for (const k of ["n", "p", "k"] as NutrientKey[]) {
      if (nutrientCount[k] > topVal) {
        topVal = nutrientCount[k];
        topKey = k;
      }
    }
    totals.dominantLimitingNutrient = topKey;
  }

  return totals;
}

const NUTRIENT_NAME: Record<NutrientKey, string> = {
  n: "nitrogen",
  p: "phosphorus",
  k: "potassium",
};

/** Suggestion triggers. Each fires when its threshold is crossed for this
 *  season; quiet otherwise. */
export function deriveSeasonSuggestions(totals: SeasonTotals): Suggestion[] {
  const out: Suggestion[] = [];

  // 1. Drought (unchanged — growth-loss is already a real-damage metric).
  if (totals.growthLostMoisture > 0.3) {
    out.push({
      id: "drought-water-pump",
      headline: `Drought cost ~${totals.growthLostMoisture.toFixed(1)} of a crop cycle this season.`,
      body: "Build a Water Pump ($300, 5-tile radius) or a Windmill ($800, 8-tile radius) near your fields.",
    });
  }

  // 2. Weeds — fire on visible harvest reductions. Old threshold (cumulative
  //    healthLost > 0.4) never fired in playtest because weed-pressure
  //    health damage accumulates ~0.006 per turn, while harvest reductions
  //    were silently eating 30-45% of every yield. New: trigger when the
  //    season's harvests averaged ≥25% yield loss to weeds.
  if (totals.harvestCount > 0 && totals.avgHarvestWeedLoss >= 0.25) {
    const pct = Math.round(totals.avgHarvestWeedLoss * 100);
    out.push({
      id: "weeds-spray",
      headline: `Weeds cut harvests by ~${pct}% this season.`,
      body: "Use the Spray tool with herbicide on affected fields between planting and harvest.",
    });
  }

  // 3. Pests / health — `harvest_complete.reductions.health` folds pests,
  //    frost, and other health-stress damage. Pest pressure still emits
  //    its own per-turn cause; we fold both signals together so the
  //    suggestion fires whether the pressure manifests as accumulated
  //    health damage OR as a single late-season pest infestation that
  //    cut a harvest.
  if (
    (totals.harvestCount > 0 && totals.avgHarvestHealthLoss >= 0.2) ||
    totals.pestHealthLost > 0.15
  ) {
    const pct = totals.harvestCount > 0 ? Math.round(totals.avgHarvestHealthLoss * 100) : null;
    const head = pct != null
      ? `Pests / damage cut harvests by ~${pct}% this season.`
      : `Pest pressure ate ~${Math.round(totals.pestHealthLost * 100)}% of field health.`;
    out.push({
      id: "pests-spray",
      headline: head,
      body: "Spray pesticide on affected fields. Pest-tolerant crops (wheat, sunflowers) also help if you're near a forest.",
    });
  }

  // 4. Nutrient depletion — fire when a season's harvests averaged ≥15%
  //    yield loss to soil nutrients. Surfaces the rotation/manure decision.
  if (totals.harvestCount > 0 && totals.avgHarvestNutrientLoss >= 0.15) {
    const pct = Math.round(totals.avgHarvestNutrientLoss * 100);
    const lim = totals.dominantLimitingNutrient
      ? ` (${NUTRIENT_NAME[totals.dominantLimitingNutrient]} was the bottleneck)`
      : "";
    out.push({
      id: "soil-rotation",
      headline: `Soil shortage cut harvests by ~${pct}% this season${lim}.`,
      body: "Spread manure on the field's inspector panel, or rotate to soybeans/clover (legumes fix nitrogen).",
    });
  }

  // 5. Starving livestock (unchanged).
  if (totals.animalsStarved >= 1) {
    out.push({
      id: "feed-shortage",
      headline: `${totals.animalsStarved} animal${totals.animalsStarved === 1 ? "" : "s"} starved this season.`,
      body: "Plant a clover field (forage cover) — it feeds livestock and restores nitrogen, and it grows in 1 month.",
    });
  }

  // 6. Expense ratio (unchanged).
  if (totals.harvestRevenue > 0 && totals.seasonalExpense > totals.harvestRevenue * 0.5) {
    const pct = Math.round((totals.seasonalExpense / totals.harvestRevenue) * 100);
    out.push({
      id: "expense-ratio",
      headline: `Seasonal expenses were ${pct}% of harvest revenue.`,
      body: "Consider consolidating fields (fewer field-overhead charges) or selling underused equipment to cut upkeep.",
    });
  } else if (totals.harvestRevenue === 0 && totals.seasonalExpense > 200) {
    out.push({
      id: "expense-no-revenue",
      headline: `No harvest revenue this season — expenses were $${totals.seasonalExpense}.`,
      body: "Plant a quick crop (lettuce, 1 month) to cover next season's expenses.",
    });
  }

  return out;
}
