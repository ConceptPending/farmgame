import type { GameState, Notification } from "../state.js";
import type { PriceSnapshot } from "../entities/market.js";
import { CROP_CATALOG, ALL_CROP_IDS } from "../data/crops.js";
import { nextFloat, nextBool } from "../rng.js";
import type { RngState } from "../rng.js";

const MAX_HISTORY = 100;

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
    const currentPrice = newPrices[cropId] ?? def.basePrice;
    const demand = newDemand[cropId] ?? 1.0;

    // Small random walk
    let walkResult = nextFloat(rng);
    rng = walkResult.rng;
    const walk = (walkResult.value - 0.5) * 0.06 * def.basePrice; // +/- 3% of base

    // Seasonal bias: crops in their harvest season are cheaper
    let seasonBias = 0;
    if (def.plantSeasons.includes(state.season)) {
      seasonBias = -0.01 * def.basePrice; // slight downward pressure
    } else {
      seasonBias = 0.005 * def.basePrice; // slight upward pressure off-season
    }

    // Demand recovery (demand drifts back toward 1.0)
    newDemand[cropId] = demand + (1.0 - demand) * 0.02;

    // Apply price change
    let newPrice = currentPrice + walk + seasonBias;
    newPrice *= (0.9 + newDemand[cropId] * 0.2); // demand multiplier

    // Clamp price to [30% .. 300%] of base price
    newPrice = Math.max(def.basePrice * 0.3, Math.min(def.basePrice * 3, newPrice));
    newPrices[cropId] = Math.round(newPrice * 100) / 100;
  }

  // Occasional market events (~2% chance per tick)
  let eventResult = nextBool(rng, 0.02);
  rng = eventResult.rng;
  if (eventResult.value) {
    let cropPickResult = nextFloat(rng);
    rng = cropPickResult.rng;
    const eventCropIdx = Math.floor(cropPickResult.value * ALL_CROP_IDS.length);
    const eventCropId = ALL_CROP_IDS[eventCropIdx];
    const eventDef = CROP_CATALOG[eventCropId];

    let typeResult = nextFloat(rng);
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
