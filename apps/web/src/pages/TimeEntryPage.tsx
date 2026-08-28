import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getWeekRange, type Weekday } from "@rushhours/domain";
import type { DatePickerRootValueChangeEvent } from "@primereact/types/primitive/datepicker";
import { getWorkSchedule } from "../api/users";
import {
  getSummary,
  listMonth,
  type DaySummary,
  type RangeSummary,
  type TimeEntryRecord,
} from "../api/time-entries";
import { toIsoDate, toIsoMonth, toUtcMidnight } from "../lib/date";
import { WeekCarousel } from "../components/WeekCarousel";
import { BalanceIndicator } from "../components/BalanceIndicator";
import { MonthCalendar } from "../components/MonthCalendar";
import {
  DatePicker,
  DatePickerCalendar,
  DatePickerInput,
  DatePickerPanel,
  DatePickerPopup,
  DatePickerPortal,
  DatePickerPositioner,
} from "../components/ui/datepicker";

type LoadState = "loading" | "ready" | "error";

/** `new Date()`'s calendar day reinterpreted as a UTC-midnight `Date`, matching every
 * other date in this app (see `DayCard.tsx`'s `toUtcCalendarDate` doc comment). */
function todayUtc(): Date {
  return new Date(toIsoDate(new Date()));
}

/**
 * Spec §7.2 "Vue Saisie" (`/`) / §3 "Carousel". Thin page: owns
 * `selectedDate`/`currentMonth` state and the two data fetches (work
 * schedule once, summary+entries per month), composes a page-level date
 * picker, `WeekCarousel`, `BalanceIndicator`, `MonthCalendar` — all of them
 * dumb, no independent fetching (architect plan). `handleDateChange` below
 * is the single callback wired to all three date-selection entry points
 * (the date picker, `MonthCalendar.onSelectDate`, `WeekCarousel.onSelectDate`),
 * so there is exactly one code path that ever calls `setSelectedDate`.
 */
