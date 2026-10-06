"use client";

import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "@primeicons/react";
import type {
  UseDatePickerMonthData,
  UseDatePickerMonthOptions,
  UseDatePickerYearOptions,
} from "@primereact/types/headless/datepicker";
import type {
  DatePickerBodyProps,
  DatePickerCalendarProps,
  DatePickerInputProps,
  DatePickerPanelProps,
  DatePickerPopupProps,
  DatePickerPortalProps,
  DatePickerPositionerProps,
  DatePickerRootProps,
  DatePickerTimeProps,
} from "@primereact/types/primitive/datepicker";
import { VariantProps } from "class-variance-authority";
import {
  DatePickerDay,
  DatePicker as PRDatePicker,
  useDatePickerContext,
} from "primereact/datepicker";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { buttonVariants } from "./button";
import { inputTextVariants } from "./inputtext";
import {
  Popover,
  PopoverPopup,
  PopoverPortal,
  PopoverPositioner,
  PopoverTrigger,
} from "./popover";

export type DatePickerProps = Omit<DatePickerRootProps, "size" | "variant">;

const selectButtonClass = `inline-flex items-center justify-center border-0 bg-transparent cursor-pointer
    px-1.5! py-1! rounded! text-sm! font-medium! text-surface-700! dark:text-surface-0!
    transition-colors duration-150
    hover:bg-surface-100! dark:hover:bg-surface-800!
    focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-primary`;

function DayTableHead() {
  const datepicker = useDatePickerContext();
  const weekDays = datepicker?.weekDays ?? [];
  const showWeek = !!datepicker?.props.showWeek;
  const weekHeaderLabel = datepicker?.weekHeaderLabel;

  return (
    <PRDatePicker.TableHeadRow>
      {showWeek && (
        <PRDatePicker.TableHeadWeekCell className="p-1 text-xs font-normal text-surface-500 opacity-60 dark:text-surface-400">
          <span className="block text-center">{weekHeaderLabel}</span>
        </PRDatePicker.TableHeadWeekCell>
      )}
      {weekDays.map((day, index) => (
        <PRDatePicker.TableHeadCell
          key={index}
          abbr={day}
          className="p-1 text-xs font-normal text-surface-500 dark:text-surface-400"
        >
          <PRDatePicker.TableHeadWeekLabel className="block text-center">
            {day}
          </PRDatePicker.TableHeadWeekLabel>
        </PRDatePicker.TableHeadCell>
      ))}
    </PRDatePicker.TableHeadRow>
  );
}

