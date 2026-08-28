import { getWeekRange, type Weekday } from "@rushhours/domain";
import { toIsoDate } from "../lib/date";
import type { TimeEntryRecord } from "../api/time-entries";
import { DayCard } from "./DayCard";
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
  onSelectDate: (date: Date) => void;
  onSaved: (entry: TimeEntryRecord) => void;
}

/**
 * The 7 UTC-midnight days of `selectedDate`'s week, `weekStartDay`-first —
 * same `getWeekRange` + `setUTCDate` stepping idiom `MonthCalendar.buildGrid`
 * uses for its own grid cursor, reusing `@rushhours/domain`'s own week-range
 * math rather than a locally invented weekday-ordering helper.
 */
function buildWeekDays(selectedDate: Date, weekStartDay: Weekday): Date[] {
  const { start } = getWeekRange(selectedDate, weekStartDay);
  const days: Date[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < 7; i++) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
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
 */
export function WeekCarousel({
  selectedDate,
  weekStartDay,
  entriesByDate,
  onSelectDate,
  onSaved,
}: WeekCarouselProps) {
  const days = buildWeekDays(selectedDate, weekStartDay);
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
        {days.map((day) => (
          <CarouselItem key={toIsoDate(day)} value={toIsoDate(day)}>
            <DayCard
              key={toIsoDate(day)}
              date={day}
              existingEntry={entriesByDate.get(toIsoDate(day))}
              onSaved={onSaved}
            />
          </CarouselItem>
        ))}
      </CarouselContent>
      <div className="mt-3 flex items-center justify-center gap-2">
        <CarouselPrev />
        <CarouselNext />
      </div>
    </Carousel>
  );
}
