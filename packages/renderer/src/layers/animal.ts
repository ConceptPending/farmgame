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

/** Stable per-animal hash for sub-tile placement + phase. */
function hashId(id: number): number {
  let h = (Math.imul(id ^ 0x9e3779b9, 2654435761)) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

interface AnimState {
  sprite: Sprite;
  type: AnimalType;
  size: number;
  /** Tile-anchored "home" position (tile center + stable id offset). */
  baseX: number;
  baseY: number;
  /** Current micro-target (a grazing wander offset from base). */
  tx: number;
  ty: number;
  /** Smoothed rendered position (eases toward `tx,ty`). */
  rx: number;
  ry: number;
  /** ms until the next grazing micro-step. */
  graze: number;
  /** Idle bob phase (radians). */
  phase: number;
  faceLeft: boolean;
}

/**
 * Renders livestock with smooth motion: each animal eases toward a tile-anchored
 * home (so when the engine wanders one to a new tile, the sprite walks there),
 * grazes within its tile with small randomised micro-steps, bobs gently, and
 * flips to face the way it moves. Renderer-only and driven by the RAF loop —
 * the engine state is unaffected.
 */
export class AnimalLayer {
  readonly container: Container;
  private states = new Map<number, AnimState>();

  constructor() {
    this.container = new Container();
  }

  update(state: GameState): void {
    const W = state.world.width;
    const present = new Set<number>();
    for (const a of state.animals) {
      present.add(a.id);
      const { x: tx, y: ty } = tileCoords(a.tileIndex, W);
      const h = hashId(a.id);
      const offX = ((h % 1000) / 1000 - 0.5) * TILE_SIZE * 0.45;
      const offY = (((h >>> 10) % 1000) / 1000 - 0.5) * TILE_SIZE * 0.35;
      const baseX = (tx + 0.5) * TILE_SIZE + offX;
      const baseY = (ty + 0.6) * TILE_SIZE + offY;
      const size = BASE_SIZE[a.type] * (0.55 + 0.45 * a.maturity);

      let st = this.states.get(a.id);
      if (!st) {
        const sprite = new Sprite(getTileTexture(SPRITE_KEY[a.type]));
        sprite.anchor.set(0.5, 0.85);
        this.container.addChild(sprite);
        st = {
          sprite,
          type: a.type,
          size,
          baseX,
          baseY,
          tx: baseX,
          ty: baseY,
          rx: baseX,
          ry: baseY,
          graze: 600 + (h % 1800),
          phase: (h % 628) / 100,
          faceLeft: false,
        };
        this.states.set(a.id, st);
      } else {
        st.size = size;
        st.type = a.type;
        st.baseX = baseX;
        st.baseY = baseY;
        // Retarget toward the new home so the sprite walks if the tile changed.
        st.tx = baseX;
        st.ty = baseY;
      }
      st.sprite.texture = getTileTexture(SPRITE_KEY[a.type]);
      st.sprite.tint = a.health < 0.5 ? 0xc98a8a : 0xffffff;
    }

    // Drop sprites for animals that are gone (sold, lost).
    for (const [id, st] of this.states) {
      if (!present.has(id)) {
        this.container.removeChild(st.sprite);
        st.sprite.destroy();
        this.states.delete(id);
      }
    }
  }

  /** Advance idle motion by `dt` ms (called from the renderer's RAF loop). */
  tick(dt: number): void {
    const d = Math.min(dt, 100); // clamp long pauses (e.g. inactive tab)
    for (const st of this.states.values()) {
      // Re-pick a grazing micro-target around the home tile periodically.
      st.graze -= d;
      if (st.graze <= 0) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * TILE_SIZE * 0.28;
        st.tx = st.baseX + Math.cos(angle) * r;
        st.ty = st.baseY + Math.sin(angle) * r * 0.55;
        st.graze = 700 + Math.random() * 2500;
      }
      // Frame-rate-independent ease toward the target (also covers walking to
      // a new tile after the engine wanders this animal).
      const k = 1 - Math.exp(-d / 280);
      const dx = st.tx - st.rx;
      const dy = st.ty - st.ry;
      st.rx += dx * k;
      st.ry += dy * k;
      // Face the way we're moving (only flip on meaningful x motion).
      if (Math.abs(dx) > 0.05) st.faceLeft = dx < 0;
      // Gentle vertical bob.
      st.phase += d * 0.005;
      const bob = Math.sin(st.phase) * 0.6;
      const scale = st.size / TILE_SIZE;
      st.sprite.scale.set(st.faceLeft ? -scale : scale, scale);
      st.sprite.position.set(st.rx, st.ry + bob);
    }
  }
}
