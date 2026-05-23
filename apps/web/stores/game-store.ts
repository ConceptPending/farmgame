import { create } from "zustand";
import {
  createGameState,
  applyCommand,
  type GameState,
  type GameCommand,
  type Notification,
  type Season,
  type CreateGameOptions,
} from "@farmgame/engine";
import { playSound } from "../lib/sounds";

/** Notification + the in-game time it fired. Drives the event log timeline. */
export interface StampedNotification extends Notification {
  id: number;
  year: number;
  season: Season;
  /** Position within the season at the time the notification fired (1..3). */
  monthOfSeason: number;
}

/** History cap — older entries get dropped FIFO. Long enough for ~20 minutes of play. */
const NOTIFICATION_HISTORY = 200;

/** Tile-anchored juice event the renderer turns into a particle burst. */
export type FXEventKind = "plant" | "harvest" | "build" | "manure";
export interface FXEvent {
  kind: FXEventKind;
  tileIndex: number;
}

interface GameStore {
  state: GameState | null;
  notifications: StampedNotification[];
  nextNotificationId: number;
  /** Queued juice events; the renderer drains this each frame. */
  fxEvents: FXEvent[];
  /** Config of the current/most-recent game, for "Play Again". */
  lastConfig: CreateGameOptions | null;

  /** Start a new game from a scenario/difficulty config. */
  startGame: (config: CreateGameOptions) => void;
  /** Drop a previously-saved GameState into the store (replaces current game). */
  loadGameState: (state: GameState) => void;
  /** Return to the start screen (state = null). */
  returnToMenu: () => void;
  dispatch: (command: GameCommand) => void;
  /** End the current monthly turn — resolves the month and refreshes labor. */
  endTurn: () => void;
  addNotification: (notification: Notification) => void;
  clearNotifications: () => void;
  /** Drain and clear the queued FX events; the renderer calls this each frame. */
  takeFXEvents: () => FXEvent[];
}

type Get = () => GameStore;
type Set = (partial: Partial<GameStore>) => void;

/** Map a successful command to the tile-anchored FX bursts it should produce. */
function deriveFXEvents(
  command: GameCommand,
  prev: GameState,
  next: GameState,
): FXEvent[] {
  switch (command.type) {
    case "PLANT_FIELD": {
      const field = next.fields.find((f) => f.id === command.fieldId);
      if (!field) return [];
      return field.tileIndices.map((t) => ({ kind: "plant" as const, tileIndex: t }));
    }
    case "HARVEST_FIELD": {
      // The field's tile list is preserved through harvest (state goes back to fallow).
      const field = prev.fields.find((f) => f.id === command.fieldId);
      if (!field) return [];
      return field.tileIndices.map((t) => ({ kind: "harvest" as const, tileIndex: t }));
    }
    case "BUILD":
      return [{ kind: "build", tileIndex: command.tileIndex }];
    case "SPREAD_MANURE": {
      const field = next.fields.find((f) => f.id === command.fieldId);
      if (!field) return [];
      return field.tileIndices.map((t) => ({ kind: "manure" as const, tileIndex: t }));
    }
    default:
      return [];
  }
}

/**
 * Patterns of engine notifications that repeat per-animal in a single tick.
 * Each entry captures the species (and optionally the named individual) so we
 * can collapse N births into one toast instead of flooding the player. The
 * first match wins; non-matching notifications pass through untouched.
 */
interface GroupSpec {
  pattern: RegExp;
  /** Indexes inside the regex match: species at [speciesIdx], optional name at [nameIdx]. */
  speciesIdx: number;
  nameIdx?: number;
  /** Build the collapsed message for `count` matched events of the same species. */
  build: (species: string, count: number, names: string[]) => string;
}

function plural(species: string, n: number): string {
  // The engine uses lowercase common nouns; chicken→chickens, sheep→sheep.
  if (species === "sheep") return "sheep";
  return n === 1 ? species : `${species}s`;
}

const NAMES_LIMIT = 5;
function nameList(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length <= NAMES_LIMIT) return names.join(", ");
  return `${names.slice(0, NAMES_LIMIT).join(", ")}, +${names.length - NAMES_LIMIT} more`;
}

const GROUP_SPECS: GroupSpec[] = [
  {
    // "Cluck the chicken was born!"
    pattern: /^(\w+) the (chicken|pig|sheep|cow) was born!$/,
    speciesIdx: 2,
    nameIdx: 1,
    build: (s, n, names) => `${n} ${plural(s, n)} were born: ${nameList(names)}.`,
  },
  {
    // "A chicken starved for lack of feed."
    pattern: /^A (chicken|pig|sheep|cow) starved for lack of feed\.$/,
    speciesIdx: 1,
    build: (s, n) => `${n} ${plural(s, n)} starved for lack of feed.`,
  },
  {
    // "A chicken died from stress in a cramped pen."
    pattern: /^A (chicken|pig|sheep|cow) died from stress in a cramped pen\.$/,
    speciesIdx: 1,
    build: (s, n) => `${n} ${plural(s, n)} died from stress in cramped pens.`,
  },
  {
    // "A predator took Cluck the chicken."
    pattern: /^A predator took (\w+) the (chicken|pig|sheep|cow)\.$/,
    speciesIdx: 2,
    nameIdx: 1,
    build: (s, n, names) => `${n} ${plural(s, n)} were taken by a predator: ${nameList(names)}.`,
  },
  {
    // "A chicken wandered off through a gap and was lost!"
    pattern: /^A (chicken|pig|sheep|cow) wandered off through a gap and was lost!$/,
    speciesIdx: 1,
    build: (s, n) => `${n} ${plural(s, n)} wandered off and were lost.`,
  },
];

