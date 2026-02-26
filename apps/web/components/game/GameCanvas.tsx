"use client";

import { useEffect, useRef } from "react";
import { useGameStore } from "../../stores/game-store";
import { useUIStore } from "../../stores/ui-store";
import type { GameRenderer as GameRendererType, InputEvent } from "@farmgame/renderer";
import { tileIndex } from "@farmgame/engine";

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GameRendererType | null>(null);
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: GameRendererType | null = null;

    async function setup() {
      const { GameRenderer } = await import("@farmgame/renderer");
      renderer = new GameRenderer();
      await renderer.init({
        canvas: canvas!,
        width: canvas!.clientWidth,
        height: canvas!.clientHeight,
      });

      renderer.setInputHandler((event: InputEvent) => {
        const currentState = useGameStore.getState().state;
        if (!currentState) return;

        if (event.type === "tile_hover") {
          // Hover is handled directly by the renderer (no React re-render).
          // Only update zustand on click for the info panel.
          return;
        }

        if (event.type === "tile_drag_start") {
          useUIStore.getState().setDragStartTile(event.tileIndex);
          return;
        }

        if (event.type === "tile_drag_end") {
          const dragStart = useUIStore.getState().dragStartTile;
          const selectedTool = useUIStore.getState().selectedTool;
          if (dragStart !== null && selectedTool === "designate_field") {
            // Calculate rectangle of tiles from drag
            const startCoords = {
              x: dragStart % currentState.world.width,
              y: Math.floor(dragStart / currentState.world.width),
            };
            const endCoords = { x: event.tileX, y: event.tileY };
            const minX = Math.min(startCoords.x, endCoords.x);
            const maxX = Math.max(startCoords.x, endCoords.x);
            const minY = Math.min(startCoords.y, endCoords.y);
            const maxY = Math.max(startCoords.y, endCoords.y);

            const indices: number[] = [];
            for (let y = minY; y <= maxY; y++) {
              for (let x = minX; x <= maxX; x++) {
                indices.push(tileIndex(x, y, currentState.world.width));
              }
            }
            if (indices.length > 0) {
              dispatch({ type: "DESIGNATE_FIELD", tileIndices: indices });
            }
          }
          useUIStore.getState().setDragStartTile(null);
          return;
        }

        if (event.type === "right_click") {
          // Right-click to inspect: select tile + field
          useUIStore.getState().setSelectedTileIndex(event.tileIndex);
          const tile = currentState.world.tiles[event.tileIndex];
          if (tile?.fieldId !== null) {
            useUIStore.getState().setSelectedFieldId(tile.fieldId);
          } else {
            useUIStore.getState().setSelectedFieldId(null);
          }
          return;
        }

        if (event.type !== "tile_click") return;

        // Always track clicked tile for info panel
        useUIStore.getState().setSelectedTileIndex(event.tileIndex);

        const selectedTool = useUIStore.getState().selectedTool;
        const tile = currentState.world.tiles[event.tileIndex];
        if (!tile) return;

        switch (selectedTool) {
          case "pointer": {
            // Select field if clicking on one
            if (tile.fieldId !== null) {
              useUIStore.getState().setSelectedFieldId(tile.fieldId);
            } else {
              useUIStore.getState().setSelectedFieldId(null);
            }
            break;
          }
          case "buy_land": {
            const plotSize = currentState.world.plotSize;
            const plotX = Math.floor(event.tileX / plotSize);
            const plotY = Math.floor(event.tileY / plotSize);
            dispatch({ type: "BUY_PLOT", plotX, plotY });
            break;
          }
          case "designate_field": {
            // Single click designates a small 2x2 field
            const w = currentState.world.width;
            const indices: number[] = [];
            for (let dy = 0; dy < 2; dy++) {
              for (let dx = 0; dx < 2; dx++) {
                const nx = event.tileX + dx;
                const ny = event.tileY + dy;
                if (nx < w && ny < currentState.world.height) {
                  indices.push(tileIndex(nx, ny, w));
                }
              }
            }
            dispatch({ type: "DESIGNATE_FIELD", tileIndices: indices });
            break;
          }
          case "plow": {
            if (tile.fieldId !== null) {
              dispatch({ type: "PLOW_FIELD", fieldId: tile.fieldId });
            } else {
              useGameStore.getState().addNotification({ type: "warning", message: "No field here. Designate a field first, then plow it." });
            }
            break;
          }
          case "plant": {
            if (tile.fieldId !== null) {
              const cropId = useUIStore.getState().selectedCrop;
              dispatch({ type: "PLANT_FIELD", fieldId: tile.fieldId, cropId });
            } else {
              useGameStore.getState().addNotification({ type: "warning", message: "No field here. Designate a field first, plow it, then plant." });
            }
            break;
          }
          case "harvest": {
            if (tile.fieldId !== null) {
              dispatch({ type: "HARVEST_FIELD", fieldId: tile.fieldId });
            } else {
              useGameStore.getState().addNotification({ type: "warning", message: "No field here to harvest." });
            }
            break;
          }
          case "build": {
            const buildingType = useUIStore.getState().selectedBuildingType;
            dispatch({ type: "BUILD", buildingType, tileIndex: event.tileIndex });
            break;
          }
          case "spray": {
            if (tile.fieldId !== null) {
              const sprayType = useUIStore.getState().selectedSprayType;
              dispatch({ type: "SPRAY", fieldId: tile.fieldId, sprayType });
            } else {
              useGameStore.getState().addNotification({ type: "warning", message: "No field here to spray." });
            }
            break;
          }
          case "bulldoze": {
            // Remove field or demolish building
            if (tile.fieldId !== null) {
              dispatch({ type: "REMOVE_FIELD", fieldId: tile.fieldId });
            } else if (tile.buildingId !== null) {
              dispatch({ type: "DEMOLISH", buildingId: tile.buildingId });
            }
            break;
          }
        }
      });

      rendererRef.current = renderer;
    }

    setup();

    return () => {
      if (renderer) {
        renderer.destroy();
        rendererRef.current = null;
      }
    };
  }, [dispatch]);

  // Update renderer when state changes
  useEffect(() => {
    if (rendererRef.current && state) {
      rendererRef.current.update(state);
    }
  }, [state]);

  // Update overlay mode
  const selectedOverlay = useUIStore((s) => s.selectedOverlay);
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setOverlayMode(selectedOverlay);
    }
  }, [selectedOverlay]);

  // Enable drag when designate_field tool is selected
  const selectedTool = useUIStore((s) => s.selectedTool);
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setDragEnabled(selectedTool === "designate_field");
    }
  }, [selectedTool]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        cursor: "pointer",
      }}
    />
  );
}
