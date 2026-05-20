export type ProductType = "eggs" | "milk" | "wool";

export interface ProductDefinition {
  id: ProductType;
  name: string;
  basePrice: number;
}

export const PRODUCT_CATALOG: Record<ProductType, ProductDefinition> = {
  eggs: { id: "eggs", name: "Eggs", basePrice: 4 },
  milk: { id: "milk", name: "Milk", basePrice: 7 },
  wool: { id: "wool", name: "Wool", basePrice: 14 },
};

export const ALL_PRODUCT_IDS = Object.keys(PRODUCT_CATALOG) as ProductType[];

export function getProductDef(id: string): ProductDefinition | undefined {
  return PRODUCT_CATALOG[id as ProductType];
}
