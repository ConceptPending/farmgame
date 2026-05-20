import type { RngState } from "../rng.js";
import { nextFloat, nextInt } from "../rng.js";
import type { Tile, WorldState } from "../entities/world.js";
import { createTile, tileIndex } from "../entities/world.js";

const WORLD_SIZE = 48;
const PLOT_SIZE = 8;
const PLOTS_PER_ROW = WORLD_SIZE / PLOT_SIZE; // 6

export interface WorldGenResult {
  world: WorldState;
  rng: RngState;
}

export function generateWorld(rng: RngState): WorldGenResult {
  const tiles: Tile[] = [];
  for (let i = 0; i < WORLD_SIZE * WORLD_SIZE; i++) {
    tiles.push(createTile("grass"));
  }

  // Generate river (sinusoidal path from top to bottom)
  const riverResult = generateRiver(tiles, rng);
  rng = riverResult.rng;

  // Place forest clusters
  const forestResult = generateForests(tiles, rng);
  rng = forestResult.rng;

  // Place rock outcrops
  const rockResult = generateRocks(tiles, rng);
  rng = rockResult.rng;

  // Set soil quality (higher near river, randomized)
  const soilResult = setSoilQuality(tiles, rng);
  rng = soilResult.rng;

  // Set initial moisture (higher near water)
  setInitialMoisture(tiles);

  // Plot ownership: 36 plots (6x6 grid of 8x8 tile plots)
  const plotOwnership = new Array(PLOTS_PER_ROW * PLOTS_PER_ROW).fill(false);

  // Player starts owning 2 central plots (2,2) and (3,2)
  const centerPlotIdx1 = 2 * PLOTS_PER_ROW + 2; // plot (2,2)
  const centerPlotIdx2 = 2 * PLOTS_PER_ROW + 3; // plot (3,2)
  plotOwnership[centerPlotIdx1] = true;
  plotOwnership[centerPlotIdx2] = true;

  // Mark those tiles as owned and set terrain to dirt (farmland)
  markPlotOwned(tiles, 2, 2);
  markPlotOwned(tiles, 3, 2);

  return {
    world: {
      width: WORLD_SIZE,
      height: WORLD_SIZE,
      tiles,
      plotSize: PLOT_SIZE,
      plotOwnership,
    },
    rng,
  };
}

function markPlotOwned(tiles: Tile[], plotX: number, plotY: number): void {
  const startX = plotX * PLOT_SIZE;
  const startY = plotY * PLOT_SIZE;
  for (let dy = 0; dy < PLOT_SIZE; dy++) {
    for (let dx = 0; dx < PLOT_SIZE; dx++) {
      const idx = tileIndex(startX + dx, startY + dy, WORLD_SIZE);
      const tile = tiles[idx];
      tile.owned = true;
      // Convert grass to dirt for owned farmland (but keep water/rock)
      if (tile.terrain === "grass" || tile.terrain === "forest") {
        tile.terrain = "dirt";
      }
    }
  }
}

function generateRiver(tiles: Tile[], rng: RngState): { rng: RngState } {
  // River flows from top to bottom with sinusoidal wandering
  let r = rng;
  const offsetResult = nextInt(r, 16, 32);
  const baseX = offsetResult.value;
  r = offsetResult.rng;

  const ampResult = nextFloat(r);
  const amplitude = 4 + ampResult.value * 6; // 4-10 tile wander
  r = ampResult.rng;

  const phaseResult = nextFloat(r);
  const phase = phaseResult.value * Math.PI * 2;
  r = phaseResult.rng;

  for (let y = 0; y < WORLD_SIZE; y++) {
    const riverX = Math.round(baseX + Math.sin((y / WORLD_SIZE) * Math.PI * 2 + phase) * amplitude);
    // River is 2-3 tiles wide
    for (let dx = -1; dx <= 1; dx++) {
      const x = riverX + dx;
      if (x >= 0 && x < WORLD_SIZE) {
        const idx = tileIndex(x, y, WORLD_SIZE);
        tiles[idx].terrain = "water";
        tiles[idx].moisture = 1.0;
        tiles[idx].soilQuality = 0;
      }
    }
  }

  return { rng: r };
}

