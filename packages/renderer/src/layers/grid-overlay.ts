import { Container, Graphics } from "pixi.js";
import type { GameState, FieldState } from "@farmgame/engine";
import { TILE_SIZE } from "../sprites/tileset.js";

export type OverlayMode = "none" | "moisture" | "soil_quality" | "ownership";

// Field outline palette follows the project color roles:
//   passive structure (fallow/plowed/planted/growing) reads quietly,
//   ready (yellow) and dead (red) read loudly — those need attention.
const FIELD_STATE_COLORS: Record<FieldState, number> = {
  fallow: 0x888888,
  plowed: 0xa0522d,
  planted: 0x6fa552, // sage green — not the active-action teal
  growing: 0x6fa552,
  ready: 0xffdd57,
  dead: 0xff4444,
};
const FIELD_STATE_ALPHA: Record<FieldState, number> = {
  fallow: 0.45,
  plowed: 0.45,
  planted: 0.45,
  growing: 0.45,
  ready: 0.95,
  dead: 0.95,
};

export class GridOverlay {
  readonly container: Container;
  private graphics: Graphics;
  private hoverGraphics: Graphics;
  private fieldOutlines: Graphics;
  private dragPreviewGraphics: Graphics;
  private overlayMode: OverlayMode = "none";
  private lastOverlayMode: OverlayMode = "none";
  private lastFieldKey = "";
  private _hoveredTileIndex = -1;
  private lastHoveredTileIndex = -2;
  private hoverPhase = 0;
  private overlayDirty = true;
  private worldWidth = 48;
  private worldHeight = 48;

  constructor() {
    this.container = new Container();
    this.graphics = new Graphics();
    this.hoverGraphics = new Graphics();
    this.fieldOutlines = new Graphics();
    this.dragPreviewGraphics = new Graphics();
    this.container.addChild(this.graphics);
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
    this.worldHeight = state.world.height;

    // Only redraw overlay when mode changes or explicitly marked dirty
    if (this.overlayDirty || this.overlayMode !== this.lastOverlayMode) {
      this.drawOverlay(state);
      this.lastOverlayMode = this.overlayMode;
      this.overlayDirty = false;
    }

    // Only redraw field outlines when fields change. Fallow fields no longer
    // need a tinted fill — the terrain layer paints them with a weedy texture.
    const fieldKey = state.fields.map((f) => `${f.id}:${f.state}:${f.tileIndices.length}`).join(",");
    if (fieldKey !== this.lastFieldKey) {
      this.drawFieldOutlines(state);
      this.lastFieldKey = fieldKey;
    }

    // The hover cursor breathes; tick() redraws it each frame when active.
    if (this._hoveredTileIndex !== this.lastHoveredTileIndex) {
      this.drawHover();
      this.lastHoveredTileIndex = this._hoveredTileIndex;
    }
  }

  /**
   * Advance the cursor pulse and redraw the brackets each frame while the
   * cursor is on a tile. Called from the renderer's RAF loop. When no tile
   * is hovered the hover Graphics is empty and this is essentially free.
   */
  tick(dt: number): void {
    if (this._hoveredTileIndex < 0) return;
    this.hoverPhase += dt * 0.0042; // ~1.5 s period
    this.drawHover();
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
          // Live fertility: the limiting (scarcest) nutrient. Red = depleted.
          const q = Math.min(tile.nutrients.n, tile.nutrients.p, tile.nutrients.k);
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

  private drawFieldOutlines(state: GameState) {
    const g = this.fieldOutlines;
    g.clear();

    for (const field of state.fields) {
      const color = FIELD_STATE_COLORS[field.state];
      const alpha = FIELD_STATE_ALPHA[field.state];
      const tileSet = new Set(field.tileIndices);

      for (const tileIdx of field.tileIndices) {
        const x = (tileIdx % state.world.width) * TILE_SIZE;
        const y = Math.floor(tileIdx / state.world.width) * TILE_SIZE;

        if (!tileSet.has(tileIdx - state.world.width)) {
          g.moveTo(x, y).lineTo(x + TILE_SIZE, y).stroke({ width: 1, color, alpha });
        }
        if (!tileSet.has(tileIdx + state.world.width)) {
          g.moveTo(x, y + TILE_SIZE).lineTo(x + TILE_SIZE, y + TILE_SIZE).stroke({ width: 1, color, alpha });
        }
        const tx = tileIdx % state.world.width;
        if (!tileSet.has(tileIdx - 1) || tx === 0) {
          g.moveTo(x, y).lineTo(x, y + TILE_SIZE).stroke({ width: 1, color, alpha });
        }
        if (!tileSet.has(tileIdx + 1) || tx === state.world.width - 1) {
          g.moveTo(x + TILE_SIZE, y).lineTo(x + TILE_SIZE, y + TILE_SIZE).stroke({ width: 1, color, alpha });
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

  /**
   * Targeting-reticle cursor: four 1px-thick L brackets at the corners of the
   * hovered tile, inset 1px and pulsing in alpha so it clearly reads as the
   * single live "thing I'm acting on" rather than another passive outline.
   */
  private drawHover() {
    const g = this.hoverGraphics;
    g.clear();
    if (this._hoveredTileIndex < 0 || this._hoveredTileIndex >= this.worldWidth * this.worldHeight) return;

    const x = (this._hoveredTileIndex % this.worldWidth) * TILE_SIZE;
    const y = Math.floor(this._hoveredTileIndex / this.worldWidth) * TILE_SIZE;
    const inset = 1;
    const arm = 4;
    const x0 = x + inset;
    const y0 = y + inset;
    const x1 = x + TILE_SIZE - inset;
    const y1 = y + TILE_SIZE - inset;
    const alpha = 0.55 + 0.35 * (0.5 + 0.5 * Math.sin(this.hoverPhase));
    const fill = { color: 0xffffff, alpha };

    // Top-left
    g.rect(x0, y0, arm, 1).fill(fill);
    g.rect(x0, y0, 1, arm).fill(fill);
    // Top-right
    g.rect(x1 - arm, y0, arm, 1).fill(fill);
    g.rect(x1 - 1, y0, 1, arm).fill(fill);
    // Bottom-left
    g.rect(x0, y1 - 1, arm, 1).fill(fill);
    g.rect(x0, y1 - arm, 1, arm).fill(fill);
    // Bottom-right
    g.rect(x1 - arm, y1 - 1, arm, 1).fill(fill);
    g.rect(x1 - 1, y1 - arm, 1, arm).fill(fill);
  }
}
