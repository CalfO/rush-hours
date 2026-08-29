import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { getWeekdayForDate, type Weekday } from "@rushhours/domain";
import { getWeekDays, toIsoDate } from "../lib/date";
import type { ReferenceWeekState } from "../api/reference-week";
import type { TimeEntryRecord } from "../api/time-entries";
import { DayCard } from "./DayCard";
import { ToggleButton } from "./ui/togglebutton";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrev,
} from "./ui/carousel";

interface WeekCarouselProps {
  selectedDate: Date; // UTC-midnight — single source of truth, owned by TimeEntryPage
  weekStartDay: Weekday;
  /** Only these weekdays get a card — configured working days only, per the user's request. */
  workingWeekdays: Weekday[];
  entriesByDate: Map<string, TimeEntryRecord>;
  /** §5.6/§5.7 — `null` while `AppLayout` hasn't resolved the fetch yet. */
  referenceWeek: ReferenceWeekState | null;
  onSelectDate: (date: Date) => void;
  onSaved: (entry: TimeEntryRecord) => void;
}

/**
 * Spec §3 "Carousel" — one `DayCard` per *working* day of `selectedDate`'s
 * week (`weekStartDay`-first, spec §4.5), filtered to `workingWeekdays` —
 * a non-working day gets no card at all, narrower per-request than the
 * original spec text (which kept every day of the week free-fillable).
 * `slidesPerPage={3}`/`align="start"` show three cards at once via the
 * PrimeReact `Carousel` Primitive (`loop={false}`, no auto-play, no
 * indicators — spec §3.1); `slide`/`onSlideChange` stay per-*item* (not
 * per-page-of-3) regardless of `slidesPerPage` — confirmed by reading
 * `@primereact/headless/carousel`'s own measurement pass, which assigns one
 * snap point per item — so `activeIndex` below still means what it always
 * did. `selectedDate` is never mirrored into local state
 * (react-best-practices #2) — `activeIndex` is derived every render, so this
 * component stays a pure function of its props, and a cross-week jump (spec
 * §3.2) needs no special-case code: `days` is recomputed fresh from
 * `selectedDate` on every render. `Prev`/`Next` disable themselves at the
 * card-count boundary via the primitive's own state, so arriving past the
 * last working day never rolls into the next week without extra guard code.
 *
 * §5.7 adds a "use the reference week" switch on `days[0]`'s card — the
 * *first working day* of the week in `weekStartDay` order (not necessarily
 * `weekStartDay` itself now that non-working days are filtered out — if
 * `weekStartDay` isn't a working day, it has no card to put the switch on).
 * `useReferenceWeek` is purely local UI state (nothing above needs to know
 * the switch is on) and resets naturally on remount rather than being
 * persisted.
 *
 * `touchedDays` guards the remount-via-`key` idiom below against destroying
 * unsaved input: a card the user has started typing into (RHF's own
 * `isDirty`, reported via `DayCard`'s `onDirtyChange`) is excluded from the
 * `:ref`-suffixed key even when it would otherwise be prefill-eligible, so
 * flipping the switch never remounts — and thus never wipes — a day someone
 * is actively filling in but hasn't saved yet. The spec's "never overwrite
 * an already-saved entry" guarantee is about *saved* entries; it says
 * nothing that would justify discarding in-progress unsaved input on an
 * unrelated day, so a touched-but-unsaved card simply doesn't receive the
 * prefill while it stays dirty — the correct trade-off here.
 */
