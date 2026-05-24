/**
 * Causal records emitted by each system during a turn. The point of this
 * module is single-source-of-truth: every notable thing the simulation does
 * gets recorded as a structured Cause, and player-facing copy (notifications,
 * the end-of-turn summary panel, inspector breadcrumbs) is derived from
 * those records — not authored separately and at risk of drifting.
 *
 * Adding a new effect anywhere in the engine: emit a new Cause kind here,
 * extend `causeToNotification` if it deserves a toast, and the UI will pick
 * it up automatically.
 */

import type { CropId } from "./crop.js";
import type { AnimalType } from "./animal.js";
import type { ComfortTier } from "../systems/pen.js";
import type { NutrientKey } from "../systems/soil.js";

/** A structured record of one thing that happened during a turn. */
export type Cause =
  // Weather/crop effects on standing crops -----------------------------
  | { kind: "frost_damage"; fieldId: number; cropId: CropId; healthLost: number }
  | { kind: "frost_kill"; fieldId: number; cropId: CropId }
  | { kind: "drought_stress"; fieldId: number; cropId: CropId; moisture: number; need: number }
  | { kind: "heat_stress"; fieldId: number; cropId: CropId; tempDegF: number }
  | { kind: "weed_pressure"; fieldId: number; weeds: number; healthLost: number }
  | { kind: "pest_pressure"; fieldId: number; pests: number; healthLost: number }
  | { kind: "crop_died_health"; fieldId: number; cropId: CropId }
  | { kind: "ready_to_harvest"; fieldId: number; cropId: CropId }
  /** A growing field had its per-turn growth multiplied by `totalMultiplier`
   *  (< 1) for one of the listed reasons. The contributions sum to roughly
   *  `1 - totalMultiplier`; PR U uses these to attribute season-level
   *  growth loss back to weather / health / soil reasons. */
  | {
      kind: "growth_delayed";
      fieldId: number;
      cropId: CropId;
      totalMultiplier: number;
      fromTemperature: number;
      fromMoisture: number;
      fromHealth: number;
      /** What fraction of one full growth bar was lost this turn. */
      growthBarLost: number;
    }

  // Harvest yield breakdown -------------------------------------------
  | {
      kind: "harvest_complete";
      fieldId: number;
      cropId: CropId;
      quantity: number;
      baseQuantity: number;
      reductions: {
        health: number; // fraction lost to health (0..1)
        weeds: number;
        nutrients: number;
      };
      limitingNutrient: NutrientKey | null;
    }

  // Field health (per-turn pressure even when not damaging yet) -------
  | { kind: "weeds_critical"; fieldId: number; weeds: number }
  | { kind: "pests_critical"; fieldId: number; pests: number }

  // Livestock ---------------------------------------------------------
  | { kind: "animal_born"; species: AnimalType; name: string }
  | { kind: "animal_starved"; species: AnimalType; name: string }
  | { kind: "animal_lost_predator"; species: AnimalType; name: string }
  | { kind: "animal_lost_wandered"; species: AnimalType; name: string }
  | { kind: "animal_lost_crowding"; species: AnimalType; name: string }
  | { kind: "feed_shortfall"; needed: number; consumed: number; affected: number }
  | { kind: "pasture_grazing_saved_feed"; saved: number }
  | { kind: "feed_trough_saved_feed"; saved: number }
  | { kind: "manure_produced"; amount: number }
  | { kind: "comfort_change"; species: AnimalType; tier: ComfortTier; count: number }

  // Pens / fences -----------------------------------------------------
  | { kind: "fence_decay"; averagePct: number }
  | { kind: "fence_breach"; tileIndex: number }

  // Market ------------------------------------------------------------
  | { kind: "rival_supply_pressure"; good: string; pressure: number }
  | { kind: "market_event_spike"; good: string; pct: number }
  | { kind: "market_event_crash"; good: string; pct: number }

  // Finance / time ----------------------------------------------------
  | {
      kind: "seasonal_expense";
      landTax: number;
      upkeep: number;
      interest: number;
      total: number;
    }
  | { kind: "interest_charged"; amount: number; outstandingLoan: number }
  | { kind: "season_change"; season: string; year: number }

  // Random events -----------------------------------------------------
  | { kind: "event_locust" }
  | { kind: "event_hail"; fieldId: number; cropId: CropId }
  | { kind: "event_blight" }
  | { kind: "event_bumper"; fieldId: number; cropId: CropId }
  | { kind: "event_subsidy"; amount: number }
  | { kind: "event_inheritance"; amount: number }
  | { kind: "event_breakdown"; amount: number }

  // Labor / agency ----------------------------------------------------
  | { kind: "labor_unused"; unused: number; capacity: number };

