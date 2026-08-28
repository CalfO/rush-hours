import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Controller,
  useForm,
  useFormState,
  useWatch,
  type Control,
  type FieldErrors,
  type Resolver,
  type SubmitHandler,
} from "react-hook-form";
import {
  WEEKDAYS,
  workScheduleSchema,
  type Weekday,
  type WorkScheduleInput,
} from "@rushhours/domain";
import { cn } from "../lib/utils";
import { getWorkSchedule, putWorkSchedule } from "../api/users";
import { Modal } from "./ui/Modal";
import { Checkbox } from "./ui/checkbox";
import { InputNumber, InputNumberInput } from "./ui/inputnumber";
import {
  Select,
  SelectList,
  SelectPopup,
  SelectPortal,
  SelectPositioner,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { ToggleButtonGroup } from "./ui/togglebuttongroup";
import { ToggleButton } from "./ui/togglebutton";

interface WorkScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (schedule: WorkScheduleInput) => void;
}

/**
 * Fixed-shape form state — the set of weekdays is always exactly the same 7,
 * never added/removed as list items (only their `checked` flag toggles), so
 * a `useFieldArray` would be the wrong tool here (spec §5.5, architect plan
 * point 4). Form state stays keyed by weekday name regardless of the
 * render-order rotation applied in `orderedWeekdays` below.
 */
type FormValues = {
  weeklyContractHours: number;
  weekStartDay: Weekday;
  entries: Record<Weekday, { checked: boolean; hours: number | null }>;
};

type LoadState = "loading" | "ready" | "error";

const QUICK_PICKS = [35, 37, 40] as const;
const DEFAULT_WORKING_DAYS: readonly Weekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
];

function emptyEntries(): FormValues["entries"] {
  const entries = {} as FormValues["entries"];
  for (const weekday of WEEKDAYS) {
    entries[weekday] = { checked: false, hours: null };
  }
  return entries;
}

/**
 * Rotates `WEEKDAYS` to start at `startDay` — render-only, has zero effect
 * on form state/validation/payload (architect plan point 6).
 */
function rotateWeekdays(startDay: Weekday): Weekday[] {
  const startIndex = WEEKDAYS.indexOf(startDay);
  if (startIndex === -1) return [...WEEKDAYS];
  return [...WEEKDAYS.slice(startIndex), ...WEEKDAYS.slice(0, startIndex)];
}

/**
 * Splits `totalMinutes` evenly across `dayCount` days, rounding each share
 * and pushing the leftover remainder onto the last day so the sum is always
 * exactly `totalMinutes` — the default distribution has Δ=0 the moment the
 * modal opens, not something the user has to fix before Save is enabled
 * (architect plan point 5).
 */
function splitMinutesEvenly(totalMinutes: number, dayCount: number): number[] {
  const base = Math.floor(totalMinutes / dayCount);
  const shares = new Array<number>(dayCount).fill(base);
  shares[dayCount - 1] += totalMinutes - base * dayCount;
  return shares;
}

/**
 * Maps a `GET /users/me/work-schedule` response onto the form's fixed
 * shape, converting minutes -> heures. A fresh user's response has an empty
 * `days` array (Prisma/seed defaults, see `apps/api/prisma/seed.ts`) — in
 * that case, Monday-Friday are checked with `weeklyContractHours` split
 * evenly between them (spec §5.5's stated default).
 */
function buildDefaultFormValues(schedule: WorkScheduleInput): FormValues {
  const entries = emptyEntries();

  if (schedule.days.length === 0) {
    const totalMinutes = Math.round(schedule.weeklyContractHours * 60);
    const shares = splitMinutesEvenly(
      totalMinutes,
      DEFAULT_WORKING_DAYS.length,
    );
    DEFAULT_WORKING_DAYS.forEach((weekday, index) => {
      entries[weekday] = { checked: true, hours: shares[index] / 60 };
    });
  } else {
    for (const day of schedule.days) {
      entries[day.weekday] = { checked: true, hours: day.targetMinutes / 60 };
    }
  }

  return {
    weeklyContractHours: schedule.weeklyContractHours,
    weekStartDay: schedule.weekStartDay,
    entries,
  };
}

