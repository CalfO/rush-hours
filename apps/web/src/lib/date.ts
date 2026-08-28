/**
 * UTC-based wire-format helpers, mirroring the private `isoDate()` helper in
 * `apps/api/src/time-entries/time-entries.service.ts` (`date.toISOString().slice(0, 10)`).
 * Deliberately NOT promoted to `@rushhours/domain` — this is trivial,
 * single-line formatting logic, not genuinely dual-usage domain behavior
 * (same reasoning as the backend's own local copy).
 */

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
