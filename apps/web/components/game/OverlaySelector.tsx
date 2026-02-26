"use client";

import { useUIStore } from "../../stores/ui-store";
import type { OverlayMode } from "@farmgame/renderer";

const OVERLAYS: { mode: OverlayMode; label: string }[] = [
  { mode: "none", label: "None" },
  { mode: "moisture", label: "Moisture" },
  { mode: "soil_quality", label: "Soil" },
  { mode: "ownership", label: "Owner" },
];

export function OverlaySelector() {
  const selectedOverlay = useUIStore((s) => s.selectedOverlay);
  const setSelectedOverlay = useUIStore((s) => s.setSelectedOverlay);

  return (
    <div style={{ display: "flex", gap: 2 }}>
      {OVERLAYS.map((o) => (
        <button
          key={o.mode}
          onClick={() => setSelectedOverlay(o.mode)}
          style={{
            padding: "2px 6px",
            fontSize: 10,
            border: selectedOverlay === o.mode ? "1px solid #4ecca3" : "1px solid #444",
            borderRadius: 3,
            background: selectedOverlay === o.mode ? "#1a4040" : "#222",
            color: selectedOverlay === o.mode ? "#4ecca3" : "#888",
            cursor: "pointer",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
