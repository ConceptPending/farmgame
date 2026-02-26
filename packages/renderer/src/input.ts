import type { Container } from "pixi.js";
import { TILE_SIZE } from "./sprites/tileset.js";

export type InputEvent =
  | { type: "tile_click"; tileIndex: number; tileX: number; tileY: number; shiftKey: boolean }
  | { type: "tile_hover"; tileIndex: number; tileX: number; tileY: number }
  | { type: "tile_drag_start"; tileIndex: number; tileX: number; tileY: number }
  | { type: "tile_drag_move"; tileIndex: number; tileX: number; tileY: number }
  | { type: "tile_drag_end"; tileIndex: number; tileX: number; tileY: number }
  | { type: "right_click"; tileIndex: number; tileX: number; tileY: number };

export class InputHandler {
  private canvas: HTMLCanvasElement | null = null;
  private callback: ((event: InputEvent) => void) | null = null;
  private worldWidth = 48;
  private worldHeight = 48;
  private world: Container | null = null;
  private dragStartTile: number | null = null;
  private dragEnabled = false;

  private screenToTile(e: MouseEvent): { tileX: number; tileY: number; tileIndex: number } | null {
    if (!this.world || !this.canvas) return null;

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const screenX = (e.clientX - rect.left) * scaleX;
    const screenY = (e.clientY - rect.top) * scaleY;
    const dpr = window.devicePixelRatio || 1;
    const worldX = (screenX - this.world.x * dpr) / (this.world.scale.x * dpr);
    const worldY = (screenY - this.world.y * dpr) / (this.world.scale.y * dpr);

    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);

    if (tileX < 0 || tileX >= this.worldWidth || tileY < 0 || tileY >= this.worldHeight) {
      return null;
    }

    return { tileX, tileY, tileIndex: tileY * this.worldWidth + tileX };
  }

  private onClick = (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (!this.callback) return;

    const tile = this.screenToTile(e);
    if (!tile) return;

    this.callback({
      type: "tile_click",
      tileIndex: tile.tileIndex,
      tileX: tile.tileX,
      tileY: tile.tileY,
      shiftKey: e.shiftKey,
    });
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (!this.callback) return;

    const tile = this.screenToTile(e);
    if (!tile) return;

    if (this.dragEnabled || e.shiftKey) {
      this.dragStartTile = tile.tileIndex;
      this.callback({
        type: "tile_drag_start",
        tileIndex: tile.tileIndex,
        tileX: tile.tileX,
        tileY: tile.tileY,
      });
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (!this.callback) return;

    if (this.dragStartTile !== null) {
      const tile = this.screenToTile(e);
      if (tile) {
        this.callback({
          type: "tile_drag_end",
          tileIndex: tile.tileIndex,
          tileX: tile.tileX,
          tileY: tile.tileY,
        });
      }
      this.dragStartTile = null;
    }
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.callback) return;

    const tile = this.screenToTile(e);
    if (!tile) return;

    this.callback({
      type: "tile_hover",
      tileIndex: tile.tileIndex,
      tileX: tile.tileX,
      tileY: tile.tileY,
    });

    if (this.dragStartTile !== null) {
      this.callback({
        type: "tile_drag_move",
        tileIndex: tile.tileIndex,
        tileX: tile.tileX,
        tileY: tile.tileY,
      });
    }
  };

  private onRightClick = (e: MouseEvent) => {
    if (!this.callback) return;
    e.preventDefault();

    const tile = this.screenToTile(e);
    if (!tile) return;

    this.callback({
      type: "right_click",
      tileIndex: tile.tileIndex,
      tileX: tile.tileX,
      tileY: tile.tileY,
    });
  };

  attach(canvas: HTMLCanvasElement, callback: (event: InputEvent) => void): void {
    this.canvas = canvas;
    this.callback = callback;
    canvas.addEventListener("click", this.onClick);
    canvas.addEventListener("mousedown", this.onMouseDown);
    canvas.addEventListener("mouseup", this.onMouseUp);
    canvas.addEventListener("mousemove", this.onMouseMove);
    canvas.addEventListener("contextmenu", this.onRightClick);
  }

  setDragEnabled(enabled: boolean): void {
    this.dragEnabled = enabled;
  }

  updateGrid(worldWidth: number, worldHeight: number, world: Container): void {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.world = world;
  }

  detach(): void {
    if (this.canvas) {
      this.canvas.removeEventListener("click", this.onClick);
      this.canvas.removeEventListener("mousedown", this.onMouseDown);
      this.canvas.removeEventListener("mouseup", this.onMouseUp);
      this.canvas.removeEventListener("mousemove", this.onMouseMove);
      this.canvas.removeEventListener("contextmenu", this.onRightClick);
    }
    this.canvas = null;
    this.callback = null;
  }
}
