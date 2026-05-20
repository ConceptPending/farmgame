"use client";

import { useGameStore } from "../../stores/game-store";
import { useUIStore } from "../../stores/ui-store";
import {
  ANIMAL_CATALOG,
  ALL_ANIMAL_TYPES,
  CROP_CATALOG,
  PRODUCT_CATALOG,
  animalValue,
  computeLivestockCapacity,
} from "@farmgame/engine";

export function LivestockPanel() {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const show = useUIStore((s) => s.showLivestockPanel);
  const setShow = useUIStore((s) => s.setShowLivestockPanel);

  if (!state || !show) return null;

  const capacity = computeLivestockCapacity(state);
  const used = state.animals.length;
  const feedNeeded = state.animals.reduce((s, a) => s + ANIMAL_CATALOG[a.type].feedPerSeason, 0);
  const grainStock = Object.entries(state.inventory).reduce(
    (s, [id, qty]) => s + (CROP_CATALOG[id as keyof typeof CROP_CATALOG]?.category === "grain" ? qty : 0),
    0,
  );
  const feedShort = feedNeeded > grainStock;

  const herd = [...state.animals].sort((a, b) => b.maturity - a.maturity);

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
        width: 420,
        maxHeight: "80vh",
        overflowY: "auto",
        fontSize: 13,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ margin: 0, color: "#4ecca3" }}>
          Livestock <span style={{ color: "#888", fontWeight: 400, fontSize: 12 }}>· {used} / {capacity} housed</span>
        </h3>
        <button
          onClick={() => setShow(false)}
          style={{ background: "none", border: "1px solid #555", borderRadius: 4, color: "#aaa", cursor: "pointer", padding: "2px 8px" }}
        >
          X
        </button>
      </div>

      {capacity === 0 && (
        <div style={{ color: "#ffdd57", fontSize: 12, marginBottom: 10 }}>
          Build a barn (under the Build tool) to house livestock.
        </div>
      )}

      {/* Feed status */}
      <div style={{ fontSize: 12, color: feedShort ? "#ff6b6b" : "#aaa", marginBottom: 12 }}>
        Feed per season: {feedNeeded} grain · In stock: {grainStock} grain
        {feedShort && used > 0 && " — shortfall! animals will lose health"}
      </div>

      {/* Buy buttons */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {ALL_ANIMAL_TYPES.map((type) => {
          const def = ANIMAL_CATALOG[type];
          const disabled = used >= capacity || state.money < def.cost;
          const productNote = def.product
            ? ` · yields ${def.yieldPerSeason} ${PRODUCT_CATALOG[def.product].name.toLowerCase()}/season`
            : "";
          return (
            <button
              key={type}
              disabled={disabled}
              onClick={() => dispatch({ type: "BUY_ANIMAL", animalType: type })}
              title={`Sells for up to $${def.matureValue} grown · eats ${def.feedPerSeason} grain/season${productNote}`}
              style={{
                padding: "4px 8px",
                fontSize: 11,
                border: "1px solid #4ecca3",
                borderRadius: 3,
                background: disabled ? "#222" : "#1a4040",
                color: disabled ? "#666" : "#4ecca3",
                cursor: disabled ? "default" : "pointer",
              }}
            >
              Buy {def.name} ${def.cost}
            </button>
          );
        })}
      </div>

      {/* Herd */}
      {herd.length === 0 ? (
        <div style={{ color: "#888", fontSize: 12 }}>No animals yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {herd.map((a) => {
            const def = ANIMAL_CATALOG[a.type];
            const value = animalValue(a);
            return (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid #222",
                  padding: "3px 0",
                }}
              >
                <span style={{ color: "#ccc" }}>
                  {def.name} #{a.id}
                  <span style={{ color: "#888" }}>
                    {" "}· {Math.round(a.maturity * 100)}% grown · health {Math.round(a.health * 100)}%
                  </span>
                </span>
                <button
                  onClick={() => dispatch({ type: "SELL_ANIMAL", animalId: a.id })}
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
                  Sell ${value}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
