import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import type { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { SessionService } from "../src/auth/session.service";

/**
 * Spec traceability — `prompts/spec/rushhours-full-spec.md` §6 (`PATCH /users/me`,
 * `GET`/`PUT /users/me/work-schedule`). Runs against the real `AppModule` + Postgres
 * (nestjs-best-practices §5) — a session is obtained by signing a JWT directly via
 * the real `SessionService` rather than driving the full WebAuthn ceremony, which is
 * already covered end to end by `auth.e2e-spec.ts`.
 */
describe("Users (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sessionService: SessionService;
  const createdUsernames: string[] = [];

  async function createAuthenticatedUser(prefix: string) {
    const username = `${prefix}-${randomUUID()}`;
    createdUsernames.push(username);
    const user = await prisma.user.create({ data: { username } });
    const token = await sessionService.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
    });
    return { user, cookie: `rushhours_session=${token}` };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
    sessionService = app.get(SessionService);
  });

  afterAll(async () => {
    if (createdUsernames.length > 0) {
      await prisma.user.deleteMany({
        where: { username: { in: createdUsernames } },
      });
    }
    await app.close();
  });

  describe("PATCH /users/me (§6)", () => {
    it("returns 401 without a session", () => {
      return request(app.getHttpServer())
        .patch("/users/me")
        .send({
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.com",
        })
        .expect(401);
    });

    it("updates the profile fields and returns them (no sensitive fields)", async () => {
      const { cookie } = await createAuthenticatedUser("e2e-profile");

      const response = await request(app.getHttpServer())
        .patch("/users/me")
        .set("Cookie", cookie)
        .send({
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.com",
        })
        .expect(200);

      expect(response.body).toMatchObject({
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
      });
      expect(response.body).not.toHaveProperty("weeklyContractHours");
    });

    it("returns 400 when a required profile field is missing (Zod validation)", async () => {
      const { cookie } = await createAuthenticatedUser("e2e-profile-invalid");

      await request(app.getHttpServer())
        .patch("/users/me")
        .set("Cookie", cookie)
        .send({ firstName: "Ada" })
        .expect(400);
    });
  });

  describe("GET /users/me/work-schedule (§6)", () => {
    it("returns the default (empty) work schedule for a freshly seeded user", async () => {
      const { cookie } = await createAuthenticatedUser("e2e-get-schedule");

      const response = await request(app.getHttpServer())
        .get("/users/me/work-schedule")
        .set("Cookie", cookie)
        .expect(200);

      expect(response.body).toMatchObject({
        weeklyContractHours: 35,
        weekStartDay: "MONDAY",
        days: [],
      });
    });
  });

  describe("PUT /users/me/work-schedule (§5.5/§6)", () => {
    it("replaces the schedule and sets onboardingCompletedAt when previously absent", async () => {
      const { user, cookie } =
        await createAuthenticatedUser("e2e-put-schedule");

      const response = await request(app.getHttpServer())
        .put("/users/me/work-schedule")
        .set("Cookie", cookie)
        .send({
          weeklyContractHours: 35,
          weekStartDay: "MONDAY",
          days: [
            { weekday: "MONDAY", targetMinutes: 420 },
            { weekday: "TUESDAY", targetMinutes: 420 },
            { weekday: "WEDNESDAY", targetMinutes: 420 },
            { weekday: "THURSDAY", targetMinutes: 420 },
            { weekday: "FRIDAY", targetMinutes: 420 },
          ],
        })
        .expect(200);

      expect(response.body).toMatchObject({
        weeklyContractHours: 35,
        weekStartDay: "MONDAY",
      });
      const body = response.body as { days: unknown[] };
      expect(body.days).toHaveLength(5);

      const updated = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(updated.onboardingCompletedAt).not.toBeNull();
    });

    it("returns 400 (not 500) when the sum of targetMinutes doesn't match weeklyContractHours * 60", async () => {
      const { cookie } = await createAuthenticatedUser(
        "e2e-put-schedule-invalid",
      );

      await request(app.getHttpServer())
        .put("/users/me/work-schedule")
        .set("Cookie", cookie)
        .send({
          weeklyContractHours: 35,
          weekStartDay: "MONDAY",
          days: [{ weekday: "MONDAY", targetMinutes: 60 }],
        })
        .expect(400);
    });

    it("returns 400 (not 500) when zero days are checked", async () => {
      const { cookie } = await createAuthenticatedUser(
        "e2e-put-schedule-zero-days",
      );

      await request(app.getHttpServer())
        .put("/users/me/work-schedule")
        .set("Cookie", cookie)
        .send({
          weeklyContractHours: 35,
          weekStartDay: "MONDAY",
          days: [],
        })
        .expect(400);
    });

    it("fully replaces the previous configuration: a day dropped from the new payload disappears from a subsequent read", async () => {
      const { cookie } = await createAuthenticatedUser(
        "e2e-put-schedule-replace",
      );

      await request(app.getHttpServer())
        .put("/users/me/work-schedule")
        .set("Cookie", cookie)
        .send({
          weeklyContractHours: 35,
          weekStartDay: "MONDAY",
          days: [
            { weekday: "MONDAY", targetMinutes: 420 },
            { weekday: "TUESDAY", targetMinutes: 420 },
            { weekday: "WEDNESDAY", targetMinutes: 420 },
            { weekday: "THURSDAY", targetMinutes: 420 },
            { weekday: "FRIDAY", targetMinutes: 420 },
          ],
        })
        .expect(200);

      // Second PUT drops Thursday and Friday entirely and lowers weeklyContractHours
      // to match (a full replace, not a merge/patch of the previous config).
      const response = await request(app.getHttpServer())
        .put("/users/me/work-schedule")
        .set("Cookie", cookie)
        .send({
          weeklyContractHours: 21,
          weekStartDay: "MONDAY",
          days: [
            { weekday: "MONDAY", targetMinutes: 420 },
            { weekday: "TUESDAY", targetMinutes: 420 },
            { weekday: "WEDNESDAY", targetMinutes: 420 },
          ],
        })
        .expect(200);

      const body = response.body as {
        days: { weekday: string; targetMinutes: number }[];
      };
      expect(body.days).toHaveLength(3);
      expect(body.days.map((day) => day.weekday).sort()).toEqual(
        ["MONDAY", "TUESDAY", "WEDNESDAY"].sort(),
      );

      const getResponse = await request(app.getHttpServer())
        .get("/users/me/work-schedule")
        .set("Cookie", cookie)
        .expect(200);
      const getBody = getResponse.body as {
        days: { weekday: string }[];
      };
      expect(getBody.days).toHaveLength(3);
      expect(getBody.days.some((day) => day.weekday === "THURSDAY")).toBe(
        false,
      );
      expect(getBody.days.some((day) => day.weekday === "FRIDAY")).toBe(false);
    });

    it("sets onboardingCompletedAt on the first successful PUT and never overwrites it on a later one", async () => {
      const { user, cookie } = await createAuthenticatedUser(
        "e2e-put-schedule-onboarding",
      );

      await request(app.getHttpServer())
        .put("/users/me/work-schedule")
        .set("Cookie", cookie)
        .send({
          weeklyContractHours: 35,
          weekStartDay: "MONDAY",
          days: [
            { weekday: "MONDAY", targetMinutes: 420 },
            { weekday: "TUESDAY", targetMinutes: 420 },
            { weekday: "WEDNESDAY", targetMinutes: 420 },
            { weekday: "THURSDAY", targetMinutes: 420 },
            { weekday: "FRIDAY", targetMinutes: 420 },
          ],
        })
        .expect(200);

      const afterFirstPut = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(afterFirstPut.onboardingCompletedAt).not.toBeNull();

      await request(app.getHttpServer())
        .put("/users/me/work-schedule")
        .set("Cookie", cookie)
        .send({
          weeklyContractHours: 40,
          weekStartDay: "TUESDAY",
          days: [
            { weekday: "MONDAY", targetMinutes: 480 },
            { weekday: "TUESDAY", targetMinutes: 480 },
            { weekday: "WEDNESDAY", targetMinutes: 480 },
            { weekday: "THURSDAY", targetMinutes: 480 },
            { weekday: "FRIDAY", targetMinutes: 480 },
          ],
        })
        .expect(200);

      const afterSecondPut = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(afterSecondPut.onboardingCompletedAt?.getTime()).toBe(
        afterFirstPut.onboardingCompletedAt?.getTime(),
      );
    });
  });

  describe("PATCH /users/me only touches profile fields (§6)", () => {
    it("leaves weeklyContractHours, weekStartDay and onboardingCompletedAt untouched", async () => {
      const { user, cookie } = await createAuthenticatedUser("e2e-patch-scope");

      await request(app.getHttpServer())
        .put("/users/me/work-schedule")
        .set("Cookie", cookie)
        .send({
          weeklyContractHours: 37,
          weekStartDay: "WEDNESDAY",
          days: [
            { weekday: "MONDAY", targetMinutes: 444 },
            { weekday: "TUESDAY", targetMinutes: 444 },
            { weekday: "WEDNESDAY", targetMinutes: 444 },
            { weekday: "THURSDAY", targetMinutes: 444 },
            { weekday: "FRIDAY", targetMinutes: 444 },
          ],
        })
        .expect(200);

      const beforePatch = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });

      await request(app.getHttpServer())
        .patch("/users/me")
        .set("Cookie", cookie)
        .send({
          firstName: "Grace",
          lastName: "Hopper",
          email: "grace@example.com",
        })
        .expect(200);

      const afterPatch = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });

      expect(afterPatch.firstName).toBe("Grace");
      expect(afterPatch.lastName).toBe("Hopper");
      expect(afterPatch.email).toBe("grace@example.com");
      expect(afterPatch.weeklyContractHours.toString()).toBe(
        beforePatch.weeklyContractHours.toString(),
      );
      expect(afterPatch.weekStartDay).toBe(beforePatch.weekStartDay);
      expect(afterPatch.onboardingCompletedAt?.getTime()).toBe(
        beforePatch.onboardingCompletedAt?.getTime(),
      );
    });
  });

  describe("Multi-user isolation (§6)", () => {
    it("a user's work-schedule write is invisible to another user's read", async () => {
      const userA = await createAuthenticatedUser("e2e-isolation-schedule-a");
      const userB = await createAuthenticatedUser("e2e-isolation-schedule-b");

      await request(app.getHttpServer())
        .put("/users/me/work-schedule")
        .set("Cookie", userA.cookie)
        .send({
          weeklyContractHours: 40,
          weekStartDay: "MONDAY",
          days: [
            { weekday: "MONDAY", targetMinutes: 480 },
            { weekday: "TUESDAY", targetMinutes: 480 },
            { weekday: "WEDNESDAY", targetMinutes: 480 },
            { weekday: "THURSDAY", targetMinutes: 480 },
            { weekday: "FRIDAY", targetMinutes: 480 },
          ],
        })
        .expect(200);

      const scheduleB = await request(app.getHttpServer())
        .get("/users/me/work-schedule")
        .set("Cookie", userB.cookie)
        .expect(200);

      expect(scheduleB.body).toMatchObject({
        weeklyContractHours: 35,
        weekStartDay: "MONDAY",
        days: [],
      });
    });
  });
});
