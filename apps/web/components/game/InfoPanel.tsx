"use client";

import { useGameStore } from "../../stores/game-store";
import { useUIStore } from "../../stores/ui-store";
import { tileCoords, getCropDef, plotOwner, CROP_CATALOG, type CropId } from "@farmgame/engine";
import { NOTIFICATION_COLOR, NOTIFICATION_GLYPH } from "./notifications";

const RISKY_WEATHER: Record<string, { glyph: string; color: string; label: string }> = {
  storm: { glyph: "⛈", color: "#ff6b6b", label: "Storm" },
  frost: { glyph: "❄", color: "#9fc3e8", label: "Frost" },
  drought: { glyph: "🔥", color: "#ffa454", label: "Drought" },
  rain: { glyph: "🌧", color: "#9db4d0", label: "Rain" },
};

export function InfoPanel() {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const notifications = useGameStore((s) => s.notifications);
  const selectedTileIndex = useUIStore((s) => s.selectedTileIndex);
  const selectedFieldId = useUIStore((s) => s.selectedFieldId);
  const openPanel = useUIStore((s) => s.openPanel);

  if (!state) return null;

  // First risky weather in the next 5 days — surfaced as a one-line warning.
  let upcomingRisk: { glyph: string; color: string; label: string; inDays: number } | null = null;
  for (let i = 0; i < state.weather.forecast.length; i++) {
    const cond = state.weather.forecast[i].condition;
    const r = RISKY_WEATHER[cond];
    if (r && (cond !== "rain" || i < 2)) {
      // Rain is mild — only surface it if it's right around the corner.
      upcomingRisk = { ...r, inDays: i + 1 };
      break;
    }
  }
  const recent = notifications.slice(-3).reverse();

  const tile = selectedTileIndex >= 0 && selectedTileIndex < state.world.tiles.length
    ? state.world.tiles[selectedTileIndex]
    : null;
  const coords = tile ? tileCoords(selectedTileIndex, state.world.width) : null;

  const selectedField = selectedFieldId !== null
    ? state.fields.find((f) => f.id === selectedFieldId)
    : null;

  const plotSize = state.world.plotSize;

  // Rival ownership of the selected tile's plot, if any.
  let rivalOwnerName: string | null = null;
  if (coords) {
    const ppr = state.world.width / plotSize;
    const plotIdx = Math.floor(coords.y / plotSize) * ppr + Math.floor(coords.x / plotSize);
    const owner = plotOwner(state, plotIdx);
    if (typeof owner === "number") {
      rivalOwnerName = state.rivals.find((r) => r.id === owner)?.name ?? "a rival";
    }
  }

  // If hovering an unowned (and un-rivaled) plot, show purchase info
  let unownedPlotInfo: { plotX: number; plotY: number } | null = null;
  if (coords && tile && !tile.owned && !rivalOwnerName) {
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
      {/* Forecast risk line — always visible, sets the mood for the panel. */}
      <div style={{ marginBottom: 10, fontSize: 11 }}>
        {upcomingRisk ? (
          <span style={{ color: upcomingRisk.color }}>
            {upcomingRisk.glyph} {upcomingRisk.label} in {upcomingRisk.inDays} day{upcomingRisk.inDays > 1 ? "s" : ""}
          </span>
        ) : (
          <span style={{ color: "#7a8a9a" }}>☀ Forecast clear</span>
        )}
      </div>

      {/* Empty-state hint so the panel has presence even with nothing selected. */}
      {!tile && !selectedField && Object.keys(state.inventory).length === 0 && (
        <div style={{ color: "#7a8a9a", fontSize: 11, marginBottom: 12 }}>
          Click any tile to inspect it.
        </div>
      )}

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
            Owned: {tile.owned ? "Yes" : rivalOwnerName ? `${rivalOwnerName}` : "No"}
            {tile.fieldId !== null && <><br />Field: #{tile.fieldId}</>}
          </div>
          {tile.terrain !== "water" && tile.terrain !== "rock" && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 10, color: "#7a8a9a", marginBottom: 2 }}>SOIL N-P-K</div>
              <NutrientBars nutrients={tile.nutrients} />
            </div>
          )}
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
            {selectedField.cropId && (() => {
              const cropDef = getCropDef(selectedField.cropId);
              return (
                <>
                  Crop: {cropDef?.name ?? selectedField.cropId}
                  {cropDef && (
                    <>
                      <br />
                      <span style={{ color: "#7a8a9a", fontStyle: "italic", fontSize: 11 }}>
                        {cropDef.archetypeTagline}
                      </span>
                    </>
                  )}
                  <br />
                  Growth: {(selectedField.growth * 100).toFixed(0)}%
                  <br />
                </>
              );
            })()}
            Health: {(selectedField.health * 100).toFixed(0)}%
            <br />
            Moisture: {(selectedField.moisture * 100).toFixed(0)}%
            <br />
            Weeds: {(selectedField.weeds * 100).toFixed(0)}%
            <br />
            Pests: {(selectedField.pests * 100).toFixed(0)}%
          </div>
          {selectedField.cropId && (() => {
            const def = getCropDef(selectedField.cropId)!;
            const factor = selectedField.growth * selectedField.health;
            const yieldNow = Math.max(0, Math.round(def.baseYield * selectedField.tileIndices.length * factor));
            const price = state.market.prices[selectedField.cropId] ?? def.basePrice;
            const valueNow = Math.round(yieldNow * price);
            return (
              <div style={{ marginTop: 4 }}>
                <div style={{ color: "#7ddf64", fontSize: 11 }}>
                  Projected yield: ~{yieldNow} units{selectedField.state !== "ready" && " (at current growth)"}
                </div>
                <div style={{ color: "#ffdd57", fontSize: 11 }}>
                  If sold now: ${valueNow} <span style={{ color: "#7a8a9a" }}>(market ${price.toFixed(1)})</span>
                </div>
              </div>
            );
          })()}
          {(() => {
            const cost = 2 * selectedField.tileIndices.length;
            const disabled = state.manure < cost;
            return (
              <button
                onClick={() => dispatch({ type: "SPREAD_MANURE", fieldId: selectedField.id })}
                disabled={disabled}
                title={`Spend ${cost} manure to restore this field's N-P-K (have ${state.manure})`}
                style={{
                  marginTop: 6,
                  padding: "3px 8px",
                  fontSize: 11,
                  border: "1px solid #9db4d0",
                  borderRadius: 3,
                  background: disabled ? "#222" : "#1a3050",
                  color: disabled ? "#667" : "#9db4d0",
                  cursor: disabled ? "default" : "pointer",
                }}
              >
                Spread Manure ({state.manure})
              </button>
            );
          })()}
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

      {/* Recent events — always present so the panel has live content. */}
      {recent.length > 0 && (
        <div style={{ marginTop: 4, borderTop: "1px solid #243353", paddingTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <span style={{ color: "#7a8a9a", fontSize: 10, letterSpacing: 0.5 }}>RECENT</span>
            <button
              onClick={() => openPanel("log")}
              style={{
                background: "none",
                border: "none",
                color: "#4ecca3",
                fontSize: 10,
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline",
              }}
            >
              view all →
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {recent.map((n) => (
              <div
                key={n.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 4,
                  fontSize: 11,
                  lineHeight: 1.3,
                  borderLeft: `2px solid ${NOTIFICATION_COLOR[n.type]}`,
                  paddingLeft: 5,
                  color: "#cdd5e0",
                }}
                title={n.message}
              >
                <span aria-hidden style={{ color: NOTIFICATION_COLOR[n.type], fontWeight: 700 }}>
                  {NOTIFICATION_GLYPH[n.type]}
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {n.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NutrientBars({ nutrients }: { nutrients: { n: number; p: number; k: number } }) {
  const rows: [string, number, string][] = [
    ["N", nutrients.n, "#4ecca3"],
    ["P", nutrients.p, "#ffb74d"],
    ["K", nutrients.k, "#9575cd"],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {rows.map(([label, v, color]) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 12, fontSize: 10, color: "#aaa" }}>{label}</span>
          <div style={{ flex: 1, height: 6, background: "#0a1628", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${Math.round(v * 100)}%`, height: "100%", background: color }} />
          </div>
          <span style={{ width: 28, fontSize: 9, color: "#7a8a9a", textAlign: "right" }}>{Math.round(v * 100)}%</span>
        </div>
      ))}
    </div>
  );
}
