import { useState } from "react";
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

          return (
            <CarouselItem key={iso} value={iso}>
              <DayCard
                // Same remount idiom `DayCard` already relies on for its own
                // `date`-keyed remount (see its doc comment): toggling the
                // switch changes the key only for cards whose prefill state
                // actually changed, forcing exactly those `DayCard`s to
                // remount with fresh `defaultValues` computed from the new
                // `prefillEntry` — not a `reset()`-in-`useEffect` path.
                key={iso + (prefillEntry ? ":ref" : "")}
                date={day}
                existingEntry={entriesByDate.get(iso)}
                prefillEntry={prefillEntry}
                onSaved={onSaved}
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