function DayTableBody({ index = 0 }: { index?: number }) {
  const datepicker = useDatePickerContext();
  const month = datepicker?.getIndexedMonth?.(index) as UseDatePickerMonthData;
  const showWeek = !!datepicker?.props.showWeek;

  return (
    <>
      {month?.dates?.map((week, weekIndex) => (
        <PRDatePicker.TableBodyRow key={weekIndex}>
          {showWeek && (
            <PRDatePicker.TableBodyWeekCell className="py-px opacity-60">
              <PRDatePicker.TableBodyWeekLabel className="mx-auto flex size-9 items-center justify-center text-sm font-normal text-surface-700 dark:text-surface-0">
                {month?.weekNumbers?.[weekIndex]}
              </PRDatePicker.TableBodyWeekLabel>
            </PRDatePicker.TableBodyWeekCell>
          )}
          {week.map((date) => (
            <PRDatePicker.TableBodyCell
              key={date.day + "" + date.month}
              date={date}
              className="py-px"
            >
              <span
                className={`flex h-9 w-full items-center justify-center rounded-full text-sm font-normal transition-none
                                has-data-in-range:rounded-none has-data-in-range:bg-primary-500/10
                                has-[[data-range-start]:not([data-range-end]):not([data-range-pending]):not([data-hover-range-end])]:rounded-r-none has-[[data-range-start]:not([data-range-end]):not([data-range-pending]):not([data-hover-range-end])]:bg-primary-500/10
                                has-[[data-range-start][data-hover-range-start]:not([data-hover-range-end])]:rounded-r-none has-[[data-range-start][data-hover-range-start]:not([data-hover-range-end])]:bg-primary-500/10
                                has-[[data-range-end]:not([data-range-start]):not([data-hover-range-start])]:rounded-l-none has-[[data-range-end]:not([data-range-start]):not([data-hover-range-start])]:bg-primary-500/10
                                has-data-in-hover-range:rounded-none has-data-in-hover-range:bg-primary-500/10
                                has-[[data-hover-range-start]:not([data-hover-range-end])]:rounded-r-none has-[[data-hover-range-start]:not([data-hover-range-end])]:bg-primary-500/10
                                has-[[data-hover-range-end]:not([data-hover-range-start])]:rounded-l-none has-[[data-hover-range-end]:not([data-hover-range-start])]:bg-primary-500/10
                                [td:first-child_&]:rounded-l-full!
                                [td:last-child_&]:rounded-r-full!`}
              >
                <DatePickerDay
                  className={`relative mx-auto flex size-9 cursor-pointer items-center justify-center rounded-full
                                    text-surface-700 transition-none dark:text-surface-0
                                    focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-primary
                                    data-outside:text-surface-400 dark:data-outside:text-surface-500
                                    data-today:after:absolute data-today:after:bottom-1 data-today:after:left-1/2 data-today:after:size-1 data-today:after:-translate-x-1/2 data-today:after:rounded-full data-today:after:bg-primary data-today:after:content-['']
                                    data-selected:data-today:after:bg-primary-contrast
                                    data-hover-range-start:data-today:after:bg-primary-contrast
                                    data-hover-range-end:data-today:after:bg-primary-contrast
                                    data-disabled:cursor-not-allowed data-disabled:opacity-40
                                    not-data-selected:not-data-disabled:not-data-in-range:not-data-in-hover-range:not-data-range-start:not-data-range-end:not-data-hover-range-start:not-data-hover-range-end:hover:bg-surface-100
                                    dark:not-data-selected:not-data-disabled:not-data-in-range:not-data-in-hover-range:not-data-range-start:not-data-range-end:not-data-hover-range-start:not-data-hover-range-end:hover:bg-surface-800
                                    data-selected:bg-primary data-selected:text-primary-contrast data-selected:hover:bg-primary-emphasis
                                    data-hover-range-start:bg-primary data-hover-range-start:text-primary-contrast data-hover-range-start:hover:bg-primary-emphasis
                                    data-hover-range-end:bg-primary data-hover-range-end:text-primary-contrast data-hover-range-end:hover:bg-primary-emphasis`}
                />
              </span>
            </PRDatePicker.TableBodyCell>
          ))}
        </PRDatePicker.TableBodyRow>
      ))}
    </>
  );
}

const monthYearButtonClass = `flex items-center justify-center w-full! h-9 mx-auto rounded-md! cursor-pointer text-sm! font-normal! p-0!
    text-surface-700! dark:text-surface-0! transition-colors duration-150
    not-data-selected:not-data-disabled:hover:bg-surface-100! dark:not-data-selected:not-data-disabled:hover:bg-surface-800!
    data-selected:bg-primary! data-selected:text-primary-contrast! data-selected:hover:bg-primary-emphasis!
    data-disabled:opacity-40 data-disabled:cursor-not-allowed
    focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-primary`;

function MonthTableBody() {
  const datepicker = useDatePickerContext();
  const months = (datepicker?.monthPickerValues ??
    []) as UseDatePickerMonthOptions[];

  return (
    <>
      {Array.from({ length: 4 }).map((_, rowIndex) => (
        <PRDatePicker.TableBodyRow key={`month-row-${rowIndex}`}>
          {months
            ?.slice(rowIndex * 3, (rowIndex + 1) * 3)
            .map((month, colIndex) => {
              const monthIndex = rowIndex * 3 + colIndex;

              return (
                <PRDatePicker.TableBodyCell
                  key={monthIndex}
                  month={month}
                  index={monthIndex}
                  className="w-1/3 p-1"
                >
                  <PRDatePicker.Month className={monthYearButtonClass} />
                </PRDatePicker.TableBodyCell>
              );
            })}
        </PRDatePicker.TableBodyRow>
      ))}
    </>
  );
}

