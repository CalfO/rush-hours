import { Weekday } from "@prisma/client";
import { getWeekRange } from "./week-range.util";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

describe("getWeekRange", () => {
  it("returns Monday-Sunday bounds for a Monday-start week", () => {
    const { start, end } = getWeekRange(
      new Date("2026-03-11T00:00:00.000Z"), // Wednesday
      Weekday.MONDAY,
    );
    expect(isoDate(start)).toBe("2026-03-09"); // Monday
    expect(isoDate(end)).toBe("2026-03-15"); // Sunday
  });

  it("correctly spans two calendar months", () => {
    // 2026-08-31 is a Monday; the Monday-start week runs into September.
    const { start, end } = getWeekRange(
      new Date("2026-09-02T00:00:00.000Z"), // Wednesday, same week
      Weekday.MONDAY,
    );
    expect(isoDate(start)).toBe("2026-08-31");
    expect(isoDate(end)).toBe("2026-09-06");
  });

  it("handles a non-Monday weekStartDay", () => {
    // 2026-03-04 and 2026-03-11 are both Wednesdays.
    const { start, end } = getWeekRange(
      new Date("2026-03-10T00:00:00.000Z"), // Tuesday, last day of the Wed-start week
      Weekday.WEDNESDAY,
    );
    expect(isoDate(start)).toBe("2026-03-04");
    expect(isoDate(end)).toBe("2026-03-10");
  });

  it("places the reference date itself as the week start when it matches weekStartDay", () => {
    const { start, end } = getWeekRange(
      new Date("2026-03-09T00:00:00.000Z"), // Monday
      Weekday.MONDAY,
    );
    expect(isoDate(start)).toBe("2026-03-09");
    expect(isoDate(end)).toBe("2026-03-15");
  });
});
