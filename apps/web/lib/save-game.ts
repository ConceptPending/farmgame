/**
 * Save/load layer for the game. Pure module — no React, no Zustand — so it
 * can be unit-tested and called from anywhere. Storage is `localStorage`
 * keyed by slot id.
 *
 * Save format is a small wrapper around the engine's `GameState`. The
 * `version` field is a hard gate: load() refuses any save not matching the
 * current SAVE_VERSION. There is no migration code in v1 — bumps will
 * orphan older saves and that's fine until the catalog stabilises.
 *
 * Slot ids:
 *   - "quicksave"           — written by the quicksave hotkey/button
 *   - "autosave"            — written silently by the season-change autosave
 *   - "slot1" / "slot2" / "slot3"  — three named manual slots
 *
 * A "slot id" is always the localStorage suffix; a user-facing "name" is
 * stored inside the save body and is editable independently.
 */

import type { GameState } from "@farmgame/engine";

/** Save schema versions:
 *  - v1: original per-day timing model.
 *  - v2 (PR L): monthly turns; `growthTicks` → `growthMonths`. v1 orphaned.
 *  - v3 (PR O): "road" removed from BuildingType. Old saves with road
 *    buildings would carry dead entries the renderer doesn't know to skip;
 *    bumping orphans them cleanly. */
export const SAVE_VERSION = 3;

const STORAGE_PREFIX = "farmgame.save.";

export type SlotKind = "quicksave" | "autosave" | "manual";

export interface SlotId {
  id: string;
  kind: SlotKind;
}

export const MANUAL_SLOT_IDS = ["slot1", "slot2", "slot3"] as const;
export const QUICKSAVE_ID = "quicksave";
export const AUTOSAVE_ID = "autosave";

export const ALL_SLOT_IDS: readonly SlotId[] = [
  { id: QUICKSAVE_ID, kind: "quicksave" },
  { id: AUTOSAVE_ID, kind: "autosave" },
  ...MANUAL_SLOT_IDS.map((id) => ({ id, kind: "manual" as SlotKind })),
];

/** What gets written to one storage key. */
export interface SavePayload {
  version: number;
  /** ISO timestamp of when this save was written. */
  savedAt: string;
  /** Player-facing label. Defaults to a derived "Year N – Season" string. */
  name: string;
  state: GameState;
}

/** Lightweight summary for the slot list UI (skips the heavy state blob). */
export interface SaveMeta {
  slotId: string;
  kind: SlotKind;
  name: string;
  savedAt: string;
  /** Quick stat strings for the slot card. */
  summary: {
    year: number;
    season: string;
    monthOfSeason: number;
    money: number;
    fields: number;
    animals: number;
  };
}

export type LoadError =
  | { kind: "not_found" }
  | { kind: "corrupt"; detail: string }
  | { kind: "version_mismatch"; saved: number; current: number };

export type LoadResult =
  | { ok: true; payload: SavePayload }
  | { ok: false; error: LoadError };

/* ----------------------------------------------------------------------- */
/* Storage primitives — single place that touches localStorage.            */
/* ----------------------------------------------------------------------- */

function storageKey(slotId: string): string {
  return `${STORAGE_PREFIX}${slotId}`;
}

function safeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readRaw(slotId: string): string | null {
  const s = safeStorage();
  if (!s) return null;
  try {
    return s.getItem(storageKey(slotId));
  } catch {
    return null;
  }
}

function writeRaw(slotId: string, value: string): boolean {
  const s = safeStorage();
  if (!s) return false;
  try {
    s.setItem(storageKey(slotId), value);
    return true;
  } catch {
    // QuotaExceededError, private mode, etc. — caller decides what to do.
    return false;
  }
}

function removeRaw(slotId: string): void {
  const s = safeStorage();
  if (!s) return;
  try {
    s.removeItem(storageKey(slotId));
  } catch {
    // Best-effort.
  }
}

/* ----------------------------------------------------------------------- */
/* Public API.                                                             */
/* ----------------------------------------------------------------------- */

/** Default human-readable name when the caller doesn't supply one. */
export function defaultSaveName(state: GameState): string {
  const phase =
    state.monthOfSeason === 1 ? "Early" : state.monthOfSeason === 3 ? "Late" : "Mid";
  const season = state.season.charAt(0).toUpperCase() + state.season.slice(1);
  return `Year ${state.year} · ${phase} ${season}`;
}

