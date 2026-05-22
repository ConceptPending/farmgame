# Design: Scenarios, Goals & Rival Farms

Status: **proposed** · Author: design pass · Target: post-`671b102` (main)

## 1. Summary

Replace the implicit "auto-start, single net-worth goal, solo" setup with:

1. **Scenarios** — Manor Lords-style named game modes chosen from a start screen.
   Each scenario bundles a victory condition, a rival setup, and an economic
   flavor. Difficulty is an orthogonal toggle; **Custom** exposes everything.
2. **Goal types** — generalize the single `goalNetWorth` into a `Goal` union
   (net worth, tycoon race, land baron, market mogul, sandbox).
3. **Rival farms** — abstracted computer-run farms that own land, grow net
   worth, expand into free plots (land scarcity), and sell into the shared
   market (price pressure). Not simulated tile-by-tile.

Guiding constraints, carried from the rest of the codebase:

- The engine stays **pure, immutable, deterministic** (functional RNG threaded
  through systems). Rival logic only consumes RNG when rivals exist, so games
  without rivals remain byte-identical and the existing 150 tests are untouched.
- Reuse existing mechanisms wherever possible: rival selling uses the same
  `SELL_DEMAND_IMPACT` demand model; land contention reuses `plotOwnership`.
- Scenario *presets* are a product/UI concern (live in the web app); the engine
  takes a generic config (`goal`, `rivals`, difficulty knobs).

## 2. Scenario lineup (Manor Lords framing)

The start screen shows **scenario cards**, not a settings form. Difficulty
(Easy / Normal / Hard) is a separate segmented control that scales economy +
rival aggressiveness. **Custom** opens the advanced form.

| Scenario | Goal | Rivals | Flavor |
|---|---|---|---|
| **Homestead** | `sandbox` (endless) | 0 | Relaxed; learn the game |
| **Prosperity** | `net_worth` $X | 0–1 | Classic solo build |
| **Tycoon Rush** | `tycoon_race` $X (first wins) | 2–3 | Competitive race |
| **Land Baron** | `land_baron` N plots | 2–3 aggressive | Land-grab race |
| **Market Mogul** | `market_leader` (top seller K seasons) | 2 | Out-produce rivals |
| **Custom** | any | 0–4 | Full control |

Difficulty knobs (applied on top of a scenario):

| Knob | Easy | Normal | Hard |
|---|---|---|---|
| Starting cash | 1000 | 500 | 300 |
| Expense multiplier | 0.7× | 1.0× | 1.3× |
| Rival aggressiveness | 0.3 | 0.6 | 0.9 |
| Goal target scale | 0.8× | 1.0× | 1.25× |

## 3. Engine — generalized goals

### 3.1 Types (`entities/goal.ts`, new)

```ts
export type GoalType =
  | "net_worth" | "tycoon_race" | "land_baron" | "market_leader" | "sandbox";

export type Goal =
  | { type: "net_worth"; target: number }
  | { type: "tycoon_race"; target: number }        // you OR a rival; first to target
  | { type: "land_baron"; plots: number }
  | { type: "market_leader"; good: string; seasons: number } // top seller K seasons
  | { type: "sandbox" };

export interface GoalProgress {
  label: string;     // "Net worth", "Plots owned", ...
  current: number;
  target: number;    // 0 for sandbox
  pct: number;       // 0..1
  detail?: string;   // e.g. "leading 2 / 4 seasons"
}
```

### 3.2 State changes (`state.ts`)

- Remove `goalNetWorth: number`; add `goal: Goal`.
- Add `marketLeadStreak: number` (for `market_leader`), default 0.
- Add `seasonSales: Record<string, number>` — human's sales of each good this
  season (reset at season rollover; used by `market_leader` standings).
- `CreateGameOptions` gains: `goal?: Goal`, `rivals?: RivalConfig[]`,
  `expenseMultiplier?: number`. `goalNetWorth?` kept as a deprecated alias that
  maps to `{ type: "net_worth", target }` (smooth migration; can drop later).

### 3.3 Evaluation (`systems/finance.ts`)

Replace the hardcoded net-worth check with `evaluateGoal(state)`:

- `net_worth`: netWorth ≥ target → **won**.
- `tycoon_race`: human netWorth ≥ target → **won**; else if any rival netWorth ≥
  target → **lost** (race lost). Tie broken in the human's favor on the same tick.
- `land_baron`: human plot count ≥ plots → **won**.
- `market_leader`: each season, if human `seasonSales[good]` ≥ every rival's
  sales of `good`, increment `marketLeadStreak`, else reset to 0; streak ≥
  `seasons` → **won**.
