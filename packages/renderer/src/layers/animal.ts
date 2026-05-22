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
    const barns = state.buildings.filter((b) => b.type === "barn");
    let idx = 0;

    if (barns.length > 0) {
      for (const a of state.animals) {
        const barn = barns[idx % barns.length];
        const { x: bx, y: by } = tileCoords(barn.tileIndex, state.world.width);
        const h = hashId(a.id);

        // Scatter within a small radius around (and mostly in front of) the barn.
        const angle = (h % 628) / 100; // 0..2π
        const radius = (0.7 + ((h >>> 9) % 100) / 100 * 1.5) * TILE_SIZE;
        const cx = (bx + 0.5) * TILE_SIZE + Math.cos(angle) * radius;
        const cy = (by + 1.1) * TILE_SIZE + Math.sin(angle) * radius * 0.7;

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
