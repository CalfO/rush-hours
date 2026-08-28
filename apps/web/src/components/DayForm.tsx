import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Controller,
  useForm,
  type FieldErrors,
  type Resolver,
  type SubmitHandler,
} from "react-hook-form";
import { timeEntrySchema, type TimeEntryInput } from "@rushhours/domain";
import type { DatePickerRootValueChangeEvent } from "@primereact/types/primitive/datepicker";
import { toIsoDate } from "../lib/date";
import { upsertTimeEntry, type TimeEntryRecord } from "../api/time-entries";
import {
  DatePicker,
  DatePickerCalendar,
  DatePickerInput,
  DatePickerPanel,
  DatePickerPopup,
  DatePickerPortal,
  DatePickerPositioner,
  DatePickerTime,
} from "./ui/datepicker";

interface DayFormProps {
  date: Date;
  existingEntry: TimeEntryRecord | undefined;
  onSaved: (entry: TimeEntryRecord) => void;
  /**
   * The form's own date picker lets the user change which day they're
   * editing, independently of `MonthCalendar`'s cell clicks — both must stay
   * in sync with `TimeEntryPage`'s `selectedDate`, so this callback mirrors
   * `MonthCalendar`'s `onSelectDate`. Not in the architect's original prop
   * list; added because a "date picker (default today)" per spec §7.2 is
   * meaningless without a way to report the picked date back up — see final
   * report.
   */
  onDateChange: (date: Date) => void;
}

/**
 * Raw form-shape state: `Date | null` per time field (unfilled until the
 * user picks a time), independent of the `date` field's own value. Combined
 * into a `TimeEntryInput` only at validate/submit time via
 * `toTimeEntryInput` below.
 */
type DayFormValues = {
  date: Date;
  arrivalTime: Date | null;
  lunchBreakStart: Date | null;
  lunchBreakEnd: Date | null;
  departureTime: Date | null;
};

const TIME_FIELDS = [
  "arrivalTime",
  "lunchBreakStart",
  "lunchBreakEnd",
  "departureTime",
] as const;

const LUNCH_MIN_MINUTES = 12 * 60; // 12:00
const LUNCH_MAX_MINUTES = 14 * 60; // 14:00

/**
 * PrimeReact's `DatePicker` (browser-local, timezone-oblivious) constructs
 * `Date` values from the local wall-clock fields the user sees on screen
 * (`getHours`/`getMinutes`/...). `packages/domain`'s schemas instead treat
 * every `Date` as a UTC-equivalent wall clock (see `time-entry.schema.ts`'s
 * own doc comment). This reinterprets a picker-produced Date's local
 * wall-clock components as UTC ones, bridging the two conventions — without
 * this, a non-UTC browser timezone would silently shift every submitted
 * time.
 */
