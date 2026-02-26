import type { CropId } from "./crop.js";

export interface PriceSnapshot {
  tick: number;
  prices: Record<string, number>;
}

export interface MarketState {
  prices: Record<string, number>;
  priceHistory: PriceSnapshot[];
  demand: Record<string, number>;
}

export function createMarketState(cropIds: CropId[], basePrices: Record<string, number>): MarketState {
  const prices: Record<string, number> = {};
  const demand: Record<string, number> = {};
  for (const id of cropIds) {
    prices[id] = basePrices[id] ?? 10;
    demand[id] = 1.0;
  }
  return {
    prices,
    priceHistory: [],
    demand,
  };
}
