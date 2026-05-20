import { CROP_CATALOG, ALL_CROP_IDS } from "./crops.js";
import { PRODUCT_CATALOG, ALL_PRODUCT_IDS } from "./products.js";
import type { CropId } from "../entities/crop.js";
import type { ProductType } from "./products.js";

/** Anything tradeable on the market: a crop or an animal product. */
export interface GoodInfo {
  name: string;
  basePrice: number;
}

export function getGoodInfo(id: string): GoodInfo | undefined {
  const crop = CROP_CATALOG[id as CropId];
  if (crop) return { name: crop.name, basePrice: crop.basePrice };
  const product = PRODUCT_CATALOG[id as ProductType];
  if (product) return { name: product.name, basePrice: product.basePrice };
  return undefined;
}

/** Base prices for every tradeable good, keyed by id. */
export function allBasePrices(): Record<string, number> {
  const prices: Record<string, number> = {};
  for (const id of ALL_CROP_IDS) prices[id] = CROP_CATALOG[id].basePrice;
  for (const id of ALL_PRODUCT_IDS) prices[id] = PRODUCT_CATALOG[id].basePrice;
  return prices;
}
