import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DatePickerRootValueChangeEvent } from "@primereact/types/primitive/datepicker";
import { getWorkSchedule } from "../api/users";
import { getAnalytics, type RangeSummary } from "../api/time-entries";
import {
  buildCumulativeBalance,
  formatAnalyticsDate,
  getAnalyticsWeekRange,
  getMonthRange,
  isValidAnalyticsRange,
  recentWeeks,
  sortDays,
  type AnalyticsDateRange,
  type AnalyticsPreset,
} from "../lib/analytics";
import { formatBalance } from "../lib/format-balance";
import {
  DatePicker,
  DatePickerCalendar,
  DatePickerInput,
  DatePickerPanel,
  DatePickerPopup,
  DatePickerPortal,
  DatePickerPositioner,
} from "../components/ui/datepicker";
import { BarChart } from "../components/charts/BarChart";
import { TrendLine } from "../components/charts/TrendLine";
import { WeeklyTotalsChart } from "../components/charts/WeeklyTotalsChart";
import type { Weekday } from "@rushhours/domain";

type LoadState = "loading" | "ready" | "error";

function todayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function dateFromIso(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function pickerDateFromIso(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function pickerDateToIso(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(value.getDate()).padStart(2, "0")}`;
}

function DateRangePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-surface-700">
        {label}
      </label>
      <DatePicker
        value={pickerDateFromIso(value)}
        onValueChange={(event: DatePickerRootValueChangeEvent) => {
          const picked = event.value as Date | null;
          if (picked) onChange(pickerDateToIso(picked));
        }}
      >
        <DatePickerInput aria-label={label} />
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
  );
}

function PresetButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-primary-600 bg-primary-600 text-primary-contrast"
          : "border-surface-300 bg-surface-0 text-surface-700 hover:bg-surface-100"
      }`}
    >
      {children}
    </button>
  );
}

