"use client";

import { useState } from "react";
import { useGameStore } from "../../stores/game-store";
import { useUIStore } from "../../stores/ui-store";
import { computeNetWorth, computeSeasonalExpenses, LOAN_LIMIT } from "@farmgame/engine";

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
  const show = useUIStore((s) => s.showFinancePanel);
  const setShow = useUIStore((s) => s.setShowFinancePanel);
  const [amount, setAmount] = useState(1000);

  if (!state || !show) return null;

  const netWorth = computeNetWorth(state);
  const assets = netWorth - state.money + state.loan; // land + buildings + inventory
  const exp = computeSeasonalExpenses(state);
  const credit = LOAN_LIMIT - state.loan;
  const progress = Math.max(0, Math.min(1, netWorth / state.goalNetWorth));
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

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
        maxHeight: "80vh",
        overflowY: "auto",
        fontSize: 13,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: "#4ecca3" }}>Finances</h3>
        <button
          onClick={() => setShow(false)}
          style={{
            background: "none",
            border: "1px solid #555",
            borderRadius: 4,
            color: "#aaa",
            cursor: "pointer",
            padding: "2px 8px",
          }}
        >
          X
        </button>
      </div>

      {/* Goal progress */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ color: "#aaa" }}>Goal progress</span>
          <span style={{ color: "#4ecca3" }}>
            {fmt(netWorth)} / {fmt(state.goalNetWorth)}
          </span>
        </div>
        <div style={{ height: 10, background: "#0a1628", borderRadius: 5, overflow: "hidden" }}>
          <div
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              background: "#4ecca3",
              transition: "width 0.3s",
            }}
          />
        </div>
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
    </div>
  );
}
