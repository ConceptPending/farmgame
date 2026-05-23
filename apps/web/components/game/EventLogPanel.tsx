"use client";

import { useGameStore, type StampedNotification } from "../../stores/game-store";
import { useUIStore } from "../../stores/ui-store";
import { PanelModal } from "./PanelModal";
import { NOTIFICATION_COLOR, NOTIFICATION_GLYPH } from "./notifications";

/**
 * Full chronological event history. Toasts only show the last few — this is
 * where the player goes after a fast-forward to see what actually happened.
 * Newest first; same severity grammar as toasts.
 */
export function EventLogPanel() {
  const notifications = useGameStore((s) => s.notifications);
  const open = useUIStore((s) => s.activePanel === "log");
  const closePanel = useUIStore((s) => s.closePanel);

  if (!open) return null;

  // Newest first; cap render at a sensible number.
  const items = [...notifications].reverse().slice(0, 150);

  return (
    <PanelModal title="Event Log" onClose={closePanel} width={520} accent="#9db4d0">
      {items.length === 0 ? (
        <div style={{ color: "#7a8a9a", fontSize: 12, padding: "8px 2px" }}>
          No events yet — advance a tick to start logging.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {items.map((n) => (
            <EventRow key={n.id} n={n} />
          ))}
        </div>
      )}
    </PanelModal>
  );
}

function EventRow({ n }: { n: StampedNotification }) {
  const color = NOTIFICATION_COLOR[n.type];
  const glyph = NOTIFICATION_GLYPH[n.type];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "4px 8px",
        borderLeft: `3px solid ${color}`,
        background: "#0e1424",
        fontSize: 12,
      }}
    >
      <span
        style={{
          color: "#7a8a9a",
          fontSize: 10,
          minWidth: 84,
          whiteSpace: "nowrap",
        }}
      >
        Y{n.year} · {n.season} d{n.day}
      </span>
      <span aria-hidden style={{ color, fontWeight: 700, lineHeight: 1.35 }}>{glyph}</span>
      <span style={{ color: "#dde4ee", flex: 1, lineHeight: 1.35 }}>{n.message}</span>
    </div>
  );
}
