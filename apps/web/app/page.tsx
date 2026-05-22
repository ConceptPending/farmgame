"use client";

import { useGameStore } from "../stores/game-store";
import { HUD } from "../components/game/HUD";
import { GameCanvas } from "../components/game/GameCanvas";
import { ToolPalette } from "../components/game/ToolPalette";
import { InfoPanel } from "../components/game/InfoPanel";
import { WeatherPanel } from "../components/game/WeatherPanel";
import { MarketPanel } from "../components/game/MarketPanel";
import { FinancePanel } from "../components/game/FinancePanel";
import { LivestockPanel } from "../components/game/LivestockPanel";
import { EquipmentPanel } from "../components/game/EquipmentPanel";
import { GameOverOverlay } from "../components/game/GameOverOverlay";
import { StartScreen } from "../components/menu/StartScreen";

export default function Home() {
  const hasGame = useGameStore((s) => s.state !== null);

  if (!hasGame) return <StartScreen />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <HUD />
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <ToolPalette />
        <div style={{ flex: 1, position: "relative" }}>
          <GameCanvas />
          <WeatherPanel />
          <MarketPanel />
          <FinancePanel />
          <LivestockPanel />
          <EquipmentPanel />
        </div>
        <InfoPanel />
      </div>
      <GameOverOverlay />
    </div>
  );
}