/** The category buckets the UI groups causes into for the turn summary. */
export type CauseCategory =
  | "weather_crop"
  | "harvest"
  | "field_health"
  | "livestock"
  | "pens"
  | "market"
  | "finance"
  | "event"
  | "labor";

/** Which group a cause kind belongs to in the end-of-turn summary panel. */
export function causeCategory(cause: Cause): CauseCategory {
  switch (cause.kind) {
    case "frost_damage":
    case "frost_kill":
    case "drought_stress":
    case "heat_stress":
    case "crop_died_health":
    case "ready_to_harvest":
    case "growth_delayed":
      return "weather_crop";
    case "harvest_complete":
      return "harvest";
    case "weed_pressure":
    case "pest_pressure":
    case "weeds_critical":
    case "pests_critical":
      return "field_health";
    case "animal_born":
    case "animal_starved":
    case "animal_lost_predator":
    case "animal_lost_wandered":
    case "animal_lost_crowding":
    case "feed_shortfall":
    case "pasture_grazing_saved_feed":
    case "feed_trough_saved_feed":
    case "manure_produced":
    case "comfort_change":
      return "livestock";
    case "fence_decay":
    case "fence_breach":
      return "pens";
    case "rival_supply_pressure":
    case "market_event_spike":
    case "market_event_crash":
      return "market";
    case "seasonal_expense":
    case "interest_charged":
    case "season_change":
      return "finance";
    case "event_locust":
    case "event_hail":
    case "event_blight":
    case "event_bumper":
    case "event_subsidy":
    case "event_inheritance":
    case "event_breakdown":
      return "event";
    case "labor_unused":
      return "labor";
  }
}

/** Plain-English copy for a cause — the UI's single source of truth.
 *
 * Keep these short and concrete; the player reads dozens of these per turn
 * in the summary panel. State the *effect* (what changed) and the *reason*
 * (why) in one sentence where possible. */
