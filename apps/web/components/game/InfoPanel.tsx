"use client";

import { useGameStore } from "../../stores/game-store";
import { useUIStore } from "../../stores/ui-store";
import { tileCoords, getCropDef, CROP_CATALOG, type CropId } from "@farmgame/engine";

export function InfoPanel() {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const selectedTileIndex = useUIStore((s) => s.selectedTileIndex);
  const selectedFieldId = useUIStore((s) => s.selectedFieldId);

  if (!state) return null;

  const tile = selectedTileIndex >= 0 && selectedTileIndex < state.world.tiles.length
    ? state.world.tiles[selectedTileIndex]
    : null;
  const coords = tile ? tileCoords(selectedTileIndex, state.world.width) : null;

  const selectedField = selectedFieldId !== null
    ? state.fields.find((f) => f.id === selectedFieldId)
    : null;

  const plotSize = state.world.plotSize;

  // If hovering an unowned plot, show purchase info
  let unownedPlotInfo: { plotX: number; plotY: number } | null = null;
  if (coords && tile && !tile.owned) {
    unownedPlotInfo = {
      plotX: Math.floor(coords.x / plotSize),
      plotY: Math.floor(coords.y / plotSize),
    };
  }

  return (
    <div
      style={{
        width: 220,
        background: "#16213e",
        borderLeft: "2px solid #0f3460",
        padding: "8px 10px",
        overflowY: "auto",
        fontSize: 12,
        flexShrink: 0,
      }}
    >
      {/* Tile info */}
      {tile && coords && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: "#4ecca3", fontWeight: 600, marginBottom: 4 }}>
            Tile ({coords.x}, {coords.y})
          </div>
          <div style={{ color: "#aaa" }}>
            Terrain: {tile.terrain}
            <br />
            Soil: {(tile.soilQuality * 100).toFixed(0)}%
            <br />
            Moisture: {(tile.moisture * 100).toFixed(0)}%
            <br />
            Owned: {tile.owned ? "Yes" : "No"}
            {tile.fieldId !== null && <><br />Field: #{tile.fieldId}</>}
          </div>
        </div>
      )}

      {/* Unowned plot purchase */}
      {unownedPlotInfo && (
        <div style={{ marginBottom: 12, padding: 6, background: "#1a3050", borderRadius: 4 }}>
          <div style={{ color: "#ffdd57", fontWeight: 600, marginBottom: 4 }}>
            Available Plot ({unownedPlotInfo.plotX}, {unownedPlotInfo.plotY})
          </div>
          <div style={{ color: "#aaa", fontSize: 11 }}>
            Use "Buy Land" tool to purchase
          </div>
        </div>
      )}

      {/* Selected field info */}
      {selectedField && (
        <div style={{ marginBottom: 12, padding: 6, background: "#1a3050", borderRadius: 4 }}>
          <div style={{ color: "#4ecca3", fontWeight: 600, marginBottom: 4 }}>
            Field #{selectedField.id}
          </div>
          <div style={{ color: "#aaa" }}>
            State: {selectedField.state}
            <br />
            Tiles: {selectedField.tileIndices.length}
            <br />
            {selectedField.cropId && (
              <>
                Crop: {getCropDef(selectedField.cropId)?.name ?? selectedField.cropId}
                <br />
                Growth: {(selectedField.growth * 100).toFixed(0)}%
                <br />
              </>
            )}
            Health: {(selectedField.health * 100).toFixed(0)}%
            <br />
            Moisture: {(selectedField.moisture * 100).toFixed(0)}%
            <br />
            Weeds: {(selectedField.weeds * 100).toFixed(0)}%
            <br />
            Pests: {(selectedField.pests * 100).toFixed(0)}%
          </div>
          {selectedField.cropId && selectedField.state === "ready" && (
            <div style={{ marginTop: 4 }}>
              <div style={{ color: "#7ddf64", fontSize: 11 }}>
                Est. yield: ~{getCropDef(selectedField.cropId)!.baseYield * selectedField.tileIndices.length} units
              </div>
              <div style={{ color: "#ffdd57", fontSize: 11 }}>
                Market price: ${state.market.prices[selectedField.cropId]?.toFixed(1) ?? "?"}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inventory */}
      {Object.keys(state.inventory).length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: "#4ecca3", fontWeight: 600, marginBottom: 4 }}>
            Inventory ({Object.values(state.inventory).reduce((a, b) => a + b, 0)}/{state.inventoryCapacity})
          </div>
          {Object.entries(state.inventory).map(([cropId, qty]) => {
            const def = CROP_CATALOG[cropId as CropId];
            if (!def) return null;
            const price = state.market.prices[cropId] ?? def.basePrice;
            return (
              <div key={cropId} style={{ display: "flex", justifyContent: "space-between", color: "#aaa", marginBottom: 2 }}>
                <span>{def.name}: {qty}</span>
                <button
                  onClick={() => dispatch({ type: "SELL", cropId: cropId as CropId, quantity: qty })}
                  style={{
                    padding: "1px 6px",
                    fontSize: 10,
                    border: "1px solid #555",
                    borderRadius: 3,
                    background: "#222",
                    color: "#4ecca3",
                    cursor: "pointer",
                  }}
                >
                  Sell ${Math.round(qty * price)}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
