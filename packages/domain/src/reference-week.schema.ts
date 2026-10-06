import { z } from "zod";
import { WEEKDAYS } from "./weekday";

/**
 * Spec `time-entry-ux-and-reference-week.md` §5.1/§5.3. A reference week entry is
 * indexed by `Weekday`, not by a real calendar `Date` — the ordering/lunch-window
 * rules mirror `time-entry.schema.ts`'s cross-field rules, expressed directly in
 * "minutes since midnight" (`[0, 1439]`) rather than via `Date` comparisons, since
 * there is no actual date to compare against here.
 */

const weekdayEnum = z.enum(WEEKDAYS);

const LUNCH_WINDOW_START_MINUTES = 12 * 60; // 12:00
const LUNCH_WINDOW_END_MINUTES = 14 * 60; // 14:00

const dayMinutes = z.number().int().min(0).max(1439);

export const referenceWeekDaySchema = z
  .object({
    weekday: weekdayEnum,
    arrivalMinutes: dayMinutes,
    departureMinutes: dayMinutes,
    lunchBreakStartMinutes: dayMinutes,
    lunchBreakEndMinutes: dayMinutes,
  })
  .superRefine((day, ctx) => {
    const {
      arrivalMinutes,
      lunchBreakStartMinutes,
      lunchBreakEndMinutes,
      departureMinutes,
    } = day;

    if (!(arrivalMinutes < lunchBreakStartMinutes)) {
      ctx.addIssue({
        code: "custom",
        path: ["lunchBreakStartMinutes"],
        message: "lunchBreakStartMinutes must be after arrivalMinutes",
      });
    }

    if (!(lunchBreakStartMinutes < lunchBreakEndMinutes)) {
      ctx.addIssue({
        code: "custom",
        path: ["lunchBreakEndMinutes"],
        message: "lunchBreakEndMinutes must be after lunchBreakStartMinutes",
      });
    }

    if (!(lunchBreakEndMinutes < departureMinutes)) {
      ctx.addIssue({
        code: "custom",
        path: ["departureMinutes"],
        message: "departureMinutes must be after lunchBreakEndMinutes",
      });
    }

    if (lunchBreakStartMinutes < LUNCH_WINDOW_START_MINUTES) {
      ctx.addIssue({
        code: "custom",
        path: ["lunchBreakStartMinutes"],
        message: "lunchBreakStartMinutes must be at or after 12:00",
      });
    }

    if (lunchBreakEndMinutes > LUNCH_WINDOW_END_MINUTES) {
      ctx.addIssue({
        code: "custom",
        path: ["lunchBreakEndMinutes"],
        message: "lunchBreakEndMinutes must be at or before 14:00",
      });
    }
  });

export type ReferenceWeekDayInput = z.infer<typeof referenceWeekDaySchema>;

/**
 * Spec §5.1/§5.3: 1 to 7 entries (as free-form as `WorkingDaySchedule`, no fixed
 * "standard week" assumption), each `weekday` unique within the array.
 */
export const referenceWeekSchema = z
  .array(referenceWeekDaySchema)
  .min(1)
  .max(7)
  .refine(
    (days) => new Set(days.map((day) => day.weekday)).size === days.length,
    { message: "Each weekday must appear at most once in a reference week" },
  );

export type ReferenceWeekInput = z.infer<typeof referenceWeekSchema>;
