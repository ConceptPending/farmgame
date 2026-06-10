# Claude / LLM agent notes

Browser farm-simulation game. **pnpm + Turbo monorepo**, fully client-side (no backend, no DB; saves go to localStorage), deployed to Vercel. The simulation is a **pure, deterministic, seeded** TypeScript engine that the React/Pixi layers render and drive. `README.md` has the stack + quickstart. The determinism rules below are the thing most likely to be broken silently — read them before touching the engine.

## Dev commands

```bash
pnpm install                              # pnpm@9.15.0, Node >=20.11
pnpm dev                                  # turbo dev — apps/web on http://localhost:3000
pnpm --filter @farmgame/web dev           # just the web app
pnpm build                                # turbo build (packages first, then web)
pnpm test                                 # turbo test (all packages)
pnpm --filter @farmgame/engine test       # engine vitest only (the important suite)
pnpm typecheck                            # turbo typecheck
pnpm lint                                 # per-package eslint
```

Tasks are Turbo-coordinated (`turbo.json`): `build`/`test`/`typecheck` depend on `^build`, so packages build before `apps/web`. Use `--filter @farmgame/<pkg>` to scope to one workspace.

## Monorepo layout & package boundaries

| Package | Role | May import | Must NOT |
|---|---|---|---|
| `packages/engine` | Pure deterministic simulation | engine-internal + `@farmgame/shared` | **no DOM, no Pixi, no React, no I/O** |
| `packages/renderer` | Pixi.js 8 canvas | `@farmgame/engine`, `@farmgame/shared`, pixi | **never mutate engine state; never dispatch commands** |
| `packages/shared` | world-geometry constants (dependency-free) | — | — |
| `apps/web` | Next.js 15 + Zustand UI | all `@farmgame/*` | — |

Workspace deps are `workspace:*`. `apps/web/next.config.ts` transpiles the workspace packages. The engine-purity rules (no DOM/Date.now/react/pixi imports, no param mutation) are lint-enforced via the engine-scoped block in the root `eslint.config.mjs`.

## The engine — determinism is the contract

- **Tick pipeline:** `packages/engine/src/tick.ts:nextTurn(state)` runs 12 systems in a fixed order (season → weather → water → crop → fieldHealth → livestock → pen → predator → rival → event → market → finance), then resets the labor budget. Order is load-bearing; don't reorder without understanding downstream reads.
- **State is immutable.** `GameState` (`state.ts`) is updated by spreading (`{ ...state, ... }`), arrays included. **Never mutate in place** (`state.fields[0].health = …`) — nothing stops you at compile time; tests and Zustand devtools are the only guard.
- **RNG is seeded and threaded immutably.** `packages/engine/src/rng.ts` (Mulberry32). Every draw returns `{ value, rng: newState }` — you **must** capture and thread the returned `rng` into the next call. Dropping it (`nextFloat(rng).value` without keeping `.rng`) silently breaks reproducibility.
- **`Date.now()` is banned in the engine** except as the *default* seed in `createGameState()` when the caller passes none. For reproducible replays/tests, always pass an explicit `seed`.
- **Commands:** player actions go through `command-handler.ts:applyCommand(state, command)` → `{ state, success, error?, notifications, causes? }`. `GameCommand` (`commands.ts`) is a 20-variant union. **Labor is hard-gated**: a command exceeding `labor.capacity` fails *before* any state change. `END_TURN` short-circuits to `nextTurn()`.
- **Saves:** `apps/web/lib/save-game.ts` — slots in localStorage (`farmgame.save.<slot>`), shape `{ version, savedAt, name, state }`. There is **no migration** across breaking versions: v1/v2 saves are intentionally orphaned and rejected on load. If you change `GameState` shape, bump the version and decide rejection vs. migration deliberately.

## Renderer & web

- **Renderer** (`packages/renderer/src/game-renderer.ts`) reads `GameState` and draws a fixed layer stack; input produces `InputEvent`s that flow **up** to React, which dispatches commands. The renderer is strictly read-only on state.
- **Web** holds two Zustand stores: `apps/web/stores/game-store.ts` (the `GameState`, dispatch, notifications/causes/fxEvents) and `ui-store.ts` (selection/panels). Dispatch flow: UI → `dispatch(cmd)` → `applyCommand` → store updates → React re-renders.
- **`reactStrictMode: false`** in `next.config.ts` is deliberate — StrictMode's dev double-mount corrupts the Pixi canvas. Don't re-enable it.

## Tests

Vitest. The engine suite (`packages/engine/tests/`, ~26 files) is the real coverage — determinism, every system, multi-year scenario runs; keep it green and extend it when you change a system. It is also typechecked (`tsconfig.test.json`). `apps/web/tests/` covers save/load, store dispatch/autosave, and coaching; React components are untested.

## Build / deploy

Vercel builds `apps/web` via Turbo with a frozen pnpm lockfile; output is `apps/web/.next`. No env vars, no API routes — it's a static client app.

## Gotchas

- RNG threading and in-place mutation are the two silent-determinism killers — review every engine change for both.
- `tools/_*` are local-only helper scripts (Puppeteer captures, smoke probes) — gitignored; never commit them. `tools/_audit-smoke.mjs` boots the dev server's game in headless Chrome and checks mount/END_TURN/remount/resize.
- Four seasons × 3 months = 12 turns/year; don't conflate `season` and `monthOfSeason`.

## Before declaring a task done

1. `pnpm typecheck` and `pnpm lint` — must pass.
2. `pnpm --filter @farmgame/engine test` (and `pnpm test`) — must pass; add cases for any system you touched.
3. Changed `GameState` shape? Decide save-version handling and update `save-game.ts`.
4. Changed the engine/renderer? `pnpm --filter @farmgame/web dev` and play a few turns — confirm the canvas renders and a full `END_TURN` resolves.