/**
 * UI-shape -> domain-shape transform (only checked days are included in the
 * `days` array; heures -> integer minutes conversion happens here). This is
 * UI-shape plumbing specific to this form, so it stays colocated here
 * rather than in `packages/domain` (architect plan point 4).
 */
function toWorkScheduleInput(values: FormValues): WorkScheduleInput {
  const days = WEEKDAYS.filter(
    (weekday) => values.entries[weekday].checked,
  ).map((weekday) => ({
    weekday,
    targetMinutes: Math.round((values.entries[weekday].hours ?? 0) * 60),
  }));

  return {
    weeklyContractHours: values.weeklyContractHours,
    weekStartDay: values.weekStartDay,
    days,
  };
}

/**
 * Safety-net resolver: projects the form's fixed-shape state to
 * `WorkScheduleInput` and re-validates it against `workScheduleSchema`
 * (imported from `@rushhours/domain`, not redeclared). The two live
 * business rules (>=1 day checked, Δ=0) are primarily enforced by the
 * Save-button-disabled logic in `DeltaAndActions` below — most users won't
 * hit a resolver-level rejection in normal use. Errors that don't map to a
 * single `FormValues` field (the days-array rules) surface as a root error.
 */
const workScheduleResolver: Resolver<FormValues> = (values) => {
  const result = workScheduleSchema.safeParse(toWorkScheduleInput(values));

  if (result.success) {
    return { values, errors: {} };
  }

  // Built as a plain record rather than `FieldErrors<FormValues>` directly:
  // TS infers an unwieldy recursive shape for `entries` (a `Record<Weekday,
  // {...}>`) that rejects a plain `{ type, message }` assignment even for
  // the two flat fields below — the same adapter pattern RHF's own
  // schema-resolver packages use internally.
  const errors: Record<string, { type: string; message: string }> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (field === "weeklyContractHours" || field === "weekStartDay") {
      errors[field] = { type: "custom", message: issue.message };
    } else {
      errors.root = { type: "custom", message: issue.message };
    }
  }

  return { values: {}, errors: errors as FieldErrors<FormValues> };
};

/**
 * One row per weekday — hoisted to module scope (react-best-practices §1)
 * rather than defined inside `WorkScheduleModal`'s render. Watches only its
 * own `checked` flag so toggling one day never re-renders sibling rows.
 */
function WorkScheduleDayRow({
  control,
  weekday,
}: {
  control: Control<FormValues>;
  weekday: Weekday;
}) {
  const { t } = useTranslation();
  const checked = useWatch({ control, name: `entries.${weekday}.checked` });

  return (
    <div className="flex items-center gap-3 py-1">
      <Controller
        control={control}
        name={`entries.${weekday}.checked`}
        render={({ field }) => (
          <label className="flex w-36 items-center gap-2 text-sm text-surface-700">
            <Checkbox
              checked={field.value}
              onCheckedChange={(event) => field.onChange(event.checked)}
            />
            {t(`weekdays.${weekday}`)}
          </label>
        )}
      />
      {checked && (
        <Controller
          control={control}
          name={`entries.${weekday}.hours`}
          render={({ field }) => (
            <InputNumber
              value={field.value}
              onValueChange={(event) => field.onChange(event.value)}
              min={0.25}
              step={0.25}
              maxFractionDigits={2}
            >
              <InputNumberInput onBlur={field.onBlur} />
            </InputNumber>
          )}
        />
      )}
    </div>
  );
}

/**
 * Δ indicator + Save/Cancel actions, scoped to its own `useWatch`/
 * `useFormState` subscriptions (react-best-practices §5/§9) so re-renders
 * from every hours-field keystroke stay confined here instead of
 * propagating to the rest of the form.
 */
