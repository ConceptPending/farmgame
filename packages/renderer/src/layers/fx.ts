import { Container, Graphics } from "pixi.js";
import { TILE_SIZE } from "../sprites/tileset.js";

/** A tile-anchored action event the UI emits and the renderer turns into a burst. */
export type FXEventKind = "plant" | "harvest" | "build" | "manure";

export interface FXEvent {
  kind: FXEventKind;
  tileIndex: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Optional per-particle gravity, px/s². */
  gy: number;
  /** ms remaining. */
  ttl: number;
  /** Original ttl, used to compute alpha fade. */
  life: number;
  color: number;
  size: number;
}

/**
 * Lightweight particle layer: short-lived bursts at tiles when the player
 * lands a planting, harvest, build, or manure-spread. Pure-cosmetic juice
 * driven by the renderer's existing RAF tick; engine state is unaffected.
 */
export class FXLayer {
  readonly container: Container;
  private graphics: Graphics;
  private particles: Particle[] = [];

  constructor() {
    this.container = new Container();
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  /** Drain a batch of action events into spawned particle bursts. */
  drain(events: FXEvent[], worldWidth: number): void {
    for (const e of events) {
      const tx = e.tileIndex % worldWidth;
      const ty = (e.tileIndex / worldWidth) | 0;
      const cx = (tx + 0.5) * TILE_SIZE;
      const cy = (ty + 0.5) * TILE_SIZE;
      switch (e.kind) {
        case "plant":
          this.spawnPlant(cx, cy);
          break;
        case "harvest":
          this.spawnHarvest(cx, cy);
          break;
        case "build":
          this.spawnBuild(cx, cy);
          break;
        case "manure":
          this.spawnManure(cx, cy);
          break;
      }
    }
  }

  /** Advance and redraw active particles. Called from the RAF loop. */
  tick(dt: number): void {
    const d = Math.min(dt, 80); // clamp jumps from inactive tabs
    const sec = d / 1000;
    const g = this.graphics;
    g.clear();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.ttl -= d;
      if (p.ttl <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gy * sec;
      p.x += p.vx * sec;
      p.y += p.vy * sec;
      const alpha = Math.max(0, Math.min(1, p.ttl / p.life));
      g.rect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size).fill({ color: p.color, alpha });
    }
  }

  // --- Per-kind spawners ----------------------------------------------------
  private spawnPlant(cx: number, cy: number): void {
    // Small green pop, mostly up.
    for (let i = 0; i < 7; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6; // up + spread
      const speed = 16 + Math.random() * 18;
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gy: 40,
        ttl: 450 + Math.random() * 120,
        life: 500,
        color: Math.random() < 0.5 ? 0x6fa552 : 0x9ad36f,
        size: 1.4,
      });
    }
  }

  private spawnHarvest(cx: number, cy: number): void {
    // Gold starburst, 360°.
    for (let i = 0; i < 11; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 22 + Math.random() * 22;
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gy: 30,
        ttl: 520 + Math.random() * 180,
        life: 650,
        color: Math.random() < 0.5 ? 0xffdd57 : 0xffe8a0,
        size: 1.6,
      });
    }
  }

  private spawnBuild(cx: number, cy: number): void {
    // Dust puff — low arc, wider horizontal spread, brownish.
    for (let i = 0; i < 9; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
      const speed = 14 + Math.random() * 14;
      this.particles.push({
        x: cx + (Math.random() - 0.5) * 3,
        y: cy + 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gy: 70,
        ttl: 600 + Math.random() * 200,
        life: 700,
        color: Math.random() < 0.6 ? 0xb09a78 : 0x7a6650,
        size: 1.5,
      });
    }
  }

  private spawnManure(cx: number, cy: number): void {
    // Dark-brown puff falling/settling onto the soil.
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 2 + (Math.random() - 0.5) * 1.6; // down + spread
      const speed = 8 + Math.random() * 10;
      this.particles.push({
        x: cx + (Math.random() - 0.5) * 4,
        y: cy - 4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gy: 60,
        ttl: 380 + Math.random() * 120,
        life: 450,
        color: 0x5a3d20,
        size: 1.4,
      });
    }
  }
}
