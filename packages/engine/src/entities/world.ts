export type TerrainType = "dirt" | "grass" | "forest" | "water" | "rock" | "road";

export interface SoilNutrients {
  n: number;
  p: number;
  k: number;
}

export interface Tile {
  terrain: TerrainType;
  /** Innate land quality (static): land cost + the nutrient recovery baseline. */
  soilQuality: number;
  /** Dynamic N-P-K levels (0..1): drawn down/fixed by crops, slowly recover. */
  nutrients: SoilNutrients;
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
    nutrients: { n: 0.5, p: 0.5, k: 0.5 },
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

/**
 * Market value of one plot: $200 base + up to $300 for soil quality (average
 * over the plot's tiles). The single source of truth for plot pricing — the
 * BUY_PLOT cost, net-worth land valuation, and the sim harness all use this,
 * which (deliberately) makes plot purchases exactly net-worth-neutral.
 */
export function plotValue(world: WorldState, plotX: number, plotY: number): number {
  const startX = plotX * world.plotSize;
  const startY = plotY * world.plotSize;
  let soilSum = 0;
  for (let dy = 0; dy < world.plotSize; dy++) {
    for (let dx = 0; dx < world.plotSize; dx++) {
      soilSum += world.tiles[(startY + dy) * world.width + (startX + dx)]!.soilQuality;
    }
  }
  const avgSoil = soilSum / (world.plotSize * world.plotSize);
  return Math.round(200 + avgSoil * 300);
}
