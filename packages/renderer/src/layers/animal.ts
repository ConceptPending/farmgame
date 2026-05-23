import { Container, Graphics, Sprite } from "pixi.js";
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

/** Per-type idle motion: each species moves a bit differently so a mixed herd reads alive. */
interface MotionProfile {
  /** Bob phase advance speed (rad/s). */
  freq: number;
  /** Vertical bob amplitude (px). */
  bob: number;
  /** Horizontal sway amplitude (px). */
  sway: number;
  /** Whether to add an occasional upward hop on the slow phase. */
  hop: boolean;
}
const PROFILE: Record<AnimalType, MotionProfile> = {
  chicken: { freq: 7, bob: 1.2, sway: 0, hop: false }, // quick peck-bob
  sheep:   { freq: 3, bob: 0.6, sway: 0, hop: true },  // calm bob + the odd hop
  cow:     { freq: 2, bob: 0.4, sway: 0.6, hop: false }, // slow head sway
  pig:     { freq: 5, bob: 0.5, sway: 0.8, hop: false }, // snuffling sway
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
  maturity: number;
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
  /** ms of birth-sparkle remaining (0 when none). */
  sparkle: number;
}

const SPARKLE_MS = 1100;

/**
 * Renders livestock with smooth, per-type motion. Each animal eases toward a
 * tile-anchored home (so when the engine wanders one to a new tile it walks
 * there), grazes within its tile with small randomised micro-steps, and adds
 * its species idle: chicken peck-bobs, sheep sometimes hops, cow sways its
 * head slowly, pig snuffles. Babies are smaller, bouncier, and re-target
 * more often. A short sparkle puffs over any animal that just appeared.
 *
 * Renderer-only and driven by the RAF loop — the engine is unaffected.
 */
export class AnimalLayer {
  readonly container: Container;
  private states = new Map<number, AnimState>();
  private sparkleGfx: Graphics;

  constructor() {
    this.container = new Container();
    this.sparkleGfx = new Graphics();
    this.container.addChild(this.sparkleGfx);
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
        // Insert beneath the sparkle layer so the sparkle floats above.
        this.container.addChildAt(sprite, this.container.children.length - 1);
        st = {
          sprite,
          type: a.type,
          size,
          maturity: a.maturity,
          baseX,
          baseY,
          tx: baseX,
          ty: baseY,
          rx: baseX,
          ry: baseY,
          graze: 600 + (h % 1800),
          phase: (h % 628) / 100,
          faceLeft: (h & 1) === 1,
          sparkle: SPARKLE_MS, // celebrate the new arrival
        };
        this.states.set(a.id, st);
      } else {
        st.size = size;
        st.type = a.type;
        st.maturity = a.maturity;
        st.baseX = baseX;
        st.baseY = baseY;
        // Retarget toward the new home so the sprite walks if the tile changed.
        st.tx = baseX;
        st.ty = baseY;
      }
      st.sprite.texture = getTileTexture(SPRITE_KEY[a.type]);
      st.sprite.tint = a.health < 0.5 ? 0xc98a8a : 0xffffff;
    }

    // Drop sprites for animals that are gone (sold, lost, taken).
    for (const [id, st] of this.states) {
      if (!present.has(id)) {
        this.container.removeChild(st.sprite);
        st.sprite.destroy();
        this.states.delete(id);
      }
    }
  }

  /** Advance per-animal motion + sparkle by `dt` ms (called from the RAF loop). */
  tick(dt: number): void {
    const d = Math.min(dt, 100); // clamp long pauses (e.g. inactive tab)
    this.sparkleGfx.clear();
    for (const st of this.states.values()) {
      const baby = st.maturity < 0.5;

      // Re-pick a grazing micro-target around the home tile periodically.
      st.graze -= d;
      if (st.graze <= 0) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * TILE_SIZE * (baby ? 0.34 : 0.28);
        st.tx = st.baseX + Math.cos(angle) * r;
        st.ty = st.baseY + Math.sin(angle) * r * 0.55;
        // Babies fidget faster than grown animals.
        st.graze = baby ? 350 + Math.random() * 1300 : 700 + Math.random() * 2500;
      }
      // Frame-rate-independent ease toward target (also covers walking after
      // the engine wanders this animal to a new tile).
      const k = 1 - Math.exp(-d / (baby ? 220 : 280));
      const dx = st.tx - st.rx;
      const dy = st.ty - st.ry;
      st.rx += dx * k;
      st.ry += dy * k;
      if (Math.abs(dx) > 0.05) st.faceLeft = dx < 0;

      // Per-type idle motion. Phase advances at the species' tempo; bob and
      // sway are scaled up for babies so the little ones look bouncy.
      const profile = PROFILE[st.type];
      const sizeScale = baby ? 1.6 : 1;
      st.phase += d * 0.001 * profile.freq;
      let yOff = Math.sin(st.phase) * profile.bob * sizeScale;
      const xOff = profile.sway
        ? Math.sin(st.phase * 0.7) * profile.sway * sizeScale
        : 0;
      if (profile.hop) {
        // Rare upward impulse from a much slower phase — a sheep's little jump.
        const hopPhase = Math.sin(st.phase * 0.18);
        if (hopPhase > 0.93) yOff -= ((hopPhase - 0.93) / 0.07) * 3;
      }

      const scale = st.size / TILE_SIZE;
      st.sprite.scale.set(st.faceLeft ? -scale : scale, scale);
      st.sprite.position.set(st.rx + xOff, st.ry + yOff);

      // Birth sparkle: a small yellow plus that rises and fades over ~1 s.
      if (st.sparkle > 0) {
        const t = 1 - st.sparkle / SPARKLE_MS; // 0 → 1
        const sx = st.rx;
        const sy = st.ry - st.size * 0.95 - t * 9;
        const alpha = (1 - t) * 0.9;
        const c = 0xffe04a;
        this.sparkleGfx.rect(sx - 1, sy, 3, 1).fill({ color: c, alpha });
        this.sparkleGfx.rect(sx, sy - 1, 1, 3).fill({ color: c, alpha });
        this.sparkleGfx.rect(sx, sy, 1, 1).fill({ color: 0xffffff, alpha });
        st.sparkle -= d;
      }
    }
  }
}
