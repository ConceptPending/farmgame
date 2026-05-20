"use client";

import { useGameStore } from "../../stores/game-store";
import { useUIStore } from "../../stores/ui-store";
import { CROP_CATALOG, PRODUCT_CATALOG, ALL_PRODUCT_IDS, type CropId } from "@farmgame/engine";

export function MarketPanel() {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const showMarketPanel = useUIStore((s) => s.showMarketPanel);
  const setShowMarketPanel = useUIStore((s) => s.setShowMarketPanel);

  if (!state || !showMarketPanel) return null;

  const cropIds = Object.keys(CROP_CATALOG) as CropId[];

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "#16213e",
        border: "2px solid #0f3460",
        borderRadius: 8,
        padding: 16,
        zIndex: 100,
        minWidth: 500,
        maxHeight: "80vh",
        overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: "#4ecca3" }}>Market Prices</h3>
        <button
          onClick={() => setShowMarketPanel(false)}
          style={{
            background: "none",
            border: "1px solid #555",
            borderRadius: 4,
            color: "#aaa",
            cursor: "pointer",
            padding: "2px 8px",
          }}
        >
          X
        </button>
      </div>

      {/* Price table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #333" }}>
            <th style={{ textAlign: "left", color: "#888", padding: "4px 8px" }}>Crop</th>
            <th style={{ textAlign: "right", color: "#888", padding: "4px 8px" }}>Base</th>
            <th style={{ textAlign: "right", color: "#888", padding: "4px 8px" }}>Current</th>
            <th style={{ textAlign: "right", color: "#888", padding: "4px 8px" }}>Trend</th>
            <th style={{ textAlign: "right", color: "#888", padding: "4px 8px" }}>In Stock</th>
            <th style={{ textAlign: "center", color: "#888", padding: "4px 8px" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {cropIds.map((cropId) => {
            const def = CROP_CATALOG[cropId];
            const price = state.market.prices[cropId] ?? def.basePrice;
            const basePrice = def.basePrice;
            const pctChange = ((price - basePrice) / basePrice) * 100;
            const trend = pctChange > 5 ? "↑" : pctChange < -5 ? "↓" : "→";
            const trendColor = pctChange > 5 ? "#4ecca3" : pctChange < -5 ? "#ff6b6b" : "#888";
            const qty = state.inventory[cropId] ?? 0;

            return (
              <tr key={cropId} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "4px 8px", color: "#ccc" }}>{def.name}</td>
                <td style={{ padding: "4px 8px", color: "#888", textAlign: "right" }}>
                  ${basePrice}
                </td>
                <td style={{ padding: "4px 8px", color: "#eee", textAlign: "right", fontWeight: 600 }}>
                  ${price.toFixed(1)}
                </td>
                <td style={{ padding: "4px 8px", textAlign: "right", color: trendColor }}>
                  {trend} {pctChange > 0 ? "+" : ""}{pctChange.toFixed(0)}%
                </td>
                <td style={{ padding: "4px 8px", color: "#aaa", textAlign: "right" }}>
                  {qty > 0 ? qty : "-"}
                </td>
                <td style={{ padding: "4px 8px", textAlign: "center" }}>
                  {qty > 0 && (
                    <button
                      onClick={() => dispatch({ type: "SELL", cropId, quantity: qty })}
                      style={{
                        padding: "2px 8px",
                        fontSize: 11,
                        border: "1px solid #4ecca3",
                        borderRadius: 3,
                        background: "#1a4040",
                        color: "#4ecca3",
                        cursor: "pointer",
                      }}
                    >
                      Sell All (${Math.round(qty * price)})
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Animal products */}
      <div style={{ marginTop: 14, color: "#888", fontSize: 11, marginBottom: 4 }}>ANIMAL PRODUCTS</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <tbody>
          {ALL_PRODUCT_IDS.map((id) => {
            const def = PRODUCT_CATALOG[id];
            const price = state.market.prices[id] ?? def.basePrice;
            const qty = state.inventory[id] ?? 0;
            return (
              <tr key={id} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "4px 8px", color: "#ccc" }}>{def.name}</td>
                <td style={{ padding: "4px 8px", color: "#eee", textAlign: "right", fontWeight: 600 }}>
                  ${price.toFixed(1)}
                </td>
                <td style={{ padding: "4px 8px", color: "#aaa", textAlign: "right" }}>{qty > 0 ? qty : "-"}</td>
                <td style={{ padding: "4px 8px", textAlign: "center" }}>
                  {qty > 0 && (
                    <button
                      onClick={() => dispatch({ type: "SELL", cropId: id, quantity: qty })}
                      style={{
                        padding: "2px 8px",
                        fontSize: 11,
                        border: "1px solid #4ecca3",
                        borderRadius: 3,
                        background: "#1a4040",
                        color: "#4ecca3",
                        cursor: "pointer",
                      }}
                    >
                      Sell All (${Math.round(qty * price)})
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Simple price chart (last 50 ticks for wheat) */}
      {state.market.priceHistory.length > 1 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ color: "#888", fontSize: 11, marginBottom: 4 }}>Price History (Wheat)</div>
          <PriceChart
            history={state.market.priceHistory}
            cropId="wheat"
            basePrice={CROP_CATALOG.wheat.basePrice}
          />
        </div>
      )}
    </div>
  );
}

function PriceChart({
  history,
  cropId,
  basePrice,
}: {
  history: { tick: number; prices: Record<string, number> }[];
  cropId: string;
  basePrice: number;
}) {
  const last50 = history.slice(-50);
  const prices = last50.map((h) => h.prices[cropId] ?? basePrice);
  const min = Math.min(...prices) * 0.95;
  const max = Math.max(...prices) * 1.05;
  const range = max - min || 1;

  const width = 460;
  const height = 60;
  const points = prices
    .map((p, i) => {
      const x = (i / (prices.length - 1 || 1)) * width;
      const y = height - ((p - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} style={{ background: "#0a1628", borderRadius: 4 }}>
      {/* Base price line */}
      <line
        x1={0}
        y1={height - ((basePrice - min) / range) * height}
        x2={width}
        y2={height - ((basePrice - min) / range) * height}
        stroke="#555"
        strokeDasharray="4"
      />
      <polyline points={points} fill="none" stroke="#4ecca3" strokeWidth="1.5" />
    </svg>
  );
}
