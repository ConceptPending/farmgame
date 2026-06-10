import { describe, it, expect, beforeEach } from "vitest";
import { type GameState } from "@farmgame/engine";
import { useGameStore } from "../stores/game-store";
import { AUTOSAVE_ID, readSave, wipeAllSaves } from "../lib/save-game";

/** Same in-memory localStorage polyfill as save-game.test.ts — the store's
 *  autosave path writes through the real save module. */
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

function freshGame(seed = 42): void {
  useGameStore.getState().startGame({ seed, startingMoney: 5000 });
}

/** Advance to the next season boundary (3 monthly turns from a fresh game). */
function endTurns(n: number): void {
  for (let i = 0; i < n; i++) useGameStore.getState().endTurn();
}

describe("game-store", () => {
  beforeEach(() => {
    installLocalStorage();
    wipeAllSaves();
    useGameStore.getState().returnToMenu();
  });

  describe("autosave", () => {
    it("does not autosave mid-season", () => {
      freshGame();
      endTurns(1);
      expect(readSave(AUTOSAVE_ID).ok).toBe(false);
    });

    it("autosaves on the season boundary", () => {
      freshGame();
      endTurns(3); // spring month 3 → summer month 1
      const r = readSave(AUTOSAVE_ID);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.payload.state.season).toBe(useGameStore.getState().state!.season);
    });

    it("loading a save does not overwrite the autosave (regression: load-clobber)", () => {
      freshGame();
      const early = useGameStore.getState().state!;
      endTurns(3);
      const autosaveAfterSeason = readSave(AUTOSAVE_ID);
      expect(autosaveAfterSeason.ok).toBe(true);
      if (!autosaveAfterSeason.ok) return;

      // Load the older state — the old HUD-effect autosave re-fired here and
      // replaced the newer autosave with the loaded (older) state.
      useGameStore.getState().loadGameState(early);
      const after = readSave(AUTOSAVE_ID);
      expect(after.ok).toBe(true);
      if (!after.ok) return;
      expect(after.payload.savedAt).toBe(autosaveAfterSeason.payload.savedAt);
      expect(after.payload.state.tick).toBe(autosaveAfterSeason.payload.state.tick);
    });
  });

  describe("dispatch error handling", () => {
    it("a failed command leaves state unchanged and pushes an error notification", () => {
      freshGame();
      const before = useGameStore.getState().state;
      useGameStore.getState().dispatch({ type: "SELL", cropId: "wheat", quantity: -5 });
      expect(useGameStore.getState().state).toBe(before);
      const last = useGameStore.getState().notifications.at(-1);
      expect(last?.type).toBe("error");
    });

    it("contains an engine throw instead of propagating it", () => {
      freshGame();
      // Corrupt state so the command handler throws (not just fails).
      const corrupt = {
        ...useGameStore.getState().state!,
        world: null,
      } as unknown as GameState;
      useGameStore.getState().loadGameState(corrupt);
      expect(() =>
        useGameStore.getState().dispatch({ type: "DESIGNATE_FIELD", tileIndices: [0] }),
      ).not.toThrow();
      expect(useGameStore.getState().state).toBe(corrupt);
      const last = useGameStore.getState().notifications.at(-1);
      expect(last?.type).toBe("error");
    });
  });

  it("startGame with a seed is deterministic", () => {
    freshGame(7);
    const a = useGameStore.getState().state!;
    freshGame(7);
    const b = useGameStore.getState().state!;
    expect(b.world.tiles).toEqual(a.world.tiles);
    expect(b.money).toBe(a.money);
  });
});
