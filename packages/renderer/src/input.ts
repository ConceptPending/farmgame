import { WORLD_SIZE } from "@farmgame/shared";
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
  private worldWidth = WORLD_SIZE;
  private worldHeight = WORLD_SIZE;
  private world: Container | null = null;
  private dragStartTile: number | null = null;
  private dragStartTileX = 0;
  private dragStartTileY = 0;
  // True once the pointer has moved to a different tile while a drag is pending,
  // i.e. an actual drag gesture (as opposed to a stationary click).
  private dragActive = false;
  // Set when a drag gesture ends, so the trailing synthetic `click` event is ignored.
  private suppressNextClick = false;
  private dragEnabled = false;
  // Last tile a hover event was emitted for (dedupes per-pixel mousemoves).
  private lastHoverTileIndex = -1;
  // Last in-bounds tile a drag visited — the drag-end target when the button
  // is released outside the canvas.
  private lastDragTile: { tileX: number; tileY: number; tileIndex: number } | null = null;

  private screenToTile(e: MouseEvent): { tileX: number; tileY: number; tileIndex: number } | null {
    if (!this.world || !this.canvas) return null;

    // Work entirely in logical (CSS) pixels: with autoDensity the canvas CSS
    // size equals Pixi's logical size, and the world transform is logical too.
    // The previous version scaled up by the *init-time* backbuffer ratio and
    // back down by the *live* devicePixelRatio — correct only until the window
    // moved to a monitor with a different DPR.
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const worldX = (px - this.world.x) / this.world.scale.x;
    const worldY = (py - this.world.y) / this.world.scale.y;

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

    // A completed drag gesture leaves a trailing `click`; ignore it so a single
    // drag doesn't also fire a click action on the start tile.
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      return;
    }

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

    // Reset here so a click that the browser suppressed after a prior drag
    // can't leak its suppression onto this new gesture.
    this.suppressNextClick = false;

    const tile = this.screenToTile(e);
    if (!tile) return;

    // Record a pending drag start, but don't emit `tile_drag_start` yet — only
    // once the pointer actually moves to another tile. A stationary press stays
    // a plain click.
    if (this.dragEnabled || e.shiftKey) {
      this.dragStartTile = tile.tileIndex;
      this.dragStartTileX = tile.tileX;
      this.dragStartTileY = tile.tileY;
      this.dragActive = false;
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (!this.callback) return;

    if (this.dragStartTile !== null && this.dragActive) {
      // Registered on window, so a release outside the canvas still ends the
      // gesture — at the last in-bounds tile the drag visited.
      const tile = this.screenToTile(e) ?? this.lastDragTile;
      if (tile) {
        this.callback({
          type: "tile_drag_end",
          tileIndex: tile.tileIndex,
          tileX: tile.tileX,
          tileY: tile.tileY,
        });
      }
      // A real drag occurred — swallow the trailing click.
      this.suppressNextClick = true;
    }
    this.dragStartTile = null;
    this.dragActive = false;
    this.lastDragTile = null;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.callback) return;

    const tile = this.screenToTile(e);
    if (!tile) return;

    // Emit hover only when the tile actually changes — per-pixel mousemove
    // events were re-running the full overlay update hundreds of times/sec.
    if (tile.tileIndex !== this.lastHoverTileIndex) {
      this.lastHoverTileIndex = tile.tileIndex;
      this.callback({
        type: "tile_hover",
        tileIndex: tile.tileIndex,
        tileX: tile.tileX,
        tileY: tile.tileY,
      });
    }

    if (this.dragStartTile === null) return;
    this.lastDragTile = tile;

    // First movement onto a different tile promotes the press into a drag.
    if (!this.dragActive && tile.tileIndex !== this.dragStartTile) {
      this.dragActive = true;
      this.callback({
        type: "tile_drag_start",
        tileIndex: this.dragStartTile,
        tileX: this.dragStartTileX,
        tileY: this.dragStartTileY,
      });
    }

    if (this.dragActive) {
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

  private onMouseLeave = () => {
    if (!this.callback) return;
    if (this.lastHoverTileIndex === -1) return;
    this.lastHoverTileIndex = -1;
    // Clears the hover reticle (and stops its per-frame pulse redraw) when
    // the pointer leaves the map.
    this.callback({ type: "tile_hover", tileIndex: -1, tileX: -1, tileY: -1 });
  };

  attach(canvas: HTMLCanvasElement, callback: (event: InputEvent) => void): void {
    this.canvas = canvas;
    this.callback = callback;
    canvas.addEventListener("click", this.onClick);
    canvas.addEventListener("mousedown", this.onMouseDown);
    // Up/move live on window so a drag that leaves the canvas still tracks
    // and ends cleanly (screenToTile bounds-checks off-canvas moves away).
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mousemove", this.onMouseMove);
    canvas.addEventListener("mouseleave", this.onMouseLeave);
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
      this.canvas.removeEventListener("mouseleave", this.onMouseLeave);
      this.canvas.removeEventListener("contextmenu", this.onRightClick);
    }
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    this.canvas = null;
    this.callback = null;
  }
}
