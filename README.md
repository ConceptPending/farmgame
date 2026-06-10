# Smallholding

A small farm against four seasons and a fickle market. Browser-based farm simulator built with Next.js 15 and Pixi.js.

<!-- Add the live URL + Vercel deploy badge once the project is linked:
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ConceptPending/farmgame)
-->

## What it is

You inherit a few hectares of land. Twelve crops, four seasons, a weather model that respects each crop's temperature/water/season profile, livestock, equipment, a market with price history and demand, and field health (weeds, pests, spraying). The simulation is turn-based and deterministic — replays from the same seed produce identical farms.

## Stack

- **Engine** (`packages/engine`): pure TypeScript simulation. No DOM, no React. Deterministic RNG (Mulberry32), immutable state updates.
- **Renderer** (`packages/renderer`): Pixi.js 8 layer that draws the world. Programmatic 16×16 pixel art tileset.
- **Shared** (`packages/shared`): small constants package.
- **Web** (`apps/web`): Next.js 15 (App Router, Turbopack dev) + Zustand stores. Fully client-side; no API routes, no backend.

The web app is a single statically-prerendered page; the renderer is dynamically imported so Pixi stays out of the initial bundle.

## Dev quickstart

```bash
pnpm install
pnpm --filter @farmgame/web dev    # http://localhost:3000
```

Other useful commands from the repo root:

```bash
pnpm turbo build         # build engine, renderer, shared, web
pnpm turbo test          # vitest across all packages (engine + web)
pnpm turbo typecheck     # tsc --noEmit everywhere
pnpm turbo lint          # eslint each package
```

## Layout

```
apps/web/                # Next.js app — this is what Vercel deploys
packages/engine/         # @farmgame/engine — pure simulation
packages/renderer/       # @farmgame/renderer — pixi.js rendering
packages/shared/         # @farmgame/shared — shared constants
tools/                   # local-only scripts (balance sims, puppeteer captures)
docs/design/             # design notes
```

## Deployment

`apps/web/vercel.json` (the Vercel project's Root Directory is `apps/web`):

- installs from the repo root with `pnpm install --frozen-lockfile`
- builds via `pnpm turbo build --filter @farmgame/web` (so the workspace packages build before Next does)
- `outputDirectory` is `.next` (relative to `apps/web`)

CI (`.github/workflows/ci.yml`) runs build/typecheck/lint/test on every PR and push to main.

No environment variables are required — the game is fully client-side and stores saves in `localStorage`.

To deploy:

```bash
pnpm install -g vercel
vercel link
vercel --prod
```

## Testing

- Engine: 260+ tests in `packages/engine/tests/` covering commands, tick pipeline, crop lifecycle, world, weather, market, field health, RNG determinism, and multi-year balance scenarios.
- Web: 36 tests in `apps/web/tests/` (saves, store dispatch/autosave, onboarding, season suggestions).

Run with `pnpm turbo test`.
