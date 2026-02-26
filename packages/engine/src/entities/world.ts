export type TerrainType = "dirt" | "grass" | "forest" | "water" | "rock" | "road";

export interface Tile {
  terrain: TerrainType;
  soilQuality: number;
  moisture: number;
  owned: boolean;
  fieldId: number | null;
  buildingId: number | null;
}

export interface WorldState {
  width: number;
  height: number;
  tiles: Tile[];
  plotSize: number;
  plotOwnership: boolean[];
}

export function createTile(terrain: TerrainType): Tile {
  return {
    terrain,
    soilQuality: 0.5,
    moisture: terrain === "water" ? 1.0 : 0.3,
    owned: false,
    fieldId: null,
    buildingId: null,
  };
}

export function tileIndex(x: number, y: number, width: number): number {
  return y * width + x;
}

export function tileCoords(index: number, width: number): { x: number; y: number } {
  return { x: index % width, y: Math.floor(index / width) };
}

export function plotIndex(plotX: number, plotY: number, plotsPerRow: number): number {
  return plotY * plotsPerRow + plotX;
}

export function plotCoords(index: number, plotsPerRow: number): { plotX: number; plotY: number } {
  return { plotX: index % plotsPerRow, plotY: Math.floor(index / plotsPerRow) };
}