export function causeCopy(cause: Cause): string {
  switch (cause.kind) {
    case "frost_damage":
      return `Frost damaged the crop in field #${cause.fieldId} (health −${Math.round(cause.healthLost * 100)}%).`;
    case "frost_kill":
      return `Frost killed the crop in field #${cause.fieldId}.`;
    case "drought_stress":
      return `Field #${cause.fieldId} is drought-stressed — moisture ${Math.round(cause.moisture * 100)}% vs need ${Math.round(cause.need * 100)}%.`;
    case "heat_stress":
      return `Field #${cause.fieldId} is heat-stressed at ${cause.tempDegF}°F.`;
    case "weed_pressure":
      return `Weeds ate ${Math.round(cause.healthLost * 100)}% health in field #${cause.fieldId} (weeds at ${Math.round(cause.weeds * 100)}%).`;
    case "pest_pressure":
      return `Pests ate ${Math.round(cause.healthLost * 100)}% health in field #${cause.fieldId} (pests at ${Math.round(cause.pests * 100)}%).`;
    case "weeds_critical":
      return `Field #${cause.fieldId} is overrun with weeds (${Math.round(cause.weeds * 100)}%) — spray herbicide.`;
    case "pests_critical":
      return `Severe pest infestation in field #${cause.fieldId} (${Math.round(cause.pests * 100)}%) — spray pesticide.`;
    case "crop_died_health":
      return `The crop in field #${cause.fieldId} died from poor health.`;
    case "ready_to_harvest":
      return `Field #${cause.fieldId} is ready to harvest.`;
    case "growth_delayed": {
      // Single-line attribution for the per-turn TurnSummaryPanel. The
      // season-level "drought cost ~X of a wheat cycle" copy is composed by
      // the season summary itself from the aggregated growthBarLost values.
      const reasons: string[] = [];
      if (cause.fromMoisture > 0.05) reasons.push(`moisture −${Math.round(cause.fromMoisture * 100)}%`);
      if (cause.fromTemperature > 0.05) reasons.push(`temperature −${Math.round(cause.fromTemperature * 100)}%`);
      if (cause.fromHealth > 0.05) reasons.push(`health −${Math.round(cause.fromHealth * 100)}%`);
      const tail = reasons.length > 0 ? ` (${reasons.join(", ")})` : "";
      return `Field #${cause.fieldId} grew at ${Math.round(cause.totalMultiplier * 100)}% rate this turn${tail}.`;
    }
    case "harvest_complete": {
      const parts: string[] = [];
      if (cause.reductions.weeds > 0.05) parts.push(`weeds −${Math.round(cause.reductions.weeds * 100)}%`);
      if (cause.reductions.health > 0.05) parts.push(`health −${Math.round(cause.reductions.health * 100)}%`);
      if (cause.reductions.nutrients > 0.05) {
        const lim = cause.limitingNutrient ? cause.limitingNutrient.toUpperCase() : "soil";
        parts.push(`${lim}-limited −${Math.round(cause.reductions.nutrients * 100)}%`);
      }
      const reductions = parts.length > 0 ? ` (${parts.join(", ")})` : "";
      return `Harvested ${cause.quantity}/${cause.baseQuantity} units from field #${cause.fieldId}${reductions}.`;
    }
    case "animal_born":
      return `${cause.name} the ${cause.species} was born.`;
    case "animal_starved":
      return `${cause.name} the ${cause.species} starved for lack of feed.`;
    case "animal_lost_predator":
      return `A predator took ${cause.name} the ${cause.species}.`;
    case "animal_lost_wandered":
      return `${cause.name} the ${cause.species} wandered off through a gap and was lost.`;
    case "animal_lost_crowding":
      return `${cause.name} the ${cause.species} died from stress in a cramped pen.`;
    case "feed_shortfall":
      return `Feed shortfall — needed ${cause.needed}, consumed ${cause.consumed}; ${cause.affected} animal${cause.affected === 1 ? "" : "s"} suffered.`;
    case "pasture_grazing_saved_feed":
      return `Pasture grazing saved ${cause.saved} feed.`;
    case "feed_trough_saved_feed":
      return `Feed troughs saved ${cause.saved} feed.`;
    case "manure_produced":
      return `Livestock produced ${cause.amount} manure.`;
    case "comfort_change":
      return `${cause.count} ${cause.species}${cause.count === 1 ? "" : "s"} now ${cause.tier}.`;
    case "fence_decay":
      return `Fences decayed (avg condition ${Math.round(cause.averagePct * 100)}%).`;
    case "fence_breach":
      return `A fence breach opened a gap in the pen.`;
    case "rival_supply_pressure":
      return `Rivals are flooding ${cause.good} — price held down by ${Math.round(cause.pressure * 100)}%.`;
    case "market_event_spike":
      return `${cause.good} demand surged — price up ${Math.round(cause.pct * 100)}%.`;
    case "market_event_crash":
      return `${cause.good} prices crashed — down ${Math.round(Math.abs(cause.pct) * 100)}%.`;
    case "seasonal_expense":
      return `Seasonal expenses: $${cause.total} (tax $${cause.landTax}, upkeep $${cause.upkeep}, interest $${cause.interest}).`;
    case "interest_charged":
      return `Loan interest: $${cause.amount} charged on $${cause.outstandingLoan} principal.`;
    case "season_change":
      return `${cause.season.charAt(0).toUpperCase() + cause.season.slice(1)} of Year ${cause.year} has begun.`;
    case "event_locust":
      return `Locust swarm — pests surged across every active field.`;
    case "event_hail":
      return `Hailstorm destroyed the crop in field #${cause.fieldId}.`;
    case "event_blight":
      return `Blight spread — crop health fell across every active field.`;
    case "event_bumper":
      return `Bumper conditions boosted growth + health in field #${cause.fieldId}.`;
    case "event_subsidy":
      return `Agricultural subsidy: +$${cause.amount}.`;
    case "event_inheritance":
      return `Inheritance windfall: +$${cause.amount}.`;
    case "event_breakdown":
      return `Equipment breakdown — repairs cost $${cause.amount}.`;
    case "labor_unused":
      return `${cause.unused}/${cause.capacity} labor unspent last month.`;
  }
}

/** Priority for sorting causes within a category (higher = more important). */
export function causePriority(cause: Cause): number {
  switch (cause.kind) {
    case "frost_kill":
    case "crop_died_health":
    case "event_hail":
    case "animal_starved":
    case "animal_lost_predator":
    case "animal_lost_crowding":
      return 100;
    case "event_locust":
    case "event_blight":
    case "event_breakdown":
    case "feed_shortfall":
    case "fence_breach":
      return 90;
    case "frost_damage":
    case "drought_stress":
    case "heat_stress":
    case "pests_critical":
    case "weeds_critical":
      return 80;
    case "ready_to_harvest":
    case "event_bumper":
    case "event_subsidy":
    case "event_inheritance":
    case "animal_born":
      return 70;
    case "harvest_complete":
      return 60;
    case "growth_delayed":
      // Informational; useful per turn but not the most important signal.
      return 20;
    case "market_event_spike":
    case "market_event_crash":
    case "rival_supply_pressure":
      return 50;
    case "seasonal_expense":
    case "interest_charged":
    case "season_change":
      return 30;
    default:
      return 10;
  }
}
