import { Container, Sprite, Graphics } from "pixi.js";
import type { GameState, TerrainType, FieldState } from "@farmgame/engine";
import { TILE_SIZE, getTileTexture } from "../sprites/tileset.js";
import type { SPRITES } from "../sprites/tileset.js";

type SpriteKey = keyof typeof SPRITES;

const TERRAIN_SPRITE_MAP: Record<TerrainType, SpriteKey[]> = {
  grass: ["grass1", "grass2", "grass3", "grass4"],
  dirt: ["dirt", "dirt2"],
  forest: ["forest"],
  water: ["water1", "water2", "water3"],
  rock: ["rock"],
  road: ["road"],
};

/** Terrain that gets subtle per-tile brightness variation to avoid flat blocks. */
const VARY_TINT: Set<TerrainType> = new Set(["grass", "dirt"]);

/**
 * Scatter-friendly hash of a tile's grid position. Plain `i % n` stripes badly
 * when the world width shares a factor with the variant count (48 % 3 == 0),
 * so mix the x/y coordinates with large primes instead.
 */
function tileHash(x: number, y: number): number {
  let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

/** Greyscale tint (0xRRGGBB with R=G=B) for a 0..1 brightness factor. */
function brightnessTint(factor: number): number {
  const v = Math.max(0, Math.min(255, Math.round(255 * factor)));
  return (v << 16) | (v << 8) | v;
}

const RIVAL_COLORS = [0xff8c42, 0xff6b6b, 0xb39ddb, 0xffd166];

export function rivalColor(rivalId: number): number {
  return RIVAL_COLORS[(rivalId - 1) % RIVAL_COLORS.length];
}

/** Map tile index → rival tint color for every rival-claimed plot's tiles. */
function rivalTileColors(state: GameState): Map<number, number> {
  const map = new Map<number, number>();
  const { world } = state;
  const ppr = world.width / world.plotSize;
  for (const r of state.rivals) {
    const color = rivalColor(r.id);
    for (const plot of r.ownedPlots) {
      const sx = (plot % ppr) * world.plotSize;
      const sy = Math.floor(plot / ppr) * world.plotSize;
      for (let dy = 0; dy < world.plotSize; dy++)
        for (let dx = 0; dx < world.plotSize; dx++)
          map.set((sy + dy) * world.width + (sx + dx), color);
    }
  }
  return map;
}

export class TerrainLayer {
  readonly container: Container;
  private sprites: Sprite[] = [];
  private plotOverlay: Graphics;
  private edgeOverlay: Graphics;
  private created = false;
  private lastTileCount = 0;
  // Dirty tracking
  private lastTerrainKey = "";
  private lastOwnershipKey = "";
  private lastFieldStateKey = "";
  private lastRivalKey = "";

  constructor() {
    this.container = new Container();
    this.plotOverlay = new Graphics();
    this.edgeOverlay = new Graphics();
  }

  update(state: GameState): void {
    const { world } = state;
    const tileCount = world.tiles.length;

    if (!this.created || this.lastTileCount !== tileCount) {
      this.rebuild(state);
      this.created = true;
      this.lastTileCount = tileCount;
      this.lastTerrainKey = "";
      this.lastOwnershipKey = "";
    }

    // Build a cheap fingerprint to detect changes
    // Terrain changes are rare (only on buy_land or bulldoze)
    const ownershipKey = world.plotOwnership.map((o) => (o ? "1" : "0")).join("");
    const fieldStateKey = state.fields.map((f) => `${f.id}:${f.state}:${f.tileIndices.length}`).join(",");
    const rivalKey = state.rivals.map((r) => `${r.id}:${r.ownedPlots.join(".")}`).join(",");
    const terrainChanged = this.lastTerrainKey === "";
    const ownershipChanged = ownershipKey !== this.lastOwnershipKey;
    const fieldStateChanged = fieldStateKey !== this.lastFieldStateKey;
    const rivalChanged = rivalKey !== this.lastRivalKey;

    if (terrainChanged || ownershipChanged || fieldStateChanged || rivalChanged) {
      // Build lookup: fieldId → state for tilled texture
      const tilledStates: Set<FieldState> = new Set(["plowed", "planted", "growing", "ready"]);
      const fieldStateMap = new Map<number, FieldState>();
      for (const field of state.fields) {
        fieldStateMap.set(field.id, field.state);
      }
      const rivalTile = rivalTileColors(state);

      for (let i = 0; i < tileCount; i++) {
        const tile = world.tiles[i];
        const sprite = this.sprites[i];
        if (!sprite) continue;

        const tx = i % world.width;
        const ty = Math.floor(i / world.width);
        const hash = tileHash(tx, ty);

        const variants = TERRAIN_SPRITE_MAP[tile.terrain] ?? ["grass1"];
        const variantIdx = hash % variants.length;
        sprite.texture = getTileTexture(variants[variantIdx]);

        // Override dirt tiles in plowed+ fields with tilled texture
        let tilled = false;
        if (tile.fieldId !== null && tile.terrain === "dirt") {
          const fState = fieldStateMap.get(tile.fieldId);
          if (fState && tilledStates.has(fState)) {
            sprite.texture = getTileTexture("tilled");
            tilled = true;
          }
        }

        const rc = rivalTile.get(i);
        if (rc !== undefined) {
          sprite.tint = rc;
          sprite.alpha = 0.85; // rival-claimed land
        } else {
          // Subtle deterministic brightness variation breaks up large expanses
          // of one terrain so they don't read as a single flat color block.
          if (!tilled && VARY_TINT.has(tile.terrain)) {
            const factor = 0.95 + (((hash >>> 8) % 1000) / 1000) * 0.05; // 0.95–1.00
            sprite.tint = brightnessTint(factor);
          } else {
            sprite.tint = 0xffffff;
          }
          sprite.alpha = tile.terrain === "water" ? 1.0 : tile.owned ? 1.0 : 0.5;
        }
      }
      // Mark terrain as clean after first full pass
      this.lastTerrainKey = "set";
      this.lastFieldStateKey = fieldStateKey;
      this.lastRivalKey = rivalKey;
    }

    if (ownershipChanged || rivalChanged) {
      this.drawPlotBoundaries(state);
      this.lastOwnershipKey = ownershipKey;
    }
  }

  /** Force a full terrain refresh (call after buy_land). */
  markDirty(): void {
    this.lastTerrainKey = "";
    this.lastOwnershipKey = "";
    this.lastFieldStateKey = "";
  }

  private rebuild(state: GameState) {
    this.container.removeChildren();
    this.sprites = [];

    const { world } = state;
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const sprite = new Sprite(getTileTexture("grass1"));
        sprite.x = x * TILE_SIZE;
        sprite.y = y * TILE_SIZE;
        sprite.width = TILE_SIZE;
        sprite.height = TILE_SIZE;
        this.container.addChild(sprite);
        this.sprites.push(sprite);
      }
    }

    // Shoreline edges sit above the tiles but below the plot boundary lines.
    // Terrain is static after world-gen, so draw the edges just once here.
    this.container.addChild(this.edgeOverlay);
    this.container.addChild(this.plotOverlay);
    this.drawTerrainEdges(state);
  }

  /**
   * Soften hard terrain seams where water meets land into a beach: grass → sand
   * → foam → water. The sand band's outer edge is feathered pixel-by-pixel with
   * a depth that varies along the shore (hashed from the absolute coordinate so
   * the ripple is continuous across tiles), which breaks up the blocky tile
   * staircase. Terrain is static, so this overlay is painted once in rebuild().
   */
  private drawTerrainEdges(state: GameState) {
    const g = this.edgeOverlay;
    g.clear();

    const { world } = state;
    const W = world.width;
    const H = world.height;
    const S = TILE_SIZE;
    const FOAM = 0xcfeaf7;
    const SAND_WET = 0xc4ac6e;
    const SAND_DRY = 0xd8c389;

    const isWater = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < W && y < H && world.tiles[y * W + x].terrain === "water";
    const hash = (c: number) => {
      let h = Math.imul(c | 0, 2654435761) >>> 0;
      h ^= h >>> 13;
      return h >>> 0;
    };
    const sandDepth = (c: number) => 2 + (hash(c) % 3); // 2..4 px
    const foamDepth = (c: number) => 1 + (hash(c * 7 + 1) % 2); // 1..2 px

    // Paint one shore column: `coord` is the position along the shore (used for
    // the ripple), and step(d) walks outward — negative d into land (sand),
    // d >= 0 into water (foam).
    const paintColumn = (coord: number, plot: (d: number, color: number) => void) => {
      const sd = sandDepth(coord);
      const fd = foamDepth(coord);
      for (let d = 0; d < fd; d++) plot(d, FOAM);
      for (let d = 1; d <= sd; d++) plot(-d, d === 1 ? SAND_WET : SAND_DRY);
    };

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isWater(x, y)) continue;
        const px = x * S;
        const py = y * S;
        for (let t = 0; t < S; t++) {
          const ax = px + t;
          const ay = py + t;
          // Outward = away from the water tile into the land neighbor.
          if (!isWater(x, y - 1)) paintColumn(ax, (d, c) => g.rect(ax, py + d, 1, 1).fill(c));
          if (!isWater(x, y + 1)) paintColumn(ax + 9973, (d, c) => g.rect(ax, py + S - 1 - d, 1, 1).fill(c));
          if (!isWater(x - 1, y)) paintColumn(ay + 555, (d, c) => g.rect(px + d, ay, 1, 1).fill(c));
          if (!isWater(x + 1, y)) paintColumn(ay + 7777, (d, c) => g.rect(px + S - 1 - d, ay, 1, 1).fill(c));
        }
      }
    }
  }

  private drawPlotBoundaries(state: GameState) {
    const g = this.plotOverlay;
    g.clear();

    const { world } = state;
    const plotSize = world.plotSize;
    const plotsPerRow = world.width / plotSize;

    for (let py = 0; py <= plotsPerRow; py++) {
      const y = py * plotSize * TILE_SIZE;
      g.moveTo(0, y).lineTo(world.width * TILE_SIZE, y).stroke({ width: 0.5, color: 0x000000, alpha: 0.15 });
    }
    for (let px = 0; px <= plotsPerRow; px++) {
      const x = px * plotSize * TILE_SIZE;
      g.moveTo(x, 0).lineTo(x, world.height * TILE_SIZE).stroke({ width: 0.5, color: 0x000000, alpha: 0.15 });
    }

    const w = plotSize * TILE_SIZE;
    for (let pi = 0; pi < world.plotOwnership.length; pi++) {
      if (!world.plotOwnership[pi]) continue;
      const x = (pi % plotsPerRow) * plotSize * TILE_SIZE;
      const y = Math.floor(pi / plotsPerRow) * plotSize * TILE_SIZE;
      g.rect(x, y, w, w).stroke({ width: 1, color: 0x4ecca3, alpha: 0.5 });
    }

    // Rival-claimed plots, outlined in each rival's color.
    for (const r of state.rivals) {
      const color = rivalColor(r.id);
      for (const plot of r.ownedPlots) {
        const x = (plot % plotsPerRow) * plotSize * TILE_SIZE;
        const y = Math.floor(plot / plotsPerRow) * plotSize * TILE_SIZE;
        g.rect(x, y, w, w).stroke({ width: 1, color, alpha: 0.6 });
      }
    }
  }
}
