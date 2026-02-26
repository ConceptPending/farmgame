import type { CropId } from "./crop.js";

export type FieldState = "fallow" | "plowed" | "planted" | "growing" | "ready" | "dead";

export interface Field {
  id: number;
  tileIndices: number[];
  cropId: CropId | null;
  state: FieldState;
  growth: number;
  growthTicks: number;
  health: number;
  moisture: number;
  weeds: number;
  pests: number;
}

export function createField(id: number, tileIndices: number[]): Field {
  return {
    id,
    tileIndices,
    cropId: null,
    state: "fallow",
    growth: 0,
    growthTicks: 0,
    health: 1.0,
    moisture: 0.5,
    weeds: 0,
    pests: 0,
  };
}
