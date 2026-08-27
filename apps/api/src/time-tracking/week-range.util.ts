import { Weekday } from "@prisma/client";

/**
 * Monday-first ordering used only to compute offsets between weekdays. This is an
 * internal implementation detail — the app itself doesn't assume Monday-first weeks,
 * `weekStartDay` is always the actual source of truth (see §4.5 of the spec).
 */
const WEEKDAY_ORDER: Weekday[] = [
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
  Weekday.SATURDAY,
  Weekday.SUNDAY,
];

/**
 * All date arithmetic in this module operates on UTC calendar fields. Incoming
 * `Date`s (whether from Prisma's `@db.Date` columns or full timestamps) are treated
 * as UTC-equivalent wall-clock values — see the timezone note in
 * `time-entries/dto/upsert-time-entry.dto.ts` for the matching front-end contract.
 */
function weekdayIndex(date: Date): number {
  const jsDay = date.getUTCDay(); // 0 = Sunday ... 6 = Saturday
  return (jsDay + 6) % 7; // 0 = Monday ... 6 = Sunday
}

export function getWeekdayForDate(date: Date): Weekday {
  return WEEKDAY_ORDER[weekdayIndex(date)];
}

function toUtcMidnight(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/**
 * Returns the 7 consecutive UTC calendar days (bounds inclusive) that contain `date`,
 * starting on `weekStartDay`. Correctly handles a week spanning two calendar months
 * and any `weekStartDay` (not just Monday) — see spec §4.5.
 */
export function getWeekRange(
  date: Date,
  weekStartDay: Weekday,
): { start: Date; end: Date } {
  const day = toUtcMidnight(date);
  const dayIndex = weekdayIndex(day);
  const startIndex = WEEKDAY_ORDER.indexOf(weekStartDay);
  const diff = (dayIndex - startIndex + 7) % 7;

  const start = new Date(day);
  start.setUTCDate(start.getUTCDate() - diff);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return { start, end };
}
