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
  /** Whether the game is auto-advancing on a timer (vs. manual stepping). */
  autoplay: boolean;
  /** When auto-advancing, stop on the first noteworthy event so the player can react. */
  autoPauseOnEvents: boolean;

  initGame: () => void;
  dispatch: (command: GameCommand) => void;
  startLoop: () => void;
  stopLoop: () => void;
  setAutoplay: (on: boolean) => void;
  toggleAutoplay: () => void;
  setAutoPauseOnEvents: (on: boolean) => void;
  /** Manually advance the simulation by n days (turn-based stepping). */
  advanceDays: (days: number) => void;
  /** Fast-forward up to maxDays, stopping early on the first noteworthy event. */
  advanceToEvent: (maxDays?: number) => void;
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

// Cap on a single "skip to event" so a quiet farm can't loop indefinitely (~4 months).
const MAX_SKIP_DAYS = 120;

// Events worth stopping for: crop ready/lost, field crises, market swings,
// random events, and season changes. Deliberately excludes routine weather
// warnings (frost/storm/drought happen often and may not threaten crops) and
// seasonal expense notices (every season — too noisy).
const STOP_WORTHY =
  /ready to harvest|killed|has died|died from|infestation|overrun|prices crashing|demand surging|has arrived|Locust|Hailstorm|Blight|bumper|subsidy|inheritance|breakdown/i;

function isStopWorthy(n: Notification): boolean {
  return n.type === "error" || STOP_WORTHY.test(n.message);
}

type Get = () => GameStore;
type Set = (partial: Partial<GameStore>) => void;

/** Advance the simulation one tick and append any notifications. Returns the new notifications. */
function runTick(get: Get, set: Set): Notification[] {
  const { state, notifications } = get();
  if (!state) return [];
  const result = nextTick(state);
  set({
    state: result.state,
    notifications: [...notifications, ...result.notifications],
  });
  return result.notifications;
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  notifications: [],
  tickInterval: null,
  // Turn-based by default: the player advances time with the STEP controls.
  // Autoplay is the optional mode, toggled from the HUD.
  autoplay: false,
  autoPauseOnEvents: true,

  initGame: () => {
    get().stopLoop();
    const state = createGameState({ seed: Date.now() });
    set({ state, notifications: [] });
    if (get().autoplay) get().startLoop();
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
      // If speed changed while auto-advancing, restart the loop at the new cadence.
      if (command.type === "SET_SPEED" && get().autoplay) {
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
      const newNotifications = runTick(get, set);
      // Stop the timer when the game ends, or auto-pause on a noteworthy event.
      if (get().state?.status !== "playing") {
        get().setAutoplay(false);
      } else if (get().autoPauseOnEvents && newNotifications.some(isStopWorthy)) {
        get().setAutoplay(false);
      }
    }, intervalForSpeed(speed));

    set({ tickInterval: interval, autoplay: true });
  },

  stopLoop: () => {
    const { tickInterval } = get();
    if (tickInterval) {
      clearInterval(tickInterval);
    }
    set({ tickInterval: null, autoplay: false });
  },

  setAutoplay: (on: boolean) => {
    if (on) get().startLoop();
    else get().stopLoop();
  },

  toggleAutoplay: () => {
    get().setAutoplay(!get().autoplay);
  },

  setAutoPauseOnEvents: (on: boolean) => {
    set({ autoPauseOnEvents: on });
  },

  advanceDays: (days: number) => {
    // Manual stepping implies turn-based control: pause any running timer first.
    get().stopLoop();
    for (let i = 0; i < days; i++) {
      if (get().state?.status !== "playing") break;
      runTick(get, set);
    }
  },

  advanceToEvent: (maxDays: number = MAX_SKIP_DAYS) => {
    get().stopLoop();
    for (let i = 0; i < maxDays; i++) {
      if (get().state?.status !== "playing") break;
      const newNotifications = runTick(get, set);
      if (newNotifications.some(isStopWorthy)) break;
    }
  },

  updateSpeed: (speed: 1 | 2 | 3) => {
    get().dispatch({ type: "SET_SPEED", speed });
  },

  addNotification: (notification: Notification) => {
    set({ notifications: [...get().notifications, notification] });
  },

  clearNotifications: () => {
    set({ notifications: [] });
  },
}));