export default function TimeEntryPage() {
  const { t } = useTranslation();

  const [selectedDate, setSelectedDate] = useState<Date>(() => todayUtc());
  const [currentMonth, setCurrentMonth] = useState<string>(() =>
    toIsoMonth(selectedDate),
  );

  const [weekStartDay, setWeekStartDay] = useState<Weekday | null>(null);
  const [scheduleLoadState, setScheduleLoadState] =
    useState<LoadState>("loading");

  const [summary, setSummary] = useState<RangeSummary | null>(null);
  const [neighborSummaries, setNeighborSummaries] = useState<
    Record<string, RangeSummary>
  >({});
  const [entries, setEntries] = useState<TimeEntryRecord[]>([]);
  // `loadedMonth`/`monthErrorFor` track which month the current `summary`/
  // `entries` (or the last failure) belong to, so "is this month loading" is
  // *derived* (`loadedMonth !== currentMonth`) rather than a separate flag
  // set synchronously inside the effect body below — an explicit
  // `setState("loading")` at the top of a `useEffect` triggers
  // `react-hooks/set-state-in-effect` (it forces an extra render pass); every
  // `setState` call here instead happens inside the async `.then`/`.catch`
  // callbacks, matching `WorkScheduleForm`'s established pattern.
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null);
  const [monthErrorFor, setMonthErrorFor] = useState<string | null>(null);
  const refreshSequence = useRef(0);
  const currentMonthRef = useRef(currentMonth);
  useEffect(() => {
    currentMonthRef.current = currentMonth;
  }, [currentMonth]);

  // Fetch-once-while-mounted, mirrors `WorkScheduleForm`'s established
  // pattern (react-best-practices #6 — narrow deps, `[]` here since it must
  // run exactly once).
  useEffect(() => {
    let ignore = false;
    getWorkSchedule().then(
      (schedule) => {
        if (ignore) return;
        setWeekStartDay(schedule.weekStartDay);
        setScheduleLoadState("ready");
      },
      () => {
        if (ignore) return;
        setScheduleLoadState("error");
      },
    );
    return () => {
      ignore = true;
    };
  }, []);

  // One effect keyed on `currentMonth`, fetches summary + raw entries
  // together (architect plan — avoids duplicate/uncoordinated fetches).
  useEffect(() => {
    let ignore = false;
    const requestId = ++refreshSequence.current;
    Promise.all([getSummary(currentMonth), listMonth(currentMonth)]).then(
      ([summaryResult, entriesResult]) => {
        if (ignore || requestId !== refreshSequence.current) return;
        setSummary(summaryResult);
        setEntries(entriesResult);
        setLoadedMonth(currentMonth);
        setMonthErrorFor(null);
      },
      () => {
        if (ignore || requestId !== refreshSequence.current) return;
        setMonthErrorFor(currentMonth);
      },
    );
    return () => {
      ignore = true;
    };
  }, [currentMonth]);

  useEffect(() => {
    if (!weekStartDay) return;
    let ignore = false;
    const { start, end } = getWeekRange(selectedDate, weekStartDay);
    const months = [toIsoMonth(start), toIsoMonth(end)].filter(
      (month, index, all) =>
        month !== currentMonth && all.indexOf(month) === index,
    );
    if (months.length === 0) {
      return;
    }
    Promise.all(months.map((month) => getSummary(month))).then(
      (results) => {
        if (ignore) return;
        setNeighborSummaries(
          Object.fromEntries(
            months.map((month, index) => [month, results[index]]),
          ),
        );
      },
      () => {
        if (!ignore) setNeighborSummaries({});
      },
    );
    return () => {
      ignore = true;
    };
  }, [currentMonth, selectedDate, weekStartDay]);

  const isMonthLoading =
    loadedMonth !== currentMonth && monthErrorFor !== currentMonth;
  const monthLoadError = monthErrorFor === currentMonth;

  const daysByDate = useMemo(() => {
    const map = new Map<string, DaySummary>();
    for (const day of summary?.days ?? []) {
      map.set(day.date, day);
    }
    return map;
  }, [summary]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, TimeEntryRecord>();
    for (const entry of entries) {
      map.set(entry.date.slice(0, 10), entry);
    }
    return map;
  }, [entries]);

  const selectedIso = toIsoDate(selectedDate);
  const dayBalance = daysByDate.get(selectedIso)?.balanceMinutes ?? null;

  const weekBalance = useMemo(() => {
    if (!weekStartDay) return null;
    const { start, end } = getWeekRange(selectedDate, weekStartDay);
    let total: number | null = null;
    const adjacentMonths = new Set(
      [toIsoMonth(start), toIsoMonth(end)].filter(
        (month) => month !== currentMonth,
      ),
    );
    const summaries = [
      summary,
      ...Object.entries(neighborSummaries)
        .filter(([month]) => adjacentMonths.has(month))
        .map(([, value]) => value),
    ];
    for (const day of summaries.flatMap((value) => value?.days ?? [])) {
      const dayDate = new Date(`${day.date}T00:00:00.000Z`);
      if (dayDate >= start && dayDate <= end) {
        total = (total ?? 0) + day.balanceMinutes;
      }
    }
    return total;
  }, [currentMonth, summary, selectedDate, weekStartDay, neighborSummaries]);

  function handleDateChange(date: Date): void {
    setSelectedDate(date);
    const month = toIsoMonth(date);
    setCurrentMonth((current) => (current === month ? current : month));
  }

  function handleMonthChange(month: string): void {
    setCurrentMonth(month);
    setSelectedDate(new Date(`${month}-01T00:00:00.000Z`));
  }

  // The save mutates what the whole page's derived view depends on —
  // re-fetch summary + entries for the month currently shown. The saved
  // record itself isn't needed here (a wholesale re-fetch is simplest and
  // keeps `daysByDate`/`entriesByDate` consistent), so `DayCard`'s
  // `onSaved: (entry) => void` is satisfied by this zero-arg handler. Called
  // from a click-triggered callback, not a `useEffect` body, so resetting
  // `loadedMonth` synchronously here (to make `isMonthLoading` derive `true`
  // again) doesn't trip `react-hooks/set-state-in-effect`.
  function handleSaved(saved: TimeEntryRecord): void {
    const month = currentMonthRef.current;
    if (saved.date.slice(0, 7) !== month) return;
    const refreshId = ++refreshSequence.current;
    setLoadedMonth(null);
    Promise.all([getSummary(month), listMonth(month)]).then(
      ([summaryResult, entriesResult]) => {
        if (refreshId !== refreshSequence.current) return;
        setSummary(summaryResult);
        setEntries(entriesResult);
        setLoadedMonth(month);
        setMonthErrorFor(null);
      },
      () => {
        if (refreshId === refreshSequence.current) setMonthErrorFor(month);
      },
    );
  }

  const isLoading = scheduleLoadState === "loading" || isMonthLoading;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-surface-900">
          {t("nav.entry")}
        </h1>
        <DatePicker
          value={selectedDate}
          onValueChange={(event: DatePickerRootValueChangeEvent) => {
            const picked = (event.value as Date | null) ?? null;
            if (picked) handleDateChange(toUtcMidnight(picked));
          }}
        >
          <DatePickerInput aria-label={t("timeEntry.dateLabel")} />
          <DatePickerPortal>
            <DatePickerPositioner>
              <DatePickerPopup>
                <DatePickerPanel>
                  <DatePickerCalendar />
                </DatePickerPanel>
              </DatePickerPopup>
            </DatePickerPositioner>
          </DatePickerPortal>
        </DatePicker>
      </div>

      {scheduleLoadState === "error" || monthLoadError ? (
        <p className="text-sm text-error-700">{t("timeEntry.loadError")}</p>
      ) : (
        <>
          <section className="rounded-lg border border-surface-200 bg-surface-0 p-4">
            {weekStartDay && !isLoading ? (
              <WeekCarousel
                selectedDate={selectedDate}
                weekStartDay={weekStartDay}
                entriesByDate={entriesByDate}
                onSelectDate={handleDateChange}
                onSaved={handleSaved}
              />
            ) : (
              <p className="text-sm text-surface-500">
                {t("timeEntry.loading")}
              </p>
            )}
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
              <BalanceIndicator
                balanceMinutes={dayBalance}
                label={t("timeEntry.dayIndicatorLabel")}
              />
            </div>
            <div className="rounded-lg border border-surface-200 bg-surface-0 p-4">
              <BalanceIndicator
                balanceMinutes={weekBalance}
                label={t("timeEntry.weekIndicatorLabel")}
              />
            </div>
          </section>

          {weekStartDay && summary && !isMonthLoading && (
            <section className="rounded-lg border border-surface-200 bg-surface-0 p-4">
              <MonthCalendar
                month={currentMonth}
                weekStartDay={weekStartDay}
                daysByDate={daysByDate}
                total={summary.total}
                selectedDate={selectedDate}
                onSelectDate={handleDateChange}
                onMonthChange={handleMonthChange}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
