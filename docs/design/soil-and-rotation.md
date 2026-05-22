# Design: Soil Nutrients & Crop Rotation

Status: **proposed** · Target: post-`be60735` (main)

## 1. Summary

Today `soilQuality` is a static per-tile number (sets land cost; never changes).
This feature adds a **living soil layer**: each tile tracks **N-P-K nutrients**
that crops draw down, replenish, and need — so **crop rotation emerges from the
mechanics** rather than a hardcoded penalty. Corn is a heavy nitrogen feeder;
legumes (soybeans) *fix* nitrogen; so soybeans-then-corn thrives while
corn-after-corn starves. Yield is governed by the **limiting nutrient**
(Liebig's law of the minimum).

Locked decisions:
- **Per-tile** nutrients (survives re-designating a field — no depletion dodge).
- **N, P, K** (three nutrients, the real-world standard).
- **Limiting-nutrient yield**: yield capped by the scarcest needed nutrient.
- **Moderate** intensity: yields visibly decline over a few monoculture cycles
  but recover via rotation, legumes, fallow, or fertilizer. Rotation is
  rewarded, not mandatory.

Invariants kept from the rest of the engine: pure/immutable/deterministic;
**no new RNG** (nutrient init derives from `soilQuality`, recovery is
deterministic) so existing games stay byte-identical and the 166 tests pass.

## 2. Model

### 2.1 Tile

```ts
interface Tile {
  // ...existing
  soilQuality: number;            // innate land quality (static; land cost + baseline)
  nutrients: { n: number; p: number; k: number }; // 0..1, dynamic
}
```
World-gen init: `nutrients = { n: soilQuality, p: soilQuality, k: soilQuality }`
(no extra RNG). `soilQuality` becomes the **recovery baseline** the soil drifts
back toward when rested.

### 2.2 Crop profiles

```ts
interface CropDefinition {
  // ...existing
  consumes: { n: number; p: number; k: number }; // drawn per harvest; negative = fixes
  needs: { n: number; p: number; k: number };    // 0..1 level wanted for full yield
}
```

Representative profiles (exact values tuned in the balance pass):

| Crop | needs N | needs P | needs K | consumes (N/P/K) | note |
|---|---|---|---|---|---|
| Corn | 0.9 | 0.3 | 0.4 | 0.10 / 0.02 / 0.03 | heavy N feeder |
| Wheat | 0.6 | 0.2 | 0.3 | 0.06 / 0.02 / 0.02 | grain |
| Lettuce | 0.7 | 0.2 | 0.3 | 0.06 / 0.01 / 0.02 | leafy → N |
| Sunflowers | 0.5 | 0.3 | 0.5 | 0.05 / 0.02 / 0.04 | |
| **Soybeans** | 0.2 | 0.4 | 0.4 | **−0.10** / 0.03 / 0.03 | legume — **fixes N** |
| Potatoes | 0.4 | 0.3 | 0.8 | 0.04 / 0.03 / 0.09 | root → K |
| Tomato | 0.4 | 0.7 | 0.6 | 0.04 / 0.07 / 0.06 | fruiting → P/K |
| Peppers | 0.4 | 0.6 | 0.6 | 0.04 / 0.06 / 0.06 | |
| Strawberries | 0.3 | 0.7 | 0.6 | 0.03 / 0.07 / 0.06 | |
| Pumpkins | 0.7 | 0.5 | 0.6 | 0.08 / 0.05 / 0.06 | greedy |
| Grapes | 0.3 | 0.5 | 0.7 | 0.03 / 0.05 / 0.07 | |
| Cotton | 0.7 | 0.4 | 0.6 | 0.08 / 0.04 / 0.06 | heavy |

Emergent rotations: **corn → soybeans → corn** (soybeans refill the N corn
drained); **potatoes** (K) followed by an N/P crop; leafy crops followed by a
legume.

### 2.3 Yield (Liebig's law of the minimum)

At harvest, per field, with `avg` = average tile nutrients over the field:
```
factor = min over x in {n,p,k} where needs[x] > 0 of clamp(avg[x] / needs[x], 0, 1)
nutrientFactor = clamp(factor, 0.3, 1)   // a depleted field still yields ~30%
```
Final harvest yield gains `× nutrientFactor` (alongside existing health/weed
mods). Nitrogen-starved corn → ~30% yield even with full P/K.

### 2.4 Depletion & fixation (at harvest)

For each tile in the harvested field, for each nutrient `x`:
`nutrients[x] = clamp(nutrients[x] − consumes[x], 0, 1)` (negative `consumes`
*adds*, e.g. soybeans raise N). Applied only on a real harvest — a crop that
dies depletes nothing (and fixes nothing).

### 2.5 Recovery (each tick)

Soil slowly mineralizes back toward its `soilQuality` baseline:
`nutrients[x] += (soilQuality − nutrients[x]) * SOIL_RECOVERY` (small, e.g.
0.004/tick). Folded into the existing per-tile loop in `waterSystem` (which
already iterates every tile) to avoid a second full pass. Fallow/rested fields
heal; actively re-cropped fields lose ground faster than they regain it.

### 2.6 Fertilizer

The existing `fertilizer` spray (already `+health`) also adds balanced N-P-K
(e.g. +0.2 each, clamped) to the field's tiles. So fertilizer is the
buy-your-way-out lever; rotation/legumes are the free, smarter play. (Targeted
single-nutrient fertilizers are a possible later extension.)

### 2.7 Optional: monoculture pests (Phase 2)

The nutrient model already penalizes repeating a crop (you drain what it needs).
A light extra touch: replanting the *same crop* on a field nudges its pest
vulnerability up (real monoculture builds pathogens). Secondary — include only
if it adds without confusing.

## 3. UI / surfacing

- **Soil overlay** (reuse the existing "Soil" mode): switch from static
  `soilQuality` to **live limiting-nutrient health** (min of N/P/K vs a
  reference) — green = fertile, red = depleted, so worn fields are obvious.
- **InfoPanel**: three small **N / P / K bars** for the selected tile/field;
  when a field is selected with a crop, highlight the nutrient(s) it needs and
  flag any that are low.
- **Hint notification** on harvest when a field's key nutrient is depleted:
  *"Field #3's nitrogen is spent — rotate to legumes or fertilize."*
- (Possible extension: a dedicated Soil panel listing each field's NPK + a
  suggested next crop.)

## 4. Balance

Depletion changes the economy: the current sim plants the single best crop
repeatedly → it would drain that crop's key nutrient → yields fall. To reflect
competent play, **update `balance-sim` to rotate** (prefer crops whose `needs`
match the tile's current nutrients; drop in legumes when N is low) and re-tune
`consumes` / `needs` / `SOIL_RECOVERY` so:
- a **rotating** player holds roughly today's pacing (~$25k in ~1.9y), and
- a **monoculture** player is meaningfully slower (yields taper a few cycles in).

## 5. Determinism & testing

- Nutrient init derives from `soilQuality` (no RNG); recovery + depletion are
  deterministic → existing 166 tests unaffected.
- New `soil.test.ts`:
  - harvesting a crop lowers its consumed nutrients on the field's tiles;
  - harvesting a legume (soybeans) *raises* nitrogen;
  - Liebig yield: corn on low-N soil yields ~30%, full-N soil yields full;
  - rotation: corn after soybeans out-yields corn after corn;
  - fallow recovery raises nutrients toward `soilQuality`;
  - fertilizer raises N/P/K.

## 6. Implementation plan

### Phase 1 — Soil engine (core loop)

- [ ] `entities/world.ts`: add `nutrients` to `Tile` + `createTile`; init in
      `data/world-gen.ts` (= soilQuality, no RNG).
- [ ] `entities/crop.ts` + `data/crops.ts`: add `consumes` / `needs` to every
      crop (table above).
- [ ] `command-handler.ts` `handleHarvestField`: apply `nutrientFactor` to
      yield (Liebig) and deplete/fix the field's tile nutrients; emit a
      depletion hint when a needed nutrient is low.
- [ ] `command-handler.ts` `handleSpray` (fertilizer): add balanced N-P-K.
- [ ] `systems/water.ts`: fold nutrient recovery toward `soilQuality` into the
      tile loop (constant `SOIL_RECOVERY`).
- [ ] Exports + `soil.test.ts` (6 cases above).

### Phase 2 — UI + balance

- [ ] Renderer `grid-overlay`: make the Soil overlay show live limiting-nutrient
      health.
- [ ] `InfoPanel`: N/P/K bars + needed-nutrient highlight + low-nutrient flag.
- [ ] Depletion hint wired through notifications/auto-pause.
- [ ] `balance-sim`: rotating strategy; re-tune profiles + recovery; confirm
      rotating pacing ≈ current and monoculture is penalized.
- [ ] (Optional) monoculture pest buildup.

## 7. Open decisions (current defaults)

- **Recovery rate** `SOIL_RECOVERY ≈ 0.004/tick`, uniform across N/P/K (could
  later make N regenerate slower); tuned in the balance pass.
- **Yield floor** 0.3 (depleted soil still yields something).
- **Depletion at harvest** (not continuous) — legible and event-driven.
- **Growth rate** is *not* nutrient-gated in v1 (only yield is); could add later.
- **Fertilizer** adds balanced NPK; targeted fertilizers are a later option.
