---
name: nestjs-best-practices
description: NestJS architecture, dependency injection, error handling, security, testing and Prisma-backed data-access conventions for this repo's API (apps/api/**). Use when writing, reviewing, or refactoring any NestJS module, controller, service, guard, filter, or Prisma query under apps/api.
license: MIT
metadata:
  author: rush-hours (adapted from Kadajett/agent-nestjs-skills, MIT)
  version: "1.0.0"
---

# NestJS best practices — apps/api

Adapted from https://github.com/Kadajett/agent-nestjs-skills (40 rules, MIT) for this repo's actual setup: NestJS 11 + **Prisma** (not TypeORM) + Jest/Supertest, TypeScript. Examples below reference real files in this repo, not the generic examples from the source. Companion skill for the ORM layer: `prisma-best-practices`.

**Not applicable here** — skip these categories from the source entirely: `micro-*` (no microservices/queues in this repo) and any TypeORM-specific API (`@InjectRepository`, `DataSource`, `createQueryBuilder`) — see `prisma-best-practices` for the Prisma equivalents.

## 1. Architecture (CRITICAL)

**Organize by feature, not by technical layer.** `CLAUDE.md` already states this: "follow Nest convention and add feature modules under `apps/api/src/` rather than growing `AppModule`." Concretely, a new `time-entries` feature gets its own `apps/api/src/time-entries/{time-entries.module,controller,service}.ts` (+ `dto/`), not a shared `controllers/`/`services/` tree. `AppModule` (`apps/api/src/app.module.ts`) only imports feature modules — it must stay a thin composition root.

**Single responsibility per service.** If a service name needs "And" (`UsersAndBillingService`) or mixes unrelated domains, split it. `AppService` today only wraps one Prisma read (`apps/api/src/app.service.ts`) — keep that pattern: one service = one bounded concern, injected where needed, orchestration (calling several services) happens in the controller or a dedicated orchestrator service, not by bloating one service.

**Avoid circular module dependencies.** If two feature modules need each other, extract the shared piece into its own module (the way `PrismaModule` is already extracted and marked `@Global()` in `apps/api/src/prisma/prisma.module.ts`) rather than having module A import module B import module A.

**Export only what's needed.** A feature module's `exports` array should list only the providers other modules actually consume — not everything it declares.

## 2. Dependency Injection (CRITICAL)

**Constructor injection only.** Every provider in this repo already follows this (`PrismaService` injected via constructor in `AppService`) — keep it that way. Never use property injection (`@Inject() private x`) except for genuinely optional dependencies with `@Optional()`.

```typescript
// apps/api/src/app.service.ts (existing pattern to replicate)
@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}
}
```

**Use injection tokens for interfaces.** TypeScript interfaces vanish at runtime. If a feature needs a swappable implementation (e.g. a notification sender), define a `Symbol` token or an abstract class, not a bare interface, as the injection target — see `di-use-interfaces-tokens` in the source for the two patterns (symbol token vs abstract class).

**Know your provider scope.** Everything here is `DEFAULT` (singleton) scope, matching `PrismaService`'s lifecycle (`onModuleInit`/`onModuleDestroy` connect once, disconnect once). Only reach for `Scope.REQUEST` if a provider genuinely needs per-request state — it disables several performance optimizations, so it's an explicit, justified choice, not a default.

## 3. Error Handling (HIGH)

**Throw, don't return, error states — and do it from services.** `AppService.getHello()` already does this correctly (`throw new NotFoundException(...)` instead of returning `{ error: ... }`). Keep controllers thin: they call the service and return its result; they don't `try/catch` and hand-roll a JSON error shape.

**Centralize unhandled errors in a global exception filter.** Not present yet in this repo — when adding cross-cutting error formatting (consistent JSON shape, logging via the Pino logger from `nestjs-pino`, see §8), add one `AllExceptionsFilter implements ExceptionFilter` registered via `APP_FILTER` in `AppModule`, rather than duplicating `try/catch` per controller.

## 4. Security & Validation (HIGH)

This repo's direction (see `prompts/spec/rushhours-full-spec.md`) is **`nestjs-zod`**, not `class-validator`. Adapt the source's "validate all input" principle accordingly:

