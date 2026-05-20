import { Container, Sprite } from "pixi.js";
import type { GameState, BuildingType } from "@farmgame/engine";
import { tileCoords } from "@farmgame/engine";
import { TILE_SIZE, getTileTexture } from "../sprites/tileset.js";
import type { SPRITES } from "../sprites/tileset.js";

type SpriteKey = keyof typeof SPRITES;

const BUILDING_SPRITE_MAP: Record<BuildingType, SpriteKey> = {
  silo: "silo",
  barn: "barn",
  water_pump: "water_pump",
  windmill: "windmill",
  irrigation_ditch: "irrigation",
  road: "road",
  fence: "fence",
};

export class BuildingLayer {
  readonly container: Container;
  private spritePool: Sprite[] = [];
  private activeCount = 0;

  constructor() {
    this.container = new Container();
  }

  update(state: GameState): void {
    let spriteIdx = 0;

    for (const building of state.buildings) {
      const spriteKey = BUILDING_SPRITE_MAP[building.type];
      if (!spriteKey) continue;

      const { x, y } = tileCoords(building.tileIndex, state.world.width);
      const sprite = this.getOrCreateSprite(spriteIdx);
      sprite.texture = getTileTexture(spriteKey);
      sprite.x = x * TILE_SIZE;
      sprite.y = y * TILE_SIZE;
      sprite.width = TILE_SIZE;
      sprite.height = TILE_SIZE;
      sprite.visible = true;
      sprite.alpha = building.active ? 1.0 : 0.5;
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
