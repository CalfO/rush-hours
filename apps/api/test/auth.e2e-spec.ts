import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import type { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { WebauthnService } from "../src/auth/webauthn.service";
import { SESSION_COOKIE_NAME } from "../src/auth/session.service";

/**
 * Spec traceability — `prompts/spec/rushhours-full-spec.md` §5.1 (POC constraint:
 * no free sign-up, only seeded accounts, bootstrap-enrollment is single-use) and
 * §5.2 (the full WebAuthn endpoints table). Runs against the real `AppModule` +
 * real Postgres (see `db:setup` in `CLAUDE.md`) via Supertest, exercising the
 * `AuthGuard`, the Zod validation pipe, cookie handling and Prisma constraints end
 * to end — see nestjs-best-practices §5.
 *
 * Only the WebAuthn cryptographic boundary (`WebauthnService`, a thin wrapper
 * around `@simplewebauthn/server`) is stubbed: a real browser/authenticator
 * ceremony can't be driven from Supertest, and this is exactly the "genuinely
 * external service" prisma-best-practices §6 says is fine to mock in an e2e test
 * — everything else (Prisma, the guard, the session cookie) is real.
 */
describe("Auth WebAuthn (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdUsernames: string[] = [];

  const webauthnMock = {
    generateRegistrationOptions: jest.fn(),
    verifyRegistrationResponse: jest.fn(),
    generateAuthenticationOptions: jest.fn(),
    verifyAuthenticationResponse: jest.fn(),
  };

  function freshUsername(prefix: string): string {
    const username = `${prefix}-${randomUUID()}`;
    createdUsernames.push(username);
    return username;
  }

  async function createUser(username: string) {
    return prisma.user.create({ data: { username } });
  }

  /** Registers a passkey for `username` via the real endpoints (mocked crypto). */
  async function enrollCredential(
    username: string,
    credentialId: string,
  ): Promise<void> {
    await request(app.getHttpServer())
      .post("/auth/webauthn/register/options")
      .send({ username })
      .expect(201);

    await request(app.getHttpServer())
      .post("/auth/webauthn/register/verify")
      .send({ username, attestationResponse: { id: credentialId } })
      .expect(201);
  }

  beforeAll(async () => {
    webauthnMock.generateRegistrationOptions.mockResolvedValue({
      challenge: "mock-registration-challenge",
      rp: { name: "RushHours", id: "localhost" },
      user: { id: "mock-user-id", name: "mock", displayName: "mock" },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
      attestation: "none",
    });
    webauthnMock.verifyRegistrationResponse.mockImplementation(
      (attestationResponse: { id: string }) => ({
        verified: true,
        registrationInfo: {
          credential: {
            id: attestationResponse.id,
            publicKey: new Uint8Array([1, 2, 3, 4]),
            counter: 0,
            transports: ["internal"],
          },
        },
      }),
    );
    webauthnMock.generateAuthenticationOptions.mockResolvedValue({
      challenge: "mock-authentication-challenge",
      rpId: "localhost",
      allowCredentials: [],
    });
    webauthnMock.verifyAuthenticationResponse.mockImplementation(
      (assertionResponse: { newCounter?: number }) => ({
        verified: true,
        authenticationInfo: { newCounter: assertionResponse.newCounter ?? 1 },
      }),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WebauthnService)
      .useValue(webauthnMock)
      .compile();

    app = moduleFixture.createNestApplication();
    // Mirrors main.ts's bootstrap so the session cookie is actually parsed.
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterEach(() => {
    webauthnMock.verifyRegistrationResponse.mockClear();
    webauthnMock.verifyAuthenticationResponse.mockClear();
  });

  afterAll(async () => {
    if (createdUsernames.length > 0) {
      await prisma.user.deleteMany({
        where: { username: { in: createdUsernames } },
      });
    }
    await app.close();
  });

  function getCookieHeader(response: request.Response): string {
    // The `@types/superagent` typing declares `headers` as `{ [index: string]: string }`,
    // but a `Set-Cookie` header is emitted (and read back by Node) as an array when
    // present, so the real runtime shape is wider than the declared type.
    const raw = response.headers["set-cookie"] as string | string[] | undefined;
    const cookies: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const sessionCookie = cookies.find((c) =>
      c.startsWith(`${SESSION_COOKIE_NAME}=`),
    );
    if (!sessionCookie) {
      throw new Error("Expected a session cookie in the response");
    }
    return sessionCookie;
  }

  describe("POST /auth/webauthn/register/options (§5.2)", () => {
    it("returns 409 for an unknown username", () => {
      return request(app.getHttpServer())
        .post("/auth/webauthn/register/options")
        .send({ username: `no-such-user-${randomUUID()}` })
        .expect(409);
    });

    it("returns creation options (200/201) for a known username with zero credentials", async () => {
      const username = freshUsername("e2e-reg-options");
      await createUser(username);

      const response = await request(app.getHttpServer())
        .post("/auth/webauthn/register/options")
        .send({ username })
        .expect(201);

      expect(response.body).toMatchObject({
        challenge: "mock-registration-challenge",
        rp: expect.any(Object) as object,
        user: expect.any(Object) as object,
      });
    });

    it("returns 409 once the account already has a credential (§5.1: single enrollment)", async () => {
      const username = freshUsername("e2e-reg-already-enrolled");
      await createUser(username);
      await enrollCredential(username, `cred-${username}`);

      await request(app.getHttpServer())
        .post("/auth/webauthn/register/options")
        .send({ username })
        .expect(409);
    });
  });

  describe("POST /auth/webauthn/register/verify (§5.2)", () => {
    it("verifies, persists the Credential, and sets an httpOnly SameSite=Lax session cookie", async () => {
      const username = freshUsername("e2e-reg-verify");
      await createUser(username);
      const credentialId = `cred-${username}`;

      await request(app.getHttpServer())
        .post("/auth/webauthn/register/options")
        .send({ username })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post("/auth/webauthn/register/verify")
        .send({ username, attestationResponse: { id: credentialId } })
        .expect(201);

      expect(response.body).toEqual({ verified: true });

      const cookie = getCookieHeader(response);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);

      const credential = await prisma.credential.findUnique({
        where: { credentialId },
      });
      expect(credential).not.toBeNull();
      expect(credential?.counter).toBe(BigInt(0));
    });
  });

  describe("POST /auth/webauthn/login/options (§5.2)", () => {
    it("returns 404 for an unknown username", () => {
      return request(app.getHttpServer())
        .post("/auth/webauthn/login/options")
        .send({ username: `no-such-user-${randomUUID()}` })
        .expect(404);
    });

    it("returns 404 for a known username with zero credentials", async () => {
      const username = freshUsername("e2e-login-no-cred");
      await createUser(username);

      await request(app.getHttpServer())
        .post("/auth/webauthn/login/options")
        .send({ username })
        .expect(404);
    });

    it("returns request options for a known username with a credential", async () => {
      const username = freshUsername("e2e-login-options-ok");
      await createUser(username);
      await enrollCredential(username, `cred-${username}`);

      const response = await request(app.getHttpServer())
        .post("/auth/webauthn/login/options")
        .send({ username })
        .expect(201);

      expect(response.body).toMatchObject({
        challenge: "mock-authentication-challenge",
      });
    });
  });

  describe("POST /auth/webauthn/login/verify (§5.2)", () => {
    it("verifies the assertion, increments the credential counter, and sets the session cookie", async () => {
      const username = freshUsername("e2e-login-verify");
      await createUser(username);
      const credentialId = `cred-${username}`;
      await enrollCredential(username, credentialId);

      await request(app.getHttpServer())
        .post("/auth/webauthn/login/options")
        .send({ username })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post("/auth/webauthn/login/verify")
        .send({
          username,
          assertionResponse: { id: credentialId, newCounter: 42 },
        })
        .expect(201);

      expect(response.body).toEqual({ verified: true });
      expect(getCookieHeader(response)).toMatch(/HttpOnly/i);

      const credential = await prisma.credential.findUnique({
        where: { credentialId },
      });
      expect(credential?.counter).toBe(BigInt(42));
    });

    it("returns 401 when the assertion references an unknown credential id, without changing the counter", async () => {
      const username = freshUsername("e2e-login-bad-cred");
      await createUser(username);
      const credentialId = `cred-${username}`;
      await enrollCredential(username, credentialId);

      await request(app.getHttpServer())
        .post("/auth/webauthn/login/options")
        .send({ username })
        .expect(201);

      await request(app.getHttpServer())
        .post("/auth/webauthn/login/verify")
        .send({
          username,
          assertionResponse: { id: "not-the-real-credential-id" },
        })
        .expect(401);

      const credential = await prisma.credential.findUnique({
        where: { credentialId },
      });
      expect(credential?.counter).toBe(BigInt(0));
    });

    it("returns 401 when there is no pending challenge (login/verify called without login/options first)", async () => {
      const username = freshUsername("e2e-login-no-challenge");
      await createUser(username);
      const credentialId = `cred-${username}`;
      await enrollCredential(username, credentialId);

      await request(app.getHttpServer())
        .post("/auth/webauthn/login/verify")
        .send({ username, assertionResponse: { id: credentialId } })
        .expect(401);
    });

    it("a single login/options challenge cannot authenticate two assertions (single-use, replay protection)", async () => {
      const username = freshUsername("e2e-login-replay");
      await createUser(username);
      const credentialId = `cred-${username}`;
      await enrollCredential(username, credentialId);

      await request(app.getHttpServer())
        .post("/auth/webauthn/login/options")
        .send({ username })
        .expect(201);

      await request(app.getHttpServer())
        .post("/auth/webauthn/login/verify")
        .send({
          username,
          assertionResponse: { id: credentialId, newCounter: 5 },
        })
        .expect(201);

      // Replaying against the same (already-consumed) challenge must fail.
      await request(app.getHttpServer())
        .post("/auth/webauthn/login/verify")
        .send({
          username,
          assertionResponse: { id: credentialId, newCounter: 6 },
        })
        .expect(401);

      const credential = await prisma.credential.findUnique({
        where: { credentialId },
      });
      expect(credential?.counter).toBe(BigInt(5));
    });
  });

  describe("POST /auth/logout (§5.2, @Public and idempotent)", () => {
    it("succeeds with no session cookie at all", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/logout")
        .expect(201);

      expect(response.body).toEqual({ success: true });
    });

    it("is idempotent: calling it twice in a row both succeed", async () => {
      await request(app.getHttpServer()).post("/auth/logout").expect(201);
      await request(app.getHttpServer()).post("/auth/logout").expect(201);
    });

    it("clears the session cookie when called with a valid session", async () => {
      const username = freshUsername("e2e-logout-with-session");
      await createUser(username);
      const credentialId = `cred-${username}`;
      await enrollCredential(username, credentialId);

      await request(app.getHttpServer())
        .post("/auth/webauthn/login/options")
        .send({ username })
        .expect(201);
      const loginResponse = await request(app.getHttpServer())
        .post("/auth/webauthn/login/verify")
        .send({ username, assertionResponse: { id: credentialId } })
        .expect(201);
      const sessionCookie = getCookieHeader(loginResponse);

      const logoutResponse = await request(app.getHttpServer())
        .post("/auth/logout")
        .set("Cookie", sessionCookie)
        .expect(201);

      expect(logoutResponse.body).toEqual({ success: true });
      const cleared = getCookieHeader(logoutResponse);
      // express's res.clearCookie() re-issues the cookie with an epoch expiry.
      expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/i);
    });
  });

  describe("GET /auth/me (§5.2)", () => {
    it("returns 401 with no session cookie", () => {
      return request(app.getHttpServer()).get("/auth/me").expect(401);
    });

    it("returns 401 with a garbage session cookie", () => {
      return request(app.getHttpServer())
        .get("/auth/me")
        .set("Cookie", `${SESSION_COOKIE_NAME}=not-a-real-jwt`)
        .expect(401);
    });

    it("returns the current user's public profile (and nothing sensitive) for a valid session", async () => {
      const username = freshUsername("e2e-me");
      await createUser(username);
      const credentialId = `cred-${username}`;
      const registerVerifyResponse = await (async () => {
        await request(app.getHttpServer())
          .post("/auth/webauthn/register/options")
          .send({ username })
          .expect(201);
        return request(app.getHttpServer())
          .post("/auth/webauthn/register/verify")
          .send({ username, attestationResponse: { id: credentialId } })
          .expect(201);
      })();
      const sessionCookie = getCookieHeader(registerVerifyResponse);

      const response = await request(app.getHttpServer())
        .get("/auth/me")
        .set("Cookie", sessionCookie)
        .expect(200);

      // `superagent`'s `Response.body` is typed `any`; narrow it once here so the
      // property accesses below are type-checked instead of unsafe `any` access.
      const body = response.body as Record<string, unknown>;
      expect(body).toMatchObject({
        username,
        role: "USER",
        onboardingCompletedAt: null,
      });
      expect(body.id).toEqual(expect.any(String));
      const forbiddenKeys = [
        "credentials",
        "publicKey",
        "counter",
        "password",
        "webauthnChallenges",
      ];
      for (const key of forbiddenKeys) {
        expect(body).not.toHaveProperty(key);
      }
    });
  });
});
