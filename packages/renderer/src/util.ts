/** Tiny deterministic RNG (Mulberry32) for stable cosmetic scatter — tile
 *  noise, season overlays. Renderer-local: never feeds back into the engine. */
export function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable per-tile-index hash so cosmetic placement doesn't flicker between
 *  repaints. (TerrainLayer keeps its own (x, y) variant — different mix,
 *  changing it would reshuffle every existing tile's noise.) */
export function tileHash(idx: number): number {
  let h = Math.imul(idx ^ 0x9e3779b9, 2654435761) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}
