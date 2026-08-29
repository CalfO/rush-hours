import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOutletContext } from "react-router-dom";
import {
  getWeekRange,
  getWeekdayForDate,
  type ReferenceWeekDayInput,
  type ReferenceWeekInput,
  type Weekday,
} from "@rushhours/domain";
import type { DatePickerRootValueChangeEvent } from "@primereact/types/primitive/datepicker";
import { useAuth } from "../auth/AuthProvider";
import { getWorkSchedule } from "../api/users";
import { putReferenceWeek } from "../api/reference-week";
import {
  getSummary,
  listMonth,
  type DaySummary,
  type RangeSummary,
  type TimeEntryRecord,
} from "../api/time-entries";
import { getWeekDays, toIsoDate, toIsoMonth, toUtcMidnight } from "../lib/date";
import type { AppLayoutContext } from "../components/AppLayout";
import { WeekCarousel } from "../components/WeekCarousel";
import { BalanceIndicator } from "../components/BalanceIndicator";
import { MonthCalendar } from "../components/MonthCalendar";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
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

/**
 * Spec §5.5 completeness check — "tous les jours travaillés de la semaine
 * ... ont désormais une saisie", for whichever `workingWeekdays` the user
 * has configured (1 to 7, no fixed 5/7 assumption, spec §5.1). A non-working
 * day is simply skipped (not required); an empty `workingWeekdays` can never
 * be "complete" (shouldn't happen post-onboarding, but no prompt in that
 * degenerate case). A plain module-scope function (not a hook) so it can be
 * called with either the pre-refetch or the post-refetch `daysMap`, from
 * inside `handleSaved`'s own closures.
 */
function isWeekComplete(
  weekStart: Date,
  weekStartDay: Weekday,
  workingWeekdays: Weekday[],
  daysMap: Map<string, DaySummary>,
  neighborDaysMap: Map<string, DaySummary>,
): boolean {
  if (workingWeekdays.length === 0) return false;
  return getWeekDays(weekStart, weekStartDay).every((day) => {
    const weekday = getWeekdayForDate(day);
    if (!workingWeekdays.includes(weekday)) return true;
    const iso = toIsoDate(day);
    return daysMap.has(iso) || neighborDaysMap.has(iso);
  });
}

/**
 * A `TimeEntryRecord`'s time fields are UTC wire timestamps that encode a
 * local wall-clock value (see `DayCard.tsx`'s own `toUtcCalendarDate` doc
 * comment on this app-wide convention) — reading UTC hours/minutes off them
 * directly gives the same "minutes since midnight" a reference-week entry
 * expects (`reference-week.schema.ts`). Small mirrored helper rather than a
 * reused `DayCard` export: `DayCard`'s own helpers convert to/from picker
 * `Date`s, not to a plain minutes integer.
 */
