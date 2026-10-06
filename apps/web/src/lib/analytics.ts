import { getWeekRange, type Weekday } from "@rushhours/domain";
import type { DaySummary, WeekSummary } from "../api/time-entries";

export type AnalyticsPreset = "month" | "week" | "custom";

export interface AnalyticsDateRange {
  from: string;
  to: string;
}

export interface CumulativeBalancePoint {
  date: string;
  balanceMinutes: number;
}

export interface ChartPoint {
  label: string;
  value: number;
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Returns the inclusive UTC range for the month containing `date`. */
export function getMonthRange(date: Date): AnalyticsDateRange {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return {
    from: formatIsoDate(new Date(Date.UTC(year, month, 1))),
    to: formatIsoDate(new Date(Date.UTC(year, month + 1, 0))),
  };
}

/** Returns the inclusive UTC work-week range containing `date`. */
export function getAnalyticsWeekRange(
  date: Date,
  weekStartDay: Weekday,
): AnalyticsDateRange {
  const range = getWeekRange(date, weekStartDay);
  return { from: formatIsoDate(range.start), to: formatIsoDate(range.end) };
}

export function isValidAnalyticsRange(range: AnalyticsDateRange): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(range.from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(range.to)
  ) {
    return false;
  }
  const from = parseIsoDate(range.from);
  const to = parseIsoDate(range.to);
  return (
    !Number.isNaN(from.getTime()) &&
    !Number.isNaN(to.getTime()) &&
    formatIsoDate(from) === range.from &&
    formatIsoDate(to) === range.to &&
    from.getTime() <= to.getTime()
  );
}

/** Sorts API day summaries without mutating the response object. */
export function sortDays(days: DaySummary[]): DaySummary[] {
  return [...days].sort((a, b) => a.date.localeCompare(b.date));
}

/** Builds a running balance, excluding neutral days omitted by the API. */
export function buildCumulativeBalance(
  days: DaySummary[],
): CumulativeBalancePoint[] {
  let balanceMinutes = 0;
  return sortDays(days).map((day) => {
    balanceMinutes += day.balanceMinutes;
    return { date: day.date, balanceMinutes };
  });
}

/** Keeps the most recent N weeks in chronological order. */
export function recentWeeks(weeks: WeekSummary[], count = 8): WeekSummary[] {
  if (count <= 0) return [];
  return [...weeks]
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(-count);
}

export function formatHours(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const remainingMinutes = absolute % 60;
  return `${sign}${hours}h${String(remainingMinutes).padStart(2, "0")}`;
}

export function formatAnalyticsDate(isoDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(parseIsoDate(isoDate));
}
