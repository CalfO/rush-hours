import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Controller,
  useForm,
  type FieldErrors,
  type Resolver,
  type SubmitHandler,
} from "react-hook-form";
import {
  timeEntrySchema,
  type ReferenceWeekDayInput,
  type TimeEntryInput,
} from "@rushhours/domain";
import type { DatePickerRootValueChangeEvent } from "@primereact/types/primitive/datepicker";
import { toIsoDate } from "../lib/date";
import { upsertTimeEntry, type TimeEntryRecord } from "../api/time-entries";
import { Button } from "./ui/button";
import {
  DatePicker,
  DatePickerInput,
  DatePickerPopup,
  DatePickerPortal,
  DatePickerPositioner,
  DatePickerTime,
} from "./ui/datepicker";

interface DayCardProps {
  date: Date; // UTC-midnight, this card's day
  existingEntry: TimeEntryRecord | undefined;
  /**
   * §5.7 reference-week prefill — only consulted when `existingEntry` is
   * `undefined` (an already-saved day is never overwritten, enforced by the
   * caller, `WeekCarousel`). Populates form defaults only, never
   * auto-submits.
   */
  prefillEntry?: ReferenceWeekDayInput;
  onSaved: (entry: TimeEntryRecord) => void;
  /**
   * Reported whenever RHF's own `formState.isDirty` changes (react-hook-form
   * is the source of truth for "has the user typed something not yet
   * saved" — no separate dirty tracking is introduced here). `WeekCarousel`
   * uses this to avoid remounting a card that has unsaved input when the
   * §5.7 reference-week switch flips (see its own doc comment) — a card the
   * user is actively typing into must never lose that input to a prefill
   * remount.
   */
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * Raw form-shape state: `Date | null` per time field (unfilled until the
 * user picks a time). Combined with the `date` prop into a `TimeEntryInput`
 * only at validate/submit time via `toTimeEntryInput` below.
 */
type DayFormValues = {
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
 * This app treats every `Date` as a UTC-equivalent wall clock (see
 * `packages/domain`'s `time-entry.schema.ts` own doc comment, which follows
 * the identical convention) — `date` here is guaranteed already UTC-midnight
 * by its caller (`WeekCarousel`'s day derivation), this just re-normalizes
 * defensively to that same convention.
 */
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
 * Inverse of `combineDateAndTime`: builds a picker-shape (local wall-clock)
 * `Date` from `cardDate`'s own UTC calendar fields plus a reference-week
 * "minutes since midnight" value (§5.7). Used only for `prefillEntry` —
 * `minutes` is already a plain minutes-of-day integer (no UTC/local
 * ambiguity of its own, see `reference-week.schema.ts`'s doc comment), so
 * this only needs to place it on the right calendar day for the picker.
 */
function minutesToPickerTime(cardDate: Date, minutes: number): Date {
  return new Date(
    cardDate.getUTCFullYear(),
    cardDate.getUTCMonth(),
    cardDate.getUTCDate(),
    Math.floor(minutes / 60),
    minutes % 60,
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
function toTimeEntryInput(date: Date, values: DayFormValues): TimeEntryInput {
  const utcDate = toUtcCalendarDate(date);
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
 * Safety-net resolver factory, same two-stage shape as `WorkScheduleModal`'s
 * `workScheduleResolver`: required-field checks first (a `null` time field
 * can't even be transformed into a candidate `TimeEntryInput`), then
 * delegates the real business rules to `timeEntrySchema` (imported from
 * `@rushhours/domain`, never redeclared). Takes `date` as a factory
 * parameter (rather than reading it off `values`, since `date` is now a
 * plain prop, not part of the form's own values) — safe to close over
 * per-render because `DayCard` is remounted whenever `date` changes (see
 * `WeekCarousel`'s `key={toIsoDate(day)}`).
 */
function dayFormResolver(date: Date): Resolver<DayFormValues> {
  return (values) => {
    const missing = TIME_FIELDS.filter((field) => !values[field]);
    if (missing.length > 0) {
      const errors: Record<string, { type: string; message: string }> = {};
      for (const field of missing) {
        errors[field] = {
          type: "required",
          message: "This field is required",
        };
      }
      return { values: {}, errors: errors as FieldErrors<DayFormValues> };
    }

    const result = timeEntrySchema.safeParse(toTimeEntryInput(date, values));
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
}

/**
 * Spec §7.2 "Formulaire du jour" / §3-§4 carousel day card — 4 `timeOnly`
 * time fields + Save for a single day. The date itself is no longer picked
 * here (relocated to `TimeEntryPage` level, see spec §3) — `DayCard` is a
 * pure function of the `date`/`existingEntry` props it's given. Remounted by
 * `WeekCarousel` on a `key={toIsoDate(date)}` each time the displayed day
 * changes, so its `defaultValues` (derived once from `existingEntry`) never
 * need a manual reset effect (react-best-practices — prefer remount over
 * prop-to-state sync).
 */
export function DayCard({
  date,
  existingEntry,
  prefillEntry,
  onSaved,
  onDirtyChange,
}: DayCardProps) {
  const { t } = useTranslation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit, formState } = useForm<DayFormValues>({
    resolver: dayFormResolver(date),
    defaultValues: {
      arrivalTime: existingEntry
        ? toPickerDate(existingEntry.arrivalTime)
        : prefillEntry
          ? minutesToPickerTime(date, prefillEntry.arrivalMinutes)
          : null,
      lunchBreakStart: existingEntry
        ? toPickerDate(existingEntry.lunchBreakStart)
        : prefillEntry
          ? minutesToPickerTime(date, prefillEntry.lunchBreakStartMinutes)
          : null,
      lunchBreakEnd: existingEntry
        ? toPickerDate(existingEntry.lunchBreakEnd)
        : prefillEntry
          ? minutesToPickerTime(date, prefillEntry.lunchBreakEndMinutes)
          : null,
      departureTime: existingEntry
        ? toPickerDate(existingEntry.departureTime)
        : prefillEntry
          ? minutesToPickerTime(date, prefillEntry.departureMinutes)
          : null,
    },
  });

  // Reports RHF's own dirty flag up to the caller (react-best-practices #6 —
  // narrowed to the one primitive this effect actually needs, not the whole
  // `formState` object, which changes identity on every keystroke).
  useEffect(() => {
    onDirtyChange?.(formState.isDirty);
  }, [formState.isDirty, onDirtyChange]);

  const onSubmit: SubmitHandler<DayFormValues> = async (values) => {
    setSubmitError(null);
    try {
      const input = toTimeEntryInput(date, values);
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
      <div className="grid grid-cols-1 gap-3">
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
                    placeholder={t("timeEntry.timePlaceholder")}
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
                    placeholder={t("timeEntry.timePlaceholder")}
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
                    placeholder={t("timeEntry.timePlaceholder")}
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
                    placeholder={t("timeEntry.timePlaceholder")}
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
        <Button
          type="submit"
          disabled={formState.isSubmitting}
          className="px-4 py-2 text-sm"
        >
          {t("timeEntry.save")}
        </Button>
      </div>
    </form>
  );
}
