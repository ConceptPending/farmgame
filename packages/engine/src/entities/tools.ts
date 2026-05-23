export type ToolId =
  | "pointer"
  | "buy_land"
  | "designate_field"
  | "plow"
  | "plant"
  | "harvest"
  | "bulldoze"
  | "build"
  | "place_animal"
  | "spray";

export interface ToolDefinition {
  id: ToolId;
  name: string;
  description: string;
}

export const TOOL_CATALOG: Record<ToolId, ToolDefinition> = {
  pointer: {
    id: "pointer",
    name: "Pointer",
    description: "Select and inspect tiles and fields",
  },
  buy_land: {
    id: "buy_land",
    name: "Buy Land",
    description: "Purchase adjacent plots of land",
  },
  designate_field: {
    id: "designate_field",
    name: "Designate Field",
    description: "Mark a rectangular area as a field",
  },
  plow: {
    id: "plow",
    name: "Plow",
    description: "Plow a designated field for planting",
  },
  plant: {
    id: "plant",
    name: "Plant",
    description: "Plant seeds in a plowed field",
  },
  harvest: {
    id: "harvest",
    name: "Harvest",
    description: "Harvest crops from a ready field",
  },
  bulldoze: {
    id: "bulldoze",
    name: "Bulldoze",
    description: "Remove fields and buildings",
  },
  build: {
    id: "build",
    name: "Build",
    description: "Construct buildings on owned land",
  },
  place_animal: {
    id: "place_animal",
    name: "Livestock",
    description: "Place animals on open owned land — pen them in with fences",
  },
  spray: {
    id: "spray",
    name: "Spray",
    description: "Apply fertilizer, pesticide, or herbicide",
  },
};
