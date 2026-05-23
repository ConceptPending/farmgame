import { Container, Sprite } from "pixi.js";
import type { GameState } from "@farmgame/engine";
import { tileCoords } from "@farmgame/engine";
import { TILE_SIZE, getTileTexture } from "../sprites/tileset.js";
import { getCropSpriteKey } from "../sprites/crop-sprites.js";

/** Stable per-tile hash used to jitter crop placement so a planted field
 *  doesn't read as the same sprite stamped eight times. */
function tileHash(idx: number): number {
  let h = Math.imul(idx ^ 0x9e3779b9, 2654435761) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

export class CropLayer {
  readonly container: Container;
  private spritePool: Sprite[] = [];
  private activeCount = 0;

  constructor() {
    this.container = new Container();
  }

  update(state: GameState): void {
    let spriteIdx = 0;

    for (const field of state.fields) {
      if (!field.cropId) continue;
      if (field.state === "fallow" || field.state === "plowed") continue;

      const isDead = field.state === "dead";
      const spriteKey = getCropSpriteKey(field.cropId, field.growth, isDead);
      const tex = getTileTexture(spriteKey);

      for (const tileIdx of field.tileIndices) {
        const { x, y } = tileCoords(tileIdx, state.world.width);
        const h = tileHash(tileIdx);
        // Sub-pixel jitter: deterministic ±1px offset so identical sprites
        // don't form a perfect grid pattern across a planted field.
        const jx = ((h % 3) - 1) | 0;
        const jy = (((h >>> 2) % 3) - 1) | 0;
        const sprite = this.getOrCreateSprite(spriteIdx);
        sprite.texture = tex;
        sprite.x = x * TILE_SIZE + jx;
        sprite.y = y * TILE_SIZE + jy;
        sprite.width = TILE_SIZE;
        sprite.height = TILE_SIZE;
        sprite.visible = true;

        // Tint: low health → red, otherwise a subtle per-tile shade (92-100%)
        // so even healthy crops in the same field don't look identical.
        if (!isDead && field.health < 0.5) {
          const healthFactor = field.health / 0.5;
          const r = 0xff;
          const g = Math.round(0xff * healthFactor);
          const b = Math.round(0xff * healthFactor);
          sprite.tint = (r << 16) | (g << 8) | b;
        } else {
          const v = 235 + ((h >>> 4) % 21); // 235..255
          sprite.tint = (v << 16) | (v << 8) | v;
        }

        spriteIdx++;
      }
    }

    // Hide unused sprites
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
