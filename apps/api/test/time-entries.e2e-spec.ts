import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Weekday } from "@prisma/client";
import cookieParser from "cookie-parser";
import request from "supertest";
import type { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { SessionService } from "../src/auth/session.service";
import type { RangeSummary } from "../src/time-entries/time-entries.service";

/**
 * Spec traceability — `prompts/spec/rushhours-full-spec.md` §4 (worked/target/
 * balance minutes) and §6 (`/time-entries` endpoints table). As in `users.e2e-spec.ts`,
 * a session is obtained by signing a JWT directly via the real `SessionService`.
 */
describe("Time entries (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sessionService: SessionService;
  const createdUsernames: string[] = [];

  async function createAuthenticatedUser(
    prefix: string,
    overrides: {
      weekStartDay?: Weekday;
      days?: { weekday: Weekday; targetMinutes: number }[];
    } = {},
  ) {
    const username = `${prefix}-${randomUUID()}`;
    createdUsernames.push(username);
    const user = await prisma.user.create({
      data: {
        username,
        weeklyContractHours: 40,
        weekStartDay: overrides.weekStartDay ?? "MONDAY",
        workingDaySchedules: {
          create: overrides.days ?? [
            { weekday: "MONDAY", targetMinutes: 480 },
            { weekday: "TUESDAY", targetMinutes: 480 },
            { weekday: "WEDNESDAY", targetMinutes: 480 },
            { weekday: "THURSDAY", targetMinutes: 480 },
            { weekday: "FRIDAY", targetMinutes: 480 },
          ],
        },
      },
    });
    const token = await sessionService.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
    });
    return { user, cookie: `rushhours_session=${token}` };
  }

  /** Valid §4.2 body for a full 8h day (480 worked minutes) on the given date. */
  function fullDayEntry(date: string) {
    return {
      date,
      arrivalTime: `${date}T08:00:00.000Z`,
      lunchBreakStart: `${date}T12:00:00.000Z`,
      lunchBreakEnd: `${date}T13:00:00.000Z`,
      departureTime: `${date}T17:00:00.000Z`,
    };
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

  describe("PUT /time-entries/:date (§4.2/§6)", () => {
    it("returns 401 without a session", () => {
      return request(app.getHttpServer())
        .put("/time-entries/2026-03-10")
        .send({
          date: "2026-03-10",
          arrivalTime: "2026-03-10T08:00:00.000Z",
          lunchBreakStart: "2026-03-10T12:00:00.000Z",
          lunchBreakEnd: "2026-03-10T13:00:00.000Z",
          departureTime: "2026-03-10T17:00:00.000Z",
        })
        .expect(401);
    });

    it("upserts a valid entry (Tuesday, 8h worked)", async () => {
      const { cookie } = await createAuthenticatedUser("e2e-upsert");

      const response = await request(app.getHttpServer())
        .put("/time-entries/2026-03-10")
        .set("Cookie", cookie)
        .send({
          date: "2026-03-10",
          arrivalTime: "2026-03-10T08:00:00.000Z",
          lunchBreakStart: "2026-03-10T12:00:00.000Z",
          lunchBreakEnd: "2026-03-10T13:00:00.000Z",
          departureTime: "2026-03-10T17:00:00.000Z",
        })
        .expect(200);

      expect(response.body).toMatchObject({ date: "2026-03-10T00:00:00.000Z" });
    });

    it("returns 400 when the URL date and body date field disagree", async () => {
      const { cookie } = await createAuthenticatedUser("e2e-mismatch");

      await request(app.getHttpServer())
        .put("/time-entries/2026-03-11")
        .set("Cookie", cookie)
        .send({
          date: "2026-03-10",
          arrivalTime: "2026-03-10T08:00:00.000Z",
          lunchBreakStart: "2026-03-10T12:00:00.000Z",
          lunchBreakEnd: "2026-03-10T13:00:00.000Z",
          departureTime: "2026-03-10T17:00:00.000Z",
        })
        .expect(400);
    });

    it("returns 400 for a lunch break outside the 12:00-14:00 window (§4.2)", async () => {
      const { cookie } = await createAuthenticatedUser("e2e-lunch-invalid");

      await request(app.getHttpServer())
        .put("/time-entries/2026-03-10")
        .set("Cookie", cookie)
        .send({
          date: "2026-03-10",
          arrivalTime: "2026-03-10T08:00:00.000Z",
          lunchBreakStart: "2026-03-10T11:00:00.000Z",
          lunchBreakEnd: "2026-03-10T11:30:00.000Z",
          departureTime: "2026-03-10T17:00:00.000Z",
        })
        .expect(400);
    });
  });

  describe("GET /time-entries?month=YYYY-MM (§6)", () => {
    it("lists raw entries for the month", async () => {
      const { cookie } = await createAuthenticatedUser("e2e-list");

      await request(app.getHttpServer())
        .put("/time-entries/2026-03-10")
        .set("Cookie", cookie)
        .send({
          date: "2026-03-10",
          arrivalTime: "2026-03-10T08:00:00.000Z",
          lunchBreakStart: "2026-03-10T12:00:00.000Z",
          lunchBreakEnd: "2026-03-10T13:00:00.000Z",
          departureTime: "2026-03-10T17:00:00.000Z",
        })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get("/time-entries")
        .query({ month: "2026-03" })
        .set("Cookie", cookie)
        .expect(200);

      expect(response.body).toHaveLength(1);
    });
  });

  describe("DELETE /time-entries/:date (§6)", () => {
    it("deletes an existing entry and is a no-op on a second call (droit à l'erreur)", async () => {
      const { cookie } = await createAuthenticatedUser("e2e-delete");

      await request(app.getHttpServer())
        .put("/time-entries/2026-03-10")
        .set("Cookie", cookie)
        .send({
          date: "2026-03-10",
          arrivalTime: "2026-03-10T08:00:00.000Z",
          lunchBreakStart: "2026-03-10T12:00:00.000Z",
          lunchBreakEnd: "2026-03-10T13:00:00.000Z",
          departureTime: "2026-03-10T17:00:00.000Z",
        })
        .expect(200);

      await request(app.getHttpServer())
        .delete("/time-entries/2026-03-10")
        .set("Cookie", cookie)
        .expect(200);

      await request(app.getHttpServer())
        .delete("/time-entries/2026-03-10")
        .set("Cookie", cookie)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get("/time-entries")
        .query({ month: "2026-03" })
        .set("Cookie", cookie)
        .expect(200);
      expect(response.body).toHaveLength(0);
    });
  });

  describe("GET /time-entries/summary?month=YYYY-MM (§4.4/§6)", () => {
    it("computes worked/target/balance minutes and excludes non-working days", async () => {
      const { cookie } = await createAuthenticatedUser("e2e-summary");

      // Tuesday 2026-03-10: a working day, 8h worked against an 8h target -> balance 0.
      await request(app.getHttpServer())
        .put("/time-entries/2026-03-10")
        .set("Cookie", cookie)
        .send({
          date: "2026-03-10",
          arrivalTime: "2026-03-10T08:00:00.000Z",
          lunchBreakStart: "2026-03-10T12:00:00.000Z",
          lunchBreakEnd: "2026-03-10T13:00:00.000Z",
          departureTime: "2026-03-10T17:00:00.000Z",
        })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get("/time-entries/summary")
        .query({ month: "2026-03" })
        .set("Cookie", cookie)
        .expect(200);

      const body = response.body as RangeSummary;
      expect(body.days).toEqual([
        {
          date: "2026-03-10",
          workedMinutes: 480,
          targetMinutes: 480,
          balanceMinutes: 0,
        },
      ]);
      expect(body.total).toEqual({
        workedMinutes: 480,
        targetMinutes: 480,
        balanceMinutes: 0,
      });
      expect(body.weeks).toHaveLength(1);
    });
  });

  describe("GET /time-entries/analytics?from&to (§6)", () => {
    it("returns the same shape as summary over a free date range", async () => {
      const { cookie } = await createAuthenticatedUser("e2e-analytics");

      await request(app.getHttpServer())
        .put("/time-entries/2026-03-10")
        .set("Cookie", cookie)
        .send({
          date: "2026-03-10",
          arrivalTime: "2026-03-10T08:00:00.000Z",
          lunchBreakStart: "2026-03-10T12:00:00.000Z",
          lunchBreakEnd: "2026-03-10T13:00:00.000Z",
          departureTime: "2026-03-10T17:00:00.000Z",
        })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get("/time-entries/analytics")
        .query({ from: "2026-03-01", to: "2026-03-31" })
        .set("Cookie", cookie)
        .expect(200);

      const body = response.body as RangeSummary;
      expect(body.days).toHaveLength(1);
      expect(body.total.balanceMinutes).toBe(0);
    });

    it("returns 400 when from is after to", async () => {
      const { cookie } = await createAuthenticatedUser("e2e-analytics-invalid");

      await request(app.getHttpServer())
        .get("/time-entries/analytics")
        .query({ from: "2026-03-31", to: "2026-03-01" })
        .set("Cookie", cookie)
        .expect(400);
    });
  });

  describe("Neutral days (§4.4)", () => {
    it("a working day without an entry is absent from summary, not present at zero", async () => {
      // Mon-Fri schedule; only Monday 2026-03-09 gets an actual entry. Tue-Fri are
      // working days too but have no entry -> must not appear in `days` at all.
      const { cookie } = await createAuthenticatedUser("e2e-neutral-noentry");

      await request(app.getHttpServer())
        .put("/time-entries/2026-03-09")
        .set("Cookie", cookie)
        .send(fullDayEntry("2026-03-09"))
        .expect(200);

      const response = await request(app.getHttpServer())
        .get("/time-entries/summary")
        .query({ month: "2026-03" })
        .set("Cookie", cookie)
        .expect(200);

      const body = response.body as RangeSummary;
      expect(body.days).toHaveLength(1);
      expect(body.days[0].date).toBe("2026-03-09");
      // The other working days of that week (Tue-Fri) must not appear, not even
      // with zeroed-out values.
      for (const date of [
        "2026-03-10",
        "2026-03-11",
        "2026-03-12",
        "2026-03-13",
      ]) {
        expect(body.days.find((day) => day.date === date)).toBeUndefined();
      }
    });

    it("an entry on a day not configured as working is excluded from every aggregate but still readable via the raw list", async () => {
      // Mon-Fri schedule (default helper): 2026-03-07 is a Saturday, not configured
      // as a working day, yet a raw entry can still be saved there ("saisie libre").
      const { cookie } = await createAuthenticatedUser(
        "e2e-neutral-nonworking",
      );

      await request(app.getHttpServer())
        .put("/time-entries/2026-03-07")
        .set("Cookie", cookie)
        .send(fullDayEntry("2026-03-07"))
        .expect(200);

      const list = await request(app.getHttpServer())
        .get("/time-entries")
        .query({ month: "2026-03" })
        .set("Cookie", cookie)
        .expect(200);
      expect(list.body).toHaveLength(1);

      const summaryResponse = await request(app.getHttpServer())
        .get("/time-entries/summary")
        .query({ month: "2026-03" })
        .set("Cookie", cookie)
        .expect(200);

      const body = summaryResponse.body as RangeSummary;
      expect(body.days).toHaveLength(0);
      expect(body.weeks).toHaveLength(0);
      expect(body.total).toEqual({
        workedMinutes: 0,
        targetMinutes: 0,
        balanceMinutes: 0,
      });
    });
  });

  describe("Weekly grouping with a non-Monday weekStartDay spanning two months (§4.5)", () => {
    it("attributes a Wednesday-to-Tuesday week straddling Feb/Mar to a single week bucket when querying March", async () => {
      // weekStartDay = WEDNESDAY -> the week containing 2026-03-02 (Mon) and
      // 2026-03-03 (Tue) runs 2026-02-25 (Wed) to 2026-03-03 (Tue) inclusive.
      const { cookie } = await createAuthenticatedUser("e2e-week-cross-month", {
        weekStartDay: "WEDNESDAY",
      });

      await request(app.getHttpServer())
        .put("/time-entries/2026-03-02")
        .set("Cookie", cookie)
        .send(fullDayEntry("2026-03-02"))
        .expect(200);

      await request(app.getHttpServer())
        .put("/time-entries/2026-03-03")
        .set("Cookie", cookie)
        .send(fullDayEntry("2026-03-03"))
        .expect(200);

      const response = await request(app.getHttpServer())
        .get("/time-entries/summary")
        .query({ month: "2026-03" })
        .set("Cookie", cookie)
        .expect(200);

      const body = response.body as RangeSummary;
      expect(body.days).toHaveLength(2);
      expect(body.weeks).toHaveLength(1);
      expect(body.weeks[0]).toEqual({
        start: "2026-02-25",
        end: "2026-03-03",
        workedMinutes: 960,
        targetMinutes: 960,
        balanceMinutes: 0,
      });
      expect(body.total).toEqual({
        workedMinutes: 960,
        targetMinutes: 960,
        balanceMinutes: 0,
      });
    });
  });

  describe("Multi-user isolation (§6)", () => {
    it("a user's time entries are invisible to, and unaffected by, another user's requests", async () => {
      const userA = await createAuthenticatedUser("e2e-isolation-a");
      const userB = await createAuthenticatedUser("e2e-isolation-b");

      await request(app.getHttpServer())
        .put("/time-entries/2026-03-16")
        .set("Cookie", userA.cookie)
        .send(fullDayEntry("2026-03-16"))
        .expect(200);

      const listB = await request(app.getHttpServer())
        .get("/time-entries")
        .query({ month: "2026-03" })
        .set("Cookie", userB.cookie)
        .expect(200);
      expect(listB.body).toHaveLength(0);

      const summaryB = await request(app.getHttpServer())
        .get("/time-entries/summary")
        .query({ month: "2026-03" })
        .set("Cookie", userB.cookie)
        .expect(200);
      expect((summaryB.body as RangeSummary).days).toHaveLength(0);

      // B deleting "the same date" only touches B's own (non-existent) row.
      await request(app.getHttpServer())
        .delete("/time-entries/2026-03-16")
        .set("Cookie", userB.cookie)
        .expect(200);

      const listA = await request(app.getHttpServer())
        .get("/time-entries")
        .query({ month: "2026-03" })
        .set("Cookie", userA.cookie)
        .expect(200);
      expect(listA.body).toHaveLength(1);
    });
  });
});
