"use client";

/**
 * Hidden balance-work panel. Renders the current run's telemetry and a
 * "Run baseline batch" tool that fires the headless greedy-wheat policy
 * across (scenario × difficulty) seeds and shows the win-rate matrix.
 *
 * Not visible to players. Surfaces in two ways:
 *   - URL param: `?debug=1`
 *   - Keystroke: Ctrl+Shift+D (or Cmd+Shift+D)
 * Once opened it lives next to the other panels behind a normal close
 * button. State is kept locally — nothing about the panel persists.
 */

import { useEffect, useState } from "react";
import { useGameStore } from "../../stores/game-store";
import {
  aggregateRun,
  simulateBatch,
  greedyWheatPolicy,
  expansionPolicy,
  type RunReport,
  type TurnSnapshot,
  type BatchReport,
  type Policy,
} from "@farmgame/engine";
import { SCENARIOS, DIFFICULTIES, type Difficulty, buildConfig } from "../../lib/scenarios";

type PolicyId = "greedy" | "expansion";
const POLICY_BY_ID: Record<PolicyId, Policy> = {
  greedy: greedyWheatPolicy,
  expansion: expansionPolicy,
};
const POLICY_DESCRIPTION: Record<PolicyId, string> = {
  greedy:
    "Greedy floor — designates, plows, plants wheat/lettuce/clover, harvests, sells. " +
    "Never buys land or equipment. Measures the minimum a scenario asks of the player.",
  expansion:
    "Greedy + buys cheapest equipment then adjacent plots when cash ≥ cost + $600. " +
    "Tests whether expansion is a viable path the scenario rewards.",
};

const SCENARIO_MAX_TURNS: Record<string, number> = {
  homestead: 24,
  prosperity: 48,
  land_baron: 36,
  tycoon_rush: 36,
  market_mogul: 24,
  first_harvest: 14,
  quick_challenge: 26,
  race_the_clock: 38,
};

