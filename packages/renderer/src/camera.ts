import type { Container } from "pixi.js";
import { TILE_SIZE } from "./sprites/tileset.js";

export class Camera {
  private target: Container | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private isDragging = false;
  private lastX = 0;
  private lastY = 0;
  private keys = new Set<string>();

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 1 || e.button === 2) {
      this.isDragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    }
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.isDragging || !this.target) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.target.x += dx;
    this.target.y += dy;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.clamp();
  };

  private onMouseUp = () => {
    this.isDragging = false;
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.target) return;
    e.preventDefault();
    const scale = this.target.scale.x;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(4, Math.max(0.5, scale * delta));
    this.target.scale.set(newScale);
    this.clamp();
  };

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.key.toLowerCase());
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  attach(world: Container, canvas: HTMLCanvasElement): void {
    this.target = world;
    this.canvas = canvas;

    // Center on player's owned plots (roughly tile 16,16 to 32,32)
    const viewWidth = canvas.clientWidth;
    const viewHeight = canvas.clientHeight;
    const centerWorldX = 24 * TILE_SIZE;
    const centerWorldY = 20 * TILE_SIZE;

    // Default zoom: show ~24x18 tiles
    const scale = Math.min(viewWidth / (24 * TILE_SIZE), viewHeight / (18 * TILE_SIZE));
    world.scale.set(Math.max(0.5, Math.min(4, scale)));

    world.x = viewWidth / 2 - centerWorldX * world.scale.x;
    world.y = viewHeight / 2 - centerWorldY * world.scale.y;

    canvas.addEventListener("mousedown", this.onMouseDown);
    canvas.addEventListener("mousemove", this.onMouseMove);
    canvas.addEventListener("mouseup", this.onMouseUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    canvas.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    // Start keyboard pan loop
    this.startPanLoop();
  }

  private panLoopId: number | null = null;

  private startPanLoop() {
    const PAN_SPEED = 4;
    const loop = () => {
      if (!this.target) return;
      let dx = 0;
      let dy = 0;
      if (this.keys.has("w") || this.keys.has("arrowup")) dy += PAN_SPEED;
      if (this.keys.has("s") || this.keys.has("arrowdown")) dy -= PAN_SPEED;
      if (this.keys.has("a") || this.keys.has("arrowleft")) dx += PAN_SPEED;
      if (this.keys.has("d") || this.keys.has("arrowright")) dx -= PAN_SPEED;
      if (dx !== 0 || dy !== 0) {
        this.target.x += dx;
        this.target.y += dy;
        this.clamp();
      }
      this.panLoopId = requestAnimationFrame(loop);
    };
    this.panLoopId = requestAnimationFrame(loop);
  }

  private clamp() {
    // Optional: prevent panning too far from the world
    // Allow some margin so user can see edges
  }

  detach(): void {
    if (this.panLoopId !== null) {
      cancelAnimationFrame(this.panLoopId);
      this.panLoopId = null;
    }
    if (!this.canvas) return;
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mouseup", this.onMouseUp);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.target = null;
    this.canvas = null;
  }
}