/**
 * Collapse repeated single-event notifications from one tick into one summary
 * line per kind. Singletons pass through. The first occurrence's position in
 * the input array is preserved; later duplicates are removed.
 */
export function groupNotifications(input: Notification[]): Notification[] {
  if (input.length < 2) return input;
  // Bucket key → { firstIndex, type, species, names[] }
  interface Bucket {
    firstIndex: number;
    type: Notification["type"];
    spec: GroupSpec;
    species: string;
    names: string[];
  }
  const buckets = new Map<string, Bucket>();
  const ungrouped: { index: number; n: Notification }[] = [];
  input.forEach((n, i) => {
    for (const spec of GROUP_SPECS) {
      const m = spec.pattern.exec(n.message);
      if (!m) continue;
      const species = m[spec.speciesIdx];
      const key = `${n.type}:${spec.pattern.source}:${species}`;
      let b = buckets.get(key);
      if (!b) {
        b = { firstIndex: i, type: n.type, spec, species, names: [] };
        buckets.set(key, b);
      }
      if (spec.nameIdx) b.names.push(m[spec.nameIdx]);
      return; // matched & bucketed
    }
    ungrouped.push({ index: i, n });
  });
  // Reassemble: place each bucket at its firstIndex, interleaved with ungrouped.
  const collapsed: { index: number; n: Notification }[] = [];
  for (const b of buckets.values()) {
    const count = b.names.length || countMatches(input, b.spec, b.species);
    const message = count === 1
      ? input[b.firstIndex].message // singleton → keep the original phrasing
      : b.spec.build(b.species, count, b.names);
    collapsed.push({ index: b.firstIndex, n: { type: b.type, message } });
  }
  return [...collapsed, ...ungrouped].sort((a, b) => a.index - b.index).map((e) => e.n);
}

function countMatches(input: Notification[], spec: GroupSpec, species: string): number {
  let n = 0;
  for (const m of input) {
    const r = spec.pattern.exec(m.message);
    if (r && r[spec.speciesIdx] === species) n++;
  }
  return n;
}

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
    monthOfSeason: ts?.monthOfSeason ?? 0,
  }));
  const all = [...notifications, ...stamped];
  const trimmed = all.length > NOTIFICATION_HISTORY ? all.slice(all.length - NOTIFICATION_HISTORY) : all;
  set({ notifications: trimmed, nextNotificationId: id });
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  notifications: [],
  nextNotificationId: 1,
  fxEvents: [],
  lastConfig: null,

  startGame: (config: CreateGameOptions) => {
    const state = createGameState({ seed: Date.now(), ...config });
    set({ state, notifications: [], nextNotificationId: 1, fxEvents: [], lastConfig: config });
  },

  loadGameState: (state: GameState) => {
    set({ state, notifications: [], nextNotificationId: 1, fxEvents: [] });
  },

  returnToMenu: () => {
    set({ state: null, notifications: [], nextNotificationId: 1, fxEvents: [] });
  },

  dispatch: (command: GameCommand) => {
    const { state } = get();
    if (!state) return;

    const result = applyCommand(state, command);
    if (result.success) {
      set({ state: result.state });
      pushStamped(get, set, groupNotifications(result.notifications), result.state);
      // Push juice events for the renderer (tile-anchored bursts on player actions).
      const fx = deriveFXEvents(command, state, result.state);
      if (fx.length > 0) set({ fxEvents: [...get().fxEvents, ...fx] });
      // Audio: at most one cue per command (FX events can fan out per-tile but
      // a single tonal blip per player action is what reads as feedback).
      if (fx.length > 0) playSound(fx[0].kind === "manure" ? "build" : fx[0].kind);
      else if (command.type === "SELL" && result.state.money > state.money) playSound("money");
    } else {
      pushStamped(get, set, [{ type: "error", message: result.error ?? "Command failed" }]);
    }
  },

  endTurn: () => {
    get().dispatch({ type: "END_TURN" });
  },

  addNotification: (notification: Notification) => {
    pushStamped(get, set, [notification]);
  },

  clearNotifications: () => {
    set({ notifications: [] });
  },

  takeFXEvents: () => {
    const { fxEvents } = get();
    if (fxEvents.length === 0) return [];
    set({ fxEvents: [] });
    return fxEvents;
  },
}));

// Debug/automation hook: lets the playtest harness drive the real game.
if (typeof window !== "undefined") {
  (window as unknown as { farmStore?: typeof useGameStore }).farmStore = useGameStore;
}
