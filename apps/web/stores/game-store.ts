import { create } from "zustand";
import {
  createGameState,
  nextTick,
  applyCommand,
  type GameState,
  type GameCommand,
  type Notification,
} from "@farmgame/engine";
import { TICK_INTERVAL_MS } from "@farmgame/shared";

interface GameStore {
  state: GameState | null;
  notifications: Notification[];
  tickInterval: ReturnType<typeof setInterval> | null;

  initGame: () => void;
  dispatch: (command: GameCommand) => void;
  startLoop: () => void;
  stopLoop: () => void;
  addNotification: (notification: Notification) => void;
  clearNotifications: () => void;
  updateSpeed: (speed: 1 | 2 | 3) => void;
}

function intervalForSpeed(speed: 1 | 2 | 3): number {
  switch (speed) {
    case 1: return TICK_INTERVAL_MS;
    case 2: return TICK_INTERVAL_MS / 2;
    case 3: return TICK_INTERVAL_MS / 4;
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  notifications: [],
  tickInterval: null,

  initGame: () => {
    const state = createGameState({ seed: Date.now() });
    set({ state });
    get().startLoop();
  },

  dispatch: (command: GameCommand) => {
    const { state } = get();
    if (!state) return;

    const result = applyCommand(state, command);
    if (result.success) {
      set({
        state: result.state,
        notifications: [...get().notifications, ...result.notifications],
      });
      // If speed changed, restart loop
      if (command.type === "SET_SPEED") {
        get().stopLoop();
        get().startLoop();
      }
    } else {
      set({
        notifications: [
          ...get().notifications,
          { type: "error", message: result.error ?? "Command failed" },
        ],
      });
    }
  },

  startLoop: () => {
    const { tickInterval, state } = get();
    if (tickInterval) return;

    const speed = state?.speed ?? 1;
    const interval = setInterval(() => {
      const { state } = get();
      if (!state) return;

      const result = nextTick(state);
      set({
        state: result.state,
        notifications: [...get().notifications, ...result.notifications],
      });
    }, intervalForSpeed(speed));

    set({ tickInterval: interval });
  },

  stopLoop: () => {
    const { tickInterval } = get();
    if (tickInterval) {
      clearInterval(tickInterval);
      set({ tickInterval: null });
    }
  },

  updateSpeed: (speed: 1 | 2 | 3) => {
    const { dispatch } = get();
    dispatch({ type: "SET_SPEED", speed });
  },

  addNotification: (notification: Notification) => {
    set({ notifications: [...get().notifications, notification] });
  },

  clearNotifications: () => {
    set({ notifications: [] });
  },
}));
