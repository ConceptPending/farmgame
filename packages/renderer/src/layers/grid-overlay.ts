import { Container, Graphics } from "pixi.js";
import type { GameState, FieldState } from "@farmgame/engine";
import { TILE_SIZE } from "../sprites/tileset.js";

export type OverlayMode = "none" | "moisture" | "soil_quality" | "ownership";

const FIELD_STATE_COLORS: Record<FieldState, number> = {
  fallow: 0x888888,
  plowed: 0xa0522d,
  planted: 0x4ecca3,
  growing: 0x4ecca3,
  ready: 0xffdd57,
  dead: 0xff4444,
};

export class GridOverlay {
  readonly container: Container;
  private graphics: Graphics;
  private hoverGraphics: Graphics;
  private fieldFillGraphics: Graphics;
  private fieldOutlines: Graphics;
  private dragPreviewGraphics: Graphics;
  private overlayMode: OverlayMode = "none";
  private lastOverlayMode: OverlayMode = "none";
  private lastFieldKey = "";
  private _hoveredTileIndex = -1;
  private lastHoveredTileIndex = -2;
  private overlayDirty = true;
  private worldWidth = 48;

  constructor() {
    this.container = new Container();
    this.graphics = new Graphics();
    this.hoverGraphics = new Graphics();
    this.fieldFillGraphics = new Graphics();
    this.fieldOutlines = new Graphics();
    this.dragPreviewGraphics = new Graphics();
    this.container.addChild(this.graphics);
    this.container.addChild(this.fieldFillGraphics);
    this.container.addChild(this.fieldOutlines);
    this.container.addChild(this.dragPreviewGraphics);
    this.container.addChild(this.hoverGraphics);
  }

  get hoveredTileIndex(): number {
    return this._hoveredTileIndex;
  }

  set hoveredTileIndex(idx: number) {
    this._hoveredTileIndex = idx;
  }

  setOverlayMode(mode: OverlayMode): void {
    if (mode !== this.overlayMode) {
      this.overlayMode = mode;
      this.overlayDirty = true;
    }
  }

  markOverlayDirty(): void {
    this.overlayDirty = true;
  }

  update(state: GameState): void {
    this.worldWidth = state.world.width;

    // Only redraw overlay when mode changes or explicitly marked dirty
    if (this.overlayDirty || this.overlayMode !== this.lastOverlayMode) {
      this.drawOverlay(state);
      this.lastOverlayMode = this.overlayMode;
      this.overlayDirty = false;
    }

    // Only redraw field outlines/fills when fields change
    const fieldKey = state.fields.map((f) => `${f.id}:${f.state}:${f.tileIndices.length}`).join(",");
    if (fieldKey !== this.lastFieldKey) {
      this.drawFieldFills(state);
      this.drawFieldOutlines(state);
      this.lastFieldKey = fieldKey;
    }

    // Only redraw hover when it changes
    if (this._hoveredTileIndex !== this.lastHoveredTileIndex) {
      this.drawHover(state);
      this.lastHoveredTileIndex = this._hoveredTileIndex;
    }
  }

  private drawOverlay(state: GameState) {
    const g = this.graphics;
    g.clear();

    if (this.overlayMode === "none") return;

    const { world } = state;
    for (let i = 0; i < world.tiles.length; i++) {
      const tile = world.tiles[i];
      const x = (i % world.width) * TILE_SIZE;
      const y = Math.floor(i / world.width) * TILE_SIZE;

      let color: number;
      let alpha: number;

      switch (this.overlayMode) {
        case "moisture":
          color = 0x0066ff;
          alpha = tile.moisture * 0.4;
          break;
        case "soil_quality": {
          const q = tile.soilQuality;
          color = (Math.round(255 * (1 - q)) << 16) | (Math.round(255 * q) << 8);
          alpha = 0.35;
          break;
        }
        case "ownership":
          color = tile.owned ? 0x00ff88 : 0xff0000;
          alpha = 0.2;
          break;
        default:
          continue;
      }

      g.rect(x, y, TILE_SIZE, TILE_SIZE).fill({ color, alpha });
    }
  }

  private drawFieldFills(state: GameState) {
    const g = this.fieldFillGraphics;
    g.clear();

    for (const field of state.fields) {
      if (field.state !== "fallow") continue;
      for (const tileIdx of field.tileIndices) {
        const x = (tileIdx % state.world.width) * TILE_SIZE;
        const y = Math.floor(tileIdx / state.world.width) * TILE_SIZE;
        g.rect(x, y, TILE_SIZE, TILE_SIZE).fill({ color: 0xaa8855, alpha: 0.15 });
      }
    }
  }

  private drawFieldOutlines(state: GameState) {
    const g = this.fieldOutlines;
    g.clear();

    for (const field of state.fields) {
      const color = FIELD_STATE_COLORS[field.state];
      const tileSet = new Set(field.tileIndices);

      for (const tileIdx of field.tileIndices) {
        const x = (tileIdx % state.world.width) * TILE_SIZE;
        const y = Math.floor(tileIdx / state.world.width) * TILE_SIZE;

        if (!tileSet.has(tileIdx - state.world.width)) {
          g.moveTo(x, y).lineTo(x + TILE_SIZE, y).stroke({ width: 1, color, alpha: 0.8 });
        }
        if (!tileSet.has(tileIdx + state.world.width)) {
          g.moveTo(x, y + TILE_SIZE).lineTo(x + TILE_SIZE, y + TILE_SIZE).stroke({ width: 1, color, alpha: 0.8 });
        }
        const tx = tileIdx % state.world.width;
        if (!tileSet.has(tileIdx - 1) || tx === 0) {
          g.moveTo(x, y).lineTo(x, y + TILE_SIZE).stroke({ width: 1, color, alpha: 0.8 });
        }
        if (!tileSet.has(tileIdx + 1) || tx === state.world.width - 1) {
          g.moveTo(x + TILE_SIZE, y).lineTo(x + TILE_SIZE, y + TILE_SIZE).stroke({ width: 1, color, alpha: 0.8 });
        }
      }
    }
  }

  setDragPreview(startIdx: number, endIdx: number): void {
    const g = this.dragPreviewGraphics;
    g.clear();

    const w = this.worldWidth;
    const startX = startIdx % w;
    const startY = Math.floor(startIdx / w);
    const endX = endIdx % w;
    const endY = Math.floor(endIdx / w);

    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);

    const px = minX * TILE_SIZE;
    const py = minY * TILE_SIZE;
    const pw = (maxX - minX + 1) * TILE_SIZE;
    const ph = (maxY - minY + 1) * TILE_SIZE;

    g.rect(px, py, pw, ph).fill({ color: 0x4488ff, alpha: 0.2 });
    g.rect(px, py, pw, ph).stroke({ width: 1, color: 0x4488ff, alpha: 0.6 });
  }

  clearDragPreview(): void {
    this.dragPreviewGraphics.clear();
  }

  private drawHover(state: GameState) {
    const g = this.hoverGraphics;
    g.clear();

    if (this._hoveredTileIndex < 0 || this._hoveredTileIndex >= state.world.tiles.length) return;

    const x = (this._hoveredTileIndex % state.world.width) * TILE_SIZE;
    const y = Math.floor(this._hoveredTileIndex / state.world.width) * TILE_SIZE;
    g.rect(x, y, TILE_SIZE, TILE_SIZE).stroke({ width: 1, color: 0xffffff, alpha: 0.6 });
  }
}