function YearTableBody() {
  const datepicker = useDatePickerContext();
  const years = (datepicker?.yearPickerValues ??
    []) as UseDatePickerYearOptions[];

  return (
    <>
      {Array.from({ length: 5 }).map((_, rowIndex) => (
        <PRDatePicker.TableBodyRow key={`year-row-${rowIndex}`}>
          {years
            ?.slice(rowIndex * 2, (rowIndex + 1) * 2)
            .map((year, colIndex) => {
              const yearIndex = rowIndex * 2 + colIndex;

              return (
                <PRDatePicker.TableBodyCell
                  key={yearIndex}
                  year={year}
                  className="w-1/2 p-1"
                >
                  <PRDatePicker.Year className={monthYearButtonClass} />
                </PRDatePicker.TableBodyCell>
              );
            })}
        </PRDatePicker.TableBodyRow>
      ))}
    </>
  );
}

function DatePicker({
  className,
  fluid,
  invalid,
  disabled,
  children,
  ...rootProps
}: DatePickerProps) {
  // `DatePickerRootProps` resolves `className`/`fluid`/`disabled` to `any`
  // under this version of `@primereact/types` (its `BaseComponentProps`
  // leaves the `T extends React.ElementType` generic unpinned for
  // `DatePickerRootProps`), so these are re-asserted to their real types
  // rather than left to leak `any` through `cn(...)`/JSX props below.
  const rootClassName = className as string | undefined;
  const isFluid = fluid as boolean | undefined;
  const isDisabled = disabled as boolean | undefined;

  return (
    <PRDatePicker.Root
      className={cn(
        "relative inline-flex max-w-full",
        isFluid && "w-full",
        isDisabled && "**:pointer-events-none **:select-none opacity-60",
        rootClassName,
      )}
      fluid={isFluid}
      disabled={isDisabled}
      data-invalid={invalid ? "" : undefined}
      {...rootProps}
    >
      {children}
    </PRDatePicker.Root>
  );
}

function DatePickerInput({
  className,
  size,
  variant,
  fluid,
  invalid,
  disabled,
  placeholder = "mm/dd/yy",
  ...props
}: DatePickerInputProps &
  VariantProps<typeof inputTextVariants> & { invalid?: boolean }) {
  // Same `any`-leak as `DatePicker` above — re-asserted for the same reason.
  const inputClassName = className as string | undefined;
  const isDisabled = disabled as boolean | undefined;
  const inputPlaceholder = placeholder as string | undefined;

  return (
    <PRDatePicker.Input
      placeholder={inputPlaceholder}
      disabled={isDisabled}
      className={cn(
        inputTextVariants({ size: size ?? "normal", variant, fluid }),
        invalid &&
          "border-red-400 placeholder:text-red-600 dark:border-red-300 dark:placeholder:text-red-400",
        inputClassName,
      )}
      {...props}
    />
  );
}

function DatePickerPortal({ ...props }: DatePickerPortalProps) {
  return <PRDatePicker.Portal {...props} />;
}

function DatePickerPositioner({
  sideOffset = 4,
  ...props
}: DatePickerPositionerProps) {
  return <PRDatePicker.Positioner sideOffset={sideOffset} {...props} />;
}

function DatePickerPopup({ className, ...props }: DatePickerPopupProps) {
  return (
    <PRDatePicker.Popup
      className={cn(
        `min-w-(--px-positioner-anchor-width) rounded-lg
                border border-surface-200 bg-surface-0 p-2
                text-surface-700 shadow-md
                dark:border-surface-700 dark:bg-surface-900 dark:text-surface-0
                origin-(--px-transform-origin)
                data-enter-from:scale-[0.93] data-enter-from:opacity-0
                data-leave-to:scale-[0.93] data-leave-to:opacity-0
                transition-[opacity,scale] duration-150 ease-out will-change-transform
                `,
        className,
      )}
      {...props}
    />
  );
}

function DatePickerBody({ className, ...props }: DatePickerBodyProps) {
  return (
    <PRDatePicker.Body
      className={cn("flex flex-wrap gap-4", className)}
      {...props}
    />
  );
}

function DatePickerPanel({ className, ...props }: DatePickerPanelProps) {
  return (
    <PRDatePicker.Panel className={cn("flex flex-col", className)} {...props} />
  );
}

const timeChevronButtonClass = buttonVariants({
  variant: "text",
  severity: "secondary",
  rounded: true,
  iconOnly: true,
  size: "small",
});

