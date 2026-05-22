import type { GameState, Notification } from "../state.js";
import type { PriceSnapshot } from "../entities/market.js";
import { CROP_CATALOG, ALL_CROP_IDS } from "../data/crops.js";
import { PRODUCT_CATALOG, ALL_PRODUCT_IDS } from "../data/products.js";
import { rivalSupplyPressure } from "../entities/rival.js";
import { nextFloat, nextBool } from "../rng.js";

const MAX_HISTORY = 100;

/** How fast demand (and thus price) drifts back toward 1.0 each tick. */
export const DEMAND_RECOVERY = 0.1;
/** Demand lost per unit sold — the "depth" of the market. */
export const SELL_DEMAND_IMPACT = 0.003;
/** Demand can't be driven below this (price floor is enforced separately). */
export const MIN_DEMAND = 0.1;

export function marketSystem(state: GameState): {
  state: GameState;
  notifications: Notification[];
} {
  const notifications: Notification[] = [];
  let rng = state.rng;
  const newPrices = { ...state.market.prices };
  const newDemand = { ...state.market.demand };

  for (const cropId of ALL_CROP_IDS) {
    const def = CROP_CATALOG[cropId];
    const demand = newDemand[cropId] ?? 1.0;

    // Small random walk for life
    const walkResult = nextFloat(rng);
    rng = walkResult.rng;
    const walk = (walkResult.value - 0.5) * 0.06 * def.basePrice; // +/- 3% of base

    // Seasonal bias: crops in their harvest season are cheaper
    const seasonBias = def.plantSeasons.includes(state.season)
      ? -0.01 * def.basePrice // slight downward pressure in season
      : 0.005 * def.basePrice; // slight upward pressure off-season

    // Demand recovers toward its ceiling (1.0, lowered by rival supply on this
    // good); price is anchored to it, so rivals keep the player's prices down.
    const target = Math.max(MIN_DEMAND, 1.0 - rivalSupplyPressure(state.rivals, cropId));
    newDemand[cropId] = demand + (target - demand) * DEMAND_RECOVERY;
    let newPrice = def.basePrice * newDemand[cropId] + walk + seasonBias;
    newPrice = Math.max(def.basePrice * 0.3, Math.min(def.basePrice * 3, newPrice));
    newPrices[cropId] = Math.round(newPrice * 100) / 100;
  }

  // Animal products: same demand anchoring, no RNG walk (keeps the random
  // stream identical whether or not the player keeps livestock).
  for (const productId of ALL_PRODUCT_IDS) {
    const def = PRODUCT_CATALOG[productId];
    const demand = newDemand[productId] ?? 1.0;
    const target = Math.max(MIN_DEMAND, 1.0 - rivalSupplyPressure(state.rivals, productId));
    newDemand[productId] = demand + (target - demand) * DEMAND_RECOVERY;
    let newPrice = def.basePrice * newDemand[productId];
    newPrice = Math.max(def.basePrice * 0.3, Math.min(def.basePrice * 3, newPrice));
    newPrices[productId] = Math.round(newPrice * 100) / 100;
  }

  // Occasional market events (~2% chance per tick)
  const eventResult = nextBool(rng, 0.02);
  rng = eventResult.rng;
  if (eventResult.value) {
    const cropPickResult = nextFloat(rng);
    rng = cropPickResult.rng;
    const eventCropIdx = Math.floor(cropPickResult.value * ALL_CROP_IDS.length);
    const eventCropId = ALL_CROP_IDS[eventCropIdx];
    const eventDef = CROP_CATALOG[eventCropId];

    const typeResult = nextFloat(rng);
    rng = typeResult.rng;

    if (typeResult.value < 0.5) {
      // Demand spike
      newPrices[eventCropId] = Math.min(eventDef.basePrice * 3, newPrices[eventCropId] * 1.3);
      newDemand[eventCropId] = Math.min(2, (newDemand[eventCropId] ?? 1) * 1.3);
      notifications.push({
        type: "info",
        message: `Market alert: ${eventDef.name} demand surging! Price up 30%.`,
      });
    } else {
      // Price crash
      newPrices[eventCropId] = Math.max(eventDef.basePrice * 0.3, newPrices[eventCropId] * 0.7);
      newDemand[eventCropId] = Math.max(0.5, (newDemand[eventCropId] ?? 1) * 0.8);
      notifications.push({
        type: "warning",
        message: `Market alert: ${eventDef.name} prices crashing! Down 30%.`,
      });
    }
  }

  // Record price history snapshot
  const snapshot: PriceSnapshot = {
    tick: state.tick,
    prices: { ...newPrices },
  };
  let newHistory = [...state.market.priceHistory, snapshot];
  if (newHistory.length > MAX_HISTORY) {
    newHistory = newHistory.slice(newHistory.length - MAX_HISTORY);
  }

  return {
    state: {
      ...state,
      rng,
      market: {
        prices: newPrices,
        demand: newDemand,
        priceHistory: newHistory,
      },
    },
    notifications,
  };
}
