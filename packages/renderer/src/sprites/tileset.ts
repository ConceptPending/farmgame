import { Graphics, RenderTexture, Texture, Rectangle, type Application } from "pixi.js";
import { ALL_CROP_IDS } from "@farmgame/engine";
import { CROP_VISUALS, type CropVisual } from "./crop-sprites.js";

export const TILE_SIZE = 16;
const SHEET_COLS = 16;
const SHEET_ROWS = 10;

/** Sheet rows that hold per-crop sprites (4 growth stages × 4 crops per row). */
const CROP_ROWS = [6, 7, 8, 9];

/** Sprite indices in the tileset. */
export const SPRITES = {
  // Terrain (row 0)
  grass1: { col: 0, row: 0 },
  grass2: { col: 1, row: 0 },
  grass3: { col: 2, row: 0 },
  dirt: { col: 3, row: 0 },
  tilled: { col: 4, row: 0 },
  water1: { col: 5, row: 0 },
  water2: { col: 6, row: 0 },
  forest: { col: 7, row: 0 },
  rock: { col: 8, row: 0 },
  road: { col: 9, row: 0 },
  grass4: { col: 10, row: 0 },
  dirt2: { col: 11, row: 0 },
  water3: { col: 12, row: 0 },
  grass_flower: { col: 13, row: 0 },
  grass_pebble: { col: 14, row: 0 },
  fallow: { col: 15, row: 0 },

  // Generic dead crop (any crop type). Per-crop living sprites are generated
  // dynamically into rows 6-9 (see CROP_ROWS) and keyed crop_<id>_<stage>.
  dead_crop: { col: 0, row: 1 },
  // Soil-condition variants of tilled, picked by terrain.ts based on per-field
  // moisture / weed pressure so the map reflects field state without UI.
  tilled_dry: { col: 1, row: 1 },
  tilled_weedy: { col: 2, row: 1 },

  // Buildings (row 3)
  silo: { col: 0, row: 3 },
  water_pump: { col: 1, row: 3 },
  windmill: { col: 2, row: 3 },
  irrigation: { col: 3, row: 3 },
  fence: { col: 4, row: 3 },
  barn: { col: 5, row: 3 },
  water_trough: { col: 6, row: 3 },
  feed_trough: { col: 7, row: 3 },

  // Fence connectivity variants (row 2). 16 sprites keyed by a 4-bit
  // neighbour mask: bit 0 = N, 1 = E, 2 = S, 3 = W. Each variant draws
  // a central post plus rail stubs extending only toward neighbours
  // that are also fences, so adjacent fences read as a continuous
  // fence line. The legacy `fence` sprite above stays for the building
  // catalog icon; the live map uses these.
  fence_0:  { col: 0,  row: 2 }, fence_1:  { col: 1,  row: 2 },
  fence_2:  { col: 2,  row: 2 }, fence_3:  { col: 3,  row: 2 },
  fence_4:  { col: 4,  row: 2 }, fence_5:  { col: 5,  row: 2 },
  fence_6:  { col: 6,  row: 2 }, fence_7:  { col: 7,  row: 2 },
  fence_8:  { col: 8,  row: 2 }, fence_9:  { col: 9,  row: 2 },
  fence_10: { col: 10, row: 2 }, fence_11: { col: 11, row: 2 },
  fence_12: { col: 12, row: 2 }, fence_13: { col: 13, row: 2 },
  fence_14: { col: 14, row: 2 }, fence_15: { col: 15, row: 2 },

  // Weather icons (row 4)
  weather_clear: { col: 0, row: 4 },
  weather_cloudy: { col: 1, row: 4 },
  weather_rain: { col: 2, row: 4 },
  weather_storm: { col: 3, row: 4 },
  weather_frost: { col: 4, row: 4 },
  weather_drought: { col: 5, row: 4 },

  // Animals (row 5)
  animal_chicken: { col: 0, row: 5 },
  animal_pig: { col: 1, row: 5 },
  animal_sheep: { col: 2, row: 5 },
  animal_cow: { col: 3, row: 5 },
} as const;

const textureCache = new Map<string, Texture>();