const timeFieldClass = `inline-flex items-center justify-center min-w-9 px-2 h-8 rounded-md text-sm font-medium tabular-nums
    text-surface-700 dark:text-surface-0 bg-surface-50 dark:bg-surface-800/60`;

const timeSeparatorClass = `inline-flex items-center justify-center px-0.5 text-sm font-semibold text-surface-500 dark:text-surface-400 select-none`;

function TimePicker({
  type,
  children,
}: {
  type: "hour" | "minute" | "second" | "ampm";
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  // Only "hour"/"minute" are ever actually rendered by this app (hourFormat
  // is always "24", showSeconds is never passed, see `DatePickerTime`
  // above) -- "second"/"ampm" fall back to the generic label rather than
  // carrying their own unused translation keys.
  const incrementLabel =
    type === "hour"
      ? t("timeEntry.incrementHourLabel")
      : type === "minute"
        ? t("timeEntry.incrementMinuteLabel")
        : t("timeEntry.incrementLabel");
  const decrementLabel =
    type === "hour"
      ? t("timeEntry.decrementHourLabel")
      : type === "minute"
        ? t("timeEntry.decrementMinuteLabel")
        : t("timeEntry.decrementLabel");

  return (
    <PRDatePicker.Picker
      type={type}
      className="flex flex-col items-center gap-0.5"
    >
      <PRDatePicker.Increment
        aria-label={incrementLabel}
        className={timeChevronButtonClass}
      >
        <ChevronUp />
      </PRDatePicker.Increment>
      {children}
      <PRDatePicker.Decrement
        aria-label={decrementLabel}
        className={timeChevronButtonClass}
      >
        <ChevronDown />
      </PRDatePicker.Decrement>
    </PRDatePicker.Picker>
  );
}

const hourGridButtonClass = `inline-flex items-center justify-center rounded-md h-8 text-sm font-medium tabular-nums cursor-pointer
    text-surface-700 dark:text-surface-0
    transition-colors duration-150
    hover:bg-surface-100 dark:hover:bg-surface-800
    focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-primary`;

/**
 * `timeFieldClass` styled for use as the hour-grid `PopoverTrigger`'s own
 * root element rather than as a static `<span>` — see the comment on
 * `DatePickerHourGrid` below for why the trigger is styled directly instead
 * of via `asChild` on `PRDatePicker.Hour`.
 */
const hourTriggerClass = `${timeFieldClass} cursor-pointer border-0 transition-colors duration-150
    hover:bg-surface-100 dark:hover:bg-surface-800
    focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-primary`;

/**
 * Spec §4.2 "Saisie d'heure simplifiée" — clicking the hour field opens a
 * 24-cell grid picker instead of requiring repeated increment/decrement
 * clicks. No dedicated absolute-hour setter exists on
 * `useDatePickerContext()`'s public return value (`getIncrementProps`/
 * `getDecrementProps` only wire to private *relative* steppers) — what IS
 * safely reachable is the context's own `.props` object (already used above
 * for `showSeconds`/`hourFormat`/`timeOnly`), which also carries
 * `.value`/`.onValueChange`, the same controlled-value contract `DayCard`
 * already wires through `field.onChange`. So `onValueChange` is called
 * directly here — not a private-internals hack.
 *
 * `PRDatePicker.Hour` cannot be `PopoverTrigger`'s `asChild` target: its
 * `render()` (see `primereact/datepicker`'s `DatePicker.Hour`) builds its
 * DOM attrs solely from the datepicker's internal `hourProps`/`cx("hour")`,
 * ignoring whatever `asChild` tries to merge onto it (`onClick` included) —
 * so the popover never opened. Instead the trigger renders its own real
 * `<button>` (default `as="button"`, styled via `hourTriggerClass`) with
 * `PRDatePicker.Hour` nested inside purely for its formatted-hour display;
 * `useDatePickerContext()` is still in scope since this all renders inside
 * `DatePickerTime`. `type="button"` is required here — `usePopover`'s
 * `triggerProps` doesn't set it (unlike `getIncrementProps`/
 * `getDecrementProps`, which do), and this renders inside `DayCard`'s
 * `<form>`, so an unset type would default to "submit".
 */
function DatePickerHourGrid() {
  const { t } = useTranslation();
  const datepicker = useDatePickerContext();
  const [open, setOpen] = React.useState(false);
  const pendingSync = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (pendingSync.current !== null) clearTimeout(pendingSync.current);
    },
    [],
  );

  function pick(hour: number) {
    const current = (datepicker?.props.value as Date | null) ?? new Date();
    const next = new Date(current);
    next.setHours(hour, current.getMinutes(), 0, 0);
    const onValueChange = datepicker?.props.onValueChange;
    onValueChange?.({ value: next });
    setOpen(false);

    // The +/- steppers (`PRDatePicker.Increment`/`Decrement`) don't read
    // `props.value` at all — they read the headless hook's own internal
    // hour/minute/second state, which the hook reconciles from
    // `props.value` in an effect keyed on `[props.value]` (see
    // `@primereact/headless/datepicker`, minified as `nr`/`useDatePicker`
    // in `node_modules/@primereact/headless/datepicker/index.mjs`). That
    // effect is itself buggy: it calls its internal `lt()` (re-derive
    // hour/min/sec from the hook's current memoized selection) *before*
    // `et(e)` (apply the incoming `value` to that memoized selection) —
    // so the very first reconciliation pass after any external
    // `onValueChange` (this grid, but also manually typing a full HH:MM
    // into `DatePickerInput`) reads the PRE-change hour/minute, not the
    // new one, leaving the steppers' internal ref (`V.current` for hour)
    // stuck on the old value while `props.value`/the visible input text
    // are already correct. Confirmed by reading that effect's body
    // directly, not just observed behavior.
    //
    // Firing `onValueChange` a second time with an equivalent-but-new
    // Date, once the first render/commit (and that first, stale
    // reconciliation pass) has flushed, makes the *second* pass run
    // against the hook's by-then-updated memoized selection — which is
    // now the picked value — so it resyncs the steppers' internal state
    // correctly. `setTimeout(..., 0)` (a macrotask) is used rather than
    // an effect in this component: this component is a *descendant* of
    // the `DatePicker.Root` that owns the hook, and React flushes child
    // passive effects before ancestor ones in the same commit, so an
    // effect here would still run before the hook's own `[value]` effect
    // has had its first (stale) pass — a macrotask reliably runs after
    // React's synchronous render+commit+passive-effect flush for the
    // click handler's state updates instead. Verified live: without this
    // second dispatch, incrementing the hour after a grid pick jumped to
    // an unrelated value instead of picked+1; with it, the picked hour is
    // preserved and increments/decrements by exactly one step.
    pendingSync.current = setTimeout(() => {
      pendingSync.current = null;
      onValueChange?.({ value: new Date(next) });
    }, 0);
  }

  return (
    <Popover open={open} onOpenChange={(event) => setOpen(!!event.value)}>
      <PopoverTrigger
        type="button"
        className={hourTriggerClass}
        aria-label={t("timeEntry.hourGridLabel")}
      >
        <PRDatePicker.Hour />
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverPositioner>
          <PopoverPopup>
            <div
              className="grid grid-cols-6 gap-1"
              role="listbox"
              aria-label={t("timeEntry.hourGridLabel")}
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <button
                  key={hour}
                  type="button"
                  role="option"
                  onClick={() => pick(hour)}
                  className={hourGridButtonClass}
                >
                  {String(hour).padStart(2, "0")}
                </button>
              ))}
            </div>
          </PopoverPopup>
        </PopoverPositioner>
      </PopoverPortal>
    </Popover>
  );
}

