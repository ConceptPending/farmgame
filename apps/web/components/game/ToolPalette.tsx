"use client";

import { useUIStore } from "../../stores/ui-store";
import { useGameStore } from "../../stores/game-store";
import {
  CROP_CATALOG,
  BUILDING_CATALOG,
  ANIMAL_CATALOG,
  ALL_ANIMAL_TYPES,
  laborCost,
  type CropId,
  type BuildingType,
  type ToolId,
  type GameCommand,
} from "@farmgame/engine";
import type { SprayType } from "@farmgame/engine";
import { Icon, type IconName } from "../ui/Icon";

const TOOLS: { id: ToolId; label: string; icon: IconName }[] = [
  { id: "pointer", label: "Select", icon: "pointer" },
  { id: "buy_land", label: "Buy Land", icon: "buy-land" },
  { id: "designate_field", label: "Field", icon: "field" },
  { id: "plow", label: "Plow", icon: "plow" },
  { id: "plant", label: "Plant", icon: "plant" },
  { id: "harvest", label: "Harvest", icon: "harvest" },
  { id: "build", label: "Build", icon: "build" },
  { id: "place_animal", label: "Animals", icon: "animal" },
  { id: "spray", label: "Spray", icon: "spray" },
  { id: "bulldoze", label: "Remove", icon: "remove" },
];

/** Labor cost the player will pay per tool action — drives the badge on each
 *  palette button. Looked up via the engine's laborCost() so it stays a single
 *  source of truth. */
const TOOL_REPRESENTATIVE_COMMAND: Partial<Record<ToolId, GameCommand>> = {
  buy_land: { type: "BUY_PLOT", plotX: 0, plotY: 0 },
  designate_field: { type: "DESIGNATE_FIELD", tileIndices: [] },
  plow: { type: "PLOW_FIELD", fieldId: 0 },
  plant: { type: "PLANT_FIELD", fieldId: 0, cropId: "wheat" },
  harvest: { type: "HARVEST_FIELD", fieldId: 0 },
  build: { type: "BUILD", buildingType: "silo", tileIndex: 0 },
  spray: { type: "SPRAY", fieldId: 0, sprayType: "herbicide" },
  bulldoze: { type: "REMOVE_FIELD", fieldId: 0 },
};

const TOOL_HINTS: Record<ToolId, string> = {
  pointer: "Click to inspect",
  buy_land: "Click a plot to buy",
  designate_field: "Click or drag to mark field",
  plow: "Click a field to plow",
  plant: "Click a plowed field",
  harvest: "Click a ready field",
  build: "Click, or drag fences",
  place_animal: "Click pen to place",
  spray: "Click a field to spray",
  bulldoze: "Click to remove",
};

const buttonStyle = (active: boolean): React.CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  padding: "6px 4px",
  fontSize: 11,
  border: active ? "2px solid #4ecca3" : "1px solid #444",
  borderRadius: 4,
  background: active ? "#1a4040" : "#222",
  color: active ? "#4ecca3" : "#ccc",
  cursor: "pointer",
  width: 56,
  minHeight: 48,
});

const subButtonStyle = (active: boolean): React.CSSProperties => ({
  padding: "3px 6px",
  fontSize: 10,
  border: active ? "1px solid #4ecca3" : "1px solid #555",
  borderRadius: 3,
  background: active ? "#1a4040" : "#2a2a2a",
  color: active ? "#4ecca3" : "#aaa",
  cursor: "pointer",
  whiteSpace: "nowrap",
});

