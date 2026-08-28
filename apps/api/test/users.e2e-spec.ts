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

    it("returns 409 (not 500) when the email is already used by another user", async () => {
      const owner = await createAuthenticatedUser("e2e-profile-email-owner");
      const { cookie } = await createAuthenticatedUser(
        "e2e-profile-email-claimer",
      );
      const takenEmail = `taken-${randomUUID()}@example.com`;

      await request(app.getHttpServer())
        .patch("/users/me")
        .set("Cookie", owner.cookie)
        .send({
          firstName: "Grace",
          lastName: "Hopper",
          email: takenEmail,
        })
        .expect(200);

      await request(app.getHttpServer())
        .patch("/users/me")
        .set("Cookie", cookie)
        .send({
          firstName: "Ada",
          lastName: "Lovelace",
          email: takenEmail,
        })
        .expect(409);
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

  /**
   * Spec traceability — `prompts/spec/time-entry-ux-and-reference-week.md` §5.1
   * (one reference week per user, indexed by `Weekday` not `Date`, only covers
   * working days) and §5.4 (the three `/users/me/reference-week` endpoints +
   * the weekday-subset validation). Schema-level edge cases (minute bounds,
   * lunch window, duplicate weekday) are already covered by
   * `packages/domain/src/reference-week.schema.spec.ts` — this block only
   * exercises the HTTP/service layer: auth, persistence, full-replace
   * semantics, cross-user isolation, and the weekday-subset 400.
   */
  describe("GET/PUT/DELETE /users/me/reference-week (§5.4)", () => {
    /** A day's worth of valid reference-week minutes (§5.3 cross-field rules). */
    const referenceDay = (weekday: string) => ({
      weekday,
      arrivalMinutes: 540, // 09:00
      lunchBreakStartMinutes: 720, // 12:00
      lunchBreakEndMinutes: 780, // 13:00
      departureMinutes: 1020, // 17:00
    });

    /** Sets the user's WorkingDaySchedule to exactly the given weekdays (§5.1: a
     * reference week can only cover weekdays present in the *current* schedule). */
    async function setWorkingDays(cookie: string, weekdays: string[]) {
      // 420 minutes/day (7h) per working day — weeklyContractHours must match the
      // sum exactly (workScheduleSchema, spec d'origine §5.5), so it scales with
      // however many weekdays this particular test configures (1 to 7).
      await request(app.getHttpServer())
        .put("/users/me/work-schedule")
        .set("Cookie", cookie)
        .send({
          weeklyContractHours: weekdays.length * 7,
          weekStartDay: "MONDAY",
          days: weekdays.map((weekday) => ({ weekday, targetMinutes: 420 })),
        })
        .expect(200);
    }

    it("§5.1: GET returns { exists: false, days: [] } when nothing was ever saved", async () => {
      const { cookie } = await createAuthenticatedUser("e2e-refweek-get-none");

      const response = await request(app.getHttpServer())
        .get("/users/me/reference-week")
        .set("Cookie", cookie)
        .expect(200);

      expect(response.body).toEqual({ exists: false, days: [] });
    });

    it("§5.4: PUT a valid full replace persists exactly what was sent, reflected by a subsequent GET", async () => {
      const { cookie } = await createAuthenticatedUser("e2e-refweek-put");
      await setWorkingDays(cookie, ["MONDAY", "WEDNESDAY", "FRIDAY"]);

      const days = [
        referenceDay("MONDAY"),
        referenceDay("WEDNESDAY"),
        referenceDay("FRIDAY"),
      ];

      const putResponse = await request(app.getHttpServer())
        .put("/users/me/reference-week")
        .set("Cookie", cookie)
        .send(days)
        .expect(200);

      expect(putResponse.body.exists).toBe(true);
      expect(putResponse.body.days).toHaveLength(3);

      const getResponse = await request(app.getHttpServer())
        .get("/users/me/reference-week")
        .set("Cookie", cookie)
        .expect(200);

      expect(getResponse.body.exists).toBe(true);
      const getDays = getResponse.body.days as Array<Record<string, unknown>>;
      expect(getDays).toHaveLength(3);
      expect(
        getDays
          .map((d) => d.weekday)
          .sort(),
      ).toEqual(["FRIDAY", "MONDAY", "WEDNESDAY"]);
      for (const day of days) {
        const persisted = getDays.find((d) => d.weekday === day.weekday);
        expect(persisted).toMatchObject({
          weekday: day.weekday,
          arrivalMinutes: day.arrivalMinutes,
          departureMinutes: day.departureMinutes,
          lunchBreakStartMinutes: day.lunchBreakStartMinutes,
          lunchBreakEndMinutes: day.lunchBreakEndMinutes,
        });
      }
    });

    it("§5.1/§5.4: a second PUT is a full replace, not a merge — the previous set is entirely gone", async () => {
      const { cookie } = await createAuthenticatedUser("e2e-refweek-replace");
      await setWorkingDays(cookie, ["MONDAY", "TUESDAY", "WEDNESDAY"]);

      await request(app.getHttpServer())
        .put("/users/me/reference-week")
        .set("Cookie", cookie)
        .send([
          referenceDay("MONDAY"),
          referenceDay("TUESDAY"),
          referenceDay("WEDNESDAY"),
        ])
        .expect(200);

      // Narrow the working days and PUT a different, smaller set with different times.
      await setWorkingDays(cookie, ["MONDAY", "TUESDAY"]);
      const secondPut = {
        ...referenceDay("MONDAY"),
        arrivalMinutes: 480, // 08:00, different from the first PUT
      };

      await request(app.getHttpServer())
        .put("/users/me/reference-week")
        .set("Cookie", cookie)
        .send([secondPut, referenceDay("TUESDAY")])
        .expect(200);

      const getResponse = await request(app.getHttpServer())
        .get("/users/me/reference-week")
        .set("Cookie", cookie)
        .expect(200);

      const getDays = getResponse.body.days as Array<Record<string, unknown>>;
      expect(getDays).toHaveLength(2);
      expect(getDays.map((d) => d.weekday).sort()).toEqual([
        "MONDAY",
        "TUESDAY",
      ]);
      expect(getDays.some((d) => d.weekday === "WEDNESDAY")).toBe(false);
      const monday = getDays.find((d) => d.weekday === "MONDAY");
      expect(monday?.arrivalMinutes).toBe(480);
    });

    it("§5.4: PUT with a weekday outside the current WorkingDaySchedule returns 400 and persists nothing (no partial write)", async () => {
      const { cookie } = await createAuthenticatedUser(
        "e2e-refweek-invalid-weekday",
      );
      await setWorkingDays(cookie, ["MONDAY", "TUESDAY"]);

      // Save a baseline valid reference week first, so we can prove the rejected
      // PUT below leaves it untouched (rather than merely "nothing to lose").
      await request(app.getHttpServer())
        .put("/users/me/reference-week")
        .set("Cookie", cookie)
        .send([referenceDay("MONDAY"), referenceDay("TUESDAY")])
        .expect(200);

      // FRIDAY is not part of this user's current WorkingDaySchedule.
      await request(app.getHttpServer())
        .put("/users/me/reference-week")
        .set("Cookie", cookie)
        .send([referenceDay("MONDAY"), referenceDay("FRIDAY")])
        .expect(400);

      const getResponse = await request(app.getHttpServer())
        .get("/users/me/reference-week")
        .set("Cookie", cookie)
        .expect(200);

      const getDays = getResponse.body.days as Array<Record<string, unknown>>;
      expect(getDays).toHaveLength(2);
      expect(getDays.map((d) => d.weekday).sort()).toEqual([
        "MONDAY",
        "TUESDAY",
      ]);
    });

    it("§5.4: DELETE removes everything — a subsequent GET returns { exists: false, days: [] }", async () => {
      const { cookie } = await createAuthenticatedUser("e2e-refweek-delete");
      await setWorkingDays(cookie, ["MONDAY"]);

      await request(app.getHttpServer())
        .put("/users/me/reference-week")
        .set("Cookie", cookie)
        .send([referenceDay("MONDAY")])
        .expect(200);

      await request(app.getHttpServer())
        .delete("/users/me/reference-week")
        .set("Cookie", cookie)
        .expect(200);

      const getResponse = await request(app.getHttpServer())
        .get("/users/me/reference-week")
        .set("Cookie", cookie)
        .expect(200);

      expect(getResponse.body).toEqual({ exists: false, days: [] });
    });

    it("§5.4: DELETE is idempotent — deleting when nothing exists still succeeds", async () => {
      const { cookie } = await createAuthenticatedUser(
        "e2e-refweek-delete-noop",
      );

      await request(app.getHttpServer())
        .delete("/users/me/reference-week")
        .set("Cookie", cookie)
        .expect(200);

      const getResponse = await request(app.getHttpServer())
        .get("/users/me/reference-week")
        .set("Cookie", cookie)
        .expect(200);

      expect(getResponse.body).toEqual({ exists: false, days: [] });
    });

    it("§5.4: multi-user isolation — user A's reference week is invisible to and unaffected by user B", async () => {
      const userA = await createAuthenticatedUser("e2e-refweek-isolation-a");
      const userB = await createAuthenticatedUser("e2e-refweek-isolation-b");
      await setWorkingDays(userA.cookie, ["MONDAY", "TUESDAY"]);
      await setWorkingDays(userB.cookie, ["MONDAY", "TUESDAY"]);

      await request(app.getHttpServer())
        .put("/users/me/reference-week")
        .set("Cookie", userA.cookie)
        .send([referenceDay("MONDAY"), referenceDay("TUESDAY")])
        .expect(200);

      // B never saved a reference week: B's GET must not see A's rows.
      const getB = await request(app.getHttpServer())
        .get("/users/me/reference-week")
        .set("Cookie", userB.cookie)
        .expect(200);
      expect(getB.body).toEqual({ exists: false, days: [] });

      // B deleting its own (already empty) reference week must not affect A's.
      await request(app.getHttpServer())
        .delete("/users/me/reference-week")
        .set("Cookie", userB.cookie)
        .expect(200);

      const getA = await request(app.getHttpServer())
        .get("/users/me/reference-week")
        .set("Cookie", userA.cookie)
        .expect(200);
      expect(getA.body.exists).toBe(true);
      expect(getA.body.days).toHaveLength(2);
    });

    it("§5.4: returns 401 without a session on all three routes", async () => {
      await request(app.getHttpServer())
        .get("/users/me/reference-week")
        .expect(401);

      await request(app.getHttpServer())
        .put("/users/me/reference-week")
        .send([referenceDay("MONDAY")])
        .expect(401);

      await request(app.getHttpServer())
        .delete("/users/me/reference-week")
        .expect(401);
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
