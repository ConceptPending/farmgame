export type BuildingType =
  | "silo"
  | "barn"
  | "water_pump"
  | "windmill"
  | "irrigation_ditch"
  | "road"
  | "fence";

export interface BuildingDefinition {
  type: BuildingType;
  name: string;
  cost: number;
  description: string;
}

export interface Building {
  id: number;
  type: BuildingType;
  tileIndex: number;
  condition: number;
  active: boolean;
}

export function createBuilding(id: number, type: BuildingType, tileIndex: number): Building {
  return {
    id,
    type,
    tileIndex,
    condition: 1.0,
    active: true,
  };
}

export const BUILDING_CATALOG: Record<BuildingType, BuildingDefinition> = {
  silo: {
    type: "silo",
    name: "Silo",
    cost: 500,
    description: "Increases inventory capacity by 100 units",
  },
  barn: {
    type: "barn",
    name: "Barn",
    cost: 600,
    description: "Shelters livestock and forms part of a pen wall",
  },
  water_pump: {
    type: "water_pump",
    name: "Water Pump",
    cost: 300,
    description: "Maintains high moisture in a 5-tile radius",
  },
  windmill: {
    type: "windmill",
    name: "Windmill",
    cost: 800,
    description: "Powers nearby irrigation and increases field efficiency",
  },
  irrigation_ditch: {
    type: "irrigation_ditch",
    name: "Irrigation Ditch",
    cost: 100,
    description: "Propagates moisture from water pumps along its path",
  },
  road: {
    type: "road",
    name: "Road",
    cost: 25,
    description: "Decorative path tile",
  },
  fence: {
    type: "fence",
    name: "Fence",
    cost: 15,
    description: "Pen wall — enclose livestock. Wears down over time; repair to keep it sound",
  },
};