export function ToolPalette() {
  const selectedTool = useUIStore((s) => s.selectedTool);
  const setSelectedTool = useUIStore((s) => s.setSelectedTool);
  const selectedCrop = useUIStore((s) => s.selectedCrop);
  const setSelectedCrop = useUIStore((s) => s.setSelectedCrop);
  const selectedBuildingType = useUIStore((s) => s.selectedBuildingType);
  const setSelectedBuildingType = useUIStore((s) => s.setSelectedBuildingType);
  const selectedAnimalType = useUIStore((s) => s.selectedAnimalType);
  const setSelectedAnimalType = useUIStore((s) => s.setSelectedAnimalType);
  const selectedSprayType = useUIStore((s) => s.selectedSprayType);
  const setSelectedSprayType = useUIStore((s) => s.setSelectedSprayType);
  const state = useGameStore((s) => s.state);

  const laborLeft = state ? state.labor.capacity - state.labor.used : 0;
  function toolCost(id: ToolId): number {
    const cmd = TOOL_REPRESENTATIVE_COMMAND[id];
    return cmd ? laborCost(cmd) : 0;
  }
  function toolDisabled(id: ToolId): boolean {
    return toolCost(id) > laborLeft;
  }

  // Sub-palettes (plant/build/spray/place_animal) have richer buttons with
  // sub-text, so the palette widens when one of those tools is active. The
  // icon column itself stays narrow.
  const needsWidePalette =
    selectedTool === "plant" ||
    selectedTool === "build" ||
    selectedTool === "spray" ||
    selectedTool === "place_animal";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "8px 4px",
        background: "#16213e",
        borderRight: "2px solid #0f3460",
        overflowY: "auto",
        width: needsWidePalette ? 170 : 68,
        flexShrink: 0,
        transition: "width 140ms ease",
      }}
    >
      {TOOLS.map((tool) => {
        const cost = toolCost(tool.id);
        const cantAfford = toolDisabled(tool.id);
        const active = selectedTool === tool.id;
        const iconColor = cantAfford ? "#555" : active ? "#4ecca3" : "#ccc";
        return (
          <button
            key={tool.id}
            onClick={() => setSelectedTool(tool.id)}
            title={cost > 0 ? `${tool.label} — ${cost} labor` : tool.label}
            style={{
              ...buttonStyle(active),
              opacity: cantAfford ? 0.6 : 1,
              position: "relative",
            }}
          >
            <Icon name={tool.icon} size={18} color={iconColor} />
            <span style={{ color: cantAfford ? "#666" : undefined }}>{tool.label}</span>
            {cost > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 2,
                  right: 4,
                  fontSize: 8,
                  fontWeight: 700,
                  color: cantAfford ? "#ff8c42" : "#7a8a9a",
                  background: "#0a1628",
                  borderRadius: 2,
                  padding: "0 3px",
                }}
              >
                {cost}
              </span>
            )}
          </button>
        );
      })}

      {/* Tool hint */}
      <div
        style={{
          fontSize: 9,
          color: "#7a8a9a",
          textAlign: "center",
          padding: "4px 2px",
          lineHeight: 1.3,
          minHeight: 20,
        }}
      >
        {TOOL_HINTS[selectedTool]}
      </div>

      {/* Sub-selectors */}
      {selectedTool === "plant" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            marginTop: 8,
            borderTop: "1px solid #333",
            paddingTop: 6,
          }}
        >
          <div style={{ fontSize: 9, color: "#888", textAlign: "center" }}>CROP</div>
          {(Object.keys(CROP_CATALOG) as CropId[]).map((id) => {
            const def = CROP_CATALOG[id];
            const active = selectedCrop === id;
            return (
              <button
                key={id}
                onClick={() => setSelectedCrop(id)}
                title={def.archetypeTagline}
                style={{
                  ...subButtonStyle(active),
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 1,
                  width: "100%",
                  padding: "4px 6px",
                  whiteSpace: "normal",
                  textAlign: "left",
                  lineHeight: 1.2,
                }}
              >
                <span>
                  {def.name}
                  <span style={{ color: "#888" }}> ${def.seedCost}</span>
                </span>
                <span style={{ color: "#7a8a9a", fontSize: 9, fontStyle: "italic" }}>
                  {def.archetypeTagline}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selectedTool === "build" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            marginTop: 8,
            borderTop: "1px solid #333",
            paddingTop: 6,
          }}
        >
          <div style={{ fontSize: 9, color: "#888", textAlign: "center" }}>BUILD</div>
          {(Object.keys(BUILDING_CATALOG) as BuildingType[]).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedBuildingType(type)}
              style={subButtonStyle(selectedBuildingType === type)}
            >
              {BUILDING_CATALOG[type].name}
              <span style={{ color: "#888" }}> ${BUILDING_CATALOG[type].cost}</span>
            </button>
          ))}
        </div>
      )}

      {selectedTool === "place_animal" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            marginTop: 8,
            borderTop: "1px solid #333",
            paddingTop: 6,
          }}
        >
          <div style={{ fontSize: 9, color: "#888", textAlign: "center" }}>ANIMAL</div>
          {ALL_ANIMAL_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedAnimalType(type)}
              style={subButtonStyle(selectedAnimalType === type)}
            >
              {ANIMAL_CATALOG[type].name}
              <span style={{ color: "#888" }}> ${ANIMAL_CATALOG[type].cost}</span>
            </button>
          ))}
        </div>
      )}

      {selectedTool === "spray" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            marginTop: 8,
            borderTop: "1px solid #333",
            paddingTop: 6,
          }}
        >
          <div style={{ fontSize: 9, color: "#888", textAlign: "center" }}>SPRAY</div>
          {(["herbicide", "pesticide", "fertilizer"] as SprayType[]).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedSprayType(type)}
              style={subButtonStyle(selectedSprayType === type)}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