function DatePickerTime({ className, ...props }: DatePickerTimeProps) {
  const datepicker = useDatePickerContext();
  const showSeconds = !!datepicker?.props.showSeconds;
  const showAmPm = datepicker?.props.hourFormat === "12";
  const timeOnly = !!datepicker?.props.timeOnly;

  return (
    <PRDatePicker.Time
      className={cn(
        "flex items-center justify-center gap-1",
        !timeOnly &&
          "-mx-2 mt-2 border-t border-surface-200 px-2 pt-3 dark:border-surface-700",
        className,
      )}
      {...props}
    >
      <TimePicker type="hour">
        <DatePickerHourGrid />
      </TimePicker>

      <PRDatePicker.Separator className={timeSeparatorClass}>
        :
      </PRDatePicker.Separator>

      <TimePicker type="minute">
        <PRDatePicker.Minute className={timeFieldClass} />
      </TimePicker>

      {showSeconds && (
        <>
          <PRDatePicker.Separator className={timeSeparatorClass}>
            :
          </PRDatePicker.Separator>
          <TimePicker type="second">
            <PRDatePicker.Second className={timeFieldClass} />
          </TimePicker>
        </>
      )}

      {showAmPm && (
        <>
          <PRDatePicker.Separator
            className={cn(timeSeparatorClass, "opacity-0")}
          >
            ·
          </PRDatePicker.Separator>
          <TimePicker type="ampm">
            <PRDatePicker.AmPm className={timeFieldClass} />
          </TimePicker>
        </>
      )}
    </PRDatePicker.Time>
  );
}