function generateForests(tiles: Tile[], rng: RngState): { rng: RngState } {
  let r = rng;
  // Place 8-15 forest clusters
  const countResult = nextInt(r, 8, 15);
  const clusterCount = countResult.value;
  r = countResult.rng;

  for (let c = 0; c < clusterCount; c++) {
    const xResult = nextInt(r, 2, WORLD_SIZE - 3);
    r = xResult.rng;
    const yResult = nextInt(r, 2, WORLD_SIZE - 3);
    r = yResult.rng;
    const sizeResult = nextInt(r, 2, 5);
    r = sizeResult.rng;

    const cx = xResult.value;
    const cy = yResult.value;
    const radius = sizeResult.value;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || x >= WORLD_SIZE || y < 0 || y >= WORLD_SIZE) continue;
        if (dx * dx + dy * dy > radius * radius) continue;

        const idx = tileIndex(x, y, WORLD_SIZE);
        if (tiles[idx].terrain === "water") continue;

        // Random chance to place tree (sparser at edges)
        const treeResult = nextFloat(r);
        r = treeResult.rng;
        const dist = Math.sqrt(dx * dx + dy * dy) / radius;
        if (treeResult.value < 0.7 - dist * 0.4) {
          tiles[idx].terrain = "forest";
          tiles[idx].soilQuality = 0.3 + treeResult.value * 0.3;
        }
      }
    }
  }

  return { rng: r };
}

function generateRocks(tiles: Tile[], rng: RngState): { rng: RngState } {
  let r = rng;
  const countResult = nextInt(r, 5, 10);
  const rockCount = countResult.value;
  r = countResult.rng;

  for (let i = 0; i < rockCount; i++) {
    const xResult = nextInt(r, 0, WORLD_SIZE - 1);
    r = xResult.rng;
    const yResult = nextInt(r, 0, WORLD_SIZE - 1);
    r = yResult.rng;

    const x = xResult.value;
    const y = yResult.value;
    const idx = tileIndex(x, y, WORLD_SIZE);

    if (tiles[idx].terrain === "water") continue;
    tiles[idx].terrain = "rock";
    tiles[idx].soilQuality = 0;

    // Sometimes place a small cluster (2-3 rocks)
    const clusterResult = nextFloat(r);
    r = clusterResult.rng;
    if (clusterResult.value < 0.5) {
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= WORLD_SIZE || ny >= WORLD_SIZE) continue;
        const nIdx = tileIndex(nx, ny, WORLD_SIZE);
        if (tiles[nIdx].terrain === "water") continue;
        const placeResult = nextFloat(r);
        r = placeResult.rng;
        if (placeResult.value < 0.4) {
          tiles[nIdx].terrain = "rock";
          tiles[nIdx].soilQuality = 0;
        }
      }
    }
  }

  return { rng: r };
}

function setSoilQuality(tiles: Tile[], rng: RngState): { rng: RngState } {
  let r = rng;

  // Find water tile positions for proximity calculation
  const waterPositions: { x: number; y: number }[] = [];
  for (let y = 0; y < WORLD_SIZE; y++) {
    for (let x = 0; x < WORLD_SIZE; x++) {
      if (tiles[tileIndex(x, y, WORLD_SIZE)].terrain === "water") {
        waterPositions.push({ x, y });
      }
    }
  }

  for (let y = 0; y < WORLD_SIZE; y++) {
    for (let x = 0; x < WORLD_SIZE; x++) {
      const idx = tileIndex(x, y, WORLD_SIZE);
      const tile = tiles[idx];
      if (tile.terrain === "water" || tile.terrain === "rock") continue;

      // Base quality from river proximity
      let minDist = Infinity;
      for (const wp of waterPositions) {
        const dist = Math.abs(x - wp.x) + Math.abs(y - wp.y);
        if (dist < minDist) minDist = dist;
      }
      const riverBonus = Math.max(0, 1 - minDist / 15) * 0.4;

      // Random variation
      const randResult = nextFloat(r);
      r = randResult.rng;
      const randomPart = 0.3 + randResult.value * 0.4; // 0.3-0.7

      tile.soilQuality = Math.min(1, randomPart + riverBonus);
    }
  }

  return { rng: r };
}

function setInitialMoisture(tiles: Tile[]): void {
  for (let y = 0; y < WORLD_SIZE; y++) {
    for (let x = 0; x < WORLD_SIZE; x++) {
      const idx = tileIndex(x, y, WORLD_SIZE);
      const tile = tiles[idx];
      if (tile.terrain === "water") {
        tile.moisture = 1.0;
        continue;
      }

      // Check proximity to water for moisture bonus
      let minWaterDist = Infinity;
      for (let dy = -6; dy <= 6; dy++) {
        for (let dx = -6; dx <= 6; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= WORLD_SIZE || ny < 0 || ny >= WORLD_SIZE) continue;
          if (tiles[tileIndex(nx, ny, WORLD_SIZE)].terrain === "water") {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minWaterDist) minWaterDist = dist;
          }
        }
      }

      const waterBonus = minWaterDist < Infinity ? Math.max(0, 1 - minWaterDist / 8) * 0.5 : 0;
      tile.moisture = Math.min(1, 0.2 + waterBonus);
    }
  }
}
