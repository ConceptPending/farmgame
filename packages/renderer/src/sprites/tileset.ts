import { Graphics, RenderTexture, Texture, Rectangle, type Application } from "pixi.js";

export const TILE_SIZE = 16;
const SHEET_COLS = 16;
const SHEET_ROWS = 8;

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

  // Crop stages (row 1-2): seedling, young, mature, ready for each color
  seedling_green: { col: 0, row: 1 },
  young_green: { col: 1, row: 1 },
  mature_green: { col: 2, row: 1 },
  ready_green: { col: 3, row: 1 },
  seedling_gold: { col: 4, row: 1 },
  young_gold: { col: 5, row: 1 },
  mature_gold: { col: 6, row: 1 },
  ready_gold: { col: 7, row: 1 },
  seedling_red: { col: 0, row: 2 },
  young_red: { col: 1, row: 2 },
  mature_red: { col: 2, row: 2 },
  ready_red: { col: 3, row: 2 },
  seedling_purple: { col: 4, row: 2 },
  young_purple: { col: 5, row: 2 },
  mature_purple: { col: 6, row: 2 },
  ready_purple: { col: 7, row: 2 },
  dead_crop: { col: 8, row: 1 },

  // Buildings (row 3)
  silo: { col: 0, row: 3 },
  water_pump: { col: 1, row: 3 },
  windmill: { col: 2, row: 3 },
  irrigation: { col: 3, row: 3 },
  fence: { col: 4, row: 3 },
  barn: { col: 5, row: 3 },

  // Weather icons (row 4)
  weather_clear: { col: 0, row: 4 },
  weather_cloudy: { col: 1, row: 4 },
  weather_rain: { col: 2, row: 4 },
  weather_storm: { col: 3, row: 4 },
  weather_frost: { col: 4, row: 4 },
  weather_drought: { col: 5, row: 4 },
} as const;

type SpriteKey = keyof typeof SPRITES;
const textureCache = new Map<SpriteKey, Texture>();

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

  // --- Row 1: Crop stages (green + gold) ---
  drawSeedling(g, 0, 1, 0x2ecc71);
  drawYoungCrop(g, 1, 1, 0x2ecc71);
  drawMatureCrop(g, 2, 1, 0x27ae60);
  drawReadyCrop(g, 3, 1, 0x27ae60);
  drawSeedling(g, 4, 1, 0xdaa520);
  drawYoungCrop(g, 5, 1, 0xdaa520);
  drawMatureCrop(g, 6, 1, 0xd4a017);
  drawReadyCrop(g, 7, 1, 0xd4a017);
  drawDeadCrop(g, 8, 1);

  // --- Row 2: Crop stages (red + purple) ---
  drawSeedling(g, 0, 2, 0xe74c3c);
  drawYoungCrop(g, 1, 2, 0xe74c3c);
  drawMatureCrop(g, 2, 2, 0xc0392b);
  drawReadyCrop(g, 3, 2, 0xc0392b);
  drawSeedling(g, 4, 2, 0x9b59b6);
  drawYoungCrop(g, 5, 2, 0x9b59b6);
  drawMatureCrop(g, 6, 2, 0x8e44ad);
  drawReadyCrop(g, 7, 2, 0x8e44ad);

  // --- Row 3: Buildings ---
  drawSilo(g, 0, 3);
  drawWaterPump(g, 1, 3);
  drawWindmill(g, 2, 3);
  drawIrrigation(g, 3, 3);
  drawFence(g, 4, 3);
  drawBarn(g, 5, 3);

  // --- Row 4: Weather icons ---
  drawWeatherClear(g, 0, 4);
  drawWeatherCloudy(g, 1, 4);
  drawWeatherRain(g, 2, 4);
  drawWeatherStorm(g, 3, 4);
  drawWeatherFrost(g, 4, 4);
  drawWeatherDrought(g, 5, 4);

  // Render to texture
  const rt = RenderTexture.create({ width: w, height: h });
  app.renderer.render({ container: g, target: rt });

  // Cut individual textures
  for (const [key, pos] of Object.entries(SPRITES)) {
    const frame = new Rectangle(pos.col * TILE_SIZE, pos.row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    const tex = new Texture({ source: rt.source, frame });
    textureCache.set(key as SpriteKey, tex);
  }

  g.destroy();
}

export function getTileTexture(key: SpriteKey): Texture {
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
// then read as crops growing in worked earth rather than flat brown squares.
// Two staggered plants per tile give fuller, row-like coverage.

function drawSeedling(g: Graphics, col: number, row: number, color: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  // Two tiny sprouts.
  for (const ox of [4, 10]) {
    g.rect(x + ox, y + 11, 1, 3).fill(0x2ecc71);
    g.rect(x + ox - 1, y + 10, 1, 2).fill(color);
    g.rect(x + ox + 1, y + 10, 1, 2).fill(color);
  }
}

function drawYoungCrop(g: Graphics, col: number, row: number, color: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  for (const ox of [4, 10]) {
    g.rect(x + ox, y + 8, 1, 6).fill(0x27ae60);
    g.rect(x + ox - 2, y + 7, 2, 3).fill(color);
    g.rect(x + ox + 1, y + 6, 2, 3).fill(color);
  }
}

function drawMatureCrop(g: Graphics, col: number, row: number, color: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  for (const ox of [4, 10]) {
    g.rect(x + ox, y + 5, 2, 9).fill(0x27ae60);
    g.rect(x + ox - 2, y + 4, 3, 3).fill(color);
    g.rect(x + ox + 1, y + 3, 3, 3).fill(color);
    g.rect(x + ox - 1, y + 2, 3, 3).fill(color);
  }
}

function drawReadyCrop(g: Graphics, col: number, row: number, color: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  for (const ox of [4, 10]) {
    g.rect(x + ox, y + 4, 2, 10).fill(0x1e8c4a);
    g.rect(x + ox - 2, y + 3, 3, 4).fill(color);
    g.rect(x + ox + 1, y + 2, 3, 4).fill(color);
    g.rect(x + ox - 1, y + 1, 3, 3).fill(lighten(color, 0.2));
  }
  // Ready sparkles.
  g.rect(x + 2, y + 1, 1, 1).fill(0xffff00);
  g.rect(x + 13, y + 2, 1, 1).fill(0xffff00);
}

function drawDeadCrop(g: Graphics, col: number, row: number) {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  // Withered brown stalks (no soil fill — dead field tile shows beneath).
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
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  g.rect(x, y, TILE_SIZE, TILE_SIZE).fill(0x4a8c3f);
  // Fence posts and rail
  g.rect(x + 2, y + 4, 2, 10).fill(0x8b6914);
  g.rect(x + 12, y + 4, 2, 10).fill(0x8b6914);
  g.rect(x + 2, y + 6, 12, 2).fill(0xa07828);
  g.rect(x + 2, y + 10, 12, 2).fill(0xa07828);
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
