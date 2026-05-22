"use client";

import { useState } from "react";
import { useGameStore } from "../../stores/game-store";
import { useUIStore } from "../../stores/ui-store";
import { PanelModal } from "./PanelModal";
import { computeNetWorth, computeSeasonalExpenses, goalProgress, LOAN_LIMIT } from "@farmgame/engine";

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
      <span style={{ color: "#aaa" }}>{label}</span>
      <span style={{ color: color ?? "#eee", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export function FinancePanel() {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const open = useUIStore((s) => s.activePanel === "finance");
  const closePanel = useUIStore((s) => s.closePanel);
  const [amount, setAmount] = useState(1000);

  if (!state || !open) return null;

  const netWorth = computeNetWorth(state);
  const assets = netWorth - state.money + state.loan; // land + buildings + inventory
  const exp = computeSeasonalExpenses(state);
  const credit = LOAN_LIMIT - state.loan;
  const progress = goalProgress(state);
  const goalIsMoney = state.goal.type !== "land_baron" && state.goal.type !== "market_leader";
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const fmtGoal = (n: number) => (goalIsMoney ? fmt(n) : `${n}`);

  return (
    <PanelModal title="Finances" onClose={closePanel} width={380}>
      {/* Goal progress */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ color: "#aaa" }}>{progress.label}{progress.target > 0 ? " goal" : ""}</span>
          <span style={{ color: "#4ecca3" }}>
            {progress.target > 0 ? `${fmtGoal(progress.current)} / ${fmtGoal(progress.target)}` : "sandbox"}
          </span>
        </div>
        {progress.target > 0 && (
          <div style={{ height: 10, background: "#0a1628", borderRadius: 5, overflow: "hidden" }}>
            <div
              style={{
                width: `${progress.pct * 100}%`,
                height: "100%",
                background: "#4ecca3",
                transition: "width 0.3s",
              }}
            />
          </div>
        )}
      </div>

      {/* Balance sheet */}
      <div style={{ borderTop: "1px solid #333", paddingTop: 8, marginBottom: 12 }}>
        <Row label="Cash" value={fmt(state.money)} color={state.money < 0 ? "#ff6b6b" : "#eee"} />
        <Row label="Assets (land, buildings, stock)" value={fmt(assets)} />
        <Row label="Debt" value={state.loan > 0 ? `-${fmt(state.loan)}` : "$0"} color={state.loan > 0 ? "#ff6b6b" : "#888"} />
        <div style={{ borderTop: "1px solid #333", marginTop: 4, paddingTop: 4 }}>
          <Row label="Net worth" value={fmt(netWorth)} color="#4ecca3" />
        </div>
      </div>

      {/* Upcoming seasonal expenses */}
      <div style={{ borderTop: "1px solid #333", paddingTop: 8, marginBottom: 12 }}>
        <div style={{ color: "#888", fontSize: 11, marginBottom: 4 }}>NEXT SEASON&apos;S EXPENSES</div>
        <Row label="Land tax" value={fmt(exp.landTax)} />
        <Row label="Upkeep & overhead" value={fmt(exp.upkeep)} />
        <Row label="Loan interest" value={fmt(exp.interest)} />
        <Row label="Total due" value={fmt(exp.total)} color="#ffdd57" />
      </div>

      {/* Bank */}
      <div style={{ borderTop: "1px solid #333", paddingTop: 8 }}>
        <div style={{ color: "#888", fontSize: 11, marginBottom: 6 }}>
          BANK — credit available {fmt(credit)}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ color: "#aaa" }}>$</span>
          <input
            type="number"
            min={0}
            step={500}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            style={{
              width: 100,
              padding: "3px 6px",
              fontSize: 12,
              background: "#0a1628",
              border: "1px solid #444",
              borderRadius: 3,
              color: "#eee",
            }}
          />
          <button
            onClick={() => dispatch({ type: "TAKE_LOAN", amount })}
            style={{
              padding: "3px 10px",
              fontSize: 12,
              border: "1px solid #4ecca3",
              borderRadius: 3,
              background: "#1a4040",
              color: "#4ecca3",
              cursor: "pointer",
            }}
          >
            Borrow
          </button>
          <button
            onClick={() => dispatch({ type: "REPAY_LOAN", amount })}
            style={{
              padding: "3px 10px",
              fontSize: 12,
              border: "1px solid #555",
              borderRadius: 3,
              background: "#222",
              color: "#ccc",
              cursor: "pointer",
            }}
          >
            Repay
          </button>
        </div>
      </div>
    </PanelModal>
  );
}
