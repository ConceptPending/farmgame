import type { GameState, Notification } from "../state.js";
import type { Building } from "../entities/building.js";
import type { Animal } from "../entities/animal.js";
import { ANIMAL_CATALOG } from "../entities/animal.js";
import { nextBool, nextInt, type RngState } from "../rng.js";

/** A fence with condition at or below this no longer blocks — it's a gap. */
export const FENCE_BREACH = 0.35;
/** Fence condition lost per season in clear weather (harsh weather scales up). */
export const FENCE_DECAY = 0.05;
/** Per-season chance a loose animal wanders to an adjacent tile. */
const ESCAPE_WANDER_CHANCE = 0.5;

/** Weather multiplier on fence wear. */
function decayFactor(condition: string): number {
  if (condition === "storm") return 2.2;
  if (condition === "frost") return 1.6;
  if (condition === "drought") return 1.3;
  return 1;
}

function buildingByTile(buildings: Building[]): Map<number, Building> {
  const m = new Map<number, Building>();
  for (const b of buildings) m.set(b.tileIndex, b);
  return m;
}

/**
 * A tile blocks animal movement (and the enclosure flood) when it holds water,
 * a non-fence building, or a fence still in good repair. A fence worn past
 * FENCE_BREACH is a gap and no longer contains.
 */
function isWall(state: GameState, idx: number, byTile: Map<number, Building>): boolean {
  if (state.world.tiles[idx].terrain === "water") return true;
  const b = byTile.get(idx);
  if (!b) return false;
  if (b.type === "fence") return b.condition > FENCE_BREACH;
  return true;
}

/**
 * Tiles that sit inside a pen: open tiles the outside world can't reach without
 * crossing a wall. Found by flooding inward from every map border through
 * passable tiles — anything the flood never touches is enclosed.
 */
export function pennedTiles(state: GameState, buildings: Building[] = state.buildings): Set<number> {
  const { width, height, tiles } = state.world;
  const n = tiles.length;
  const byTile = buildingByTile(buildings);
  const wall = new Uint8Array(n);
  for (let i = 0; i < n; i++) wall[i] = isWall(state, i, byTile) ? 1 : 0;

  const outside = new Uint8Array(n);
  const stack: number[] = [];
  const visit = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (wall[i] || outside[i]) return;
    outside[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < width; x++) {
    visit(x, 0);
    visit(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    visit(0, y);
    visit(width - 1, y);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % width;
    const y = (i / width) | 0;
    visit(x - 1, y);
    visit(x + 1, y);
    visit(x, y - 1);
    visit(x, y + 1);
  }

  const penned = new Set<number>();
  for (let i = 0; i < n; i++) if (!wall[i] && !outside[i]) penned.add(i);
  return penned;
}

/** Pick a random in-bounds, passable neighbor of a tile (or null if boxed in). */
function wanderTarget(
  state: GameState,
  idx: number,
  byTile: Map<number, Building>,
  rng: RngState,
): { tile: number | null; rng: RngState } {
  const { width, height } = state.world;
  const x = idx % width;
  const y = (idx / width) | 0;
  const cand: number[] = [];
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    const ni = ny * width + nx;
    if (isWall(state, ni, byTile)) continue;
    cand.push(ni);
  }
  if (cand.length === 0) return { tile: null, rng };
  const r = nextInt(rng, 0, cand.length - 1);
  return { tile: cand[r.value], rng: r.rng };
}

/**
 * Pen system. Each season fences wear down (faster in harsh weather); a fence
 * worn past breaching opens its enclosure. Animals on penned tiles stay put;
 * loose animals wander and, if they drift onto unowned land, are lost.
 *
 * Consumes no RNG (and makes no change) when there are no animals and no
 * fences, so games without livestock stay byte-for-byte identical.
 */
export function penSystem(state: GameState): { state: GameState; notifications: Notification[] } {
  const hasFences = state.buildings.some((b) => b.type === "fence");
  if (state.animals.length === 0 && !hasFences) {
    return { state, notifications: [] };
  }

  const notifications: Notification[] = [];
  const seasonStart = state.day === 1;

  // Fence wear.
  let buildings = state.buildings;
  if (seasonStart && hasFences) {
    const decay = FENCE_DECAY * decayFactor(state.weather.condition);
    buildings = buildings.map((b) =>
      b.type === "fence" ? { ...b, condition: Math.max(0, b.condition - decay) } : b,
    );
  }

  // Escape — only loose (un-penned) animals are at risk, so a maintained pen
  // consumes no RNG here.
  let animals = state.animals;
  let rng = state.rng;
  if (animals.length > 0 && seasonStart) {
    const penned = pennedTiles(state, buildings);
    const byTile = buildingByTile(buildings);
    const survivors: Animal[] = [];
    let lost = 0;
    for (const a of animals) {
      if (penned.has(a.tileIndex)) {
        survivors.push(a);
        continue;
      }
      const roll = nextBool(rng, ESCAPE_WANDER_CHANCE);
      rng = roll.rng;
      if (!roll.value) {
        survivors.push(a);
        continue;
      }
      const dest = wanderTarget(state, a.tileIndex, byTile, rng);
      rng = dest.rng;
      if (dest.tile === null) {
        survivors.push(a);
        continue;
      }
      if (state.world.tiles[dest.tile].owned) {
        survivors.push({ ...a, tileIndex: dest.tile });
      } else {
        lost++;
        notifications.push({
          type: "warning",
          message: `A ${ANIMAL_CATALOG[a.type].name.toLowerCase()} wandered off through a gap and was lost!`,
        });
      }
    }
    animals = survivors;
    if (lost === 0) {
      // Warn once if any animals are loose in an open pen, before they're lost.
      const loose = animals.filter((a) => !penned.has(a.tileIndex)).length;
      if (loose > 0) {
        notifications.push({
          type: "warning",
          message: `${loose} animal${loose > 1 ? "s are" : " is"} loose — repair your pen fences before they wander off.`,
        });
      }
    }
  }

  return { state: { ...state, buildings, animals, rng }, notifications };
}
