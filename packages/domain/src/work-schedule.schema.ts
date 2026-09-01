import { z } from "zod";
import { WEEKDAYS } from "./weekday";

const weekdayEnum = z.enum(WEEKDAYS);

const workScheduleDaySchema = z.object({
  weekday: weekdayEnum,
  targetMinutes: z.number().int().positive(),
});

/**
 * Spec §5.5/§6. `weeklyContractHours` is validated as a plain positive number here;
 * the DB stores it as `Decimal(5,2)` (see `prisma-best-practices` — avoids float
 * rounding error), but Zod/JSON transport only ever sees a plain JS number.
 */
export const workScheduleSchema = z
  .object({
    weeklyContractHours: z.number().positive(),
    weekStartDay: weekdayEnum,
    days: z.array(workScheduleDaySchema).min(1),
  })
  .refine(
    (schedule) => {
      const sum = schedule.days.reduce(
        (total, day) => total + day.targetMinutes,
        0,
      );
      return sum === Math.round(schedule.weeklyContractHours * 60);
    },
    {
      message:
        "The sum of each day's targetMinutes must equal weeklyContractHours * 60",
      path: ["days"],
    },
  );

export type WorkScheduleInput = z.infer<typeof workScheduleSchema>;
