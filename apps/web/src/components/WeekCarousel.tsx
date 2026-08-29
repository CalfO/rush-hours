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
  entriesByDate: Map<string, TimeEntryRecord>;
  /** §5.6/§5.7 — `null` while `AppLayout` hasn't resolved the fetch yet. */
  referenceWeek: ReferenceWeekState | null;
  onSelectDate: (date: Date) => void;
  onSaved: (entry: TimeEntryRecord) => void;
}

/**
 * Spec §3 "Carousel" — 7 `DayCard`s, one per day of `selectedDate`'s week
 * (`weekStartDay`-first, spec §4.5), one page at a time via the PrimeReact
 * `Carousel` Primitive (`loop={false}`, no auto-play, no indicators — spec
 * §3.1). `selectedDate` is never mirrored into local state
 * (react-best-practices #2) — `activeIndex` is derived every render, so this
 * component stays a pure function of its props, and a cross-week jump (spec
 * §3.2) needs no special-case code: `days` is recomputed fresh from
 * `selectedDate` on every render. `Prev`/`Next` disable themselves at the
 * 7-card boundary via the primitive's own state, so arriving past day 7
 * never rolls into the next week without extra guard code.
 *
 * §5.7 adds a "use the reference week" switch on `days[0]`'s card — always
 * the `weekStartDay` day, per how `getWeekDays`/`getWeekRange` construct the
 * array, no searching needed. `useReferenceWeek` is purely local UI state
 * (nothing above needs to know the switch is on) and resets naturally on
 * remount rather than being persisted.
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

  const days = getWeekDays(selectedDate, weekStartDay);
  const selectedIso = toIsoDate(selectedDate);
  const activeIndex = days.findIndex((day) => toIsoDate(day) === selectedIso);

  return (
    <Carousel
      slide={activeIndex === -1 ? 0 : activeIndex}
      onSlideChange={(event) => {
        const day = days[Number(event.value ?? 0)];
        if (day) onSelectDate(day);
      }}
      slidesPerPage={1}
      align="center"
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
            </CarouselItem>
          );
        })}
      </CarouselContent>
      <div className="mt-3 flex items-center justify-center gap-2">
        <CarouselPrev />
        <CarouselNext />
      </div>
    </Carousel>
  );
}