export function WeekCarousel({
  selectedDate,
  weekStartDay,
  workingWeekdays,
  entriesByDate,
  referenceWeek,
  onSelectDate,
  onSaved,
}: WeekCarouselProps) {
  const { t } = useTranslation();
  const [useReferenceWeek, setUseReferenceWeek] = useState(false);
  const [touchedDays, setTouchedDays] = useState<Set<string>>(new Set());

  // Stable across renders (functional `setState`, react-best-practices #3)
  // so it isn't a fresh function identity on every `WeekCarousel` render —
  // `DayCard`'s own dirty-watching effect depends on the callback it's
  // given, so a stable reference here avoids that effect re-firing for no
  // reason.
  const handleDirtyChange = useCallback((iso: string, dirty: boolean) => {
    setTouchedDays((curr) => {
      const alreadyTouched = curr.has(iso);
      if (dirty === alreadyTouched) return curr;
      const next = new Set(curr);
      if (dirty) {
        next.add(iso);
      } else {
        next.delete(iso);
      }
      return next;
    });
  }, []);

  const days = getWeekDays(selectedDate, weekStartDay).filter((day) =>
    workingWeekdays.includes(getWeekdayForDate(day)),
  );
  const selectedIso = toIsoDate(selectedDate);
  const activeIndex = days.findIndex((day) => toIsoDate(day) === selectedIso);

  if (days.length === 0) {
    return (
      <p className="text-sm text-surface-500">{t("timeEntry.noWorkingDays")}</p>
    );
  }

  return (
    <Carousel
      slide={activeIndex === -1 ? 0 : activeIndex}
      onSlideChange={(event) => {
        const day = days[Number(event.value ?? 0)];
        if (day) onSelectDate(day);
      }}
      slidesPerPage={3}
      align="start"
      loop={false}
    >
      <CarouselContent>
        {days.map((day, index) => {
          const iso = toIsoDate(day);
          // §5.7: never overwrite an already-saved day — prefill only
          // applies to a day with no existing entry yet.
          const prefillEntry =
            useReferenceWeek && !entriesByDate.get(iso)
              ? referenceWeek?.days.find(
                  (candidate) => candidate.weekday === getWeekdayForDate(day),
                )
              : undefined;
          // A card with unsaved (dirty) input never gets the `:ref` suffix,
          // regardless of prefill eligibility — see the component doc
          // comment above. It keeps its plain `iso` key, so it never
          // remounts from this switch and its in-progress state survives.
          const eligibleForPrefillKey =
            prefillEntry !== undefined && !touchedDays.has(iso);

          return (
            <CarouselItem key={iso} value={iso}>
              <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                <p className="mb-2 text-sm font-semibold text-surface-800 dark:text-surface-100">
                  {t(`weekdays.${getWeekdayForDate(day)}`)}{" "}
                  <span className="font-normal text-surface-500">
                    {day.getUTCDate()}
                  </span>
                </p>
                <DayCard
                  // Same remount idiom `DayCard` already relies on for its own
                  // `date`-keyed remount (see its doc comment): toggling the
                  // switch changes the key only for cards whose prefill state
                  // actually changed, forcing exactly those `DayCard`s to
                  // remount with fresh `defaultValues` computed from the new
                  // `prefillEntry` — not a `reset()`-in-`useEffect` path.
                  key={iso + (eligibleForPrefillKey ? ":ref" : "")}
                  date={day}
                  existingEntry={entriesByDate.get(iso)}
                  prefillEntry={prefillEntry}
                  onSaved={onSaved}
                  onDirtyChange={(dirty) => handleDirtyChange(iso, dirty)}
                />
                {index === 0 && referenceWeek?.exists && (
                  <div className="mt-3 flex items-center gap-2">
                    <ToggleButton
                      pressed={useReferenceWeek}
                      onPressedChange={(event) =>
                        setUseReferenceWeek(event.pressed)
                      }
                    >
                      {t("referenceWeek.useSwitchLabel")}
                    </ToggleButton>
                  </div>
                )}
              </div>
            </CarouselItem>
          );
        })}
      </CarouselContent>
      <div className="mt-3 flex items-center justify-center gap-2">
        <CarouselPrev aria-label={t("timeEntry.previousDay")} />
        <CarouselNext aria-label={t("timeEntry.nextDay")} />
      </div>
    </Carousel>
  );
}