function toUtcMidnight(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

function toUtcCalendarDate(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/** Reinterprets a UTC wire timestamp as the local wall-clock value a picker displays. */
function toPickerDate(value: string | Date): Date {
  const source = typeof value === "string" ? new Date(value) : value;
  return new Date(
    source.getUTCFullYear(),
    source.getUTCMonth(),
    source.getUTCDate(),
    source.getUTCHours(),
    source.getUTCMinutes(),
  );
}

/** Combines `date`'s (already UTC-anchored) calendar day with `time`'s local wall-clock hour/minute. */
function combineDateAndTime(utcDate: Date, time: Date): Date {
  return new Date(
    Date.UTC(
      utcDate.getUTCFullYear(),
      utcDate.getUTCMonth(),
      utcDate.getUTCDate(),
      time.getHours(),
      time.getMinutes(),
    ),
  );
}

/**
 * Clamps a picker-produced time's local wall-clock minutes-of-day into
 * `[minMinutes, maxMinutes]` — used to keep the lunch-break fields in the
 * 12:00-14:00 window in-component (architect plan), on top of (not instead
 * of) `timeEntrySchema`'s own 12:00/14:00 checks, which remain the source of
 * truth.
 */
function clampLocalTimeOfDay(
  value: Date,
  minMinutes: number,
  maxMinutes: number,
): Date {
  const minutesOfDay = value.getHours() * 60 + value.getMinutes();
  const clamped = Math.min(Math.max(minutesOfDay, minMinutes), maxMinutes);
  if (clamped === minutesOfDay) {
    return value;
  }
  const result = new Date(value);
  result.setHours(Math.floor(clamped / 60), clamped % 60, 0, 0);
  return result;
}

/** Raw form-shape -> domain-shape transform. Only valid once every time field is non-null. */
function toTimeEntryInput(values: DayFormValues): TimeEntryInput {
  const utcDate = toUtcCalendarDate(values.date);
  return {
    date: utcDate,
    // Non-null assertions: only called once the required-field check below
    // (in the resolver) or RHF's own successful validation has already
    // confirmed every time field is filled.
    arrivalTime: combineDateAndTime(utcDate, values.arrivalTime as Date),
    lunchBreakStart: combineDateAndTime(
      utcDate,
      values.lunchBreakStart as Date,
    ),
    lunchBreakEnd: combineDateAndTime(utcDate, values.lunchBreakEnd as Date),
    departureTime: combineDateAndTime(utcDate, values.departureTime as Date),
  };
}

/**
 * Safety-net resolver, same two-stage shape as `WorkScheduleModal`'s
 * `workScheduleResolver`: required-field checks first (a `null` time field
 * can't even be transformed into a candidate `TimeEntryInput`), then
 * delegates the real business rules to `timeEntrySchema` (imported from
 * `@rushhours/domain`, never redeclared).
 */
const dayFormResolver: Resolver<DayFormValues> = (values) => {
  const missing = TIME_FIELDS.filter((field) => !values[field]);
  if (missing.length > 0) {
    const errors: Record<string, { type: string; message: string }> = {};
    for (const field of missing) {
      errors[field] = { type: "required", message: "This field is required" };
    }
    return { values: {}, errors: errors as FieldErrors<DayFormValues> };
  }

  const result = timeEntrySchema.safeParse(toTimeEntryInput(values));
  if (result.success) {
    return { values, errors: {} };
  }

  const errors: Record<string, { type: string; message: string }> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string") {
      errors[field] = { type: "custom", message: issue.message };
    }
  }
  return { values: {}, errors: errors as FieldErrors<DayFormValues> };
};

/**
 * Spec §7.2 "Formulaire du jour" — date picker (default today) + 4
 * `timeOnly` time fields + Save. Remounted by `TimeEntryPage` on a
 * `key={toIsoDate(selectedDate)}` each time the selected day changes, so its
 * `defaultValues` (derived once from `date`/`existingEntry`) never need a
 * manual reset effect (react-best-practices — prefer remount over
 * prop-to-state sync).
 */
