import { Container, Graphics } from "pixi.js";
import type { Season } from "@farmgame/engine";
import { TILE_SIZE } from "../sprites/tileset.js";

/** Tiny deterministic RNG (Mulberry32) so each season's overlay is stable. */
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * World-space overlay that gives each season a distinct map-level look on top
 * of the screen-space ambient tint. Painted once per season change (no per-
 * frame cost) and pans/zooms with the map because it lives in the world container.
 */
export class SeasonOverlay {
  readonly container: Container;
  private graphics: Graphics;
  private currentSeason: Season | null = null;

  constructor() {
    this.container = new Container();
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  /** Repaint the overlay if the season changed; no-op otherwise. */
  setSeason(season: Season, worldWidth: number, worldHeight: number): void {
    if (season === this.currentSeason) return;
    this.currentSeason = season;

    const g = this.graphics;
    g.clear();

    const w = worldWidth * TILE_SIZE;
    const h = worldHeight * TILE_SIZE;
    const rnd = seededRng(seasonSeed(season));

    switch (season) {
      case "spring":
        drawSpringFlowers(g, rnd, w, h);
        break;
      case "summer":
        drawSummerHaze(g, rnd, w, h);
        break;
      case "fall":
        drawFallLeaves(g, rnd, w, h);
        break;
      case "winter":
        drawWinterSnow(g, rnd, w, h);
        break;
    }
  }
}

function seasonSeed(season: Season): number {
  // Distinct seed per season so the patterns differ but are stable.
  return { spring: 111, summer: 222, fall: 333, winter: 444 }[season];
}

function drawSpringFlowers(g: Graphics, rnd: () => number, w: number, h: number): void {
  // Sparse extra blooms layered on top of the year-round meadow scatter.
  const palette = [0xffffff, 0xffd24a, 0xff7eb0, 0xb39ddb];
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(rnd() * w);
    const y = Math.floor(rnd() * h);
    const c = palette[Math.floor(rnd() * palette.length)];
    g.rect(x, y, 1, 1).fill({ color: c, alpha: 0.85 });
    // Occasionally add a tiny petal pair so a few read as flowers, not dust.
    if (rnd() < 0.15) {
      g.rect(x - 1, y, 1, 1).fill({ color: c, alpha: 0.7 });
      g.rect(x + 1, y, 1, 1).fill({ color: c, alpha: 0.7 });
    }
  }
}

function drawSummerHaze(g: Graphics, rnd: () => number, w: number, h: number): void {
  // Faint warm horizontal streaks — heat shimmer in the distance.
  const haze = 0xe0c98e;
  for (let i = 0; i < 16; i++) {
    const y = Math.floor(rnd() * h);
    const height = 3 + Math.floor(rnd() * 3);
    g.rect(0, y, w, height).fill({ color: haze, alpha: 0.04 });
  }
}

function drawFallLeaves(g: Graphics, rnd: () => number, w: number, h: number): void {
  const palette = [0xd97742, 0xc7561c, 0xe8a838, 0xb53d20, 0x8a4a1a];
  // Lots of small leaf-like specks scattered across the world.
  for (let i = 0; i < 220; i++) {
    const x = Math.floor(rnd() * w);
    const y = Math.floor(rnd() * h);
    const c = palette[Math.floor(rnd() * palette.length)];
    g.rect(x, y, 2, 1).fill({ color: c, alpha: 0.85 });
  }
  // A few larger fallen leaves with a darker accent pixel for some weight.
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rnd() * w);
    const y = Math.floor(rnd() * h);
    const c = palette[Math.floor(rnd() * palette.length)];
    g.rect(x, y, 2, 2).fill({ color: c, alpha: 0.85 });
    g.rect(x + 1, y + 1, 1, 1).fill({ color: 0x6b3818, alpha: 0.7 });
  }
}

function drawWinterSnow(g: Graphics, rnd: () => number, w: number, h: number): void {
  // Heavy speckling so the map actually reads as snow-covered.
  for (let i = 0; i < 900; i++) {
    const x = Math.floor(rnd() * w);
    const y = Math.floor(rnd() * h);
    const c = rnd() < 0.6 ? 0xffffff : 0xeaf3fb;
    g.rect(x, y, 1, 1).fill({ color: c, alpha: 0.85 });
  }
  // Small snow clumps for accents.
  for (let i = 0; i < 50; i++) {
    const x = Math.floor(rnd() * (w - 2));
    const y = Math.floor(rnd() * (h - 2));
    g.rect(x, y, 2, 2).fill({ color: 0xffffff, alpha: 0.9 });
  }
}
