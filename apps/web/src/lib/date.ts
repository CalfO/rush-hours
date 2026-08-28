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