- `sandbox`: never auto-wins.
- **Bankruptcy is the universal lose** (unchanged), for every goal type.

`goalProgress(state): GoalProgress` powers the HUD chip + Finance panel for any
goal. Export both from `index.ts`.

### 3.4 Touch list

`state.ts`, `systems/finance.ts`, `index.ts`, plus UI (`HUD`, `FinancePanel`,
`GameOverOverlay`) and `tests/finance.test.ts` (uses `goalNetWorth` today →
switch to `goal`).

## 4. Engine — abstracted rivals

### 4.1 Types (`entities/rival.ts`, new)

```ts
export interface RivalFarm {
  id: number;
  name: string;
  netWorth: number;
  ownedPlots: number[];     // plot indices held
  focusGoods: string[];     // crops/products they produce & sell
  aggressiveness: number;   // 0..1 expansion + selling rate
  seasonSales: Record<string, number>; // last season's volume per good
}

export interface RivalConfig {
  name: string;
  aggressiveness: number;
  startingPlots: number;    // claimed at game start (outer grid, away from player)
  focusGoods: string[];
}
```

`state.rivals: RivalFarm[]` (created once at game start; no mid-game spawns).

### 4.2 `systems/rival.ts` (new) — runs at season boundary, RNG-threaded

Early-returns with no RNG use when `state.rivals.length === 0` (determinism).

For each rival, each season:

1. **Grow** — `netWorth += round(ownedPlots.length * PLOT_PRODUCTIVITY *
   aggressiveness * marketFactor) - upkeep`, plus small RNG noise.
   `marketFactor` dips when their focus goods' prices are depressed (so rivals
   feel the same saturation).
2. **Expand** — with prob ∝ `aggressiveness` and capital, claim one unowned,
   unclaimed plot, preferring adjacency to their holdings then soil quality.
   Adds to `ownedPlots` → reduces availability for the human.
3. **Sell** — volume ∝ size × aggressiveness on each focus good; record in
   `seasonSales` and apply `SELL_DEMAND_IMPACT` to that good's demand → price
   pressure in the shared market (processed by `marketSystem` same tick).
4. **Notify** — occasional: "Rival X expanded nearby", "Rival Y is flooding the
   corn market."

