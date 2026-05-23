"use client";

/**
 * Settings + Save/Load panel — the canonical home for global preferences and
 * the manual save/load slot UI. Opened from the gear icon in the HUD.
 *
 * Slot list shows every populated slot plus empty placeholders for the
 * three manual slots. Save writes; Load swaps the running game; Delete
 * removes that slot only. Quicksave/load have dedicated buttons; autosave
 * is read-only (auto-written on season change — see useAutosaveOnSeasonChange).
 */

import { useEffect, useState } from "react";
import { useGameStore } from "../../stores/game-store";
import { useUIStore } from "../../stores/ui-store";
import { PanelModal } from "./PanelModal";
import { isAudioEnabled, setAudioEnabled, playSound } from "../../lib/sounds";
import { monthPhase } from "@farmgame/engine";
import {
  ALL_SLOT_IDS,
  AUTOSAVE_ID,
  MANUAL_SLOT_IDS,
  QUICKSAVE_ID,
  deleteSave,
  listSaves,
  quickLoad,
  quickSave,
  readSave,
  wipeAllSaves,
  writeSave,
  type SaveMeta,
} from "../../lib/save-game";

export function SettingsPanel() {
  const state = useGameStore((s) => s.state);
  const loadGameState = useGameStore((s) => s.loadGameState);
  const returnToMenu = useGameStore((s) => s.returnToMenu);
  const open = useUIStore((s) => s.activePanel === "settings");
  const closePanel = useUIStore((s) => s.closePanel);
  const reopenOnboarding = useUIStore((s) => s.reopenOnboarding);

  // Audio toggle hydrates from localStorage on mount (the sounds module owns it).
  const [audioOn, setAudioOn] = useState(false);
  useEffect(() => setAudioOn(isAudioEnabled()), []);

  // Slot list — re-listed after every save/delete to stay in sync.
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const refreshSaves = () => setSaves(listSaves());
  useEffect(() => {
    if (open) refreshSaves();
  }, [open]);

  // Transient status line under the save section (e.g. "Quicksaved · just now").
  const [status, setStatus] = useState<string | null>(null);
  const flash = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus((cur) => (cur === msg ? null : cur)), 2200);
  };

  if (!open) return null;

  const findSave = (slotId: string) => saves.find((s) => s.slotId === slotId);

  const doSave = (slotId: string, name?: string) => {
    if (!state) return;
    const result = writeSave(slotId, state, name);
    if (result) {
      refreshSaves();
      flash(`Saved to ${slotLabel(slotId)}`);
    } else {
      flash("Could not save — storage may be full or disabled.");
    }
  };
  const doLoad = (slotId: string) => {
    const r = readSave(slotId);
    if (!r.ok) {
      flash(loadErrorMessage(r.error.kind));
      return;
    }
    loadGameState(r.payload.state);
    closePanel();
  };
  const doDelete = (slotId: string) => {
    deleteSave(slotId);
    refreshSaves();
    flash(`Deleted ${slotLabel(slotId)}`);
  };

  return (
    <PanelModal title="Settings" onClose={closePanel} width={480} accent="#9db4d0">
      {/* Save / Load --------------------------------------------------- */}
      <Section label="Save & Load">
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <ActionButton
            onClick={() => {
              if (!state) return;
              const meta = quickSave(state);
              refreshSaves();
              flash(meta ? "Quicksaved" : "Could not quicksave — storage may be full.");
            }}
            color="#4ecca3"
            disabled={!state}
            title="Save to the dedicated quicksave slot"
          >
            Quicksave
          </ActionButton>
          <ActionButton
            onClick={() => {
              const r = quickLoad();
              if (!r.ok) {
                flash(loadErrorMessage(r.error.kind));
                return;
              }
              loadGameState(r.payload.state);
              closePanel();
            }}
            color="#9db4d0"
            disabled={!findSave(QUICKSAVE_ID)}
            title="Load from the quicksave slot"
          >
            Quickload
          </ActionButton>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ALL_SLOT_IDS.map(({ id, kind }) => {
            const save = findSave(id);
            return (
              <SaveSlotRow
                key={id}
                slotId={id}
                kind={kind}
                save={save}
                onSave={kind === "manual" ? (name) => doSave(id, name) : undefined}
                onLoad={save ? () => doLoad(id) : undefined}
                onDelete={save ? () => doDelete(id) : undefined}
              />
            );
          })}
        </div>
        {status && (
          <div style={{ marginTop: 8, fontSize: 11, color: "#7a8a9a" }}>{status}</div>
        )}
      </Section>

      {/* Preferences --------------------------------------------------- */}
      <Section label="Preferences">
        <ToggleRow
          label="Sound effects"
          description="Synthesised UI cues on plant, harvest, build, sale."
          on={audioOn}
          onChange={(next) => {
            setAudioEnabled(next);
            setAudioOn(next);
            if (next) playSound("plant"); // sample so the user knows it works
          }}
        />
        <button
          onClick={() => {
            reopenOnboarding();
            flash("Onboarding tips re-enabled.");
          }}
          style={ghostButtonStyle}
        >
          Reopen onboarding tips
        </button>
      </Section>

      {/* Danger zone --------------------------------------------------- */}
      <Section label="Danger zone" accent="#ff8c42">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <ConfirmButton
            label="Wipe all saves"
            confirmLabel="Click again to confirm"
            color="#ff6b6b"
            onConfirm={() => {
              wipeAllSaves();
              refreshSaves();
              flash("All saves wiped.");
            }}
          />
          <ConfirmButton
            label="Quit to start screen"
            confirmLabel="Click again — unsaved progress will be lost"
            color="#ff8c42"
            onConfirm={() => {
              returnToMenu();
              closePanel();
            }}
          />
        </div>
      </Section>
    </PanelModal>
  );
}

