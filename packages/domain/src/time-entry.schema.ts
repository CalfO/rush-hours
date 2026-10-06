import { z } from "zod";

/**
 * Spec §4.2. All calendar-day/time-of-day comparisons below use UTC getters
 * (`getUTCFullYear`/`getUTCHours`/...), never local-time getters — this matches the
 * convention documented in `week-range.ts` (same package), so a `Date` means the
 * same UTC-equivalent wall-clock value everywhere in this domain layer regardless of
 * the server's local timezone.
 */

const LUNCH_WINDOW_START_MINUTES = 12 * 60; // 12:00
const LUNCH_WINDOW_END_MINUTES = 14 * 60; // 14:00

function isSameUtcCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function utcMinutesSinceMidnight(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

const TIMESTAMP_FIELDS = [
  "arrivalTime",
  "lunchBreakStart",
  "lunchBreakEnd",
  "departureTime",
] as const;

export const timeEntrySchema = z
  .object({
    date: z.coerce.date(),
    arrivalTime: z.coerce.date(),
    lunchBreakStart: z.coerce.date(),
    lunchBreakEnd: z.coerce.date(),
    departureTime: z.coerce.date(),
  })
  .superRefine((entry, ctx) => {
    const { date, arrivalTime, lunchBreakStart, lunchBreakEnd, departureTime } =
      entry;

    for (const field of TIMESTAMP_FIELDS) {
      if (!isSameUtcCalendarDay(date, entry[field])) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: `${field} must be on the same calendar day as date`,
        });
      }
    }

    if (!(arrivalTime < lunchBreakStart)) {
      ctx.addIssue({
        code: "custom",
        path: ["lunchBreakStart"],
        message: "lunchBreakStart must be after arrivalTime",
      });
    }

    if (!(lunchBreakStart < lunchBreakEnd)) {
      ctx.addIssue({
        code: "custom",
        path: ["lunchBreakEnd"],
        message: "lunchBreakEnd must be after lunchBreakStart",
      });
    }

    if (!(lunchBreakEnd < departureTime)) {
      ctx.addIssue({
        code: "custom",
        path: ["departureTime"],
        message: "departureTime must be after lunchBreakEnd",
      });
    }

    if (utcMinutesSinceMidnight(lunchBreakStart) < LUNCH_WINDOW_START_MINUTES) {
      ctx.addIssue({
        code: "custom",
        path: ["lunchBreakStart"],
        message: "lunchBreakStart must be at or after 12:00",
      });
    }

    if (utcMinutesSinceMidnight(lunchBreakEnd) > LUNCH_WINDOW_END_MINUTES) {
      ctx.addIssue({
        code: "custom",
        path: ["lunchBreakEnd"],
        message: "lunchBreakEnd must be at or before 14:00",
      });
    }
  });

export type TimeEntryInput = z.infer<typeof timeEntrySchema>;