Pipeline placement: `… → livestock → rivals → events → market → finance`
(rivals act before market so their demand impact is priced in, and before
finance so win/lose sees current rival net worth and the player's seasonSales).

### 4.3 Land contention

- Keep `world.plotOwnership: boolean[]` for the human. Rival ownership lives in
  `rival.ownedPlots`.
- Helper `plotOwner(state, plotIdx): "human" | number | null` (rivalId or null).
- `handleBuyPlot` rejects a plot unless `plotOwner === null` (new check:
  not in any rival's `ownedPlots`).
- Rivals start owning plots in the outer 6×6 grid, away from the player's
  central plots (2,2)/(3,2). No hostile takeover in v1.

### 4.4 Net worth & standings

- Rival `netWorth` is tracked directly (abstracted).
- `standings(state)` returns `[{ name, netWorth, plots, isHuman }]` sorted desc,
  for the standings panel and `tycoon_race`/rank display.

## 5. UI surfaces

### 5.1 Start screen (`components/menu/StartScreen.tsx`, new)

- Shown whenever `gameStore.state === null` (stop auto-initing in `page.tsx`).
- Scenario cards (grid) → difficulty segmented control → **Custom** expands an
  advanced form (goal type, target, rival count, starting cash, seed).
- "Start Farming" calls a new store action `startGame(config)`.
- Scenario presets defined in `apps/web/lib/scenarios.ts` → produce a
  `CreateGameOptions`.

### 5.2 Store (`stores/game-store.ts`)

- Drop auto-init; add `startGame(config)` (builds state via `createGameState`)
  and remember `lastConfig`.
- Game-over → "Play Again" (same `lastConfig`) and "Main Menu" (`state = null`).

### 5.3 In-game

- **Goal chip** (HUD): generalize the net-worth chip to render `goalProgress`
  (label + bar) for any goal type.
- **Standings panel** (`components/game/StandingsPanel.tsx`, new): rivals' name,
  net worth, plots, your rank; for Tycoon Rush, everyone's % to target. HUD
  "Rivals" button (hidden when 0 rivals).
- **Map**: rival plots tinted per-rival (renderer reads `state.rivals`);
  InfoPanel shows "Owned by: Rival X".
- **Game-over overlay**: messages vary by outcome (won race / outranked /
  domination achieved / bankrupt).

## 6. Determinism, testing, balance

- `rivalSystem` + goal eval are pure and RNG-threaded; no-rival path consumes no
  RNG → existing tests unaffected.
- **New tests**
  - `goal.test.ts`: each goal's win/lose, `goalProgress`, tycoon-race loss when a
    rival hits target first, market-leader streak.
  - `rival.test.ts`: expansion claims a free plot & reduces availability; selling
    drops the focus good's demand; determinism for a seed; no-rival no-op.
  - extend `commands.test.ts`: `BUY_PLOT` rejects a rival-owned plot.
- **Balance**: extend `tools/balance-sim.mjs` to spawn rivals and measure how
  land scarcity + price pressure shift pacing; re-tune each scenario/difficulty
  target. Expect competitive scenarios to need lower targets than solo.

## 7. Implementation plan

### Phase A — Goals + Start screen (no rivals)

Self-contained; ships a real menu and goal variety. Rival-dependent scenarios
(Tycoon Rush, Market Mogul) are shown disabled until Phase B.

Engine
- [ ] `entities/goal.ts`: `Goal`, `GoalType`, `GoalProgress`.
- [ ] `state.ts`: `goal` (replace `goalNetWorth`), `seasonSales`,
      `marketLeadStreak`; `CreateGameOptions` (`goal`, `expenseMultiplier`,
      deprecated `goalNetWorth` alias). Reset `seasonSales` at season rollover
      (in `seasonSystem` or `financeSystem`).
- [ ] `systems/finance.ts`: `evaluateGoal`, `goalProgress`; apply
      `expenseMultiplier` to seasonal expenses.
- [ ] `index.ts`: export goal types + helpers.
- [ ] Tests: `goal.test.ts`; fix `finance.test.ts` to use `goal`.

Web
- [ ] `lib/scenarios.ts`: scenario + difficulty presets → `CreateGameOptions`.
- [ ] `components/menu/StartScreen.tsx`: cards + difficulty + custom form.
- [ ] `stores/game-store.ts`: `startGame(config)`, `lastConfig`; drop auto-init.
- [ ] `app/page.tsx`: render `StartScreen` when `state === null`.
- [ ] HUD goal chip + `FinancePanel` + `GameOverOverlay`: use `goalProgress`,
      add "Play Again" / "Main Menu".

Verify: tests/typecheck/lint green; in-browser pick each (solo) scenario,
confirm goal chip + win/lose for `net_worth`, `land_baron`, `sandbox`.

### Phase B — Abstracted rivals

Engine
- [ ] `entities/rival.ts`: `RivalFarm`, `RivalConfig`; `plotOwner`, `standings`
      helpers.
- [ ] `state.ts`: `rivals: RivalFarm[]`; build from `RivalConfig[]` in
      `createGameState` (assign starting plots in the outer grid via RNG).
- [ ] `systems/rival.ts`: grow / expand / sell; wire into `nextTick`
      (`… livestock → rivals → events → market → finance`).
- [ ] `command-handler.ts`: `handleBuyPlot` rejects rival-owned plots; track
      human `seasonSales` in `handleSell`.
- [ ] `systems/finance.ts`: enable `tycoon_race` (rival net worth) &
      `market_leader` (compare seasonSales vs rivals).
- [ ] `index.ts`: export rival types + helpers.
- [ ] Tests: `rival.test.ts`; `BUY_PLOT`-rejects-rival in `commands.test.ts`.

Web
- [ ] `StartScreen`: enable Tycoon Rush / Market Mogul; rival-count control.
- [ ] `components/game/StandingsPanel.tsx` + HUD "Rivals" button.
- [ ] Renderer: tint rival plots (per-rival color) in the terrain/plot layer;
      InfoPanel "Owned by: Rival X".
- [ ] `GameOverOverlay`: competitive outcome messages.

Balance
- [ ] Extend `balance-sim` with rivals; re-tune scenario/difficulty targets.

Verify: tests/typecheck/lint; in-browser run Tycoon Rush — confirm rivals
appear in standings, claim plots (blocked from purchase), depress focus-good
prices, and the race win/lose fires.

### Phase C — Polish

- [ ] Rival names/personalities, richer notifications, scenario flavor copy.
- [ ] Per-difficulty balance pass; tune rival growth so they're credible but
      beatable at each difficulty.

## 8. Open decisions (current defaults)

- **Land Baron target**: ~12–18 plots (of 36); tune in Phase B.
- **Market Mogul**: top seller of one good for ~4 consecutive seasons.
- **No hostile takeover** — pure economic competition (rivals can't seize your
  land, you can't seize theirs).
- **Rivals are abstracted** — no per-tile crops; their "farming" is a net-worth
  growth model parameterized by plots × productivity × aggressiveness.
- **Migration**: `goalNetWorth` kept as an alias for one release, then removed.
