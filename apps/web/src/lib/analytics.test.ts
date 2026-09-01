import { describe, expect, test } from "vitest";
import {
  buildCumulativeBalance,
  getAnalyticsWeekRange,
  getMonthRange,
  isValidAnalyticsRange,
  recentWeeks,
} from "./analytics";

describe("analytics helpers", () => {
  test("builds UTC month and week ranges", () => {
    const date = new Date("2026-02-18T23:30:00.000Z");

    expect(getMonthRange(date)).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
    expect(getAnalyticsWeekRange(date, "MONDAY")).toEqual({
      from: "2026-02-16",
      to: "2026-02-22",
    });
  });

  test("validates ordered, real calendar dates", () => {
    expect(
      isValidAnalyticsRange({ from: "2026-02-01", to: "2026-02-28" }),
    ).toBe(true);
    expect(
      isValidAnalyticsRange({ from: "2026-02-28", to: "2026-02-01" }),
    ).toBe(false);
    expect(
      isValidAnalyticsRange({ from: "2026-02-30", to: "2026-03-01" }),
    ).toBe(false);
    expect(isValidAnalyticsRange({ from: "invalid", to: "2026-03-01" })).toBe(
      false,
    );
  });

  test("sorts days for cumulative balance and keeps recent weeks", () => {
    expect(
      buildCumulativeBalance([
        {
          date: "2026-01-02",
          workedMinutes: 0,
          targetMinutes: 0,
          balanceMinutes: -30,
        },
        {
          date: "2026-01-01",
          workedMinutes: 0,
          targetMinutes: 0,
          balanceMinutes: 60,
        },
      ]),
    ).toEqual([
      { date: "2026-01-01", balanceMinutes: 60 },
      { date: "2026-01-02", balanceMinutes: 30 },
    ]);

    const weeks = Array.from({ length: 3 }, (_, index) => ({
      start: `2026-01-0${index + 1}`,
      end: `2026-01-0${index + 1}`,
      workedMinutes: 0,
      targetMinutes: 0,
      balanceMinutes: 0,
    }));
    expect(recentWeeks(weeks, 2).map((week) => week.start)).toEqual([
      "2026-01-02",
      "2026-01-03",
    ]);
  });
});