function DeltaAndActions({
  control,
  onCancel,
}: {
  control: Control<FormValues>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { isSubmitting, errors } = useFormState({ control });
  const [weeklyContractHours, entries] = useWatch({
    control,
    name: ["weeklyContractHours", "entries"],
  });

  const checkedWeekdays = WEEKDAYS.filter(
    (weekday) => entries?.[weekday]?.checked,
  );
  const hasCheckedDay = checkedWeekdays.length > 0;
  // A checked day with no hours entered (`null`, e.g. cleared and blurred)
  // must block Save even if other days' hours happen to add up to Δ=0 —
  // `workScheduleSchema` (packages/domain) requires `targetMinutes > 0` for
  // every submitted day, so the button-enabled state must agree with what
  // the schema will actually accept, or Save silently no-ops (the resolver
  // rejects, RHF never calls onSubmit, nothing was previously shown to the
  // user for this case).
  const hasIncompleteCheckedDay = checkedWeekdays.some((weekday) => {
    const hours = entries?.[weekday]?.hours;
    return hours == null || hours <= 0;
  });

  const targetMinutes = Math.round((weeklyContractHours ?? 0) * 60);
  const enteredMinutes = checkedWeekdays.reduce((sum, weekday) => {
    return sum + Math.round((entries?.[weekday]?.hours ?? 0) * 60);
  }, 0);
  const delta = targetMinutes - enteredMinutes;

  return (
    <div className="flex flex-col gap-3">
      <p
        className={cn(
          "text-sm font-medium",
          delta === 0 && !hasIncompleteCheckedDay
            ? "text-success-700"
            : "text-error-700",
        )}
      >
        {hasIncompleteCheckedDay
          ? t("workSchedule.incompleteCheckedDay")
          : delta === 0
            ? t("workSchedule.deltaMatch")
            : t("workSchedule.deltaMismatch", { minutes: delta })}
      </p>
      {errors.root?.message && (
        <p className="text-sm text-error-700">{errors.root.message}</p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-surface-300 px-4 py-2 text-sm text-surface-700 hover:bg-surface-100"
        >
          {t("workSchedule.cancel")}
        </button>
        <button
          type="submit"
          disabled={
            delta !== 0 ||
            !hasCheckedDay ||
            hasIncompleteCheckedDay ||
            isSubmitting
          }
          className="rounded-md bg-primary-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {t("workSchedule.save")}
        </button>
      </div>
    </div>
  );
}

/**
 * Owns fetching the current schedule, all form state, and the `PUT`
 * submission. Deliberately mounted only while the modal is `open` (see the
 * default export below) rather than gating on an `open` effect dependency:
 * that makes "fetch once per open session" a natural consequence of mount
 * lifecycle — initial state starts at `"loading"` and only the `.then`/
 * `catch` callbacks below call `setLoadState`, so there's no synchronous
 * `setState` in the effect body to trigger cascading renders
 * (react-hooks/set-state-in-effect) — instead of an `open`-keyed effect
 * that would need to reset state back to `"loading"` on every reopen.
 */
function WorkScheduleForm({
  onOpenChange,
  onSaved,
}: {
  onOpenChange: (open: boolean) => void;
  onSaved?: (schedule: WorkScheduleInput) => void;
}) {
  const { t } = useTranslation();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: workScheduleResolver,
  });

  useEffect(() => {
    let ignore = false;
    getWorkSchedule().then(
      (schedule) => {
        if (ignore) return;
        reset(buildDefaultFormValues(schedule));
        setLoadState("ready");
      },
      () => {
        if (ignore) return;
        setLoadState("error");
      },
    );
    return () => {
      ignore = true;
    };
  }, [reset]);

  // Live, not frozen at open-time: reacts as the user changes the week-start-day
  // Select mid-edit (architect plan point 6).
  const weekStartDay = useWatch({ control, name: "weekStartDay" }) ?? "MONDAY";
  const orderedWeekdays = rotateWeekdays(weekStartDay);
  const weekStartDayOptions = WEEKDAYS.map((weekday) => ({
    value: weekday,
    label: t(`weekdays.${weekday}`),
  }));

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    setSubmitError(null);
    try {
      const saved = await putWorkSchedule(toWorkScheduleInput(values));
      onOpenChange(false);
      onSaved?.(saved);
    } catch {
      setSubmitError(t("workSchedule.saveError"));
    }
  };

  return (
    <>
      {loadState !== "ready" ? (
        <p className="text-sm text-surface-500">
          {loadState === "error"
            ? t("workSchedule.loadError")
            : t("workSchedule.loading")}
        </p>
      ) : (
        <form
          onSubmit={(event) => void handleSubmit(onSubmit)(event)}
          className="flex flex-col gap-5"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">
              {t("workSchedule.weeklyHoursLabel")}
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Controller
                control={control}
                name="weeklyContractHours"
                render={({ field }) => (
                  <InputNumber
                    value={field.value}
                    onValueChange={(event) => field.onChange(event.value)}
                    min={0.25}
                    step={0.5}
                    maxFractionDigits={2}
                  >
                    <InputNumberInput
                      onBlur={field.onBlur}
                      aria-label={t("workSchedule.weeklyHoursLabel")}
                    />
                  </InputNumber>
                )}
              />
              <Controller
                control={control}
                name="weeklyContractHours"
                render={({ field }) => (
                  <ToggleButtonGroup
                    value={
                      QUICK_PICKS.includes(
                        field.value as (typeof QUICK_PICKS)[number],
                      )
                        ? field.value
                        : undefined
                    }
                    onValueChange={(event) => {
                      if (typeof event.value === "number") {
                        field.onChange(event.value);
                      }
                    }}
                    aria-label={t("workSchedule.quickPickLabel")}
                  >
                    {QUICK_PICKS.map((hours) => (
                      <ToggleButton key={hours} value={hours}>
                        {hours}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                )}
              />
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-surface-700">
              {t("workSchedule.workingDaysLabel")}
            </p>
            <p className="mb-2 text-xs text-surface-500">
              {t("workSchedule.distributionLabel")}
            </p>
            <div className="flex flex-col gap-1">
              {orderedWeekdays.map((weekday) => (
                <WorkScheduleDayRow
                  key={weekday}
                  control={control}
                  weekday={weekday}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">
              {t("workSchedule.weekStartDayLabel")}
            </label>
            <Controller
              control={control}
              name="weekStartDay"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(event) => field.onChange(event.value)}
                  options={weekStartDayOptions}
                  optionLabel="label"
                  optionValue="value"
                >
                  <SelectTrigger
                    aria-label={t("workSchedule.weekStartDayLabel")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectPositioner>
                      <SelectPopup>
                        <SelectList />
                      </SelectPopup>
                    </SelectPositioner>
                  </SelectPortal>
                </Select>
              )}
            />
          </div>

          {submitError && (
            <p className="text-sm text-error-700">{submitError}</p>
          )}

          <DeltaAndActions
            control={control}
            onCancel={() => onOpenChange(false)}
          />
        </form>
      )}
    </>
  );
}

/**
 * Spec §5.5 — standalone, reusable "Ma semaine de travail" modal. Not wired
 * into any trigger point yet (that's onboarding step 2 and the header
 * avatar menu, both later lots) — this lot only builds the component
 * itself. `WorkScheduleForm` is only rendered while `open`, so it (re)fetches
 * the current schedule exactly once per open session (see its own doc
 * comment) rather than on every mount of this wrapper.
 */
export default function WorkScheduleModal({
  open,
  onOpenChange,
  onSaved,
}: WorkScheduleModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("workSchedule.title")}
    >
      {open && (
        <WorkScheduleForm onOpenChange={onOpenChange} onSaved={onSaved} />
      )}
    </Modal>
  );
}