/**
 * Write `state` to `slotId`. The `name` is stored inside the payload and
 * shown in the slot list; defaults to a derived "Year N · Season" string.
 * Returns the SaveMeta on success or null if storage is unavailable / full.
 */
export function writeSave(slotId: string, state: GameState, name?: string): SaveMeta | null {
  const payload: SavePayload = {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    name: name ?? defaultSaveName(state),
    state,
  };
  const ok = writeRaw(slotId, JSON.stringify(payload));
  if (!ok) return null;
  return toMeta(slotId, payload);
}

/** Read `slotId`. Returns the typed result; never throws. */
export function readSave(slotId: string): LoadResult {
  const raw = readRaw(slotId);
  if (raw === null) return { ok: false, error: { kind: "not_found" } };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: { kind: "corrupt", detail: String(e) } };
  }
  if (!isSavePayload(parsed)) {
    return { ok: false, error: { kind: "corrupt", detail: "shape mismatch" } };
  }
  if (parsed.version !== SAVE_VERSION) {
    return {
      ok: false,
      error: { kind: "version_mismatch", saved: parsed.version, current: SAVE_VERSION },
    };
  }
  return { ok: true, payload: parsed };
}

/** Delete the save in `slotId`. No-op if it doesn't exist. */
export function deleteSave(slotId: string): void {
  removeRaw(slotId);
}

/** Wipe every save slot. Used by the "Wipe all saves" danger button. */
export function wipeAllSaves(): void {
  for (const slot of ALL_SLOT_IDS) removeRaw(slot.id);
}

/** List every populated slot (summary only — no full GameState in memory). */
export function listSaves(): SaveMeta[] {
  const out: SaveMeta[] = [];
  for (const slot of ALL_SLOT_IDS) {
    const r = readSave(slot.id);
    if (r.ok) out.push(toMeta(slot.id, r.payload));
  }
  return out;
}

/** Has any populated save slot? Drives the StartScreen "Continue" affordance. */
export function hasAnySave(): boolean {
  for (const slot of ALL_SLOT_IDS) {
    if (readRaw(slot.id) !== null) return true;
  }
  return false;
}

/**
 * Pick the most recently written save across all slots, for the "Continue"
 * button. Returns null if no saves exist.
 */
export function mostRecentSave(): SaveMeta | null {
  const list = listSaves();
  if (list.length === 0) return null;
  return list.reduce((a, b) => (a.savedAt >= b.savedAt ? a : b));
}

/* Convenience wrappers for the well-known slots. */
export function quickSave(state: GameState): SaveMeta | null {
  return writeSave(QUICKSAVE_ID, state, `Quicksave · ${defaultSaveName(state)}`);
}
export function quickLoad(): LoadResult {
  return readSave(QUICKSAVE_ID);
}
export function autoSave(state: GameState): SaveMeta | null {
  return writeSave(AUTOSAVE_ID, state, `Autosave · ${defaultSaveName(state)}`);
}

/* ----------------------------------------------------------------------- */
/* Internals.                                                              */
/* ----------------------------------------------------------------------- */

function slotKind(slotId: string): SlotKind {
  if (slotId === QUICKSAVE_ID) return "quicksave";
  if (slotId === AUTOSAVE_ID) return "autosave";
  return "manual";
}

function toMeta(slotId: string, payload: SavePayload): SaveMeta {
  const s = payload.state;
  return {
    slotId,
    kind: slotKind(slotId),
    name: payload.name,
    savedAt: payload.savedAt,
    summary: {
      year: s.year,
      season: s.season,
      monthOfSeason: s.monthOfSeason,
      money: s.money,
      fields: s.fields.length,
      animals: s.animals.length,
    },
  };
}

/** Cheap structural type guard — we don't validate every nested field but we do
 *  reject obviously-bad shapes (missing version, no state object). */
function isSavePayload(v: unknown): v is SavePayload {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.version === "number" &&
    typeof o.savedAt === "string" &&
    typeof o.name === "string" &&
    !!o.state &&
    typeof o.state === "object"
  );
}
