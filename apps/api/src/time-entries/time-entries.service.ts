import { BadRequestException, Injectable } from "@nestjs/common";
import { getWeekRange } from "@rushhours/domain";
import { PrismaService } from "../prisma/prisma.service";
import {
  dailyBalanceMinutes,
  dailyTargetMinutes,
  workedMinutes,
} from "../time-tracking/balance.util";
import { UpsertTimeEntryDto } from "./dto/upsert-time-entry.dto";

const TIME_ENTRY_SELECT = {
  date: true,
  arrivalTime: true,
  departureTime: true,
  lunchBreakStart: true,
  lunchBreakEnd: true,
} as const;

export interface DayTotals {
  workedMinutes: number;
  targetMinutes: number;
  balanceMinutes: number;
}

export interface DaySummary extends DayTotals {
  date: string;
}

export interface WeekSummary extends DayTotals {
  start: string;
  end: string;
}

export interface RangeSummary {
  days: DaySummary[];
  weeks: WeekSummary[];
  total: DayTotals;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parses a `YYYY-MM` string into UTC month bounds (bounds inclusive). */
function monthBounds(month: string): { start: Date; end: Date } {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  return {
    start: new Date(Date.UTC(year, monthIndex, 1)),
    end: new Date(Date.UTC(year, monthIndex + 1, 0)),
  };
}

function emptyTotals(): DayTotals {
  return { workedMinutes: 0, targetMinutes: 0, balanceMinutes: 0 };
}

/**
 * §6 — time entries CRUD + §4's worked/target/balance minutes computed from the
 * pure `balance.util` functions and `@rushhours/domain`'s `getWeekRange` (never
 * duplicated here, per the plan).
 */
@Injectable()
export class TimeEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** §6 `GET /time-entries?month=YYYY-MM` — raw entries for the month. */
  async listMonth(userId: string, month: string) {
    const { start, end } = monthBounds(month);
    return this.prisma.timeEntry.findMany({
      where: { userId, date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
      select: TIME_ENTRY_SELECT,
    });
  }

  /**
   * §6 `PUT /time-entries/:date` — upsert, keyed on the `@@unique([userId, date])`
   * constraint (prisma-best-practices §5). Rejects when the URL `:date` and the
   * body's `date` field disagree, with a clean 400 rather than silently trusting
   * one or the other.
   */
  async upsert(userId: string, dateParam: string, dto: UpsertTimeEntryDto) {
    if (isoDate(dto.date) !== dateParam) {
      throw new BadRequestException(
        "URL date must match the date field in the request body",
      );
    }

    return this.prisma.timeEntry.upsert({
      where: { userId_date: { userId, date: dto.date } },
      create: {
        userId,
        date: dto.date,
        arrivalTime: dto.arrivalTime,
        departureTime: dto.departureTime,
        lunchBreakStart: dto.lunchBreakStart,
        lunchBreakEnd: dto.lunchBreakEnd,
      },
      update: {
        arrivalTime: dto.arrivalTime,
        departureTime: dto.departureTime,
        lunchBreakStart: dto.lunchBreakStart,
        lunchBreakEnd: dto.lunchBreakEnd,
      },
      select: TIME_ENTRY_SELECT,
    });
  }

  /** §6 `DELETE /time-entries/:date` — "droit à l'erreur", no-op if absent. */
  async remove(userId: string, dateParam: string): Promise<{ success: true }> {
    await this.prisma.timeEntry.deleteMany({
      where: { userId, date: new Date(`${dateParam}T00:00:00.000Z`) },
    });
    return { success: true };
  }

  /** §6 `GET /time-entries/summary?month=YYYY-MM`. */
  async summary(userId: string, month: string): Promise<RangeSummary> {
    const { start, end } = monthBounds(month);
    return this.buildRangeSummary(userId, start, end);
  }

  /** §6 `GET /time-entries/analytics?from&to`. */
  async analytics(
    userId: string,
    from: string,
    to: string,
  ): Promise<RangeSummary> {
    return this.buildRangeSummary(
      userId,
      new Date(`${from}T00:00:00.000Z`),
      new Date(`${to}T00:00:00.000Z`),
    );
  }

  /**
   * §4.4 — only days that are both a working day (a matching `WorkingDaySchedule`
   * row exists) AND have an actual entry contribute to any of the returned totals;
   * a non-working day or a working day without an entry is neutral and simply
   * doesn't appear in `days`/isn't added to `weeks`/`total`.
   */
  private async buildRangeSummary(
    userId: string,
    start: Date,
    end: Date,
  ): Promise<RangeSummary> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        weekStartDay: true,
        workingDaySchedules: {
          select: { weekday: true, targetMinutes: true },
        },
      },
    });

    const entries = await this.prisma.timeEntry.findMany({
      where: { userId, date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
      select: TIME_ENTRY_SELECT,
    });

    const days: DaySummary[] = [];
    for (const entry of entries) {
      const targetMinutes = dailyTargetMinutes(
        entry.date,
        user.workingDaySchedules,
      );
      if (targetMinutes === null) {
        continue; // non-working day: neutral, excluded from every cumulative sum
      }
      const worked = workedMinutes(entry);
      days.push({
        date: isoDate(entry.date),
        workedMinutes: worked,
        targetMinutes,
        balanceMinutes: dailyBalanceMinutes(worked, targetMinutes),
      });
    }

    const weeksByStart = new Map<string, WeekSummary>();
    for (const day of days) {
      const { start: weekStart, end: weekEnd } = getWeekRange(
        new Date(`${day.date}T00:00:00.000Z`),
        user.weekStartDay,
      );
      const key = isoDate(weekStart);
      const week = weeksByStart.get(key) ?? {
        start: key,
        end: isoDate(weekEnd),
        ...emptyTotals(),
      };
      week.workedMinutes += day.workedMinutes;
      week.targetMinutes += day.targetMinutes;
      week.balanceMinutes += day.balanceMinutes;
      weeksByStart.set(key, week);
    }
    const weeks = Array.from(weeksByStart.values()).sort((a, b) =>
      a.start.localeCompare(b.start),
    );

    const total = days.reduce<DayTotals>((acc, day) => {
      acc.workedMinutes += day.workedMinutes;
      acc.targetMinutes += day.targetMinutes;
      acc.balanceMinutes += day.balanceMinutes;
      return acc;
    }, emptyTotals());

    return { days, weeks, total };
  }
}
