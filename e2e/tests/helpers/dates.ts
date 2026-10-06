/**
 * All computed relative to real wall-clock "today" rather than a fixed
 * date, so these tests stay correct however far in the future they run —
 * and in this app's own UTC-wall-clock convention (see
 * apps/web/src/components/DayCard.tsx's doc comment) rather than the test
 * runner's local timezone, to match what the frontend itself computes.
 */

/** Monday (UTC midnight) of the week containing `date` — this app's seeded
 * accounts default to `weekStartDay: MONDAY`. */
export function mondayOfWeekUTC(date: Date): Date {
  const utcMidnight = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = utcMidnight.getUTCDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day;
  utcMidnight.setUTCDate(utcMidnight.getUTCDate() + diff);
  return utcMidnight;
}

export function addDaysUTC(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