export function DayForm({
  date,
  existingEntry,
  onSaved,
  onDateChange,
}: DayFormProps) {
  const { t } = useTranslation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit, formState } = useForm<DayFormValues>({
    resolver: dayFormResolver,
    defaultValues: {
      date,
      arrivalTime: existingEntry
        ? toPickerDate(existingEntry.arrivalTime)
        : null,
      lunchBreakStart: existingEntry
        ? toPickerDate(existingEntry.lunchBreakStart)
        : null,
      lunchBreakEnd: existingEntry
        ? toPickerDate(existingEntry.lunchBreakEnd)
        : null,
      departureTime: existingEntry
        ? toPickerDate(existingEntry.departureTime)
        : null,
    },
  });

  const onSubmit: SubmitHandler<DayFormValues> = async (values) => {
    setSubmitError(null);
    try {
      const input = toTimeEntryInput(values);
      const saved = await upsertTimeEntry(toIsoDate(input.date), input);
      onSaved(saved);
    } catch {
      setSubmitError(t("timeEntry.saveError"));
    }
  };

  return (
    <form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      className="flex flex-col gap-4"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-surface-700">
          {t("timeEntry.dateLabel")}
        </label>
        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <DatePicker
              value={toPickerDate(field.value)}
              onValueChange={(event: DatePickerRootValueChangeEvent) => {
                const picked = event.value as Date | null;
                if (!picked) return;
                const utcDate = toUtcMidnight(picked);
                field.onChange(utcDate);
                onDateChange(utcDate);
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
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-surface-700">
            {t("timeEntry.arrivalTimeLabel")}
          </label>
          <Controller
            control={control}
            name="arrivalTime"
            render={({ field, fieldState }) => (
              <>
                <DatePicker
                  timeOnly
                  hourFormat="24"
                  value={field.value ?? undefined}
                  onValueChange={(event: DatePickerRootValueChangeEvent) =>
                    field.onChange((event.value as Date | null) ?? null)
                  }
                  invalid={!!fieldState.error}
                >
                  <DatePickerInput
                    aria-label={t("timeEntry.arrivalTimeLabel")}
                  />
                  <DatePickerPortal>
                    <DatePickerPositioner>
                      <DatePickerPopup>
                        <DatePickerTime />
                      </DatePickerPopup>
                    </DatePickerPositioner>
                  </DatePickerPortal>
                </DatePicker>
                {fieldState.error && (
                  <p className="mt-1 text-xs text-error-700">
                    {fieldState.error.message}
                  </p>
                )}
              </>
            )}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-surface-700">
            {t("timeEntry.departureTimeLabel")}
          </label>
          <Controller
            control={control}
            name="departureTime"
            render={({ field, fieldState }) => (
              <>
                <DatePicker
                  timeOnly
                  hourFormat="24"
                  value={field.value ?? undefined}
                  onValueChange={(event: DatePickerRootValueChangeEvent) =>
                    field.onChange((event.value as Date | null) ?? null)
                  }
                  invalid={!!fieldState.error}
                >
                  <DatePickerInput
                    aria-label={t("timeEntry.departureTimeLabel")}
                  />
                  <DatePickerPortal>
                    <DatePickerPositioner>
                      <DatePickerPopup>
                        <DatePickerTime />
                      </DatePickerPopup>
                    </DatePickerPositioner>
                  </DatePickerPortal>
                </DatePicker>
                {fieldState.error && (
                  <p className="mt-1 text-xs text-error-700">
                    {fieldState.error.message}
                  </p>
                )}
              </>
            )}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-surface-700">
            {t("timeEntry.lunchBreakStartLabel")}
          </label>
          <Controller
            control={control}
            name="lunchBreakStart"
            render={({ field, fieldState }) => (
              <>
                <DatePicker
                  timeOnly
                  hourFormat="24"
                  value={field.value ?? undefined}
                  onValueChange={(event: DatePickerRootValueChangeEvent) => {
                    const picked = event.value as Date | null;
                    field.onChange(
                      picked
                        ? clampLocalTimeOfDay(
                            picked,
                            LUNCH_MIN_MINUTES,
                            LUNCH_MAX_MINUTES,
                          )
                        : null,
                    );
                  }}
                  invalid={!!fieldState.error}
                >
                  <DatePickerInput
                    aria-label={t("timeEntry.lunchBreakStartLabel")}
                  />
                  <DatePickerPortal>
                    <DatePickerPositioner>
                      <DatePickerPopup>
                        <DatePickerTime />
                      </DatePickerPopup>
                    </DatePickerPositioner>
                  </DatePickerPortal>
                </DatePicker>
                {fieldState.error && (
                  <p className="mt-1 text-xs text-error-700">
                    {fieldState.error.message}
                  </p>
                )}
              </>
            )}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-surface-700">
            {t("timeEntry.lunchBreakEndLabel")}
          </label>
          <Controller
            control={control}
            name="lunchBreakEnd"
            render={({ field, fieldState }) => (
              <>
                <DatePicker
                  timeOnly
                  hourFormat="24"
                  value={field.value ?? undefined}
                  onValueChange={(event: DatePickerRootValueChangeEvent) => {
                    const picked = event.value as Date | null;
                    field.onChange(
                      picked
                        ? clampLocalTimeOfDay(
                            picked,
                            LUNCH_MIN_MINUTES,
                            LUNCH_MAX_MINUTES,
                          )
                        : null,
                    );
                  }}
                  invalid={!!fieldState.error}
                >
                  <DatePickerInput
                    aria-label={t("timeEntry.lunchBreakEndLabel")}
                  />
                  <DatePickerPortal>
                    <DatePickerPositioner>
                      <DatePickerPopup>
                        <DatePickerTime />
                      </DatePickerPopup>
                    </DatePickerPositioner>
                  </DatePickerPortal>
                </DatePicker>
                {fieldState.error && (
                  <p className="mt-1 text-xs text-error-700">
                    {fieldState.error.message}
                  </p>
                )}
              </>
            )}
          />
        </div>
      </div>

      {submitError && <p className="text-sm text-error-700">{submitError}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={formState.isSubmitting}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {t("timeEntry.save")}
        </button>
      </div>
    </form>
  );
}
