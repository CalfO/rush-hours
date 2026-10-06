/**
 * UTC-based wire-format helpers, mirroring the private `isoDate()` helper in
 * `apps/api/src/time-entries/time-entries.service.ts` (`date.toISOString().slice(0, 10)`).
 * Deliberately NOT promoted to `@rushhours/domain` — this is trivial,
 * single-line formatting logic, not genuinely dual-usage domain behavior
 * (same reasoning as the backend's own local copy).
 */

import { getWeekRange, type Weekday } from "@rushhours/domain";

/** `Date` -> `YYYY-MM-DD` (UTC calendar day). */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `Date` -> `YYYY-MM` (UTC calendar month). */
export function toIsoMonth(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/**
 * PrimeReact's `DatePicker` (browser-local, timezone-oblivious) constructs
 * `Date` values from the local wall-clock fields the user sees on screen
 * (`getFullYear`/`getMonth`/`getDate`). This app instead treats every `Date`
 * as a UTC-equivalent wall clock (see `DayCard.tsx`'s `toUtcCalendarDate` doc
 * comment). This reinterprets a picker-produced Date's local wall-clock components as
 * UTC ones, bridging the two conventions — without this, a non-UTC browser
 * timezone would silently shift every selected date.
 */
export function toUtcMidnight(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

/**
 * The 7 UTC-midnight days of `anchorDate`'s week, `weekStartDay`-first.
 * Hoisted out of `WeekCarousel.tsx`'s former private `buildWeekDays` (spec
 * `time-entry-ux-and-reference-week.md` §5.7 lot) so `WeekCarousel`, the
 * §5.5 completeness check, and §5.7's prefill matching share one
 * implementation instead of drifting copies — same `getWeekRange` +
 * `setUTCDate` stepping idiom `MonthCalendar.buildGrid` uses for its own
 * grid cursor, reusing `@rushhours/domain`'s own week-range math rather than
 * a locally invented weekday-ordering helper.
 */
export function getWeekDays(anchorDate: Date, weekStartDay: Weekday): Date[] {
  const { start } = getWeekRange(anchorDate, weekStartDay);
  const days: Date[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < 7; i++) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}
