"use client";

import { useGameStore } from "../../stores/game-store";
import { useUIStore } from "../../stores/ui-store";
import { standings } from "@farmgame/engine";

export function StandingsPanel() {
  const state = useGameStore((s) => s.state);
  const show = useUIStore((s) => s.showStandingsPanel);
  const setShow = useUIStore((s) => s.setShowStandingsPanel);

  if (!state || !show) return null;

  const table = standings(state);
  const target = state.goal.type === "tycoon_race" ? state.goal.target : 0;

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "#16213e",
        border: "2px solid #0f3460",
        borderRadius: 8,
        padding: 16,
        zIndex: 100,
        width: 380,
        fontSize: 13,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ margin: 0, color: "#4ecca3" }}>Standings</h3>
        <button
          onClick={() => setShow(false)}
          style={{ background: "none", border: "1px solid #555", borderRadius: 4, color: "#aaa", cursor: "pointer", padding: "2px 8px" }}
        >
          X
        </button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #333", color: "#888" }}>
            <th style={{ textAlign: "left", padding: "4px 6px" }}>#</th>
            <th style={{ textAlign: "left", padding: "4px 6px" }}>Farm</th>
            <th style={{ textAlign: "right", padding: "4px 6px" }}>Net worth</th>
            <th style={{ textAlign: "right", padding: "4px 6px" }}>Plots</th>
            {target > 0 && <th style={{ textAlign: "right", padding: "4px 6px" }}>To win</th>}
          </tr>
        </thead>
        <tbody>
          {table.map((row, i) => (
            <tr
              key={row.name}
              style={{
                borderBottom: "1px solid #222",
                background: row.isHuman ? "#15302e" : "transparent",
              }}
            >
              <td style={{ padding: "4px 6px", color: "#888" }}>{i + 1}</td>
              <td style={{ padding: "4px 6px", color: row.isHuman ? "#4ecca3" : "#ccc", fontWeight: row.isHuman ? 700 : 400 }}>
                {row.name}
              </td>
              <td style={{ padding: "4px 6px", textAlign: "right", color: "#eee" }}>
                ${row.netWorth.toLocaleString()}
              </td>
              <td style={{ padding: "4px 6px", textAlign: "right", color: "#aaa" }}>{row.plots}</td>
              {target > 0 && (
                <td style={{ padding: "4px 6px", textAlign: "right", color: "#7a8a9a" }}>
                  {Math.max(0, Math.round(((row.netWorth / target) * 100)))}%
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