interface DatePickerCalendarProps2 extends DatePickerCalendarProps {
  index?: number;
}

function DatePickerCalendar({
  className,
  index = 0,
  ...props
}: DatePickerCalendarProps2) {
  const { t } = useTranslation();
  const datepicker = useDatePickerContext();
  const monthName = datepicker?.getMonthName?.(
    datepicker?.getIndexedMonth?.(index)?.month ?? 0,
  );
  const monthYear = datepicker?.getIndexedMonth?.(index)?.year;
  const numberOfMonths = (datepicker?.props.numberOfMonths as number) ?? 1;
  const showPrev = index === 0;
  const showNext = index === numberOfMonths - 1;

  return (
    <PRDatePicker.Calendar
      className={cn("flex min-w-64 flex-1 flex-col", className)}
      {...props}
    >
      <PRDatePicker.Header className="flex items-center justify-between text-surface-700 dark:text-surface-0">
        {showPrev ? (
          <PRDatePicker.Prev
            aria-label={t("timeEntry.previousMonth")}
            className={buttonVariants({
              variant: "text",
              severity: "secondary",
              rounded: true,
              iconOnly: true,
              size: "small",
            })}
          >
            <ChevronLeft />
          </PRDatePicker.Prev>
        ) : (
          <span className="size-7" />
        )}
        <PRDatePicker.Title className="flex items-center justify-between gap-0.5">
          {numberOfMonths > 1 ? (
            <>
              <span className="px-1.5 py-1 text-sm font-medium">
                {monthName}
              </span>
              <span className="px-1.5 py-1 text-sm font-medium">
                {monthYear}
              </span>
            </>
          ) : (
            <>
              <PRDatePicker.SelectMonth className={selectButtonClass} />
              <PRDatePicker.SelectYear className={selectButtonClass} />
              <PRDatePicker.Decade className="text-sm font-medium text-surface-700 dark:text-surface-0" />
            </>
          )}
        </PRDatePicker.Title>
        {showNext ? (
          <PRDatePicker.Next
            aria-label={t("timeEntry.nextMonth")}
            className={buttonVariants({
              variant: "text",
              severity: "secondary",
              rounded: true,
              iconOnly: true,
              size: "small",
            })}
          >
            <ChevronRight />
          </PRDatePicker.Next>
        ) : (
          <span className="size-7" />
        )}
      </PRDatePicker.Header>

      <PRDatePicker.Table className="mt-2 w-full border-collapse">
        <PRDatePicker.TableHead>
          <DayTableHead />
        </PRDatePicker.TableHead>
        <PRDatePicker.TableBody index={index}>
          <DayTableBody index={index} />
        </PRDatePicker.TableBody>
        {index === 0 && (
          <>
            <PRDatePicker.TableBody view="month">
              <MonthTableBody />
            </PRDatePicker.TableBody>
            <PRDatePicker.TableBody view="year">
              <YearTableBody />
            </PRDatePicker.TableBody>
          </>
        )}
      </PRDatePicker.Table>
    </PRDatePicker.Calendar>
  );
}

export {
  DatePicker,
  DatePickerBody,
  DatePickerCalendar,
  DatePickerInput,
  DatePickerPanel,
  DatePickerPopup,
  DatePickerPortal,
  DatePickerPositioner,
  DatePickerTime,
};