function minutesOfDay(isoTimestamp: string): number {
  const date = new Date(isoTimestamp);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

/**
 * Builds the §5.5 `PUT /users/me/reference-week` payload from the completed
 * week's raw entries — one `ReferenceWeekDayInput` per working day that has
 * a matching entry in `entriesByDate` (always true once `isWeekComplete` has
 * just confirmed it for this same week/data).
 */
function buildReferenceWeekInput(
  weekStart: Date,
  weekStartDay: Weekday,
  workingWeekdays: Weekday[],
  entriesByDate: Map<string, TimeEntryRecord>,
): ReferenceWeekInput {
  const days: ReferenceWeekDayInput[] = [];
  for (const day of getWeekDays(weekStart, weekStartDay)) {
    const weekday = getWeekdayForDate(day);
    if (!workingWeekdays.includes(weekday)) continue;
    const entry = entriesByDate.get(toIsoDate(day));
    if (!entry) continue;
    days.push({
      weekday,
      arrivalMinutes: minutesOfDay(entry.arrivalTime),
      departureMinutes: minutesOfDay(entry.departureTime),
      lunchBreakStartMinutes: minutesOfDay(entry.lunchBreakStart),
      lunchBreakEndMinutes: minutesOfDay(entry.lunchBreakEnd),
    });
  }
  return days;
}

/** localStorage key for "don't re-prompt this already-answered week" (spec §5.5). */
function referenceWeekPromptKey(userId: string, weekStartIso: string): string {
  return `referenceWeekPrompt:${userId}:${weekStartIso}`;
}

function hasAnsweredReferenceWeekPrompt(
  userId: string,
  weekStartIso: string,
): boolean {
  try {
    return (
      localStorage.getItem(referenceWeekPromptKey(userId, weekStartIso)) === "1"
    );
  } catch {
    // Storage unavailable (private mode, disabled site data, ...) — treat
    // as "not yet answered" rather than crashing the save flow over it.
    return false;
  }
}

function markReferenceWeekPromptAnswered(
  userId: string,
  weekStartIso: string,
): void {
  try {
    localStorage.setItem(referenceWeekPromptKey(userId, weekStartIso), "1");
  } catch {
    // Best-effort only — see `hasAnsweredReferenceWeekPrompt`.
  }
}

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
  const { user } = useAuth();
  const userId = user?.id ?? null;
  // Standalone render (e.g. this page's own unit tests) has no `<Outlet>`
  // ancestor providing this context — `useOutletContext` then returns `null`
  // (its own default context value), so fall back to "no reference week,
  // no-op refresh" rather than crashing.
  const { referenceWeek, refreshReferenceWeek } =
    useOutletContext<AppLayoutContext>() ??
    ({
      referenceWeek: null,
      refreshReferenceWeek: () => {},
    } satisfies AppLayoutContext);

  const [selectedDate, setSelectedDate] = useState<Date>(() => todayUtc());
  const [currentMonth, setCurrentMonth] = useState<string>(() =>
    toIsoMonth(selectedDate),
  );

  const [weekStartDay, setWeekStartDay] = useState<Weekday | null>(null);
  const [workingWeekdays, setWorkingWeekdays] = useState<Weekday[]>([]);
  const [scheduleLoadState, setScheduleLoadState] =
    useState<LoadState>("loading");

  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [pendingReferenceWeekInput, setPendingReferenceWeekInput] =
    useState<ReferenceWeekInput | null>(null);
  const [pendingWeekStartIso, setPendingWeekStartIso] = useState<string | null>(
    null,
  );
  // Distinguishes "closed because the save was confirmed and succeeded"
  // from every other close (explicit decline, dismiss) inside
  // `handleSavePromptOpenChange` below — only the latter should write the
  // "already answered" localStorage flag (spec §5.5).
  const savePromptAcceptedRef = useRef(false);

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
        setWorkingWeekdays(schedule.days.map((day) => day.weekday));
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

  // Spec §5.5 completeness check's "current month ∪ relevant neighbor
  // summaries" merged source — same `neighborSummaries` state `weekBalance`
  // below already assembles for the same reason (a displayed week can
  // straddle a month boundary), reused rather than rebuilt.
  const neighborDaysByDate = useMemo(() => {
    const map = new Map<string, DaySummary>();
    for (const monthSummary of Object.values(neighborSummaries)) {
      for (const day of monthSummary.days) {
        map.set(day.date, day);
      }
    }
    return map;
  }, [neighborSummaries]);

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
  //
  // Spec §5.5 save-prompt: piggybacks on this same handler (it's the only
  // place a day save is observed). `wasComplete` is computed *before* the
  // refetch below, from data captured in this closure right now (mirrors
  // `currentMonthRef`'s own closure-freshness reasoning) — `weekStart` is
  // derived from `saved.date`, not from `selectedDate`, so this stays
  // correct even if `selectedDate` has already moved on by the time the
  // async refetch resolves.
  function handleSaved(saved: TimeEntryRecord): void {
    const month = currentMonthRef.current;
    if (saved.date.slice(0, 7) !== month) return;

    let promptWeekStart: Date | null = null;
    let wasComplete = false;
    if (weekStartDay) {
      const { start, end } = getWeekRange(new Date(saved.date), weekStartDay);
      // Known limitation (spec §9's pattern — documented, not resolved
      // here): building the reference-week payload needs raw entries for
      // every working day of the completed week, but this page only has
      // `entries` (raw `TimeEntryRecord`s from `listMonth`) loaded for
      // `currentMonth`. A week straddling a month boundary could have some
      // of its days' raw entries unavailable, so the prompt is skipped
      // entirely (no error, no re-prompt later) whenever the week's start
      // and end don't both fall in `currentMonth`.
      if (toIsoMonth(start) === month && toIsoMonth(end) === month) {
        promptWeekStart = start;
        wasComplete = isWeekComplete(
          start,
          weekStartDay,
          workingWeekdays,
          daysByDate,
          neighborDaysByDate,
        );
      }
    }

    const refreshId = ++refreshSequence.current;
    setLoadedMonth(null);
    Promise.all([getSummary(month), listMonth(month)]).then(
      ([summaryResult, entriesResult]) => {
        if (refreshId !== refreshSequence.current) return;
        setSummary(summaryResult);
        setEntries(entriesResult);
        setLoadedMonth(month);
        setMonthErrorFor(null);

        if (promptWeekStart && weekStartDay) {
          const freshDaysMap = new Map<string, DaySummary>();
          for (const day of summaryResult.days) {
            freshDaysMap.set(day.date, day);
          }
          const isComplete = isWeekComplete(
            promptWeekStart,
            weekStartDay,
            workingWeekdays,
            freshDaysMap,
            neighborDaysByDate,
          );
          if (!wasComplete && isComplete && userId) {
            const weekStartIso = toIsoDate(promptWeekStart);
            if (!hasAnsweredReferenceWeekPrompt(userId, weekStartIso)) {
              const freshEntriesByDate = new Map<string, TimeEntryRecord>();
              for (const entry of entriesResult) {
                freshEntriesByDate.set(entry.date.slice(0, 10), entry);
              }
              setPendingReferenceWeekInput(
                buildReferenceWeekInput(
                  promptWeekStart,
                  weekStartDay,
                  workingWeekdays,
                  freshEntriesByDate,
                ),
              );
              setPendingWeekStartIso(weekStartIso);
              savePromptAcceptedRef.current = false;
              setSavePromptOpen(true);
            }
          }
        }
      },
      () => {
        if (refreshId === refreshSequence.current) setMonthErrorFor(month);
      },
    );
  }

  async function handleSavePromptConfirm(): Promise<void> {
    if (!pendingReferenceWeekInput) return;
    await putReferenceWeek(pendingReferenceWeekInput);
    savePromptAcceptedRef.current = true;
    refreshReferenceWeek();
  }

  // §5.5: "Non / fermeture -> ne pas rappeler ce popup pour cette même
  // semaine". Every close *except* a successful confirm (tracked via
  // `savePromptAcceptedRef`, set only once `putReferenceWeek` above has
  // actually resolved) counts as "closing without confirming" and marks the
  // week answered — an explicit decline and a dismiss (Escape/backdrop) are
  // deliberately treated the same way here.
  function handleSavePromptOpenChange(open: boolean): void {
    setSavePromptOpen(open);
    if (!open) {
      if (!savePromptAcceptedRef.current && userId && pendingWeekStartIso) {
        markReferenceWeekPromptAnswered(userId, pendingWeekStartIso);
      }
      savePromptAcceptedRef.current = false;
    }
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
                workingWeekdays={workingWeekdays}
                entriesByDate={entriesByDate}
                referenceWeek={referenceWeek}
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

      <ConfirmDialog
        open={savePromptOpen}
        onOpenChange={handleSavePromptOpenChange}
        title={t("referenceWeek.saveTitle")}
        description={
          referenceWeek?.exists
            ? t("referenceWeek.saveDescriptionReplace")
            : t("referenceWeek.saveDescription")
        }
        confirmLabel={t("referenceWeek.saveConfirm")}
        cancelLabel={t("referenceWeek.saveDecline")}
        onConfirm={() => handleSavePromptConfirm()}
      />
    </div>
  );
}
