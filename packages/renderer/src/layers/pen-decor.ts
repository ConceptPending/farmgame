import { Container, Graphics } from "pixi.js";
import type { GameState } from "@farmgame/engine";
import { pennedTiles } from "@farmgame/engine";
import { TILE_SIZE } from "../sprites/tileset.js";

/**
 * World-space decoration drawn inside player pens: hay near barns, mud near
 * water troughs, grain near feed troughs, footprints scattered across the
 * interior. Makes a pen read as a lived-in space rather than a fenced
 * rectangle, without per-frame cost — repainted only when buildings or the
 * herd change.
 */
export class PenDecorLayer {
  readonly container: Container;
  private graphics: Graphics;
  private lastKey = "";

  constructor() {
    this.container = new Container();
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  update(state: GameState): void {
    // Dirty key: changes when any building moves/added or herd count changes
    // (animals occupying different tiles is the cheap proxy for "the herd has
    // shifted enough that we should rescatter decor").
    const key =
      state.buildings.map((b) => `${b.type}@${b.tileIndex}`).join(",") +
      "|" +
      state.animals.length;
    if (key === this.lastKey) return;
    this.lastKey = key;

    const g = this.graphics;
    g.clear();

    const W = state.world.width;
    const penned = pennedTiles(state);
    if (penned.size === 0) return;

    // Build a quick lookup: tile → building type, so we can find anchors.
    const buildingAt = new Map<number, string>();
    for (const b of state.buildings) buildingAt.set(b.tileIndex, b.type);

    // For each barn, find penned neighbours and drop hay there.
    for (const b of state.buildings) {
      if (b.type !== "barn") continue;
      const neighbors = neighborTiles(b.tileIndex, W);
      for (const n of neighbors) {
        if (penned.has(n)) drawHay(g, n, W);
      }
    }

    // Water/feed troughs sit on penned tiles directly (they're passable).
    for (const b of state.buildings) {
      if (!penned.has(b.tileIndex)) continue;
      if (b.type === "water_trough") drawMud(g, b.tileIndex, W);
      else if (b.type === "feed_trough") drawGrainScatter(g, b.tileIndex, W);
    }

    // Scatter footprints across the interior — skip tiles that already host
    // a building so decor stays in the open ground.
    for (const t of penned) {
      if (buildingAt.has(t)) continue;
      drawFootprints(g, t, W);
    }
  }
}

function neighborTiles(idx: number, w: number): number[] {
  const x = idx % w;
  const y = (idx / w) | 0;
  const out: number[] = [];
  if (x > 0) out.push(idx - 1);
  if (x < w - 1) out.push(idx + 1);
  if (y > 0) out.push(idx - w);
  out.push(idx + w);
  return out;
}

function tilePx(idx: number, w: number): { x: number; y: number } {
  return { x: (idx % w) * TILE_SIZE, y: ((idx / w) | 0) * TILE_SIZE };
}

/** Tiny deterministic per-tile hash so footprint positions don't flicker. */
function tileHash(idx: number): number {
  let h = Math.imul(idx ^ 0x9e3779b9, 2654435761) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

function drawHay(g: Graphics, idx: number, w: number) {
  const { x, y } = tilePx(idx, w);
  const h = tileHash(idx + 31);
  // 3 short straws + a slightly darker shadow line.
  for (let i = 0; i < 4; i++) {
    const sx = 2 + ((h >>> (i * 4)) % 12);
    const sy = 3 + ((h >>> (i * 4 + 2)) % 10);
    g.rect(x + sx, y + sy, 3, 1).fill({ color: 0xd8b072, alpha: 0.85 });
    g.rect(x + sx, y + sy + 1, 3, 1).fill({ color: 0xa48045, alpha: 0.6 });
  }
}

function drawMud(g: Graphics, idx: number, w: number) {
  const { x, y } = tilePx(idx, w);
  // Wet patch under the trough — a flat darker ellipse.
  g.ellipse(x + 8, y + 13, 6, 2).fill({ color: 0x2a1c10, alpha: 0.55 });
  g.ellipse(x + 8, y + 13, 4, 1.2).fill({ color: 0x1a120a, alpha: 0.5 });
}

function drawGrainScatter(g: Graphics, idx: number, w: number) {
  const { x, y } = tilePx(idx, w);
  const h = tileHash(idx + 7);
  for (let i = 0; i < 6; i++) {
    const sx = 2 + ((h >>> (i * 3)) % 12);
    const sy = 11 + ((h >>> (i * 3 + 1)) % 4);
    g.rect(x + sx, y + sy, 1, 1).fill({ color: 0xdcb43c, alpha: 0.9 });
  }
}

function drawFootprints(g: Graphics, idx: number, w: number) {
  const { x, y } = tilePx(idx, w);
  const h = tileHash(idx);
  // 1-2 pairs of dark dots, hashed for stable placement.
  const pairs = 1 + (h & 1);
  for (let i = 0; i < pairs; i++) {
    const fx = 2 + ((h >>> (i * 5)) % 11);
    const fy = 4 + ((h >>> (i * 5 + 3)) % 10);
    g.rect(x + fx, y + fy, 1, 1).fill({ color: 0x2b1f14, alpha: 0.45 });
    g.rect(x + fx + 2, y + fy + 1, 1, 1).fill({ color: 0x2b1f14, alpha: 0.45 });
  }
}
