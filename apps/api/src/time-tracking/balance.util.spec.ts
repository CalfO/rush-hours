import { Weekday } from "@prisma/client";
import {
  dailyBalanceMinutes,
  dailyTargetMinutes,
  workedMinutes,
} from "./balance.util";

function utc(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00.000Z`);
}

describe("workedMinutes", () => {
  it("computes worked minutes as (departure - arrival) - lunch break", () => {
    const minutes = workedMinutes({
      arrivalTime: utc("2026-03-10", "09:00"),
      departureTime: utc("2026-03-10", "17:30"),
      lunchBreakStart: utc("2026-03-10", "12:30"),
      lunchBreakEnd: utc("2026-03-10", "13:15"),
    });
    // 8h30 present - 45min lunch = 7h45 = 465 minutes
    expect(minutes).toBe(465);
  });

  it("handles a lunch break starting exactly at 12:00 and ending exactly at 14:00", () => {
    const minutes = workedMinutes({
      arrivalTime: utc("2026-03-10", "08:00"),
      departureTime: utc("2026-03-10", "18:00"),
      lunchBreakStart: utc("2026-03-10", "12:00"),
      lunchBreakEnd: utc("2026-03-10", "14:00"),
    });
    // 10h present - 2h lunch = 8h = 480 minutes
    expect(minutes).toBe(480);
  });
});

describe("dailyTargetMinutes", () => {
  const schedule = [
    { weekday: Weekday.MONDAY, targetMinutes: 480 },
    { weekday: Weekday.WEDNESDAY, targetMinutes: 420 },
  ];

  it("returns the configured target minutes for a working day", () => {
    // 2026-03-09 is a Monday
    expect(dailyTargetMinutes(utc("2026-03-09", "00:00"), schedule)).toBe(480);
  });

  it("returns null for a non-working day (no matching WorkingDaySchedule row)", () => {
    // 2026-03-10 is a Tuesday, not in the schedule above
    expect(dailyTargetMinutes(utc("2026-03-10", "00:00"), schedule)).toBeNull();
  });
});

describe("dailyBalanceMinutes", () => {
  it("returns worked minus target, positive when in credit", () => {
    expect(dailyBalanceMinutes(500, 480)).toBe(20);
  });

  it("returns worked minus target, negative when in debit", () => {
    expect(dailyBalanceMinutes(400, 480)).toBe(-80);
  });
});
