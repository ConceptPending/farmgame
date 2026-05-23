import type { GameState, Notification } from "../state.js";
import type { Building } from "../entities/building.js";
import type { Animal, AnimalType } from "../entities/animal.js";
import { ANIMAL_CATALOG } from "../entities/animal.js";
import { nextBool, nextInt, type RngState } from "../rng.js";

/** Feed units of grazing each grass tile in a pen provides per season. */
export const PASTURE_YIELD = 2;
/** A single animal may free at most this fraction of its feed from pasture. */
const PASTURE_CAP = 0.6;
/** Per-type grazing efficiency: weights pasture share. */
const GRAZE_EFFICIENCY: Record<AnimalType, number> = {
  chicken: 1.2,
  sheep: 1.0,
  cow: 0.8,
  pig: 0.5,
};
/** Saving multiplier when a pen contains a feed trough. */
export const FEED_TROUGH_FACTOR = 0.75;
/** Breeding bonus multiplier from a water trough in the pen. */
export const WATER_TROUGH_BREED_BONUS = 1.1;

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
/** Buildings small enough to be passable ground features (animals walk over). */
const PASSABLE_BUILDINGS = new Set(["water_trough", "feed_trough", "road"]);

function isWall(state: GameState, idx: number, byTile: Map<number, Building>): boolean {
  if (state.world.tiles[idx].terrain === "water") return true;
  const b = byTile.get(idx);
  if (!b) return false;
  if (b.type === "fence") return b.condition > FENCE_BREACH;
  if (PASSABLE_BUILDINGS.has(b.type)) return false;
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

/**
 * Connected enclosed region containing `tileIndex` — empty if the tile isn't
 * penned. Flood-fills inward through non-wall tiles; if the flood ever reaches
 * a map border, the outside reaches in and the region isn't enclosed.
 */
export function findPen(
  state: GameState,
  tileIndex: number,
  buildings: Building[] = state.buildings,
): Set<number> {
  const { width, height } = state.world;
  const byTile = buildingByTile(buildings);
  if (isWall(state, tileIndex, byTile)) return new Set();
  const visited = new Set<number>();
  const stack: number[] = [tileIndex];
  while (stack.length) {
    const i = stack.pop()!;
    if (visited.has(i)) continue;
    visited.add(i);
    const x = i % width;
    const y = (i / width) | 0;
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) return new Set();
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      const ni = ny * width + nx;
      if (visited.has(ni)) continue;
      if (isWall(state, ni, byTile)) continue;
      stack.push(ni);
    }
  }
  return visited;
}

/** Per-pen lookup of grass tile counts + which trough buildings sit inside. */
interface PenInfo {
  tiles: Set<number>;
  grass: number;
  hasWaterTrough: boolean;
  hasFeedTrough: boolean;
}

/**
 * Group penned animals by the pen they're in, and tally each pen's grazing
 * grass + amenity buildings. Animals not inside any pen are omitted.
 */
function penIndex(
  state: GameState,
  buildings: Building[] = state.buildings,
): { animalsByPen: Map<PenInfo, Animal[]>; penByTile: Map<number, PenInfo> } {
  const penByTile = new Map<number, PenInfo>();
  const animalsByPen = new Map<PenInfo, Animal[]>();
  for (const a of state.animals) {
    const existing = penByTile.get(a.tileIndex);
    if (existing) {
      animalsByPen.get(existing)!.push(a);
      continue;
    }
    const tiles = findPen(state, a.tileIndex, buildings);
    if (tiles.size === 0) continue;
    let grass = 0;
    let hasWaterTrough = false;
    let hasFeedTrough = false;
    for (const t of tiles) {
      if (state.world.tiles[t].terrain === "grass") grass++;
    }
    for (const b of buildings) {
      if (!tiles.has(b.tileIndex)) continue;
      if (b.type === "water_trough") hasWaterTrough = true;
      else if (b.type === "feed_trough") hasFeedTrough = true;
    }
    const info: PenInfo = { tiles, grass, hasWaterTrough, hasFeedTrough };
    for (const t of tiles) penByTile.set(t, info);
    animalsByPen.set(info, [a]);
  }
  return { animalsByPen, penByTile };
}

/**
 * Per-animal pasture grazing offset (feed units freed by grass in the pen).
 * Distributes each pen's grazing pool proportional to feed-need × type efficiency,
 * capped per animal at PASTURE_CAP of its seasonal feed.
 */
export function pastureGrazingOffset(
  state: GameState,
  buildings: Building[] = state.buildings,
): Map<number, number> {
  const out = new Map<number, number>();
  const { animalsByPen } = penIndex(state, buildings);
  for (const [pen, group] of animalsByPen) {
    if (pen.grass === 0) continue;
    const pool = pen.grass * PASTURE_YIELD;
    const totalWeight = group.reduce(
      (s, a) => s + ANIMAL_CATALOG[a.type].feedPerSeason * GRAZE_EFFICIENCY[a.type],
      0,
    );
    if (totalWeight === 0) continue;
    for (const a of group) {
      const def = ANIMAL_CATALOG[a.type];
      const weight = def.feedPerSeason * GRAZE_EFFICIENCY[a.type];
      const share = (pool * weight) / totalWeight;
      out.set(a.id, Math.min(share, def.feedPerSeason * PASTURE_CAP));
    }
  }
  return out;
}

/** Whether an animal's pen contains a water trough / feed trough. */
export function animalAmenities(
  state: GameState,
  buildings: Building[] = state.buildings,
): Map<number, { water: boolean; feed: boolean }> {
  const out = new Map<number, { water: boolean; feed: boolean }>();
  const { animalsByPen } = penIndex(state, buildings);
  for (const [pen, group] of animalsByPen) {
    for (const a of group) {
      out.set(a.id, { water: pen.hasWaterTrough, feed: pen.hasFeedTrough });
    }
  }
  return out;
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
