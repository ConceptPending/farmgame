import { Container, Sprite } from "pixi.js";
import type { GameState, AnimalType } from "@farmgame/engine";
import { tileCoords } from "@farmgame/engine";
import { TILE_SIZE, getTileTexture } from "../sprites/tileset.js";
import type { SPRITES } from "../sprites/tileset.js";

type SpriteKey = keyof typeof SPRITES;

const SPRITE_KEY: Record<AnimalType, SpriteKey> = {
  chicken: "animal_chicken",
  pig: "animal_pig",
  sheep: "animal_sheep",
  cow: "animal_cow",
};

/** On-screen size (px) of a fully grown animal; babies scale down from this. */
const BASE_SIZE: Record<AnimalType, number> = {
  chicken: 11,
  pig: 13,
  sheep: 13,
  cow: 15,
};

/** Stable per-animal hash so each one keeps the same spot around its barn. */
function hashId(id: number): number {
  let h = (Math.imul(id ^ 0x9e3779b9, 2654435761)) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

/**
 * Renders livestock on the map. The engine gives animals no position, so each
 * is scattered deterministically around a barn (round-robin across barns) from
 * a hash of its id — stable across frames, clustering the herd by its pens.
 * Babies render smaller (by maturity); unhealthy animals are tinted.
 */
export class AnimalLayer {
  readonly container: Container;
  private pool: Sprite[] = [];
  private activeCount = 0;

  constructor() {
    this.container = new Container();
  }

  update(state: GameState): void {
    let idx = 0;
    for (const a of state.animals) {
      const { x: tx, y: ty } = tileCoords(a.tileIndex, state.world.width);
      const h = hashId(a.id);
      // A stable sub-tile offset so several animals sharing a tile don't stack.
      const ox = ((h % 1000) / 1000 - 0.5) * TILE_SIZE * 0.55;
      const oy = (((h >>> 10) % 1000) / 1000 - 0.5) * TILE_SIZE * 0.45;
      const cx = (tx + 0.5) * TILE_SIZE + ox;
      const cy = (ty + 0.6) * TILE_SIZE + oy;

      const size = BASE_SIZE[a.type] * (0.55 + 0.45 * a.maturity);
      const sprite = this.getOrCreate(idx);
      sprite.texture = getTileTexture(SPRITE_KEY[a.type]);
      sprite.width = size;
      sprite.height = size;
      sprite.x = cx - size / 2;
      sprite.y = cy - size * 0.8; // anchor feet near the ground point
      sprite.visible = true;
      sprite.tint = a.health < 0.5 ? 0xc98a8a : 0xffffff;
      idx++;
    }

    for (let i = idx; i < this.activeCount; i++) {
      this.pool[i].visible = false;
    }
    this.activeCount = idx;
  }

  private getOrCreate(i: number): Sprite {
    if (i < this.pool.length) return this.pool[i];
    const sprite = new Sprite();
    this.container.addChild(sprite);
    this.pool.push(sprite);
    return sprite;
  }
}
