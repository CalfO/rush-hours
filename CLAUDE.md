# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

RushHours — a POC monorepo (npm workspaces) exploring the React / NestJS / Prisma stack, built and run inside a GitHub Codespace. Goal: let an employee enter arrival/departure times per worked day and see monthly worked hours computed on the fly.

- `apps/web` — React 18 + Vite frontend (plain JS/JSX, no TypeScript).
- `apps/api` — NestJS + Prisma backend, TypeScript, backed by PostgreSQL.

## Commands

Run everything from the repo root unless noted.

```bash
npm install               # installs all workspaces
npm run dev                # runs web (port 3000) + api (port 3001) concurrently
npm run dev:web             # web only
npm run dev:api             # api only
npm run build                # builds all workspaces
npm run test                  # runs tests in all workspaces
npm run lint                   # lints all workspaces (only api currently has a lint script)
npm run prisma:generate         # regenerate Prisma client (delegates to apps/api)
npm run prisma:migrate           # create/apply a dev migration (delegates to apps/api)
```

Per-workspace (run with `--workspace api` / `--workspace web`, or `cd` into the app dir):

```bash
# apps/api
npm run start:dev --workspace api      # watch mode (auto-runs db:setup first, see below)
npm run test --workspace api            # jest unit tests
npm run test --workspace api -- app.controller.spec   # single test file
npm run test:e2e --workspace api          # supertest e2e tests against a real Nest app + DB
npm run prisma:studio --workspace api      # open Prisma Studio

# apps/web
npm run test --workspace web              # vitest
npm run test --workspace web -- App.test    # single test file
```

## Architecture

### Monorepo & dev orchestration
Root `package.json` defines workspaces `apps/*` and uses `concurrently` to run both apps for `npm run dev`. There is no shared/lib package — web and api are fully independent, communicating only over HTTP.

### Database bring-up is automatic
`docker-compose.yml` (repo root) defines a single `db` service (Postgres 16, credentials `postgres/postgres/app`, named volume). `apps/api/package.json` wires this into the npm lifecycle: `prestart` and `prestart:dev` hooks run `db:setup`, which chains `docker compose up -d` → `wait-on tcp:localhost:5432` → `prisma migrate deploy` → `prisma db seed`. This means simply running `npm run start:dev` (or the root `npm run dev`) brings up Postgres, applies migrations, and seeds data with no manual steps — do not remove these hooks without preserving that behavior.

### Prisma access pattern
`apps/api/src/prisma/prisma.service.ts` wraps `PrismaClient` in a Nest injectable (`onModuleInit`/`onModuleDestroy` handle connect/disconnect). `apps/api/src/prisma/prisma.module.ts` is `@Global()`, so `PrismaService` is injectable anywhere without re-importing the module. Application services (e.g. `AppService`) depend on `PrismaService`, not on `PrismaClient` directly.

Seeding logic lives in `apps/api/prisma/seed.ts` and is registered via the `prisma.seed` key in `apps/api/package.json` (Prisma's seed convention) — it is invoked both by `prisma migrate dev` and by the `db:setup` chain above.

### Frontend → backend calls and Codespaces CORS
`apps/web/src/App.jsx` calls the API through `import.meta.env.VITE_API_URL` (set in `apps/web/.env`). In dev this is set to `/api`, and `apps/web/vite.config.js` proxies `/api/*` to `http://localhost:3001/*` (Vite dev server rewrites, stripping the `/api` prefix). This exists specifically because GitHub Codespaces' forwarded-port reverse proxy injects its own auth layer, which breaks true cross-origin calls between two forwarded ports (e.g. the `*-3000.app.github.dev` origin calling `*-3001.app.github.dev` directly) with an opaque CORS/missing-header error. Keep frontend↔backend calls same-origin through this proxy rather than pointing `VITE_API_URL` at the forwarded 3001 URL directly. `apps/api/src/main.ts` also calls `app.enableCors()` unconditionally, which is needed for direct (non-Codespaces) access but is not what fixes the Codespaces case.

### Nest module shape
Standard single-module Nest app so far: `AppModule` imports `PrismaModule` and declares `AppController`/`AppService`. As real RushHours features are added (time entries, employees, monthly totals), follow Nest convention and add feature modules under `apps/api/src/` rather than growing `AppModule`.
