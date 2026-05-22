"use client";

import { useEffect, type ReactNode } from "react";

interface PanelModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Card width in px (or any CSS width). Defaults to a comfortable medium. */
  width?: number | string;
  /** Header accent color. Defaults to the app green. */
  accent?: string;
}

/**
 * Shared shell for the game's modal panels (Market, Finance, Equipment, …).
 * Renders a dimmed scrim that closes on click-outside, a centered card with a
 * consistent header + close button, and an Escape-to-close handler. Only one
 * panel is ever open at a time (see ui-store `activePanel`).
 */
export function PanelModal({ title, onClose, children, width = 420, accent = "#4ecca3" }: PanelModalProps) {
  // Close on Escape while this panel is mounted.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      // Scrim: clicking the backdrop (but not the card) closes the panel.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(7, 11, 22, 0.55)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          background: "#16213e",
          border: "1px solid #2a3f6a",
          borderRadius: 10,
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.5)",
          width,
          maxWidth: "92vw",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontSize: 13,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid #0f3460",
            background: "#13203c",
          }}
        >
          <h3 style={{ margin: 0, color: accent, fontSize: 15 }}>{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
            style={{
              background: "none",
              border: "1px solid #3a4a6a",
              borderRadius: 6,
              color: "#9db4d0",
              cursor: "pointer",
              padding: "2px 9px",
              fontSize: 14,
              lineHeight: 1.2,
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ padding: 16, overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}
