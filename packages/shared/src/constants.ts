/**
 * World geometry — the single source of truth shared by the engine (world
 * generation), the renderer (initial sizing defaults), and any future
 * consumer. Everything downstream of game start should prefer the runtime
 * values on `state.world`; these constants exist so generation and defaults
 * can't drift apart.
 */

/** World dimensions in tiles. */
export const WORLD_SIZE = 48;

/** Plot size in tiles (purchasable land comes in PLOT_SIZE × PLOT_SIZE blocks). */
export const PLOT_SIZE = 8;

/** Number of plots per row/column. */
export const PLOTS_PER_ROW = WORLD_SIZE / PLOT_SIZE; // 6
