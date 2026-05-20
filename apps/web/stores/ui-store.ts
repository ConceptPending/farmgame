import { create } from "zustand";
import type { CropId, BuildingType, ToolId } from "@farmgame/engine";
import type { OverlayMode } from "@farmgame/renderer";
import type { SprayType } from "@farmgame/engine";

interface UIStore {
  selectedTool: ToolId;
  selectedCrop: CropId;
  selectedBuildingType: BuildingType;
  selectedSprayType: SprayType;
  selectedOverlay: OverlayMode;
  hoveredTileIndex: number;
  selectedTileIndex: number;
  selectedFieldId: number | null;
  showMarketPanel: boolean;
  showFinancePanel: boolean;
  showInfoPanel: boolean;
  dragStartTile: number | null;

  setSelectedTool: (tool: ToolId) => void;
  setSelectedCrop: (cropId: CropId) => void;
  setSelectedBuildingType: (type: BuildingType) => void;
  setSelectedSprayType: (type: SprayType) => void;
  setSelectedOverlay: (mode: OverlayMode) => void;
  setHoveredTileIndex: (idx: number) => void;
  setSelectedTileIndex: (idx: number) => void;
  setSelectedFieldId: (id: number | null) => void;
  setShowMarketPanel: (show: boolean) => void;
  setShowFinancePanel: (show: boolean) => void;
  setShowInfoPanel: (show: boolean) => void;
  setDragStartTile: (idx: number | null) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  selectedTool: "pointer",
  selectedCrop: "wheat",
  selectedBuildingType: "silo",
  selectedSprayType: "herbicide",
  selectedOverlay: "none",
  hoveredTileIndex: -1,
  selectedTileIndex: -1,
  selectedFieldId: null,
  showMarketPanel: false,
  showFinancePanel: false,
  showInfoPanel: true,
  dragStartTile: null,

  setSelectedTool: (tool) => set({ selectedTool: tool }),
  setSelectedCrop: (cropId) => set({ selectedCrop: cropId }),
  setSelectedBuildingType: (type) => set({ selectedBuildingType: type }),
  setSelectedSprayType: (type) => set({ selectedSprayType: type }),
  setSelectedOverlay: (mode) => set({ selectedOverlay: mode }),
  setHoveredTileIndex: (idx) => set({ hoveredTileIndex: idx }),
  setSelectedTileIndex: (idx) => set({ selectedTileIndex: idx }),
  setSelectedFieldId: (id) => set({ selectedFieldId: id }),
  setShowMarketPanel: (show) => set({ showMarketPanel: show }),
  setShowFinancePanel: (show) => set({ showFinancePanel: show }),
  setShowInfoPanel: (show) => set({ showInfoPanel: show }),
  setDragStartTile: (idx) => set({ dragStartTile: idx }),
}));
