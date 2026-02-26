import { Container, Graphics } from "pixi.js";
import type { GameState, WeatherCondition } from "@farmgame/engine";
import { TILE_SIZE } from "../sprites/tileset.js";

const NEEDS_PARTICLES: Set<WeatherCondition> = new Set(["rain", "storm", "frost"]);
const NEEDS_OVERLAY: Set<WeatherCondition> = new Set(["cloudy", "rain", "storm", "drought"]);

interface Particle {
  x: number;
  y: number;
  speed: number;
  size: number;
}

export class WeatherEffects {
  readonly container: Container;
  private overlayGraphics: Graphics;
  private particleGraphics: Graphics;
  private particles: Particle[] = [];
  private lastCondition: WeatherCondition | null = null;
  private worldWidth = 0;
  private worldHeight = 0;
  private frameCount = 0;

  constructor() {
    this.container = new Container();
    this.overlayGraphics = new Graphics();
    this.particleGraphics = new Graphics();
    this.container.addChild(this.overlayGraphics);
    this.container.addChild(this.particleGraphics);
  }

  /** Called on game state change (every few seconds). */
  updateState(state: GameState): void {
    this.worldWidth = state.world.width * TILE_SIZE;
    this.worldHeight = state.world.height * TILE_SIZE;

    if (state.weather.condition !== this.lastCondition) {
      this.lastCondition = state.weather.condition;
      this.initParticles(state.weather.condition);
      this.drawOverlay(state.weather.condition);
    }
  }

  /** Called on animation frame — only does work when particles exist. */
  tick(): void {
    if (this.particles.length === 0) return;

    // Throttle particle draw to ~20fps
    this.frameCount++;
    if (this.frameCount % 3 !== 0) return;

    this.animateParticles();
    this.drawParticles();
  }

  private initParticles(condition: WeatherCondition) {
    this.particles = [];
    this.particleGraphics.clear();

    if (!NEEDS_PARTICLES.has(condition)) return;

    const count = condition === "storm" ? 100 : condition === "rain" ? 50 : 25;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.worldWidth,
        y: Math.random() * this.worldHeight,
        speed: condition === "storm" ? 3 + Math.random() * 3 : condition === "rain" ? 1.5 + Math.random() * 2 : 0.3 + Math.random() * 0.5,
        size: condition === "frost" ? 1 + Math.random() : 1,
      });
    }
  }

  private drawOverlay(condition: WeatherCondition) {
    const g = this.overlayGraphics;
    g.clear();

    if (!NEEDS_OVERLAY.has(condition)) return;

    if (condition === "drought") {
      g.rect(0, 0, this.worldWidth, this.worldHeight).fill({ color: 0xff6600, alpha: 0.06 });
    } else {
      const darkness = condition === "storm" ? 0.25 : condition === "rain" ? 0.15 : 0.08;
      g.rect(0, 0, this.worldWidth, this.worldHeight).fill({ color: 0x000000, alpha: darkness });
    }
  }

  private animateParticles() {
    const isFrost = this.lastCondition === "frost";
    const isStorm = this.lastCondition === "storm";
    for (const p of this.particles) {
      p.y += p.speed;
      if (isFrost) {
        p.x += Math.sin(p.y * 0.02) * 0.3;
      } else if (isStorm) {
        p.x += 1;
      }
      if (p.y > this.worldHeight) { p.y = -5; p.x = Math.random() * this.worldWidth; }
      if (p.x > this.worldWidth) p.x = 0;
    }
  }

  private drawParticles() {
    const g = this.particleGraphics;
    g.clear();

    const isFrost = this.lastCondition === "frost";
    for (const p of this.particles) {
      if (isFrost) {
        g.circle(p.x, p.y, p.size).fill({ color: 0xffffff, alpha: 0.7 });
      } else {
        g.moveTo(p.x, p.y).lineTo(p.x, p.y + 3).stroke({ width: 1, color: 0x6688cc, alpha: 0.5 });
      }
    }
  }
}
