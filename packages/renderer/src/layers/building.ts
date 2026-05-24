import { Container, Sprite } from "pixi.js";
import type { GameState, BuildingType } from "@farmgame/engine";
import { tileCoords, tileIndex } from "@farmgame/engine";
import { TILE_SIZE, getTileTexture } from "../sprites/tileset.js";
import type { SPRITES } from "../sprites/tileset.js";

type SpriteKey = keyof typeof SPRITES;

const BUILDING_SPRITE_MAP: Record<BuildingType, SpriteKey> = {
  silo: "silo",
  barn: "barn",
  water_pump: "water_pump",
  windmill: "windmill",
  irrigation_ditch: "irrigation",
  fence: "fence",
  water_trough: "water_trough",
  feed_trough: "feed_trough",
};

/** Compute the 4-bit neighbour mask for a fence at `(x, y)` against the
 *  set of all fence tile indices. bit 0 = N, 1 = E, 2 = S, 3 = W. */
function fenceVariantKey(
  x: number,
  y: number,
  width: number,
  height: number,
  fences: Set<number>,
): SpriteKey {
  let mask = 0;
  if (y > 0          && fences.has(tileIndex(x, y - 1, width))) mask |= 1; // N
  if (x < width - 1  && fences.has(tileIndex(x + 1, y, width))) mask |= 2; // E
  if (y < height - 1 && fences.has(tileIndex(x, y + 1, width))) mask |= 4; // S
  if (x > 0          && fences.has(tileIndex(x - 1, y, width))) mask |= 8; // W
  return `fence_${mask}` as SpriteKey;
}

export class BuildingLayer {
  readonly container: Container;
  private spritePool: Sprite[] = [];
  private activeCount = 0;

  constructor() {
    this.container = new Container();
  }

  update(state: GameState): void {
    let spriteIdx = 0;

    // Pre-compute the set of fence tile indices once per update so each
    // fence's connectivity mask is an O(1) lookup against four neighbours.
    const fenceTiles = new Set<number>();
    for (const b of state.buildings) {
      if (b.type === "fence") fenceTiles.add(b.tileIndex);
    }

    for (const building of state.buildings) {
      let spriteKey: SpriteKey | undefined = BUILDING_SPRITE_MAP[building.type];
      if (!spriteKey) continue;

      const { x, y } = tileCoords(building.tileIndex, state.world.width);

      // Fences pick a variant based on their neighbours so adjacent fences
      // read as a continuous line.
      if (building.type === "fence") {
        spriteKey = fenceVariantKey(x, y, state.world.width, state.world.height, fenceTiles);
      }

      const sprite = this.getOrCreateSprite(spriteIdx);
      sprite.texture = getTileTexture(spriteKey);
      sprite.x = x * TILE_SIZE;
      sprite.y = y * TILE_SIZE;
      sprite.width = TILE_SIZE;
      sprite.height = TILE_SIZE;
      sprite.visible = true;
      if (building.type === "fence") {
        // Worn fences look weathered (browner) and fade once breached.
        sprite.tint = building.condition > 0.7 ? 0xffffff : building.condition > 0.35 ? 0xcaa98a : 0x9a7a5a;
        sprite.alpha = building.condition <= 0.35 ? 0.5 : 1;
      } else {
        sprite.tint = 0xffffff;
        sprite.alpha = building.active ? 1.0 : 0.5;
      }
      spriteIdx++;
    }

    for (let i = spriteIdx; i < this.activeCount; i++) {
      this.spritePool[i].visible = false;
    }
    this.activeCount = spriteIdx;
  }

  private getOrCreateSprite(idx: number): Sprite {
    if (idx < this.spritePool.length) {
      return this.spritePool[idx];
    }
    const sprite = new Sprite();
    this.container.addChild(sprite);
    this.spritePool.push(sprite);
    return sprite;
  }
}
