"use client";

import { useGameStore } from "../../stores/game-store";
import { useUIStore } from "../../stores/ui-store";
import { ANIMAL_CATALOG, DAYS_PER_SEASON, PRODUCT_CATALOG } from "@farmgame/engine";
import type { Animal } from "@farmgame/engine";

/**
 * Floating tooltip that appears near the cursor when the hovered tile holds
 * livestock — surfaces each animal's name, age, health and lifetime products
 * so individual animals feel like characters, not numbers.
 */
export function AnimalHoverTooltip() {
  const state = useGameStore((s) => s.state);
  const tileIndex = useUIStore((s) => s.hoveredTileIndex);
  const screen = useUIStore((s) => s.hoverScreen);

  if (!state || !screen || tileIndex < 0) return null;
  const animals = state.animals.filter((a) => a.tileIndex === tileIndex);
  if (animals.length === 0) return null;

  // Anchor a bit to the right of the cursor; nudge inward near the right edge.
  const offset = 16;
  const flipLeft = screen.x > window.innerWidth - 260;
  return (
    <div
      style={{
        position: "fixed",
        zIndex: 250,
        top: screen.y + offset,
        left: flipLeft ? undefined : screen.x + offset,
        right: flipLeft ? window.innerWidth - screen.x + offset : undefined,
        pointerEvents: "none",
        background: "rgba(14, 22, 40, 0.96)",
        border: "1px solid #2a3f6a",
        borderRadius: 6,
        padding: "6px 10px",
        fontSize: 11,
        color: "#ddd",
        maxWidth: 240,
        boxShadow: "0 6px 18px rgba(0, 0, 0, 0.5)",
      }}
    >
      {animals.slice(0, 6).map((a) => (
        <AnimalLine key={a.id} a={a} />
      ))}
      {animals.length > 6 && (
        <div style={{ color: "#7a8a9a", marginTop: 4 }}>… +{animals.length - 6} more</div>
      )}
    </div>
  );
}

function AnimalLine({ a }: { a: Animal }) {
  const def = ANIMAL_CATALOG[a.type];
  const years = Math.floor(a.lifetime.daysAlive / (DAYS_PER_SEASON * 4));
  const seasons = Math.floor((a.lifetime.daysAlive % (DAYS_PER_SEASON * 4)) / DAYS_PER_SEASON);
  const ageStr = years > 0 ? `${years}y ${seasons}s` : `${seasons}s`;
  const productName = def.product ? PRODUCT_CATALOG[def.product].name.toLowerCase() : null;
  const healthColor = a.health < 0.5 ? "#ff6b6b" : a.health < 0.85 ? "#ffdd57" : "#4ecca3";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "1px 0" }}>
      <span>
        <strong style={{ color: "#4ecca3" }}>{a.name}</strong>{" "}
        <span style={{ color: "#888" }}>· {def.name.toLowerCase()} · {ageStr}</span>
      </span>
      <span style={{ color: healthColor }}>
        {Math.round(a.health * 100)}%
        {productName && a.lifetime.products > 0 && (
          <span style={{ color: "#9db4d0" }}> · {a.lifetime.products} {productName}</span>
        )}
      </span>
    </div>
  );
}