- Every DTO is a Zod schema (`z.object({...})`), turned into a class via `nestjs-zod`'s `createZodDto`, applied with its `ZodValidationPipe` — this replaces `class-validator` decorators + `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` from the source 1:1 in intent (strip/reject unknown fields, coerce types, fail fast on bad input).
- Validate `@Body()`, `@Query()`, and `@Param()` alike — a route param like a UUID or a `YYYY-MM-DD` date (as used by the planned `time-entries` endpoints) gets its own small Zod schema too, not an unchecked string.
- **Guards for auth/roles**, not manual `if (!req.user)` checks in handlers — one `AuthGuard` reading the session JWT cookie (per the WebAuthn design in the spec), one `RolesGuard` reading a `@Roles()` metadata decorator, both registered globally via `APP_GUARD`, with a `@Public()` decorator to opt out (e.g. the WebAuthn ceremony endpoints themselves, which must be reachable pre-auth).
- **Never return a Prisma model directly if it carries sensitive fields.** Today's `Hello` model has none, but the planned `User`/`Credential` models do (`publicKey`, `counter`, eventually a session secret) — return a plain object/response DTO built from an explicit field list, don't spread the Prisma result into the response body.

## 5. Testing (MEDIUM-HIGH)

Follow the two-tier setup already configured in `apps/api/package.json` (`test` = Jest unit tests colocated as `*.spec.ts` under `src`, `test:e2e` = Supertest against a real Nest app via `test/jest-e2e.json`):

- **Unit tests**: `Test.createTestingModule({ providers: [...] })` with mocked collaborators (`{ provide: PrismaService, useValue: { user: { findUnique: jest.fn(), ... } } }`), never a manually `new`'d service — that bypasses DI and, if the mock is forgotten, can hit the real database.
- **E2E tests**: boot the real `AppModule` (`Test.createTestingModule({ imports: [AppModule] }).compile()` → `createNestApplication()` → `app.init()`), apply the same global pipes/guards/filters as `main.ts`, and hit it with `supertest(app.getHttpServer())`. This is what actually exercises guards, the Zod validation pipe, and serialization end to end.
- Mock genuinely external services (WebAuthn relying-party calls, if ever routed through a third party) — never mock `PrismaService` in an e2e test; e2e tests should hit the real dev/test Postgres brought up by `db:setup`.

## 6. API Design (MEDIUM)

- **Response DTOs, not raw Prisma models**, for anything with fields that shouldn't reach the client (see §4). Simple read models can still return the Prisma result directly (as `AppService.getHello()` does) when there is truly nothing to hide.
- **Route params over query strings for resource identifiers**: `GET /time-entries/:date`, not `GET /time-entries?date=...`, matching the endpoint table in `prompts/spec/rushhours-full-spec.md`.
- No API versioning scheme is needed for this POC (single consumer: the same repo's `apps/web`) — don't add `/v1` prefixes speculatively.

## 7. Database & ORM (MEDIUM-HIGH)

Delegated entirely to the companion skill **`prisma-best-practices`** — load it for anything touching `apps/api/prisma/schema.prisma` or a `PrismaService` query (N+1 avoidance via `include`/`select`, transactions, migrations).

## 8. DevOps: Config & Logging (LOW-MEDIUM)

- **Config**: `@nestjs/config` with `isGlobal: true` and a Joi/Zod validation schema for required env vars (`DATABASE_URL` already required by Prisma per `CLAUDE.md`; the WebAuthn/JWT vars the spec introduces — `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`, `JWT_SECRET` — should fail app startup immediately if missing, not surface as a 500 on first request).
- **Logging**: `nestjs-pino` per the spec (`prompts/spec/rushhours-full-spec.md` §2/§8.3) — inject `PinoLogger`/use `app.useLogger(app.get(Logger))` in `main.ts`, never `console.log`. Never log secrets: WebAuthn challenges, JWTs, cookies — use Pino's `redact` option (`redact: ['req.headers.authorization', 'req.headers.cookie']`) rather than trusting call sites to remember.

## Sources

- https://github.com/Kadajett/agent-nestjs-skills/tree/main/skills/nestjs-best-practices (MIT) — full rule set with generic (TypeORM) examples; this file re-derives the parts applicable to this repo's Prisma-based stack.
- Companion: `.claude/skills/prisma-best-practices/SKILL.md`, `.claude/skills/react-best-practices/SKILL.md`.
- Repo conventions: `CLAUDE.md` (root), `prompts/spec/rushhours-full-spec.md`.
