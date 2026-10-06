import { useTranslation } from "react-i18next";
import { getWeekRange, WEEKDAYS, type Weekday } from "@rushhours/domain";
import { cn } from "../lib/utils";
import { toIsoDate } from "../lib/date";
import { formatBalance } from "../lib/format-balance";
import type { DaySummary, DayTotals } from "../api/time-entries";

interface MonthCalendarProps {
  month: string; // YYYY-MM
  weekStartDay: Weekday;
  daysByDate: Map<string, DaySummary>;
  total: DayTotals;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onMonthChange: (month: string) => void;
}

interface CalendarCell {
  date: Date;
  inCurrentMonth: boolean;
  summary: DaySummary | undefined;
}

/** Same rotation used by `WorkScheduleModal`'s weekday rows — colocated here rather
 * than shared, per the architect's UI-shape-plumbing-stays-colocated precedent. */
function rotateWeekdays(startDay: Weekday): Weekday[] {
  const startIndex = WEEKDAYS.indexOf(startDay);
  if (startIndex === -1) return [...WEEKDAYS];
  return [...WEEKDAYS.slice(startIndex), ...WEEKDAYS.slice(0, startIndex)];
}

function parseMonth(month: string): { year: number; monthIndex: number } {
  const [yearStr, monthStr] = month.split("-");
  return { year: Number(yearStr), monthIndex: Number(monthStr) - 1 };
}

function shiftMonth(month: string, delta: number): string {
  const { year, monthIndex } = parseMonth(month);
  const shifted = new Date(Date.UTC(year, monthIndex + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Full aligned 7-column grid including adjacent-month day numbers (grayed
 * out / always-neutral, never colored by their real balance even though
 * technically computable) — avoids a ragged grid (architect's resolved
 * ambiguity). Uses `getWeekRange` from `@rushhours/domain` for the exact
 * date math, matching the `weekStartDay`-aware convention used everywhere
 * else in this app (spec §4.5) rather than assuming Monday-first weeks.
 */
function buildGrid(
  month: string,
  weekStartDay: Weekday,
  daysByDate: Map<string, DaySummary>,
): CalendarCell[] {
  const { year, monthIndex } = parseMonth(month);
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const lastOfMonth = new Date(Date.UTC(year, monthIndex + 1, 0));

  const gridStart = getWeekRange(firstOfMonth, weekStartDay).start;
  const gridEnd = getWeekRange(lastOfMonth, weekStartDay).end;

  const cells: CalendarCell[] = [];
  const cursor = new Date(gridStart);
  while (cursor.getTime() <= gridEnd.getTime()) {
    const inCurrentMonth =
      cursor.getUTCMonth() === monthIndex && cursor.getUTCFullYear() === year;
    cells.push({
      date: new Date(cursor),
      inCurrentMonth,
      summary: inCurrentMonth ? daysByDate.get(toIsoDate(cursor)) : undefined,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return cells;
}

function balanceCellClasses(
  inCurrentMonth: boolean,
  balanceMinutes: number | undefined,
): string {
  if (!inCurrentMonth) {
    return "bg-surface-0 text-surface-300";
  }
  if (balanceMinutes === undefined) {
    return "bg-surface-50 text-surface-500";
  }
  if (balanceMinutes >= 0) {
    return balanceMinutes >= 60
      ? "bg-success-100 text-success-700"
      : "bg-success-50 text-success-700";
  }
  return balanceMinutes <= -60
    ? "bg-error-100 text-error-700"
    : "bg-error-50 text-error-700";
}

/**
 * Hoisted module-scope sub-component (react-best-practices §1) — not
 * extracted to its own file since it's not reused elsewhere (architect
 * plan).
 */
function MonthCalendarCell({
  cell,
  selected,
  onSelect,
}: {
  cell: CalendarCell;
  selected: boolean;
  onSelect: (date: Date) => void;
}) {
  const balanceMinutes = cell.summary?.balanceMinutes;

  return (
    <button
      type="button"
      disabled={!cell.inCurrentMonth}
      onClick={() => onSelect(cell.date)}
      className={cn(
        "flex h-16 flex-col items-start gap-0.5 rounded-md p-1.5 text-left transition-colors",
        balanceCellClasses(cell.inCurrentMonth, balanceMinutes),
        cell.inCurrentMonth
          ? "cursor-pointer hover:opacity-80"
          : "cursor-default",
        selected && cell.inCurrentMonth && "ring-2 ring-primary-600",
      )}
    >
      <span className="text-xs font-medium">{cell.date.getUTCDate()}</span>
      {cell.inCurrentMonth && balanceMinutes !== undefined && (
        <span className="text-[11px] tabular-nums">
          {formatBalance(balanceMinutes)}
        </span>
      )}
    </button>
  );
}

/** Spec §7.2 "Calendrier du mois" — custom Tailwind grid (architect plan). */
export function MonthCalendar({
  month,
  weekStartDay,
  daysByDate,
  total,
  selectedDate,
  onSelectDate,
  onMonthChange,
}: MonthCalendarProps) {
  const { t } = useTranslation();
  const orderedWeekdays = rotateWeekdays(weekStartDay);
  const cells = buildGrid(month, weekStartDay, daysByDate);
  const selectedIso = toIsoDate(selectedDate);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonthChange(shiftMonth(month, -1))}
          aria-label={t("timeEntry.previousMonth")}
          className="rounded-md p-1.5 text-surface-600 hover:bg-surface-100"
        >
          ‹
        </button>
        <div className="flex flex-col items-center">
          <span className="text-sm font-semibold text-surface-800">
            {month}
          </span>
          <span
            className={cn(
              "text-xs font-medium tabular-nums",
              total.balanceMinutes >= 0 ? "text-success-700" : "text-error-700",
            )}
          >
            {t("timeEntry.monthTotalLabel")}:{" "}
            {formatBalance(total.balanceMinutes)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onMonthChange(shiftMonth(month, 1))}
          aria-label={t("timeEntry.nextMonth")}
          className="rounded-md p-1.5 text-surface-600 hover:bg-surface-100"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {orderedWeekdays.map((weekday) => (
          <div
            key={weekday}
            className="text-center text-xs font-medium text-surface-500"
          >
            {t(`weekdays.${weekday}`)}
          </div>
        ))}
        {cells.map((cell) => (
          <MonthCalendarCell
            key={toIsoDate(cell.date)}
            cell={cell}
            selected={toIsoDate(cell.date) === selectedIso}
            onSelect={onSelectDate}
          />
        ))}
      </div>
    </div>
  );
}