export function DebugReportPanel() {
  const snapshots = useGameStore((s) => s.turnSnapshots);
  const state = useGameStore((s) => s.state);
  const [open, setOpen] = useState(false);
  const [batch, setBatch] = useState<BatchReport[] | null>(null);
  const [running, setRunning] = useState(false);
  const [policyId, setPolicyId] = useState<PolicyId>("greedy");

  // Open via URL ?debug=1 or via Ctrl/Cmd+Shift+D.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("debug") === "1") setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toUpperCase() === "D") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  const currentRun: RunReport | null =
    snapshots.length > 0 ? aggregateRun({ snapshots }) : null;

  const runBatch = async () => {
    setRunning(true);
    // Yield so the spinner paints before we start computing.
    await new Promise((r) => setTimeout(r, 16));
    const results: BatchReport[] = [];
    for (const sc of SCENARIOS) {
      for (const d of DIFFICULTIES) {
        const cfg = buildConfig(sc, d.id as Difficulty, { seed: 1 });
        // `simulateBatch` will overwrite seed per-run; strip ours.
        const { seed: _, ...rest } = cfg;
        void _;
        const report = simulateBatch({
          config: rest,
          runs: 20,
          startSeed: 1,
          maxTurns: SCENARIO_MAX_TURNS[sc.id] ?? 36,
          scenarioId: `${sc.id}/${d.id}`,
          policy: POLICY_BY_ID[policyId],
        });
        results.push(report);
        // Yield between scenarios so the UI stays responsive.
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    setBatch(results);
    setRunning(false);
  };

  const exportJson = () => {
    if (!currentRun) return;
    const blob = new Blob([JSON.stringify(currentRun, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `farmgame-run-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 250,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(7, 11, 22, 0.65)",
      }}
    >
      <div
        style={{
          background: "#101a2e",
          border: "1px solid #2a3f6a",
          borderRadius: 8,
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.5)",
          width: 880,
          maxWidth: "94vw",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 11.5,
          color: "#cdd5e0",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 14px",
            background: "#0a1628",
            borderBottom: "1px solid #2a3f6a",
          }}
        >
          <span style={{ color: "#ffdd57", fontWeight: 700, fontSize: 13 }}>
            Debug · Balance Report
          </span>
          <span style={{ fontSize: 10, color: "#7a8a9a" }}>
            Toggle: Ctrl/Cmd+Shift+D · or ?debug=1 in URL
          </span>
          <button onClick={() => setOpen(false)} style={iconBtn}>✕</button>
        </div>

        <div style={{ padding: 14, overflowY: "auto" }}>
          <Section label="Current run">
            {!state ? (
              <div style={{ color: "#7a8a9a" }}>No game in progress.</div>
            ) : !currentRun ? (
              <div style={{ color: "#7a8a9a" }}>
                No turns recorded yet — End Turn once to populate.
              </div>
            ) : (
              <CurrentRun report={currentRun} snapshots={snapshots} />
            )}
            {currentRun && (
              <button onClick={exportJson} style={primaryBtn}>Export run as JSON</button>
            )}
          </Section>

          <Section label="Baseline batch">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "#7a8a9a" }}>POLICY</span>
              <select
                value={policyId}
                onChange={(e) => setPolicyId(e.target.value as PolicyId)}
                disabled={running}
                style={{
                  fontFamily: "inherit",
                  fontSize: 11,
                  padding: "2px 6px",
                  background: "#0f1a2e",
                  color: "#cdd5e0",
                  border: "1px solid #2a3f6a",
                  borderRadius: 3,
                }}
              >
                <option value="greedy">greedy</option>
                <option value="expansion">expansion</option>
              </select>
            </div>
            <div style={{ fontSize: 10, color: "#556677", marginBottom: 6 }}>
              {POLICY_DESCRIPTION[policyId]}
            </div>
            <button onClick={runBatch} disabled={running} style={primaryBtn}>
              {running ? "Running…" : "Run baseline batch (20 seeds × scenarios × difficulties)"}
            </button>
            {batch && <BatchTable batches={batch} />}
          </Section>
        </div>
      </div>
    </div>
  );
}

function CurrentRun({ report, snapshots }: { report: RunReport; snapshots: TurnSnapshot[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 8 }}>
      <Stat label="Turn" value={String(report.turnCount)} />
      <Stat label="Status" value={report.finalStatus} />
      <Stat label="Cash" value={`$${report.finalMoney.toLocaleString()}`} />
      <Stat label="Net worth" value={`$${report.finalNetWorth.toLocaleString()}`} />
      <Stat label="Loan" value={`$${report.finalLoan.toLocaleString()}`} />
      <Stat
        label="Labor utilisation"
        value={`${(report.laborUtilisation * 100).toFixed(0)}% (wasted ${report.laborWastedTotal} total)`}
      />
      <Stat
        label="Crops"
        value={`${report.outcomes.harvests} harvests · ${report.outcomes.cropDeaths} deaths · ${report.outcomes.cropsReady} ready`}
      />
      <Stat
        label="Animals"
        value={`${report.outcomes.animalBirths} born · ${report.outcomes.animalDeaths} lost`}
      />
      <Stat
        label="Events"
        value={`${report.outcomes.marketEvents} market · ${report.outcomes.randomEvents} random`}
      />
      <Stat
        label="Pressure turns"
        value={`frost ${report.pressureTurnTotals.frost} · weeds ${report.pressureTurnTotals.weeds} · pests ${report.pressureTurnTotals.pests} · drought ${report.pressureTurnTotals.drought} · heat ${report.pressureTurnTotals.heat}`}
      />
      <Stat
        label="Growth lost (crop cycles)"
        value={`moisture ${report.growthLostTotals.moisture.toFixed(2)} · temp ${report.growthLostTotals.temperature.toFixed(2)} · health ${report.growthLostTotals.health.toFixed(2)}`}
      />
      <div style={{ gridColumn: "1 / -1", marginTop: 6 }}>
        <div style={{ fontSize: 10, letterSpacing: 0.5, color: "#7a8a9a", marginBottom: 4 }}>
          NET WORTH TRACE
        </div>
        <Sparkline values={report.netWorthByTurn} height={32} />
        <div style={{ fontSize: 9, color: "#556677", marginTop: 2 }}>
          {snapshots.length} snapshot{snapshots.length === 1 ? "" : "s"} ·{" "}
          first ${snapshots[0]?.netWorth.toLocaleString()} →{" "}
          last ${snapshots[snapshots.length - 1]?.netWorth.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function BatchTable({ batches }: { batches: BatchReport[] }) {
  return (
    <table style={{ width: "100%", marginTop: 10, borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ color: "#7a8a9a", fontSize: 10, textAlign: "left" }}>
          <th style={th}>Scenario / Diff</th>
          <th style={th}>Runs</th>
          <th style={th}>Win%</th>
          <th style={th}>Loss%</th>
          <th style={th}>Bankrupt%</th>
          <th style={th}>Median $</th>
          <th style={th}>Median NW</th>
          <th style={th}>Labor%</th>
        </tr>
      </thead>
      <tbody>
        {batches.map((b) => {
          const winColor =
            b.winRate >= 0.4 ? "#7ddf64" : b.winRate >= 0.1 ? "#ffdd57" : "#ff8c42";
          const lossColor =
            b.lossRate <= 0.3 ? "#7ddf64" : b.lossRate <= 0.7 ? "#ffdd57" : "#ff6b6b";
          return (
            <tr key={b.scenarioId} style={{ borderTop: "1px solid #1a2540" }}>
              <td style={td}>{b.scenarioId}</td>
              <td style={td}>{b.runs}</td>
              <td style={{ ...td, color: winColor }}>{(b.winRate * 100).toFixed(0)}%</td>
              <td style={{ ...td, color: lossColor }}>{(b.lossRate * 100).toFixed(0)}%</td>
              <td style={td}>{(b.bankruptcyRate * 100).toFixed(0)}%</td>
              <td style={td}>{b.medianFinalMoney.toLocaleString()}</td>
              <td style={td}>{b.medianFinalNetWorth.toLocaleString()}</td>
              <td style={td}>{(b.averageLaborUtilisation * 100).toFixed(0)}%</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Sparkline({ values, height }: { values: number[]; height: number }) {
  if (values.length === 0) return null;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const W = 600;
  const stepX = W / Math.max(1, values.length - 1);
  const points = values.map((v, i) => `${(i * stepX).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <polyline fill="none" stroke="#4ecca3" strokeWidth="1.5" points={points} />
      <line x1="0" y1={height - ((0 - min) / range) * height} x2={W} y2={height - ((0 - min) / range) * height} stroke="#556677" strokeWidth="0.4" strokeDasharray="2 3" />
    </svg>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: "#ffdd57", fontSize: 11, fontWeight: 700, marginBottom: 6, letterSpacing: 0.4 }}>
        {label.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: "#7a8a9a", letterSpacing: 0.4 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 12, color: "#cdd5e0" }}>{value}</div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: "none",
  border: "1px solid #3a4a6a",
  borderRadius: 4,
  color: "#9db4d0",
  cursor: "pointer",
  padding: "2px 8px",
};

const primaryBtn: React.CSSProperties = {
  marginTop: 8,
  padding: "6px 12px",
  fontSize: 11,
  borderRadius: 3,
  cursor: "pointer",
  border: "1px solid #4ecca3",
  background: "#1a4040",
  color: "#4ecca3",
};

const th: React.CSSProperties = { padding: "4px 6px", fontWeight: 600, fontSize: 10 };
const td: React.CSSProperties = { padding: "3px 6px", fontSize: 11 };
