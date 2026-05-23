export type EquipmentType = "plow" | "tractor" | "combine";

export interface EquipmentDefinition {
  type: EquipmentType;
  name: string;
  cost: number;
  /** Extra tiles the player can keep under cultivation at once. */
  workableTiles: number;
  /** Extra labor units per monthly turn that this equipment provides. */
  laborBonus: number;
  /** Seasonal upkeep (maintenance, fuel). */
  upkeepPerSeason: number;
}

export interface Equipment {
  id: number;
  type: EquipmentType;
}

export const EQUIPMENT_CATALOG: Record<EquipmentType, EquipmentDefinition> = {
  plow: {
    type: "plow",
    name: "Plow",
    cost: 250,
    workableTiles: 20,
    laborBonus: 1,
    upkeepPerSeason: 8,
  },
  tractor: {
    type: "tractor",
    name: "Tractor",
    cost: 1000,
    workableTiles: 50,
    laborBonus: 4,
    upkeepPerSeason: 30,
  },
  combine: {
    type: "combine",
    name: "Combine Harvester",
    cost: 2800,
    workableTiles: 130,
    laborBonus: 6,
    upkeepPerSeason: 80,
  },
};

export const ALL_EQUIPMENT_TYPES = Object.keys(EQUIPMENT_CATALOG) as EquipmentType[];

/** Tiles workable by hand, before any machinery. */
export const BASE_WORKABLE_TILES = 24;

/** Salvage fraction when selling used equipment. */
export const EQUIPMENT_SALVAGE = 0.6;

export function createEquipment(id: number, type: EquipmentType): Equipment {
  return { id, type };
}

/** Total tiles the player can keep under cultivation, given their machinery. */
export function workableTiles(equipment: Equipment[]): number {
  return (
    BASE_WORKABLE_TILES +
    equipment.reduce((sum, e) => sum + EQUIPMENT_CATALOG[e.type].workableTiles, 0)
  );
}

/** Sum of per-turn labor bonuses across all owned equipment. */
export function equipmentLaborBonus(equipment: Equipment[]): number {
  return equipment.reduce((sum, e) => sum + EQUIPMENT_CATALOG[e.type].laborBonus, 0);
}

/** Tiles currently under cultivation (anything past fallow). */
export function cultivatedTiles(fields: { state: string; tileIndices: number[] }[]): number {
  return fields
    .filter((f) => f.state !== "fallow")
    .reduce((sum, f) => sum + f.tileIndices.length, 0);
}
