"use client";

import { useUIStore } from "../../stores/ui-store";
import {
  CROP_CATALOG,
  BUILDING_CATALOG,
  ANIMAL_CATALOG,
  ALL_ANIMAL_TYPES,
  type CropId,
  type BuildingType,
  type ToolId,
} from "@farmgame/engine";
import type { SprayType } from "@farmgame/engine";

const TOOLS: { id: ToolId; label: string; icon: string }[] = [
  { id: "pointer", label: "Select", icon: "👆" },
  { id: "buy_land", label: "Buy Land", icon: "🏷️" },
  { id: "designate_field", label: "Field", icon: "🔲" },
  { id: "plow", label: "Plow", icon: "🌾" },
  { id: "plant", label: "Plant", icon: "🌱" },
  { id: "harvest", label: "Harvest", icon: "🫘" },
  { id: "build", label: "Build", icon: "🏗️" },
  { id: "place_animal", label: "Animals", icon: "🐄" },
  { id: "spray", label: "Spray", icon: "💧" },
  { id: "bulldoze", label: "Remove", icon: "🗑️" },
];

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
        width: 68,
        flexShrink: 0,
      }}
    >
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setSelectedTool(tool.id)}
          style={buttonStyle(selectedTool === tool.id)}
        >
          <span style={{ fontSize: 18 }}>{tool.icon}</span>
          <span>{tool.label}</span>
        </button>
      ))}

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
          {(Object.keys(CROP_CATALOG) as CropId[]).map((id) => (
            <button
              key={id}
              onClick={() => setSelectedCrop(id)}
              style={subButtonStyle(selectedCrop === id)}
            >
              {CROP_CATALOG[id].name}
              <span style={{ color: "#888" }}> ${CROP_CATALOG[id].seedCost}</span>
            </button>
          ))}
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