/** Generate and cache all tile textures programmatically. */
export async function generateTileset(app: Application): Promise<void> {
  const w = SHEET_COLS * TILE_SIZE;
  const h = SHEET_ROWS * TILE_SIZE;
  const g = new Graphics();

  // --- Row 0: Terrain (seed varies the noise pattern per variant) ---
  drawGrass(g, 0, 0, 0x4a8c3f, 11); // grass1
  drawGrass(g, 1, 0, 0x3d7a34, 29); // grass2
  drawGrass(g, 2, 0, 0x56994a, 47); // grass3
  drawDirt(g, 3, 0, 0x8b7355, 7); // dirt
  drawTilledSoil(g, 4, 0);
  drawWater(g, 5, 0, 0x3498db, 5); // water1
  drawWater(g, 6, 0, 0x2980b9, 13); // water2
  drawForest(g, 7, 0);
  drawRock(g, 8, 0);
  drawRoad(g, 9, 0);
  drawGrass(g, 10, 0, 0x4f9143, 83); // grass4
  drawDirt(g, 11, 0, 0x877052, 23); // dirt2 (kept close to dirt to avoid patchiness)
  drawWater(g, 12, 0, 0x3093cf, 37); // water3
  drawGrassFlower(g, 13, 0, 0x4a8c3f, 101); // sparse meadow flowers
  drawGrassPebble(g, 14, 0, 0x4a8c3f, 137); // sparse stones
  drawFallow(g, 15, 0); // fallow field — dirt + weedy tufts

  // --- Row 1: Dead crop (generic) ---
  drawDeadCrop(g, 0, 1);
  drawTilledDry(g, 1, 1);
  drawTilledWeedy(g, 2, 1);

  // --- Rows 6-9: per-crop sprites, 4 growth stages each ---
  ALL_CROP_IDS.forEach((id, k) => {
    const v = CROP_VISUALS[id];
    const row = CROP_ROWS[Math.floor(k / 4)];
    const colBase = (k % 4) * 4;
    for (let stage = 0; stage < 4; stage++) drawCrop(g, colBase + stage, row, stage, v);
  });

  // --- Row 3: Buildings ---
  drawSilo(g, 0, 3);
  drawWaterPump(g, 1, 3);
  drawWindmill(g, 2, 3);
  drawIrrigation(g, 3, 3);
  drawFence(g, 4, 3);
  drawBarn(g, 5, 3);
  drawWaterTrough(g, 6, 3);
  drawFeedTrough(g, 7, 3);

  // --- Row 2: 16 fence connectivity variants ---
  for (let mask = 0; mask < 16; mask++) {
    drawFenceVariant(g, mask, 2, mask);
  }

  // --- Row 4: Weather icons ---
  drawWeatherClear(g, 0, 4);
  drawWeatherCloudy(g, 1, 4);
  drawWeatherRain(g, 2, 4);
  drawWeatherStorm(g, 3, 4);
  drawWeatherFrost(g, 4, 4);
  drawWeatherDrought(g, 5, 4);

  // --- Row 5: Animals ---
  drawChicken(g, 0, 5);
  drawPig(g, 1, 5);
  drawSheep(g, 2, 5);
  drawCow(g, 3, 5);

  // Render to texture
  const rt = RenderTexture.create({ width: w, height: h });
  app.renderer.render({ container: g, target: rt });

  // Cut individual textures (static sprites)
  for (const [key, pos] of Object.entries(SPRITES)) {
    const frame = new Rectangle(pos.col * TILE_SIZE, pos.row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    const tex = new Texture({ source: rt.source, frame });
    textureCache.set(key, tex);
  }

  // Cut per-crop textures, keyed crop_<id>_<stage>.
  ALL_CROP_IDS.forEach((id, k) => {
    const row = CROP_ROWS[Math.floor(k / 4)];
    const colBase = (k % 4) * 4;
    for (let stage = 0; stage < 4; stage++) {
      const frame = new Rectangle((colBase + stage) * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      textureCache.set(`crop_${id}_${stage}`, new Texture({ source: rt.source, frame }));
    }
  });

  g.destroy();
}

export function getTileTexture(key: string): Texture {
  return textureCache.get(key) ?? Texture.WHITE;
}

// --- Drawing helpers ---

/** Tiny deterministic RNG so each tile variant scatters its noise repeatably. */
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Soft contact shadow: a translucent black ellipse beneath an object. Shadows
 * are baked into the (transparent-background) sprite, so they darken whatever
 * terrain the object sits on. A consistent light from the top-left means every
 * shadow sits slightly low-and-right of its object for a cohesive sense of depth.
 */
function softShadow(g: Graphics, cx: number, cy: number, rw: number, rh: number) {
  g.ellipse(cx, cy, rw, rh).fill({ color: 0x000000, alpha: 0.22 });
  g.ellipse(cx, cy, rw * 0.6, rh * 0.6).fill({ color: 0x000000, alpha: 0.16 });
}

/** Scatter single-pixel noise across a tile in lighter/darker shades of base. */
function scatterNoise(
  g: Graphics,
  x: number,
  y: number,
  rnd: () => number,
  base: number,
  count: number,
  lightAmt: number,
  darkAmt: number,
) {
  for (let i = 0; i < count; i++) {
    const px = Math.floor(rnd() * TILE_SIZE);
    const py = Math.floor(rnd() * TILE_SIZE);
    const shade = rnd() < 0.5 ? lighten(base, lightAmt) : darken(base, darkAmt);
    g.rect(x + px, y + py, 1, 1).fill(shade);
  }
}

function drawGrass(g: Graphics, col: number, row: number, color: number, seed: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  const rnd = seededRng(seed);
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(color);
  // Tonal noise so a field of grass isn't one flat color.
  scatterNoise(g, x, y, rnd, color, 26, 0.1, 0.14);
  // A handful of scattered blade tufts at varied positions/heights.
  const dark = darken(color, 0.28);
  const light = lighten(color, 0.16);
  for (let i = 0; i < 7; i++) {
    const bx = 1 + Math.floor(rnd() * 14);
    const by = 6 + Math.floor(rnd() * 7);
    const h = 2 + Math.floor(rnd() * 3);
    g.rect(x + bx, y + by, 1, h).fill(dark);
    g.rect(x + bx + 1, y + by - 1, 1, h).fill(light);
  }
}

function drawGrassFlower(g: Graphics, col: number, row: number, color: number, seed: number) {
  drawGrass(g, col, row, color, seed);
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  const rnd = seededRng(seed + 911);
  const petals = [0xffffff, 0xffe04a, 0xff7eb0, 0xb39ddb];
  for (let i = 0; i < 3; i++) {
    const fx = 3 + Math.floor(rnd() * 10);
    const fy = 3 + Math.floor(rnd() * 9);
    const c = petals[Math.floor(rnd() * petals.length)];
    g.rect(x + fx - 1, y + fy, 3, 1).fill(c); // petals (+ shape)
    g.rect(x + fx, y + fy - 1, 1, 3).fill(c);
    g.rect(x + fx, y + fy, 1, 1).fill(0xffd24a); // center
  }
}

function drawGrassPebble(g: Graphics, col: number, row: number, color: number, seed: number) {
  drawGrass(g, col, row, color, seed);
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  const rnd = seededRng(seed + 733);
  for (let i = 0; i < 3; i++) {
    const px = 2 + Math.floor(rnd() * 11);
    const py = 4 + Math.floor(rnd() * 9);
    g.rect(x + px, y + py, 2, 2).fill(0x9a9a8e); // stone
    g.rect(x + px, y + py, 1, 1).fill(0xc4c4b6); // highlight
  }
}

function drawDirt(g: Graphics, col: number, row: number, color: number, seed: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  const rnd = seededRng(seed);
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(color);
  // Fine speckle so bare soil reads as earth, not a flat brown block.
  scatterNoise(g, x, y, rnd, color, 40, 0.09, 0.16);
  // A few small clods (2x2) and pebbles for surface relief.
  for (let i = 0; i < 5; i++) {
    const cx = Math.floor(rnd() * (TILE_SIZE - 2));
    const cy = Math.floor(rnd() * (TILE_SIZE - 2));
    g.rect(x + cx, y + cy, 2, 2).fill(darken(color, 0.22));
    g.rect(x + cx, y + cy, 1, 1).fill(lighten(color, 0.14));
  }
}

function drawFallow(g: Graphics, col: number, row: number) {
  // Use the same dirt base for continuity with clean dirt, then scatter little
  // weed tufts so a resting field reads as overgrown rather than freshly tilled.
  drawDirt(g, col, row, 0x8b7355, 211);
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  const rnd = seededRng(431);
  for (let i = 0; i < 4; i++) {
    const wx = 2 + Math.floor(rnd() * 12);
    const wy = 3 + Math.floor(rnd() * 11);
    // 3-pixel L-shaped tuft + a brighter highlight blade.
    g.rect(x + wx, y + wy, 1, 2).fill(0x5a8a3e);
    g.rect(x + wx - 1, y + wy + 1, 1, 1).fill(0x4a7330);
    g.rect(x + wx + 1, y + wy, 1, 1).fill(0x6fa552);
  }
  // A small dry leaf or two for variety.
  for (let i = 0; i < 2; i++) {
    const lx = 2 + Math.floor(rnd() * 12);
    const ly = 2 + Math.floor(rnd() * 12);
    g.rect(x + lx, y + ly, 2, 1).fill(0x7a5a36);
  }
}

function drawTilledSoil(g: Graphics, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  const base = 0x6b4a2c;
  const rnd = seededRng(3);
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(base);
  // Raised furrow ridges with shaded troughs between them.
  for (let i = 1; i < TILE_SIZE; i += 3) {
    g.rect(x, y + i, TILE_SIZE, 1).fill(lighten(base, 0.12)); // ridge top
    g.rect(x, y + i + 1, TILE_SIZE, 1).fill(darken(base, 0.2)); // shadow trough
  }
  scatterNoise(g, x, y, rnd, base, 14, 0.08, 0.18);
}

/** Tilled soil that's dried out — paler base, weaker ridges, scattered cracks. */
function drawTilledDry(g: Graphics, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  const base = 0x826142; // warmer + paler than the moist baseline
  const rnd = seededRng(17);
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(base);
  // Furrows are faint — the moisture that lifts them is gone.
  for (let i = 1; i < TILE_SIZE; i += 3) {
    g.rect(x, y + i, TILE_SIZE, 1).fill(lighten(base, 0.06));
    g.rect(x, y + i + 1, TILE_SIZE, 1).fill(darken(base, 0.12));
  }
  scatterNoise(g, x, y, rnd, base, 18, 0.05, 0.14);
  // A few dark "crack" segments scattered across the surface.
  const crackColor = darken(base, 0.5);
  for (let i = 0; i < 5; i++) {
    const cx = 1 + Math.floor(rnd() * (TILE_SIZE - 4));
    const cy = 2 + Math.floor(rnd() * (TILE_SIZE - 4));
    const horizontal = rnd() < 0.5;
    if (horizontal) g.rect(x + cx, y + cy, 3 + Math.floor(rnd() * 2), 1).fill(crackColor);
    else g.rect(x + cx, y + cy, 1, 3 + Math.floor(rnd() * 2)).fill(crackColor);
  }
}

/** Tilled soil overrun with weeds — base + small green tufts poking through. */
function drawTilledWeedy(g: Graphics, col: number, row: number) {
  // Start from the standard moist tilled look so it still reads as cultivated.
  drawTilledSoil(g, col, row);
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  const rnd = seededRng(67);
  // 5-7 small green tufts scattered across the furrows.
  for (let i = 0; i < 6; i++) {
    const wx = 2 + Math.floor(rnd() * 12);
    const wy = 3 + Math.floor(rnd() * 11);
    g.rect(x + wx, y + wy, 1, 2).fill({ color: 0x5a8a3e, alpha: 0.95 });
    g.rect(x + wx - 1, y + wy + 1, 1, 1).fill({ color: 0x4a7330, alpha: 0.9 });
    g.rect(x + wx + 1, y + wy, 1, 1).fill({ color: 0x6fa552, alpha: 0.85 });
  }
}

function drawWater(g: Graphics, col: number, row: number, color: number, seed: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  const rnd = seededRng(seed);
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(color);
  // Subtle depth banding.
  g.rect(x, y + 6, TILE_SIZE, 4).fill(darken(color, 0.1));
  g.rect(x, y + 12, TILE_SIZE, 4).fill(darken(color, 0.16));
  // Scattered wave highlights (short light dashes at varied rows).
  const hi = lighten(color, 0.32);
  for (let i = 0; i < 4; i++) {
    const wx = 1 + Math.floor(rnd() * 10);
    const wy = 2 + Math.floor(rnd() * 12);
    const len = 2 + Math.floor(rnd() * 3);
    g.rect(x + wx, y + wy, len, 1).fill(hi);
  }
}

function drawForest(g: Graphics, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(0x2d5a1e);
  // Tree trunk
  g.rect(x + 7, y + 10, 2, 4).fill(0x5c3a1e);
  // Tree canopy (triangle-ish)
  g.circle(x + 8, y + 7, 5).fill(0x1e7a1e);
  g.circle(x + 6, y + 8, 3).fill(0x267a26);
}

function drawRock(g: Graphics, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(0x6b7b3a);
  // Rock shape
  g.circle(x + 8, y + 9, 5).fill(0x808080);
  g.circle(x + 8, y + 8, 4).fill(0x999999);
  g.rect(x + 5, y + 5, 2, 1).fill(0xbbbbbb); // highlight
}

function drawRoad(g: Graphics, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(0x706050);
  // Center line
  g.rect(x + 7, y + 1, 2, 3).fill(0x999978);
  g.rect(x + 7, y + 7, 2, 3).fill(0x999978);
  g.rect(x + 7, y + 13, 2, 3).fill(0x999978);
}

// Crop sprites are drawn with transparent backgrounds (no soil fill) so the
// tilled-soil furrows of the field tile beneath show through — planted rows
// then read as crops growing in worked earth. Two staggered plants per tile
// give row-like coverage, and each crop has its own silhouette + ripening
// payoff (golden heads, cobs, gourds, berries, …) via an archetype dispatcher.
// stage: 0 seedling · 1 young · 2 mature · 3 ready.

const STEM = 0x4f9a3e;
const STEM_DARK = 0x3c7a2f;

function drawCrop(g: Graphics, col: number, row: number, stage: number, v: CropVisual) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  for (const ox of [4, 10]) softShadow(g, x + ox + 1, y + 14, 2.8 + stage * 0.2, 1.1 + stage * 0.1);
  if (stage === 0) {
    // Seedlings look alike for every crop: two tiny sprouts.
    for (const ox of [4, 10]) {
      g.rect(x + ox, y + 11, 1, 3).fill(STEM);
      g.rect(x + ox - 1, y + 10, 1, 2).fill(0x6cc659);
      g.rect(x + ox + 1, y + 10, 1, 2).fill(0x6cc659);
    }
    return;
  }
  for (const ox of [4, 10]) drawPlant(g, x, y, ox, stage, v);
}

/** One plant of a crop at column offset `ox`, branching on the crop archetype. */
function drawPlant(g: Graphics, x: number, y: number, ox: number, stage: number, v: CropVisual) {
  const p = v.primary;
  const leaf = v.accent;
  switch (v.kind) {
    case "grain": {
      const top = stage === 1 ? y + 8 : y + 4;
      g.rect(x + ox, top, 1, y + 14 - top).fill(STEM);
      g.rect(x + ox - 2, top + 4, 2, 1).fill(STEM);
      if (stage === 2) g.rect(x + ox - 1, top - 1, 3, 3).fill(lighten(p, 0.2));
      if (stage === 3) {
        g.rect(x + ox - 1, top - 2, 3, 5).fill(p);
        g.rect(x + ox, top - 3, 1, 2).fill(p);
        g.rect(x + ox - 2, top, 1, 1).fill(lighten(p, 0.25));
        g.rect(x + ox + 2, top + 1, 1, 1).fill(lighten(p, 0.25));
      }
      break;
    }
    case "corn": {
      const top = stage === 1 ? y + 8 : y + 3;
      g.rect(x + ox, top, 2, y + 14 - top).fill(STEM);
      g.rect(x + ox - 2, top + 4, 2, 1).fill(STEM);
      g.rect(x + ox + 2, top + 6, 2, 1).fill(STEM);
      if (stage >= 2) g.rect(x + ox + 2, top + 2, 2, 4).fill(stage === 3 ? p : 0xbfd98a); // cob
      if (stage === 3) g.rect(x + ox, top - 2, 2, 2).fill(0xe8d97a); // tassel
      break;
    }
    case "sunflower": {
      const top = stage === 1 ? y + 8 : y + 3;
      g.rect(x + ox, top, 1, y + 14 - top).fill(STEM);
      g.rect(x + ox - 2, top + 5, 2, 1).fill(STEM);
      if (stage === 2) g.circle(x + ox, top, 2).fill(0x8fbf5a);
      if (stage === 3) {
        g.circle(x + ox, top - 1, 3).fill(p);
        g.circle(x + ox, top - 1, 1.4).fill(0x6b4a2c);
      }
      break;
    }
    case "leafy": {
      const cy = stage === 1 ? y + 11 : y + 9;
      const r = stage === 1 ? 2 : stage === 2 ? 2.8 : 3.3;
      g.circle(x + ox, cy, r).fill(p);
      g.circle(x + ox - 1, cy - 1, r * 0.55).fill(leaf);
      if (stage === 3) g.circle(x + ox + 1, cy + 1, r * 0.5).fill(leaf);
      break;
    }
    case "cover": {
      const cy = y + 12;
      g.circle(x + ox, cy, stage >= 2 ? 2.2 : 1.6).fill(p);
      g.rect(x + ox - 1, cy - 1, 1, 1).fill(leaf);
      if (stage === 3) g.rect(x + ox, cy - 3, 1, 1).fill(leaf); // tiny flower
      break;
    }
    case "cotton": {
      const cy = stage === 1 ? y + 11 : y + 9;
      const r = stage === 1 ? 2 : 3;
      g.circle(x + ox, cy, r).fill(leaf); // green bush
      if (stage >= 2) g.circle(x + ox - 1, cy - 1, 1.4).fill(p); // white boll
      if (stage === 3) {
        g.circle(x + ox + 1, cy, 1.4).fill(p);
        g.circle(x + ox, cy - 2, 1.2).fill(p);
      }
      break;
    }
    case "fruitbush": {
      const cy = stage === 1 ? y + 11 : y + 9;
      const r = stage === 1 ? 2 : 3.2;
      g.circle(x + ox, cy, r).fill(leaf);
      if (stage >= 2) g.circle(x + ox - 1, cy, 1.3).fill(stage === 3 ? p : lighten(p, 0.28));
      if (stage === 3) {
        g.circle(x + ox + 1, cy + 1, 1.3).fill(p);
        g.circle(x + ox + 1, cy - 2, 1.2).fill(p);
      }
      break;
    }
    case "strawberry": {
      const cy = y + 12;
      g.circle(x + ox, cy, stage === 1 ? 1.8 : 2.4).fill(leaf);
      if (stage === 3) {
        g.circle(x + ox - 1, cy + 1, 1.2).fill(p);
        g.circle(x + ox + 1, cy, 1).fill(p);
      } else if (stage === 2) {
        g.circle(x + ox, cy, 1).fill(lighten(p, 0.35));
      }
      break;
    }
    case "gourd": {
      g.circle(x + ox, y + 10, stage === 1 ? 2 : 3).fill(leaf); // sprawling leaves
      if (stage === 3) {
        g.ellipse(x + ox, y + 13, 3, 2.4).fill(p); // orange gourd
        g.rect(x + ox, y + 10, 1, 2).fill(STEM_DARK);
      } else if (stage === 2) {
        g.circle(x + ox + 1, y + 12, 1.5).fill(lighten(p, 0.25));
      }
      break;
    }
    case "vine": {
      const top = stage === 1 ? y + 9 : y + 5;
      g.rect(x + ox, top, 1, y + 13 - top).fill(STEM_DARK); // woody stem
      // Leafy foliage down the vine so it reads green/alive, not like dead twigs.
      g.circle(x + ox - 1, top, 2).fill(leaf);
      g.circle(x + ox + 1, top + 3, 1.6).fill(leaf);
      g.circle(x + ox - 1, top + 6, 1.6).fill(leaf);
      if (stage === 3) {
        g.circle(x + ox, top + 4, 1.2).fill(p);
        g.circle(x + ox + 2, top + 4, 1.2).fill(p);
        g.circle(x + ox + 1, top + 6, 1.2).fill(p);
        g.circle(x + ox + 1, top + 8, 1).fill(p);
      } else if (stage === 2) {
        g.circle(x + ox + 1, top + 5, 1).fill(lighten(p, 0.25));
      }
      break;
    }
  }
}

function drawDeadCrop(g: Graphics, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  // Withered brown stalks (no soil fill — dead field tile shows beneath).
  for (const ox of [4, 10]) softShadow(g, x + ox + 1, y + 14, 2.5, 1.1);
  for (const ox of [4, 10]) {
    g.rect(x + ox, y + 7, 2, 6).fill(0x5c3a1e);
    g.rect(x + ox - 2, y + 6, 2, 2).fill(0x6b4423);
    g.rect(x + ox + 1, y + 5, 2, 2).fill(0x6b4423);
  }
}

function drawSilo(g: Graphics, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(0x8b7355);
  softShadow(g, x + 9, y + 14, 6, 2.2);
  // Silo body
  g.rect(x + 4, y + 4, 8, 10).fill(0xccccbb);
  g.rect(x + 5, y + 3, 6, 2).fill(0xbb4444);
  // Door
  g.rect(x + 6, y + 10, 4, 4).fill(0x5c3a1e);
}

function drawBarn(g: Graphics, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(0x4a8c3f); // grass base
  softShadow(g, x + 9, y + 14, 7, 2.2);
  g.rect(x + 2, y + 7, 12, 7).fill(0xb23a2e); // red wall
  g.rect(x + 1, y + 5, 14, 2).fill(0x7a2820); // roof eave
  g.rect(x + 4, y + 3, 8, 2).fill(0x7a2820); // roof peak
  g.rect(x + 6, y + 9, 4, 5).fill(0xf0e6d0); // door
  g.rect(x + 7, y + 9, 1, 5).fill(0x7a2820); // door cross (vertical)
  g.rect(x + 6, y + 11, 4, 1).fill(0x7a2820); // door cross (horizontal)
}

function drawWaterPump(g: Graphics, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(0x8b7355);
  softShadow(g, x + 8, y + 14, 5, 2);
  // Pump base
  g.rect(x + 5, y + 8, 6, 6).fill(0x666666);
  // Pump arm
  g.rect(x + 7, y + 3, 2, 6).fill(0x888888);
  g.rect(x + 6, y + 2, 4, 2).fill(0x3498db);
}

function drawWindmill(g: Graphics, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(0x8b7355);
  softShadow(g, x + 8, y + 14, 5, 2);
  // Tower
  g.rect(x + 6, y + 6, 4, 8).fill(0xccccbb);
  // Blades (X shape)
  g.rect(x + 3, y + 3, 2, 6).fill(0xddddcc);
  g.rect(x + 11, y + 3, 2, 6).fill(0xddddcc);
  g.rect(x + 5, y + 2, 6, 2).fill(0xddddcc);
}

function drawIrrigation(g: Graphics, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(0x8b7355);
  // Ditch (blue channel)
  g.rect(x + 2, y + 6, 12, 4).fill(0x2980b9);
  g.rect(x + 4, y + 5, 8, 1).fill(0x654321); // dirt edges
  g.rect(x + 4, y + 10, 8, 1).fill(0x654321);
}

function drawFence(g: Graphics, col: number, row: number) {
  // Legacy single-tile fence sprite — kept for the building-catalog icon
  // (Build sub-palette). The live map uses drawFenceVariant for each tile.
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(0x4a8c3f);
  softShadow(g, x + 8, y + 14, 6, 1.4);
  g.rect(x + 2, y + 4, 2, 10).fill(0x8b6914);
  g.rect(x + 12, y + 4, 2, 10).fill(0x8b6914);
  g.rect(x + 2, y + 6, 12, 2).fill(0xa07828);
  g.rect(x + 2, y + 10, 12, 2).fill(0xa07828);
}

/**
 * One of 16 fence variants. `mask` is a 4-bit neighbour bitmask:
 * bit 0 = N, 1 = E, 2 = S, 3 = W. Each set bit adds a rail stub
 * extending from the central post to that tile edge — so two adjacent
 * fences read as a continuous fence line and a corner reads as an
 * L-bend without any special-case code.
 *
 * Deliberately NO background fill: the tile's terrain shows through,
 * so a fence on a dirt pen tile no longer reads as a green patch
 * inside a brown pen.
 */
function drawFenceVariant(g: Graphics, col: number, row: number, mask: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  const N = (mask & 1) !== 0;
  const E = (mask & 2) !== 0;
  const S = (mask & 4) !== 0;
  const W = (mask & 8) !== 0;

  // Top + bottom rail colour and post colour, matching the legacy fence.
  const POST = 0x8b6914;
  const RAIL = 0xa07828;

  // Central post — always drawn so a lone fence still reads as one.
  g.rect(x + 7, y + 4, 2, 10).fill(POST);
  softShadow(g, x + 8, y + 14, 5, 1.2);

  // Horizontal rails extend through the post toward east / west neighbours.
  // Two parallel rails at y=6 and y=10, matching the legacy fence rhythm.
  if (E) {
    g.rect(x + 8, y + 6, 8, 2).fill(RAIL);
    g.rect(x + 8, y + 10, 8, 2).fill(RAIL);
  }
  if (W) {
    g.rect(x + 0, y + 6, 8, 2).fill(RAIL);
    g.rect(x + 0, y + 10, 8, 2).fill(RAIL);
  }
  // Vertical rails extend above / below the post toward north / south
  // neighbours. Two parallel rails at x=6 and x=10 mirror the horizontal
  // spacing so the line reads consistent at corners and intersections.
  if (N) {
    g.rect(x + 5, y + 0, 2, 7).fill(RAIL);
    g.rect(x + 9, y + 0, 2, 7).fill(RAIL);
  }
  if (S) {
    g.rect(x + 5, y + 9, 2, 7).fill(RAIL);
    g.rect(x + 9, y + 9, 2, 7).fill(RAIL);
  }
}

function drawWeatherClear(g: Graphics, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(0x87ceeb);
  g.circle(x + 8, y + 8, 4).fill(0xffdd00);
  // Rays
  for (let a = 0; a < 8; a++) {
    const angle = (a / 8) * Math.PI * 2;
    const rx = x + 8 + Math.cos(angle) * 6;
    const ry = y + 8 + Math.sin(angle) * 6;
    g.rect(Math.round(rx), Math.round(ry), 1, 1).fill(0xffdd00);
  }
}

function drawWeatherCloudy(g: Graphics, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(0x87ceeb);
  g.circle(x + 6, y + 9, 4).fill(0xcccccc);
  g.circle(x + 10, y + 8, 3).fill(0xbbbbbb);
  g.circle(x + 8, y + 7, 3).fill(0xdddddd);
}

function drawWeatherRain(g: Graphics, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(0x5a7a9a);
  g.circle(x + 8, y + 5, 4).fill(0x888888);
  // Raindrops
  g.rect(x + 4, y + 11, 1, 3).fill(0x3498db);
  g.rect(x + 8, y + 12, 1, 3).fill(0x3498db);
  g.rect(x + 12, y + 10, 1, 3).fill(0x3498db);
}

function drawWeatherStorm(g: Graphics, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(0x3a4a5a);
  g.circle(x + 8, y + 5, 4).fill(0x555555);
  // Lightning bolt
  g.rect(x + 7, y + 9, 2, 2).fill(0xffff00);
  g.rect(x + 8, y + 11, 2, 2).fill(0xffff00);
  g.rect(x + 7, y + 13, 2, 2).fill(0xffff00);
}

function drawWeatherFrost(g: Graphics, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(0xa8d8ea);
  // Snowflake-ish
  g.rect(x + 7, y + 3, 2, 10).fill(0xffffff);
  g.rect(x + 3, y + 7, 10, 2).fill(0xffffff);
  g.rect(x + 5, y + 5, 1, 1).fill(0xffffff);
  g.rect(x + 10, y + 5, 1, 1).fill(0xffffff);
  g.rect(x + 5, y + 10, 1, 1).fill(0xffffff);
  g.rect(x + 10, y + 10, 1, 1).fill(0xffffff);
}

function drawWeatherDrought(g: Graphics, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(0xd4a017);
  g.circle(x + 8, y + 6, 4).fill(0xff6600);
  // Heat waves
  g.rect(x + 3, y + 12, 4, 1).fill(0xff8800);
  g.rect(x + 9, y + 13, 4, 1).fill(0xff8800);
}

function drawWaterTrough(g: Graphics, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(0x4a8c3f); // grass base
  softShadow(g, x + 8, y + 13, 5, 1.4);
  // Trough body: wooden box, low and wide.
  g.rect(x + 2, y + 9, 12, 4).fill(0x6b4a2c);
  g.rect(x + 2, y + 9, 12, 1).fill(0x8a6a44); // rim highlight
  g.rect(x + 2, y + 12, 12, 1).fill(0x4a3018); // base shadow
  // Water inside.
  g.rect(x + 3, y + 10, 10, 2).fill(0x3a8ec8);
  g.rect(x + 5, y + 10, 2, 1).fill(0xbfe4f5);
  g.rect(x + 10, y + 11, 2, 1).fill(0xbfe4f5);
}

function drawFeedTrough(g: Graphics, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(0x4a8c3f);
  softShadow(g, x + 8, y + 13, 5, 1.4);
  // Wooden trough.
  g.rect(x + 2, y + 9, 12, 4).fill(0x6b4a2c);
  g.rect(x + 2, y + 9, 12, 1).fill(0x8a6a44);
  g.rect(x + 2, y + 12, 12, 1).fill(0x4a3018);
  // Grain heap.
  g.rect(x + 4, y + 10, 8, 2).fill(0xdcb43c);
  g.rect(x + 5, y + 10, 6, 1).fill(0xefcf6c);
  g.rect(x + 7, y + 10, 1, 1).fill(0x9a7e2c);
}

// --- Animals (side view, bottom-aligned in the cell, with a contact shadow) ---

function drawChicken(g: Graphics, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  softShadow(g, x + 8, y + 14, 3, 1.1);
  g.rect(x + 3, y + 7, 3, 4).fill(0xf0f0f0); // tail
  g.ellipse(x + 8, y + 10, 3.6, 3).fill(0xffffff); // body
  g.circle(x + 11, y + 7, 2).fill(0xffffff); // head
  g.rect(x + 11, y + 4, 2, 2).fill(0xe74c3c); // comb
  g.rect(x + 13, y + 7, 2, 1).fill(0xf39c12); // beak
  g.rect(x + 11, y + 6, 1, 1).fill(0x222222); // eye
  g.rect(x + 7, y + 13, 1, 2).fill(0xf39c12); // legs
  g.rect(x + 10, y + 13, 1, 2).fill(0xf39c12);
}

function drawPig(g: Graphics, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  const pink = 0xe79ab0;
  const dark = 0xcf7e96;
  softShadow(g, x + 8, y + 14, 4.5, 1.4);
  g.ellipse(x + 8, y + 10, 5, 3.2).fill(pink); // body
  g.circle(x + 12, y + 9, 2.6).fill(pink); // head
  g.rect(x + 11, y + 5, 2, 2).fill(dark); // ear
  g.rect(x + 14, y + 9, 2, 2).fill(dark); // snout
  g.rect(x + 12, y + 8, 1, 1).fill(0x222222); // eye
  g.rect(x + 4, y + 6, 2, 2).fill(pink); // rump curl/tail
  for (const lx of [5, 8, 11]) g.rect(x + lx, y + 12, 1, 2).fill(dark); // legs
}

function drawSheep(g: Graphics, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  const wool = 0xf5f5ef;
  softShadow(g, x + 8, y + 14, 4.5, 1.4);
  for (const lx of [6, 9]) g.rect(x + lx, y + 12, 1, 2).fill(0x4a4a4a); // legs
  g.circle(x + 5, y + 10, 3).fill(wool); // fluffy body (overlapping puffs)
  g.circle(x + 8, y + 8, 3.4).fill(wool);
  g.circle(x + 10, y + 10, 3).fill(wool);
  g.circle(x + 12, y + 10, 2).fill(0x4a4a4a); // head
  g.rect(x + 13, y + 9, 1, 1).fill(0xffffff); // eye glint
}

function drawCow(g: Graphics, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  softShadow(g, x + 8, y + 14, 5.5, 1.6);
  for (const lx of [5, 8, 11]) g.rect(x + lx, y + 12, 1.5, 3).fill(0x33271c); // legs
  g.ellipse(x + 8, y + 9, 5.5, 3.4).fill(0xfafafa); // body
  g.ellipse(x + 6, y + 8, 1.8, 1.6).fill(0x2b2b2b); // patches
  g.ellipse(x + 10, y + 10, 1.6, 1.4).fill(0x2b2b2b);
  g.circle(x + 13, y + 8, 2.4).fill(0xfafafa); // head
  g.rect(x + 11, y + 4, 1, 2).fill(0x2b2b2b); // horn/ear
  g.rect(x + 14, y + 8, 2, 2).fill(0xe79ab0); // snout
  g.rect(x + 13, y + 7, 1, 1).fill(0x222222); // eye
}

function darken(color: number, amount: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amount));
  const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amount));
  const b = Math.max(0, (color & 0xff) * (1 - amount));
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

function lighten(color: number, amount: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) + 255 * amount);
  const g = Math.min(255, ((color >> 8) & 0xff) + 255 * amount);
  const b = Math.min(255, (color & 0xff) + 255 * amount);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
