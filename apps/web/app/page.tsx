"use client";

import { useEffect, useRef } from "react";
import { useGameStore } from "../stores/game-store";
import { HUD } from "../components/game/HUD";
import { GameCanvas } from "../components/game/GameCanvas";
import { ToolPalette } from "../components/game/ToolPalette";
import { InfoPanel } from "../components/game/InfoPanel";
import { WeatherPanel } from "../components/game/WeatherPanel";
import { MarketPanel } from "../components/game/MarketPanel";

export default function Home() {
  const initialized = useRef(false);
  const initGame = useGameStore((s) => s.initGame);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      initGame();
    }
  }, [initGame]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <HUD />
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <ToolPalette />
        <div style={{ flex: 1, position: "relative" }}>
          <GameCanvas />
          <WeatherPanel />
          <MarketPanel />
        </div>
        <InfoPanel />
      </div>
    </div>
  );
}
