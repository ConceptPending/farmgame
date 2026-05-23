"use client";

import { useGameStore } from "../../stores/game-store";
import { useUIStore } from "../../stores/ui-store";
import { PanelModal } from "./PanelModal";
import {
  ANIMAL_CATALOG,
  ALL_ANIMAL_TYPES,
  CROP_CATALOG,
  PRODUCT_CATALOG,
  BUILDING_CATALOG,
  animalValue,
  pennedTiles,
  pastureGrazingOffset,
  animalAmenities,
  FEED_TROUGH_FACTOR,
} from "@farmgame/engine";

export function LivestockPanel() {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const open = useUIStore((s) => s.activePanel === "livestock");
  const setSelectedTool = useUIStore((s) => s.setSelectedTool);
  const setSelectedAnimalType = useUIStore((s) => s.setSelectedAnimalType);
  const closePanel = useUIStore((s) => s.closePanel);

  if (!state || !open) return null;

  const total = state.animals.length;
  const penned = pennedTiles(state);
  const pennedCount = state.animals.filter((a) => penned.has(a.tileIndex)).length;
  const looseCount = total - pennedCount;

  const fences = state.buildings.filter((b) => b.type === "fence");
  const penIntegrity = fences.length
    ? fences.reduce((sum, f) => sum + f.condition, 0) / fences.length
    : null;
  const repairCost = fences.reduce(
    (sum, f) => (f.condition < 1 ? sum + Math.max(1, Math.round(BUILDING_CATALOG.fence.cost * (1 - f.condition))) : sum),
    0,
  );

  const baseFeed = state.animals.reduce((s, a) => s + ANIMAL_CATALOG[a.type].feedPerSeason, 0);
  const pasture = pastureGrazingOffset(state);
  const amenities = animalAmenities(state);
  const feedNeeded = state.animals.reduce((s, a) => {
    const base = ANIMAL_CATALOG[a.type].feedPerSeason;
    const afterTrough = amenities.get(a.id)?.feed ? base * FEED_TROUGH_FACTOR : base;
    return s + Math.max(0, afterTrough - (pasture.get(a.id) ?? 0));
  }, 0);
  const feedSavings = Math.max(0, baseFeed - feedNeeded);
  const feedStock = Object.entries(state.inventory).reduce((s, [id, qty]) => {
    const cat = CROP_CATALOG[id as keyof typeof CROP_CATALOG]?.category;
    return s + (cat === "grain" || cat === "forage" ? qty : 0);
  }, 0);
  const feedShort = feedNeeded > feedStock;
  const waterTroughs = state.buildings.filter((b) => b.type === "water_trough").length;
  const feedTroughs = state.buildings.filter((b) => b.type === "feed_trough").length;

  const startPlacing = (type: (typeof ALL_ANIMAL_TYPES)[number]) => {
    setSelectedAnimalType(type);
    setSelectedTool("place_animal");
    closePanel();
  };

  const herd = [...state.animals].sort((a, b) => b.maturity - a.maturity);

  return (
    <PanelModal title="Livestock" onClose={closePanel} width={420} accent="#e0a96d">
      {/* Herd headcount: penned vs loose */}
      <div style={{ color: "#888", fontSize: 12, marginBottom: 6 }}>
        {total} animal{total === 1 ? "" : "s"} ·{" "}
        <span style={{ color: "#4ecca3" }}>{pennedCount} penned</span>
        {looseCount > 0 && <span style={{ color: "#ff6b6b" }}> · {looseCount} loose</span>}
      </div>

      {/* Pen integrity + repair */}
      {penIntegrity !== null && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: penIntegrity < 0.5 ? "#ff6b6b" : "#9db4d0" }}>
            Pen fences: {Math.round(penIntegrity * 100)}% sound
          </span>
          {repairCost > 0 && (
            <button
              onClick={() => dispatch({ type: "REPAIR_FENCES" })}
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
              Repair pens ${repairCost}
            </button>
          )}
        </div>
      )}

      {looseCount > 0 && (
        <div style={{ color: "#ffdd57", fontSize: 12, marginBottom: 10 }}>
          Loose animals will wander off. Fence them into a pen (Build → Fence) and keep it repaired.
        </div>
      )}

      {/* Feed + manure status */}
      <div style={{ fontSize: 12, color: feedShort ? "#ff6b6b" : "#aaa", marginBottom: 4 }}>
        Feed per season: {Math.round(feedNeeded)} (grain or hay) · In stock: {feedStock}
        {feedSavings > 0 && (
          <span style={{ color: "#4ecca3" }}> · saving {Math.round(feedSavings)} (pasture/trough)</span>
        )}
        {feedShort && total > 0 && " — shortfall! animals will lose health"}
      </div>
      {(waterTroughs > 0 || feedTroughs > 0) && (
        <div style={{ fontSize: 12, color: "#9db4d0", marginBottom: 4 }}>
          Amenities: {waterTroughs > 0 && `${waterTroughs} water trough${waterTroughs > 1 ? "s" : ""}`}
          {waterTroughs > 0 && feedTroughs > 0 && " · "}
          {feedTroughs > 0 && `${feedTroughs} feed trough${feedTroughs > 1 ? "s" : ""}`}
        </div>
      )}
      <div style={{ fontSize: 12, color: "#9db4d0", marginBottom: 12 }}>
        Manure: {state.manure} · producing ≈ {state.animals.reduce((m, a) => m + ANIMAL_CATALOG[a.type].manurePerSeason, 0)}/season (spread on fields to restore soil)
      </div>

      {/* Buy → place. Picks the spot for you, or use the Animals tool to aim. */}
      <div style={{ fontSize: 9, color: "#888", marginBottom: 4 }}>BUY &amp; PLACE</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
        {ALL_ANIMAL_TYPES.map((type) => {
          const def = ANIMAL_CATALOG[type];
          const disabled = state.money < def.cost;
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
      <div style={{ fontSize: 10, color: "#7a8a9a", marginBottom: 14 }}>
        Auto-placed in a pen if you have one.{" "}
        <button
          onClick={() => startPlacing(state.animals[0]?.type ?? "chicken")}
          style={{ background: "none", border: "none", color: "#4ecca3", cursor: "pointer", padding: 0, fontSize: 10, textDecoration: "underline" }}
        >
          Place by hand
        </button>{" "}
        with the Animals tool.
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
    </PanelModal>
  );
}
