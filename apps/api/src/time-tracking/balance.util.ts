import { Weekday, getWeekdayForDate } from "@rushhours/domain";

export interface WorkedMinutesInput {
  arrivalTime: Date;
  departureTime: Date;
  lunchBreakStart: Date;
  lunchBreakEnd: Date;
}

/**
 * §4.1 — worked minutes for a day = (departure - arrival) - (lunch end - lunch start).
 */
export function workedMinutes(entry: WorkedMinutesInput): number {
  const totalMs = entry.departureTime.getTime() - entry.arrivalTime.getTime();
  const lunchMs =
    entry.lunchBreakEnd.getTime() - entry.lunchBreakStart.getTime();
  return Math.round((totalMs - lunchMs) / 60_000);
}

export interface DailyScheduleEntry {
  weekday: Weekday;
  targetMinutes: number;
}

/**
 * §4.3 — target minutes for a calendar date, from the user's working-day schedule.
 * Returns `null` when the date's weekday has no matching `WorkingDaySchedule` row,
 * i.e. it is a non-working day (no target, no expected entry).
 */
export function dailyTargetMinutes(
  date: Date,
  schedule: DailyScheduleEntry[],
): number | null {
  const weekday = getWeekdayForDate(date);
  const match = schedule.find((entry) => entry.weekday === weekday);
  return match ? match.targetMinutes : null;
}

/**
 * §4.4 — daily balance = worked - target, for a day that was both a working day
 * (has a target) and has an actual entry. Callers must only invoke this once both
 * `workedMinutes` and `targetMinutes` are known to exist for the day — a day with
 * either missing is neutral and must not be passed through this function (see
 * `time-entries.service.ts` for how neutral days are excluded from cumulative sums).
 */
export function dailyBalanceMinutes(
  workedMinutes: number,
  targetMinutes: number,
): number {
  return workedMinutes - targetMinutes;
}
