import { Application, Container, Graphics } from "pixi.js";
import type { GameState, Season } from "@farmgame/engine";
import { TerrainLayer } from "./layers/terrain.js";
import { CropLayer } from "./layers/crop.js";
import { BuildingLayer } from "./layers/building.js";
import { AnimalLayer } from "./layers/animal.js";
import { PenDecorLayer } from "./layers/pen-decor.js";
import { SeasonOverlay } from "./layers/season-overlay.js";
import { FXLayer, type FXEvent } from "./layers/fx.js";
import { GridOverlay, type OverlayMode } from "./layers/grid-overlay.js";
import { WeatherEffects } from "./layers/weather-effects.js";
import { Camera } from "./camera.js";
import { InputHandler, type InputEvent } from "./input.js";
import { generateTileset, TILE_SIZE } from "./sprites/tileset.js";

export interface RendererOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export class GameRenderer {
  private app: Application;
  private world: Container;
  private terrainLayer: TerrainLayer;
  private cropLayer: CropLayer;
  private buildingLayer: BuildingLayer;
  private animalLayer: AnimalLayer;
  private penDecorLayer: PenDecorLayer;
  private fxLayer: FXLayer;
  private seasonOverlay: SeasonOverlay;
  private fxSource: (() => FXEvent[]) | null = null;
  private gridOverlay: GridOverlay;
  private weatherEffects: WeatherEffects;
  private camera: Camera;
  private inputHandler: InputHandler;
  private ambient: Graphics;
  private lastSeason: Season | null = null;
  private initialized = false;
  private onInput: ((event: InputEvent) => void) | null = null;
  private animationTickerId: number | null = null;
  private lastState: GameState | null = null;
  private dragStartTileIndex: number | null = null;

  static readonly CELL_SIZE = TILE_SIZE;

  constructor() {
    this.app = new Application();
    this.world = new Container();
    this.terrainLayer = new TerrainLayer();
    this.cropLayer = new CropLayer();
    this.buildingLayer = new BuildingLayer();
    this.animalLayer = new AnimalLayer();
    this.penDecorLayer = new PenDecorLayer();
    this.fxLayer = new FXLayer();
    this.seasonOverlay = new SeasonOverlay();
    this.gridOverlay = new GridOverlay();
    this.weatherEffects = new WeatherEffects();
    this.camera = new Camera();
    this.inputHandler = new InputHandler();
    this.ambient = new Graphics();
  }

  async init(options: RendererOptions): Promise<void> {
    await this.app.init({
      canvas: options.canvas,
      width: options.width,
      height: options.height,
      backgroundColor: 0x87ceeb,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    await generateTileset(this.app);

    this.app.stage.addChild(this.world);
    this.world.addChild(this.terrainLayer.container);
    // Season overlay sits just above the terrain so its dusting/flowers/etc.
    // appear on the ground but below any crops, buildings, or animals.
    this.world.addChild(this.seasonOverlay.container);
    this.world.addChild(this.cropLayer.container);
    this.world.addChild(this.buildingLayer.container);
    // Pen decoration (hay/mud/grain/footprints) sits above buildings but
    // below animals, so animals walk over their pen.
    this.world.addChild(this.penDecorLayer.container);
    this.world.addChild(this.animalLayer.container);
    // FX particles draw above animals so an action burst always reads on top.
    this.world.addChild(this.fxLayer.container);
    this.world.addChild(this.gridOverlay.container);
    this.world.addChild(this.weatherEffects.container);

    // Seasonal color grade sits in screen space (on the stage, not the world)
    // so it tints the whole viewport without panning/zooming. Never eats input.
    this.app.stage.addChild(this.ambient);
    this.ambient.eventMode = "none";

    this.camera.attach(this.world, options.canvas);
    this.inputHandler.attach(options.canvas, (event: InputEvent) => {
      if (event.type === "tile_hover") {
        // Update hover directly on the overlay — no React/zustand involved
        this.gridOverlay.hoveredTileIndex = event.tileIndex;
        // Redraw just the hover graphic if we have state
        if (this.lastState) {
          this.gridOverlay.update(this.lastState);
        }
      }
      if (event.type === "tile_drag_move") {
        const dragStart = this.dragStartTileIndex;
        if (dragStart !== null) {
          this.gridOverlay.setDragPreview(dragStart, event.tileIndex);
        }
      }
      if (event.type === "tile_drag_start") {
        this.dragStartTileIndex = event.tileIndex;
      }
      if (event.type === "tile_drag_end" || event.type === "tile_click") {
        this.gridOverlay.clearDragPreview();
        this.dragStartTileIndex = null;
      }
      if (this.onInput) {
        this.onInput(event);
      }
    });

    // Per-frame animation: weather particles + livestock idle/walk + cursor pulse.
    let lastTs = performance.now();
    const animate = () => {
      const now = performance.now();
      const dt = now - lastTs;
      lastTs = now;
      this.weatherEffects.tick();
      this.animalLayer.tick(dt);
      this.gridOverlay.tick(dt);
      if (this.fxSource && this.lastState) {
        const events = this.fxSource();
        if (events.length > 0) this.fxLayer.drain(events, this.lastState.world.width);
      }
      this.fxLayer.tick(dt);
      this.animationTickerId = requestAnimationFrame(animate);
    };
    this.animationTickerId = requestAnimationFrame(animate);

    this.initialized = true;
  }

  setInputHandler(handler: (event: InputEvent) => void): void {
    this.onInput = handler;
  }

  /** Provide a function the renderer calls each frame to pull queued FX events. */
  setFXSource(source: () => FXEvent[]): void {
    this.fxSource = source;
  }

  setOverlayMode(mode: OverlayMode): void {
    this.gridOverlay.setOverlayMode(mode);
    if (this.lastState) {
      this.gridOverlay.markOverlayDirty();
      this.gridOverlay.update(this.lastState);
    }
  }

  setDragEnabled(enabled: boolean): void {
    this.inputHandler.setDragEnabled(enabled);
  }

  /** Called when game state changes (every tick, ~1-3 seconds). */
  update(state: GameState): void {
    if (!this.initialized) return;
    this.lastState = state;

    this.terrainLayer.update(state);
    this.cropLayer.update(state);
    this.buildingLayer.update(state);
    this.penDecorLayer.update(state);
    this.animalLayer.update(state);
    this.gridOverlay.update(state);
    this.weatherEffects.updateState(state);

    this.inputHandler.updateGrid(state.world.width, state.world.height, this.world);
    this.camera.setWorldSize(state.world.width, state.world.height);

    if (state.season !== this.lastSeason) {
      this.lastSeason = state.season;
      this.drawAmbient(state.season);
      this.seasonOverlay.setSeason(state.season, state.world.width, state.world.height);
    }
  }

  /** Repaint the screen-space seasonal tint (a low-alpha full-viewport wash). */
  private drawAmbient(season: Season): void {
    // [color, alpha] per season — subtle so it grades mood without muddying art.
    const grade: Record<Season, [number, number]> = {
      spring: [0x8fd16f, 0.05],
      summer: [0xffd24a, 0.07],
      fall: [0xe07a2e, 0.1],
      winter: [0x9fc3e8, 0.13],
    };
    const [color, alpha] = grade[season];
    this.ambient.clear();
    this.ambient.rect(0, 0, this.app.screen.width, this.app.screen.height).fill({ color, alpha });
  }

  destroy(): void {
    if (this.animationTickerId !== null) {
      cancelAnimationFrame(this.animationTickerId);
    }
    this.camera.detach();
    this.inputHandler.detach();
    this.app.destroy(true);
    this.initialized = false;
  }
}
