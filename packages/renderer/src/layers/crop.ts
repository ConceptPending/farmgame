import { Container, Sprite } from "pixi.js";
import type { GameState } from "@farmgame/engine";
import { tileCoords } from "@farmgame/engine";
import { TILE_SIZE, getTileTexture } from "../sprites/tileset.js";
import { getCropSpriteKey } from "../sprites/crop-sprites.js";

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
        const sprite = this.getOrCreateSprite(spriteIdx);
        sprite.texture = tex;
        sprite.x = x * TILE_SIZE;
        sprite.y = y * TILE_SIZE;
        sprite.width = TILE_SIZE;
        sprite.height = TILE_SIZE;
        sprite.visible = true;

        // Tint based on health
        if (!isDead && field.health < 0.5) {
          const healthFactor = field.health / 0.5;
          const r = 0xff;
          const g = Math.round(0xff * healthFactor);
          const b = Math.round(0xff * healthFactor);
          sprite.tint = (r << 16) | (g << 8) | b;
        } else {
          sprite.tint = 0xffffff;
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
