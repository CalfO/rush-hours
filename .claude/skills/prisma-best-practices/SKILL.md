---
name: prisma-best-practices
description: Prisma schema, query shape, transaction, and PrismaClient lifecycle conventions for this repo's API (apps/api/prisma/**, apps/api/src/prisma/**). Use when writing or reviewing a schema change, migration, or any PrismaClient query.
license: MIT
metadata:
  author: rush-hours (adapted from prisma/skills prisma-client-api, MIT, and Prisma docs)
  version: "1.0.0"
---

# Prisma best practices — apps/api

This repo runs Prisma **6.19.3** via the classic `prisma-client-js` generator (`apps/api/prisma/schema.prisma`, client generated into `node_modules/@prisma/client`). Some official Prisma examples (v7-era `generated/client` output path + driver adapters like `@prisma/adapter-pg`) do **not** apply here — don't introduce a driver adapter or change the generator output path without a deliberate migration; use the plain `PrismaClient` import.

## 1. One shared client — already enforced, don't bypass it

`apps/api/src/prisma/prisma.service.ts` wraps a single `PrismaClient` in a Nest injectable with `onModuleInit`/`onModuleDestroy` for connect/disconnect. `apps/api/src/prisma/prisma.module.ts` is `@Global()`, so `PrismaService` is injectable anywhere without re-importing the module. **Never call `new PrismaClient()` anywhere else** — every extra instance opens its own connection pool against the same Postgres container, which is exactly the "connection pool exhaustion" failure mode Prisma's own docs warn about. Application services depend on `PrismaService`, never on `PrismaClient` directly (see `AppService`).

## 2. Query shape: be explicit, avoid N+1

- Prefer `select`/`include` with an explicit field list over fetching whole rows you don't need — cheaper over the wire and it documents what a call actually uses.
- Load relations with `include` (optionally filtered/paginated: `include: { entries: { where: {...}, take: 30 } }`) instead of looping and querying per-parent — that loop is the classic N+1. Example for the planned `time-entries` summary endpoint (`prompts/spec/rushhours-full-spec.md` §6): fetch a user's `TimeEntry` rows for a month in one `findMany({ where: { userId, date: { gte, lte } } })`, never per-day queries in a loop.
- Use `_count` (`select: { _count: { select: { timeEntries: true } } }`) instead of a separate `count()` round-trip when you just need a relation count alongside the parent.
- `findUniqueOrThrow`/`findFirstOrThrow` collapse a "fetch then manually throw `NotFoundException` if null" pair into one call — use them in services that already throw on missing records (see `nestjs-best-practices` §3).

## 3. Transactions

Two shapes, pick deliberately:

- **Sequential** (`prisma.$transaction([opA, opB])`) for independent operations that must all-or-nothing commit, with no branching between them.
- **Interactive** (`prisma.$transaction(async (tx) => {...})`) whenever a later step depends on an earlier step's result or on a conditional check — e.g. verifying a WebAuthn credential's `counter` hasn't gone backwards before incrementing it must read-then-write inside one interactive transaction, not as two separate `PrismaService` calls, or a replay could race past the check.
- Inside an interactive transaction, use the `tx` parameter for every query, never the outer `prisma`/`this.prisma` — mixing the two silently escapes the transaction boundary.
- Keep transactions short: do any pure computation (e.g. this project's balance/minutes math, see `prompts/spec/rushhours-full-spec.md` §4) **before** opening the transaction, not inside it, so a lock isn't held across expensive synchronous work.
- Nested writes (`prisma.user.create({ data: { credentials: { create: {...} } } })`) are automatically transactional — don't manually wrap them in `$transaction` again.

## 4. Migrations

Already automated by `apps/api/package.json`'s `db:setup` chain (`docker:up && db:wait && prisma generate && prisma migrate deploy && prisma db seed`, run via `prestart`/`prestart:dev` — see `CLAUDE.md`). Consequences for day-to-day work:

- **Local schema changes**: run `npm run prisma:migrate --workspace api` (= `prisma migrate dev`), which creates a new migration file and applies it — this is what generates the migration `db:setup`'s `migrate deploy` will replay for anyone else who pulls the branch.
- **Never hand-edit a migration file that has already been applied** anywhere (including your own local dev DB) — create a new migration instead. Editing history causes `migrate deploy` to detect drift and refuse to apply cleanly.
- After any schema edit, `prisma generate` must re-run before the new fields/models are visible to TypeScript — `db:setup` already does this on every `start`/`start:dev`, but a mid-session schema edit without restarting the dev server needs a manual `npm run prisma:generate --workspace api` (this is exactly the `EADDRINUSE`-adjacent "client did not initialize" failure mode already hit once in this repo's history — regenerate before assuming the client is broken).

## 5. Schema conventions

- Keep the existing naming convention: PascalCase model names, camelCase fields, `@@map("snake_case_table")` for the actual table name (see `Hello` → `@@map("hello")`, and the models in `prompts/spec/rushhours-full-spec.md` §3 which all follow this).
- Add `@@unique([...])` for natural composite keys the app relies on for upserts (e.g. `TimeEntry`'s `@@unique([userId, date])`) rather than enforcing uniqueness only in application code — the DB constraint is the actual source of truth and makes `upsert` possible.
- Use `Decimal`/`@db.Decimal(p, s)` for values like `weeklyContractHours` that must support arbitrary fractional input — not `Float`, which can introduce rounding error in comparisons.
- Index foreign keys and any field used in a frequent `where`/`orderBy` (Prisma adds an index on relation scalar fields by default for most connectors, but composite/query-pattern-specific indexes are not automatic — add them explicitly via `@@index([...])` once real query patterns exist).

## 6. Testing

- **Unit tests**: mock `PrismaService` (`{ provide: PrismaService, useValue: { timeEntry: { findMany: jest.fn(), upsert: jest.fn() } } }`) — see `nestjs-best-practices` §5. Never let a unit test hit the real Postgres container.
- **E2E tests**: run against the real dev/test database brought up by `db:setup` — this is what actually validates a Prisma query/constraint (e.g. that the `@@unique([userId, date])` upsert behaves as expected), which a mocked unit test cannot.

## Sources

- https://github.com/prisma/skills/tree/main/prisma-client-api (MIT, official Prisma agent-skills repo) — client API reference (queries, relations, transactions); this file adapts it to this repo's Prisma 6 / classic-generator setup.
- https://www.prisma.io/docs/orm/more/best-practices, https://www.prisma.io/docs/orm/prisma-client/queries/advanced/query-optimization-performance — production/perf guidance (connection pooling, N+1).
- Repo conventions: `CLAUDE.md` (root, "Prisma access pattern" and "Database bring-up is automatic" sections), `prompts/spec/rushhours-full-spec.md` §3–§4.
