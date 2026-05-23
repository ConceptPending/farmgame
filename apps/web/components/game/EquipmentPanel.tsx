"use client";

import { useGameStore } from "../../stores/game-store";
import { useUIStore } from "../../stores/ui-store";
import { PanelModal } from "./PanelModal";
import {
  EQUIPMENT_CATALOG,
  ALL_EQUIPMENT_TYPES,
  EQUIPMENT_SALVAGE,
  workableTiles,
  cultivatedTiles,
} from "@farmgame/engine";

export function EquipmentPanel() {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const open = useUIStore((s) => s.activePanel === "equipment");
  const closePanel = useUIStore((s) => s.closePanel);

  if (!state || !open) return null;

  const capacity = workableTiles(state.equipment);
  const used = cultivatedTiles(state.fields);
  const pct = Math.min(100, Math.round((used / capacity) * 100));

  return (
    <PanelModal title="Equipment" onClose={closePanel} width={420} accent="#9db4d0">
      {/* Workable-land gauge */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ color: "#aaa" }}>Land under cultivation</span>
          <span style={{ color: used > capacity ? "#ff6b6b" : "#4ecca3" }}>{used} / {capacity} tiles</span>
        </div>
        <div style={{ height: 8, background: "#0a1628", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? "#ffa454" : "#4ecca3" }} />
        </div>
        <div style={{ color: "#7a8a9a", fontSize: 11, marginTop: 4 }}>
          Buy machinery to plow and work more land at once.
        </div>
      </div>

      {/* Buy buttons */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {ALL_EQUIPMENT_TYPES.map((type) => {
          const def = EQUIPMENT_CATALOG[type];
          const disabled = state.money < def.cost;
          return (
            <button
              key={type}
              disabled={disabled}
              onClick={() => dispatch({ type: "BUY_EQUIPMENT", equipmentType: type })}
              title={`+${def.workableTiles} workable tiles · upkeep $${def.upkeepPerSeason}/season`}
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
              {def.name} ${def.cost} <span style={{ opacity: 0.7 }}>(+{def.workableTiles})</span>
            </button>
          );
        })}
      </div>

      {/* Owned */}
      {state.equipment.length === 0 ? (
        <div style={{ color: "#888", fontSize: 12 }}>No machinery yet — working by hand.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {state.equipment.map((e) => {
            const def = EQUIPMENT_CATALOG[e.type];
            return (
              <div
                key={e.id}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #222", padding: "3px 0" }}
              >
                <span style={{ color: "#ccc" }}>
                  {def.name} <span style={{ color: "#888" }}>· +{def.workableTiles} tiles · ${def.upkeepPerSeason}/season</span>
                </span>
                <button
                  onClick={() => dispatch({ type: "SELL_EQUIPMENT", equipmentId: e.id })}
                  style={{ padding: "2px 8px", fontSize: 11, border: "1px solid #555", borderRadius: 3, background: "#222", color: "#ccc", cursor: "pointer" }}
                >
                  Sell ${Math.round(def.cost * EQUIPMENT_SALVAGE)}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </PanelModal>
  );
}
