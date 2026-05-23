import { create } from "zustand";
import type { CropId, BuildingType, ToolId, AnimalType } from "@farmgame/engine";
import type { OverlayMode } from "@farmgame/renderer";
import type { SprayType } from "@farmgame/engine";

/** Modal panels — only one may be open at a time. */
export type PanelId = "market" | "finance" | "livestock" | "equipment" | "standings" | "log";

interface UIStore {
  selectedTool: ToolId;
  selectedCrop: CropId;
  selectedBuildingType: BuildingType;
  selectedAnimalType: AnimalType;
  selectedSprayType: SprayType;
  selectedOverlay: OverlayMode;
  hoveredTileIndex: number;
  selectedTileIndex: number;
  selectedFieldId: number | null;
  /** The single open modal panel, or null when none is open. */
  activePanel: PanelId | null;
  showInfoPanel: boolean;
  dragStartTile: number | null;
  /** Mouse position in viewport pixels while hovering the canvas (null when off). */
  hoverScreen: { x: number; y: number } | null;

  setSelectedTool: (tool: ToolId) => void;
  setSelectedCrop: (cropId: CropId) => void;
  setSelectedBuildingType: (type: BuildingType) => void;
  setSelectedAnimalType: (type: AnimalType) => void;
  setSelectedSprayType: (type: SprayType) => void;
  setSelectedOverlay: (mode: OverlayMode) => void;
  setHoveredTileIndex: (idx: number) => void;
  setSelectedTileIndex: (idx: number) => void;
  setSelectedFieldId: (id: number | null) => void;
  /** Open a modal panel (closing any other), or toggle it shut if already open. */
  openPanel: (panel: PanelId) => void;
  closePanel: () => void;
  setShowInfoPanel: (show: boolean) => void;
  setDragStartTile: (idx: number | null) => void;
  setHoverScreen: (p: { x: number; y: number } | null) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  selectedTool: "pointer",
  selectedCrop: "wheat",
  selectedBuildingType: "silo",
  selectedAnimalType: "chicken",
  selectedSprayType: "herbicide",
  selectedOverlay: "none",
  hoveredTileIndex: -1,
  selectedTileIndex: -1,
  selectedFieldId: null,
  activePanel: null,
  showInfoPanel: true,
  dragStartTile: null,
  hoverScreen: null,

  setSelectedTool: (tool) => set({ selectedTool: tool }),
  setSelectedCrop: (cropId) => set({ selectedCrop: cropId }),
  setSelectedBuildingType: (type) => set({ selectedBuildingType: type }),
  setSelectedAnimalType: (type) => set({ selectedAnimalType: type }),
  setSelectedSprayType: (type) => set({ selectedSprayType: type }),
  setSelectedOverlay: (mode) => set({ selectedOverlay: mode }),
  setHoveredTileIndex: (idx) => set({ hoveredTileIndex: idx }),
  setSelectedTileIndex: (idx) => set({ selectedTileIndex: idx }),
  setSelectedFieldId: (id) => set({ selectedFieldId: id }),
  openPanel: (panel) => set((s) => ({ activePanel: s.activePanel === panel ? null : panel })),
  closePanel: () => set({ activePanel: null }),
  setShowInfoPanel: (show) => set({ showInfoPanel: show }),
  setDragStartTile: (idx) => set({ dragStartTile: idx }),
  setHoverScreen: (p) => set({ hoverScreen: p }),
}));