/* ----------------------------------------------------------------------- */
/* Building blocks.                                                        */
/* ----------------------------------------------------------------------- */

function Section({
  label,
  children,
  accent = "#9db4d0",
}: {
  label: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: 0.6,
          color: accent,
          fontWeight: 700,
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  on,
  onChange,
}: {
  label: string;
  description: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        padding: "6px 0",
        borderBottom: "1px solid #1a2540",
        marginBottom: 6,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ color: "#cdd5e0" }}>{label}</div>
        <div style={{ color: "#7a8a9a", fontSize: 11, marginTop: 2 }}>{description}</div>
      </div>
      <button
        onClick={() => onChange(!on)}
        aria-pressed={on}
        style={{
          padding: "2px 12px",
          fontSize: 11,
          borderRadius: 3,
          cursor: "pointer",
          border: on ? "1px solid #4ecca3" : "1px solid #555",
          background: on ? "#1a4040" : "#222",
          color: on ? "#4ecca3" : "#aaa",
          flexShrink: 0,
        }}
      >
        {on ? "ON" : "OFF"}
      </button>
    </div>
  );
}

function ActionButton({
  children,
  color,
  disabled,
  title,
  onClick,
}: {
  children: React.ReactNode;
  color: string;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: "4px 12px",
        fontSize: 12,
        borderRadius: 3,
        cursor: disabled ? "default" : "pointer",
        border: `1px solid ${disabled ? "#333" : color}`,
        background: disabled ? "#1a1f2e" : `${color}22`,
        color: disabled ? "#555" : color,
      }}
    >
      {children}
    </button>
  );
}

const ghostButtonStyle: React.CSSProperties = {
  padding: "4px 10px",
  marginTop: 6,
  fontSize: 11,
  borderRadius: 3,
  cursor: "pointer",
  border: "1px solid #3a4a6a",
  background: "#1a2540",
  color: "#9db4d0",
};

/** Two-click confirm to prevent accidental destructive actions. */
function ConfirmButton({
  label,
  confirmLabel,
  color,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  color: string;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
      style={{
        padding: "5px 10px",
        fontSize: 12,
        borderRadius: 3,
        cursor: "pointer",
        textAlign: "left",
        border: `1px solid ${armed ? color : "#444"}`,
        background: armed ? `${color}22` : "#1a2540",
        color: armed ? color : "#cdd5e0",
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

/** Row in the slot list. Manual slots can save; quicksave/autosave are read-only here. */
function SaveSlotRow({
  slotId,
  kind,
  save,
  onSave,
  onLoad,
  onDelete,
}: {
  slotId: string;
  kind: "manual" | "quicksave" | "autosave";
  save: SaveMeta | undefined;
  onSave?: (name?: string) => void;
  onLoad?: () => void;
  onDelete?: () => void;
}) {
  const label = slotLabel(slotId);
  const empty = !save;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        background: "#0f1a2e",
        border: "1px solid #1a2540",
        borderRadius: 4,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: empty ? "#7a8a9a" : "#cdd5e0", fontWeight: 600, fontSize: 12 }}>
          {label}
          {kind !== "manual" && (
            <span style={{ color: "#7a8a9a", fontWeight: 400, marginLeft: 6, fontSize: 10 }}>
              {kind === "quicksave" ? "(F5 / Quicksave)" : "(auto, per season)"}
            </span>
          )}
        </div>
        {save ? (
          <div style={{ color: "#7a8a9a", fontSize: 10.5, marginTop: 2 }}>
            {monthPhase(save.summary.monthOfSeason)} {save.summary.season} Y{save.summary.year} · $
            {save.summary.money.toLocaleString()} · {save.summary.fields}f / {save.summary.animals}a
            <span style={{ color: "#556677", marginLeft: 6 }}>{relativeTime(save.savedAt)}</span>
          </div>
        ) : (
          <div style={{ color: "#556677", fontSize: 10.5, marginTop: 2 }}>Empty</div>
        )}
      </div>
      {onSave && (
        <SmallButton onClick={() => onSave()} color="#4ecca3">
          {empty ? "Save" : "Overwrite"}
        </SmallButton>
      )}
      {onLoad && (
        <SmallButton onClick={onLoad} color="#9db4d0">
          Load
        </SmallButton>
      )}
      {onDelete && (
        <SmallButton onClick={onDelete} color="#ff8c42">
          Delete
        </SmallButton>
      )}
    </div>
  );
}

function SmallButton({
  children,
  color,
  onClick,
}: {
  children: React.ReactNode;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "2px 8px",
        fontSize: 11,
        borderRadius: 3,
        cursor: "pointer",
        border: `1px solid ${color}`,
        background: `${color}22`,
        color,
      }}
    >
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------------- */
/* Helpers.                                                                */
/* ----------------------------------------------------------------------- */

function slotLabel(slotId: string): string {
  if (slotId === QUICKSAVE_ID) return "Quicksave";
  if (slotId === AUTOSAVE_ID) return "Autosave";
  const i = MANUAL_SLOT_IDS.indexOf(slotId as (typeof MANUAL_SLOT_IDS)[number]);
  return i >= 0 ? `Slot ${i + 1}` : slotId;
}

function loadErrorMessage(kind: "not_found" | "corrupt" | "version_mismatch"): string {
  switch (kind) {
    case "not_found":
      return "That slot is empty.";
    case "corrupt":
      return "Save file is unreadable.";
    case "version_mismatch":
      return "Save is from an older version and can't be loaded.";
  }
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}
