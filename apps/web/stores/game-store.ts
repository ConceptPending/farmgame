import { create } from "zustand";
import {
  createGameState,
  nextTick,
  applyCommand,
  type GameState,
  type GameCommand,
  type Notification,
  type Season,
  type CreateGameOptions,
} from "@farmgame/engine";
import { TICK_INTERVAL_MS } from "@farmgame/shared";

/** Notification + the in-game time it fired. Drives the event log timeline. */
export interface StampedNotification extends Notification {
  id: number;
  year: number;
  season: Season;
  day: number;
}

/** History cap — older entries get dropped FIFO. Long enough for ~20 minutes of play. */
const NOTIFICATION_HISTORY = 200;

interface GameStore {
  state: GameState | null;
  notifications: StampedNotification[];
  nextNotificationId: number;
  tickInterval: ReturnType<typeof setInterval> | null;
  /** Whether the game is auto-advancing on a timer (vs. manual stepping). */
  autoplay: boolean;
  /** When auto-advancing, stop on the first noteworthy event so the player can react. */
  autoPauseOnEvents: boolean;
  /** Config of the current/most-recent game, for "Play Again". */
  lastConfig: CreateGameOptions | null;

  /** Start a new game from a scenario/difficulty config. */
  startGame: (config: CreateGameOptions) => void;
  /** Return to the start screen (state = null). */
  returnToMenu: () => void;
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
  /ready to harvest|killed|has died|died from|infestation|overrun|prices crashing|demand surging|has arrived|Locust|Hailstorm|Blight|bumper|subsidy|inheritance|breakdown|closing in on the goal|is running low/i;

function isStopWorthy(n: Notification): boolean {
  return n.type === "error" || STOP_WORTHY.test(n.message);
}

type Get = () => GameStore;
type Set = (partial: Partial<GameStore>) => void;

/** Append `newOnes` to the notifications log, stamped with the game time from
 *  `stampState` (or the current store state if not provided). Caps at
 *  NOTIFICATION_HISTORY entries, dropping the oldest first. */
function pushStamped(get: Get, set: Set, newOnes: Notification[], stampState?: GameState | null): void {
  if (newOnes.length === 0) return;
  const { notifications, nextNotificationId, state } = get();
  const ts = stampState ?? state;
  let id = nextNotificationId;
  const stamped: StampedNotification[] = newOnes.map((n) => ({
    ...n,
    id: id++,
    year: ts?.year ?? 0,
    season: ts?.season ?? "spring",
    day: ts?.day ?? 0,
  }));
  const all = [...notifications, ...stamped];
  const trimmed = all.length > NOTIFICATION_HISTORY ? all.slice(all.length - NOTIFICATION_HISTORY) : all;
  set({ notifications: trimmed, nextNotificationId: id });
}

/** Advance the simulation one tick and append any notifications. Returns the new notifications. */
function runTick(get: Get, set: Set): Notification[] {
  const { state } = get();
  if (!state) return [];
  const result = nextTick(state);
  set({ state: result.state });
  pushStamped(get, set, result.notifications, result.state);
  return result.notifications;
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  notifications: [],
  nextNotificationId: 1,
  tickInterval: null,
  // Turn-based by default: the player advances time with the STEP controls.
  // Autoplay is the optional mode, toggled from the HUD.
  autoplay: false,
  autoPauseOnEvents: true,
  lastConfig: null,

  startGame: (config: CreateGameOptions) => {
    get().stopLoop();
    const state = createGameState({ seed: Date.now(), ...config });
    set({ state, notifications: [], nextNotificationId: 1, lastConfig: config });
    if (get().autoplay) get().startLoop();
  },

  returnToMenu: () => {
    get().stopLoop();
    set({ state: null, notifications: [], nextNotificationId: 1 });
  },

  dispatch: (command: GameCommand) => {
    const { state } = get();
    if (!state) return;

    const result = applyCommand(state, command);
    if (result.success) {
      set({ state: result.state });
      pushStamped(get, set, result.notifications, result.state);
      // If speed changed while auto-advancing, restart the loop at the new cadence.
      if (command.type === "SET_SPEED" && get().autoplay) {
        get().stopLoop();
        get().startLoop();
      }
    } else {
      pushStamped(get, set, [{ type: "error", message: result.error ?? "Command failed" }]);
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
    pushStamped(get, set, [notification]);
  },

  clearNotifications: () => {
    set({ notifications: [] });
  },
}));

// Debug/automation hook: lets the playtest harness drive the real game.
if (typeof window !== "undefined") {
  (window as unknown as { farmStore?: typeof useGameStore }).farmStore = useGameStore;
}