export default function AnalyticsPage() {
  const { t, i18n } = useTranslation();
  const initialDate = useMemo(() => todayUtc(), []);
  const initialMonth = useMemo(() => getMonthRange(initialDate), [initialDate]);
  const [weekStartDay, setWeekStartDay] = useState<Weekday>("MONDAY");
  const [scheduleLoadState, setScheduleLoadState] =
    useState<LoadState>("loading");
  const [preset, setPreset] = useState<AnalyticsPreset>("month");
  const [referenceDate, setReferenceDate] = useState(initialDate);
  const [customRange, setCustomRange] =
    useState<AnalyticsDateRange>(initialMonth);
  const [summary, setSummary] = useState<RangeSummary | null>(null);
  const [loadedRangeKey, setLoadedRangeKey] = useState<string | null>(null);
  const [errorRangeKey, setErrorRangeKey] = useState<string | null>(null);
  const requestSequence = useRef(0);

  useEffect(() => {
    let ignore = false;
    getWorkSchedule().then(
      (schedule) => {
        if (ignore) return;
        setWeekStartDay(schedule.weekStartDay);
        setScheduleLoadState("ready");
      },
      () => {
        if (!ignore) setScheduleLoadState("error");
      },
    );
    return () => {
      ignore = true;
    };
  }, []);

  const selectedRange = useMemo(() => {
    if (preset === "custom") return customRange;
    if (preset === "week") {
      return getAnalyticsWeekRange(referenceDate, weekStartDay);
    }
    return getMonthRange(referenceDate);
  }, [customRange, preset, referenceDate, weekStartDay]);
  const rangeKey = `${selectedRange.from}:${selectedRange.to}`;
  const rangeIsValid = isValidAnalyticsRange(selectedRange);

  useEffect(() => {
    if (!rangeIsValid) return;
    let ignore = false;
    const requestId = ++requestSequence.current;
    getAnalytics(selectedRange.from, selectedRange.to).then(
      (result) => {
        if (ignore || requestId !== requestSequence.current) return;
        setSummary(result);
        setLoadedRangeKey(rangeKey);
        setErrorRangeKey(null);
      },
      () => {
        if (ignore || requestId !== requestSequence.current) return;
        setErrorRangeKey(rangeKey);
      },
    );
    return () => {
      ignore = true;
    };
  }, [rangeKey, rangeIsValid, selectedRange.from, selectedRange.to]);

  const loading =
    scheduleLoadState === "loading" ||
    (rangeIsValid && loadedRangeKey !== rangeKey && errorRangeKey !== rangeKey);
  const hasError = scheduleLoadState === "error" || errorRangeKey === rangeKey;
  const days = useMemo(() => sortDays(summary?.days ?? []), [summary]);
  const cumulativeBalance = useMemo(() => buildCumulativeBalance(days), [days]);
  const recent = useMemo(() => recentWeeks(summary?.weeks ?? []), [summary]);
  const locale = i18n.language === "fr" ? "fr-FR" : "en-US";

  function selectPreset(nextPreset: AnalyticsPreset): void {
    setPreset(nextPreset);
  }

  function handleReferenceDateChange(
    event: DatePickerRootValueChangeEvent,
  ): void {
    const picked = event.value as Date | null;
    if (!picked) return;
    setReferenceDate(dateFromIso(pickerDateToIso(picked)));
  }

  function updateCustomRange(key: "from" | "to", value: string): void {
    setCustomRange((current) => ({ ...current, [key]: value }));
    setPreset("custom");
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-surface-900">
          {t("analytics.title")}
        </h1>
        <p className="mt-1 text-sm text-surface-600">
          {t("analytics.range", {
            from: selectedRange.from,
            to: selectedRange.to,
          })}
        </p>
      </div>

      <section className="rounded-lg border border-surface-200 bg-surface-0 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label={t("analytics.periodLabel")}
          >
            <PresetButton
              active={preset === "month"}
              onClick={() => selectPreset("month")}
            >
              {t("analytics.month")}
            </PresetButton>
            <PresetButton
              active={preset === "week"}
              onClick={() => selectPreset("week")}
            >
              {t("analytics.week")}
            </PresetButton>
            <PresetButton
              active={preset === "custom"}
              onClick={() => selectPreset("custom")}
            >
              {t("analytics.custom")}
            </PresetButton>
          </div>

          {preset !== "custom" ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">
                {t("analytics.referenceDate")}
              </label>
              <DatePicker
                value={pickerDateFromIso(
                  referenceDate.toISOString().slice(0, 10),
                )}
                onValueChange={handleReferenceDateChange}
              >
                <DatePickerInput aria-label={t("analytics.referenceDate")} />
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
          ) : (
            <>
              <DateRangePicker
                label={t("analytics.from")}
                value={customRange.from}
                onChange={(value) => updateCustomRange("from", value)}
              />
              <DateRangePicker
                label={t("analytics.to")}
                value={customRange.to}
                onChange={(value) => updateCustomRange("to", value)}
              />
            </>
          )}
        </div>
        {!rangeIsValid && (
          <p className="mt-3 text-sm text-error-700">
            {t("analytics.invalidRange")}
          </p>
        )}
      </section>

      {loading && (
        <p role="status" className="text-sm text-surface-600">
          {t("analytics.loading")}
        </p>
      )}

      {!loading && hasError && (
        <p role="alert" className="text-sm text-error-700">
          {t("analytics.loadError")}
        </p>
      )}

      {!loading &&
        !hasError &&
        rangeIsValid &&
        summary &&
        days.length === 0 && (
          <p className="rounded-lg border border-surface-200 bg-surface-0 p-6 text-sm text-surface-600">
            {t("analytics.empty")}
          </p>
        )}

      {!loading && !hasError && rangeIsValid && summary && days.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-surface-200 bg-surface-0 p-4">
            <h2 className="mb-3 text-base font-semibold text-surface-900">
              {t("analytics.dailyTitle")}
            </h2>
            <BarChart
              data={days.map((day) => ({
                label: formatAnalyticsDate(day.date, locale),
                value: day.workedMinutes / 60,
              }))}
              ariaLabel={t("analytics.dailyChart")}
              valueLabel={t("analytics.hours")}
            />
          </section>

          <section className="rounded-lg border border-surface-200 bg-surface-0 p-4">
            <h2 className="mb-3 text-base font-semibold text-surface-900">
              {t("analytics.balanceTitle")}
            </h2>
            <TrendLine
              data={cumulativeBalance}
              ariaLabel={t("analytics.balanceChart")}
            />
            <p className="text-right text-sm font-medium text-surface-700">
              {t("analytics.currentBalance")}:{" "}
              {formatBalance(cumulativeBalance.at(-1)?.balanceMinutes ?? 0)}
            </p>
          </section>

          <section className="rounded-lg border border-surface-200 bg-surface-0 p-4 lg:col-span-2">
            <h2 className="mb-3 text-base font-semibold text-surface-900">
              {t("analytics.weeklyTitle", { count: recent.length })}
            </h2>
            {recent.length > 0 ? (
              <WeeklyTotalsChart
                weeks={recent}
                locale={locale}
                ariaLabel={t("analytics.weeklyChart")}
                valueLabel={t("analytics.hours")}
              />
            ) : (
              <p className="text-sm text-surface-600">
                {t("analytics.noWeeks")}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
