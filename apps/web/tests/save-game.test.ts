import { describe, it, expect, beforeEach, vi } from "vitest";
import { createGameState } from "@farmgame/engine";
import {
  ALL_SLOT_IDS,
  AUTOSAVE_ID,
  MANUAL_SLOT_IDS,
  QUICKSAVE_ID,
  SAVE_VERSION,
  autoSave,
  defaultSaveName,
  deleteSave,
  hasAnySave,
  listSaves,
  mostRecentSave,
  quickLoad,
  quickSave,
  readSave,
  wipeAllSaves,
  writeSave,
} from "../lib/save-game";

/**
 * Vitest runs in Node by default — no `window` / `localStorage`. We install a
 * tiny in-memory polyfill so the save module can write through its standard
 * code path. (The module itself guards against `window === undefined`.)
 */
function installLocalStorage(): void {
  const store = new Map<string, string>();
  const fake: Storage = {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    key: (i) => Array.from(store.keys())[i] ?? null,
    removeItem: (k) => { store.delete(k); },
    setItem: (k, v) => { store.set(k, v); },
  };
  (globalThis as unknown as { window: { localStorage: Storage } }).window = { localStorage: fake };
}

describe("save-game", () => {
  beforeEach(() => {
    installLocalStorage();
    wipeAllSaves();
  });

  it("round-trips a fresh GameState through writeSave/readSave", () => {
    const state = createGameState({ seed: 42, startingMoney: 1234 });
    const meta = writeSave("slot1", state, "My save");
    expect(meta).not.toBeNull();
    expect(meta!.name).toBe("My save");

    const r = readSave("slot1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.version).toBe(SAVE_VERSION);
    expect(r.payload.state.money).toBe(1234);
    expect(r.payload.state.year).toBe(state.year);
    // Deep field — the world tile grid round-trips intact.
    expect(r.payload.state.world.tiles.length).toBe(state.world.tiles.length);
    expect(r.payload.state.world.tiles[0].soilQuality).toBe(state.world.tiles[0].soilQuality);
  });

  it("returns a typed not_found result for an empty slot", () => {
    const r = readSave("slot1");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe("not_found");
  });

  it("returns version_mismatch when the saved version doesn't match", () => {
    const state = createGameState({ seed: 1 });
    writeSave("slot1", state);
    // Tamper directly with localStorage to simulate an older save.
    const raw = window.localStorage.getItem("farmgame.save.slot1")!;
    const parsed = JSON.parse(raw);
    parsed.version = SAVE_VERSION - 1;
    window.localStorage.setItem("farmgame.save.slot1", JSON.stringify(parsed));

    const r = readSave("slot1");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe("version_mismatch");
  });

  it("returns corrupt when the payload is malformed JSON or shape", () => {
    window.localStorage.setItem("farmgame.save.slot1", "not json {{{");
    let r = readSave("slot1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("corrupt");

    window.localStorage.setItem("farmgame.save.slot1", JSON.stringify({ version: 1 }));
    r = readSave("slot1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("corrupt");
  });

  it("deleteSave removes only the target slot", () => {
    const state = createGameState({ seed: 2 });
    writeSave("slot1", state);
    writeSave("slot2", state);
    deleteSave("slot1");
    expect(readSave("slot1").ok).toBe(false);
    expect(readSave("slot2").ok).toBe(true);
  });

  it("listSaves returns one meta per populated slot, skipping empty ones", () => {
    const state = createGameState({ seed: 3 });
    writeSave("slot1", state, "A");
    writeSave("slot3", state, "C");
    const list = listSaves();
    expect(list.map((s) => s.slotId).sort()).toEqual(["slot1", "slot3"]);
    expect(list.find((s) => s.slotId === "slot1")!.name).toBe("A");
  });

  it("quickSave / quickLoad / autoSave route to the dedicated slots", () => {
    const state = createGameState({ seed: 4, startingMoney: 999 });
    quickSave(state);
    autoSave(state);
    const list = listSaves();
    const ids = new Set(list.map((s) => s.slotId));
    expect(ids.has(QUICKSAVE_ID)).toBe(true);
    expect(ids.has(AUTOSAVE_ID)).toBe(true);
    const r = quickLoad();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.state.money).toBe(999);
  });

  it("mostRecentSave picks the latest savedAt across slots", async () => {
    const state = createGameState({ seed: 5 });
    writeSave("slot1", state);
    // Force a different timestamp by advancing the clock for the second write.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    writeSave("slot2", state, "Newer");
    vi.useRealTimers();
    const recent = mostRecentSave();
    expect(recent).not.toBeNull();
    expect(recent!.slotId).toBe("slot2");
  });

  it("hasAnySave is false on a clean store, true after any write", () => {
    expect(hasAnySave()).toBe(false);
    writeSave("slot1", createGameState({ seed: 6 }));
    expect(hasAnySave()).toBe(true);
  });

  it("defaultSaveName reflects the in-game time", () => {
    const state = createGameState({ seed: 7 });
    const name = defaultSaveName(state);
    expect(name).toMatch(/^Year 1 · /);
  });

  it("ALL_SLOT_IDS covers the well-known slots plus the manual three", () => {
    const ids = ALL_SLOT_IDS.map((s) => s.id);
    expect(ids).toContain(QUICKSAVE_ID);
    expect(ids).toContain(AUTOSAVE_ID);
    for (const m of MANUAL_SLOT_IDS) expect(ids).toContain(m);
  });
});
