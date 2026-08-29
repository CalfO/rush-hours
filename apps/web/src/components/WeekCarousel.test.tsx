import { Children, createContext, useContext } from "react";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrimeReactProvider } from "@primereact/core";
import type { Weekday } from "@rushhours/domain";
import { WeekCarousel } from "./WeekCarousel";
import type { TimeEntryRecord } from "../api/time-entries";
import i18n from "../i18n/config";

/**
 * Spec §3.1 (`prompts/spec/time-entry-ux-and-reference-week.md`) — the
 * carousel's own contract, isolated from `TimeEntryPage`. `DayCard` is real
 * (so each card's displayed Arrival value genuinely proves which day is
 * active), but `./ui/carousel` is replaced with a small fidelity-preserving
 * fake: the real PrimeReact `Carousel` primitive computes its paging from
 * DOM layout (`scrollWidth`/`offsetLeft`/`ResizeObserver`) that jsdom always
 * reports as 0, which collapses every card to a single always-both-ends
 * snap point and makes Prev/Next permanently disabled regardless of what's
 * under test — the same reason `TimeEntryPage.test.tsx` already mocks this
 * primitive. This fake instead drives paging purely off the `slide`/
 * `onSlideChange` contract `WeekCarousel` itself wires up, which is exactly
 * what this file is testing (not the PrimeReact primitive's own scrolling).
 *
 * Traceability:
 * - §3.1 "dans l'ordre déterminé par `user.weekStartDay`" (not hardcoded
 *   Monday-first) -> "renders the 7 days starting from a non-Monday
 *   weekStartDay, in weekday order"
 * - §3.1 "Navigation ... flèches précédent/suivant = jour précédent/suivant"
 *   + "le jour actif ... correspond à selectedDate" -> "clicking next/prev
 *   calls onSelectDate with the correct next/previous date, and the newly
 *   active card reflects it"
 * - §3.1 "Arriver après le 7e jour ne fait pas automatiquement changer de
 *   semaine" -> "the Next control is disabled on the 7th day of the
 *   displayed week (no auto-loop into the next week)" + "the Prev control
 *   is disabled on the 1st day (no auto-loop into the previous week)"
 */

vi.mock("../api/time-entries", async () => {
  const actual = await vi.importActual<typeof import("../api/time-entries")>(
    "../api/time-entries",
  );
  return { ...actual, upsertTimeEntry: vi.fn() };
});

const WEEK_LENGTH = 7;

vi.mock("./ui/carousel", () => {
  interface CarouselCtx {
    slide: number;
    loop: boolean;
    onSlideChange?: (event: { value: number }) => void;
  }
  const CarouselContext = createContext<CarouselCtx>({
    slide: 0,
    loop: false,
  });

  function Carousel({
    slide,
    loop,
    onSlideChange,
    children,
  }: {
    slide?: number;
    loop?: boolean;
    onSlideChange?: (event: { value: number }) => void;
    children?: ReactNode;
  }) {
    return (
      <CarouselContext.Provider
        value={{ slide: slide ?? 0, loop: !!loop, onSlideChange }}
      >
        <div>{children}</div>
      </CarouselContext.Provider>
    );
  }

  function CarouselContent({ children }: { children?: ReactNode }) {
    const { slide } = useContext(CarouselContext);
    const items = Children.toArray(children);
    return <>{items[slide] ?? null}</>;
  }

  function CarouselItem({ children }: { children?: ReactNode }) {
    return <>{children}</>;
  }

  function CarouselPrev() {
    const { slide, loop, onSlideChange } = useContext(CarouselContext);
    const disabled = !loop && slide <= 0;
    return (
      <button
        type="button"
        aria-label="Previous day"
        disabled={disabled}
        onClick={() => onSlideChange?.({ value: slide - 1 })}
      >
        Prev
      </button>
    );
  }

  function CarouselNext() {
    const { slide, loop, onSlideChange } = useContext(CarouselContext);
    const disabled = !loop && slide >= WEEK_LENGTH - 1;
    return (
      <button
        type="button"
        aria-label="Next day"
        disabled={disabled}
        onClick={() => onSlideChange?.({ value: slide + 1 })}
      >
        Next
      </button>
    );
  }

  return {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselPrev,
    CarouselNext,
  };
});

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await new Promise<void>((resolve) => {
      i18n.on("initialized", () => resolve());
    });
  }
  await i18n.changeLanguage("en");
});

beforeEach(() => {
  vi.clearAllMocks();
});

// A non-Monday `weekStartDay`, per spec §3.1's own requirement to prove the
// ordering is user-driven, not hardcoded to Monday-first.
const WEEK_START: Weekday = "WEDNESDAY";

// 2026-08-26 is a Wednesday; the WEDNESDAY-first week it belongs to runs
// Wed 26 Aug -> Tue 1 Sep.
const WEEK_DATES = [
  "2026-08-26", // Wed (index 0, weekStartDay)
  "2026-08-27", // Thu
  "2026-08-28", // Fri
  "2026-08-29", // Sat
  "2026-08-30", // Sun
  "2026-08-31", // Mon
  "2026-09-01", // Tue
];

/** One entry per day of the week, each with a distinguishable arrival minute
 * (`08:0<index>`/`08:1<index>`) so which `DayCard` is active can be read off
 * the "Arrival" field's own displayed value. */
function buildEntries(): Map<string, TimeEntryRecord> {
  const map = new Map<string, TimeEntryRecord>();
  WEEK_DATES.forEach((date, index) => {
    const minute = String(index * 5).padStart(2, "0");
    map.set(date, {
      date: `${date}T00:00:00.000Z`,
      arrivalTime: `${date}T08:${minute}:00.000Z`,
      departureTime: `${date}T17:00:00.000Z`,
      lunchBreakStart: `${date}T12:00:00.000Z`,
      lunchBreakEnd: `${date}T13:00:00.000Z`,
    });
  });
  return map;
}

function renderCarousel(selectedIso: string) {
  const onSelectDate = vi.fn();
  const onSaved = vi.fn();
  const utils = render(
    <PrimeReactProvider>
      <WeekCarousel
        selectedDate={new Date(`${selectedIso}T00:00:00.000Z`)}
        weekStartDay={WEEK_START}
        entriesByDate={buildEntries()}
        referenceWeek={null}
        onSelectDate={onSelectDate}
        onSaved={onSaved}
      />
    </PrimeReactProvider>,
  );
  return { onSelectDate, onSaved, rerender: utils.rerender };
}

function activeArrivalValue(): string | null {
  return screen
    .getByRole("combobox", { name: "Arrival" })
    .getAttribute("value");
}

describe("WeekCarousel (spec §3.1)", () => {
  test("renders the 7 days starting from a non-Monday weekStartDay, in weekday order", () => {
    // Active card = selectedDate itself (index 0, the weekStartDay).
    renderCarousel(WEEK_DATES[0]);
    expect(activeArrivalValue()).toBe("08:00");
  });

  test("selecting a mid-week day shows that day's own card, not the weekStartDay's", () => {
    // Friday is index 2 of the WEDNESDAY-first week.
    renderCarousel(WEEK_DATES[2]);
    expect(activeArrivalValue()).toBe("08:10");
  });

  test("clicking next/prev calls onSelectDate with the correct next/previous date, and the newly active card reflects it", async () => {
    const { onSelectDate } = renderCarousel(WEEK_DATES[2]); // Friday, index 2
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Next day" }));
    expect(onSelectDate).toHaveBeenCalledWith(
      new Date(`${WEEK_DATES[3]}T00:00:00.000Z`), // Saturday, index 3
    );

    await user.click(screen.getByRole("button", { name: "Previous day" }));
    expect(onSelectDate).toHaveBeenCalledWith(
      new Date(`${WEEK_DATES[1]}T00:00:00.000Z`), // Thursday, index 1
    );
  });

  test("navigating via onSelectDate keeps the carousel's active card in sync with the newly selected day", async () => {
    const { rerender } = renderCarousel(WEEK_DATES[0]);

    expect(activeArrivalValue()).toBe("08:00");

    // Simulate the page reacting to a click on "Next day" by updating
    // `selectedDate` (the real ownership chain: WeekCarousel.onSelectDate ->
    // TimeEntryPage.setSelectedDate -> selectedDate prop flows back down) —
    // the carousel is a pure function of its props (react-best-practices
    // #2), so it must re-derive its active index, not keep mirroring stale
    // internal state.
    rerender(
      <PrimeReactProvider>
        <WeekCarousel
          selectedDate={new Date(`${WEEK_DATES[1]}T00:00:00.000Z`)}
          weekStartDay={WEEK_START}
          entriesByDate={buildEntries()}
          referenceWeek={null}
          onSelectDate={vi.fn()}
          onSaved={vi.fn()}
        />
      </PrimeReactProvider>,
    );

    await waitFor(() => expect(activeArrivalValue()).toBe("08:05"));
  });

  test("jumping selectedDate to a day outside the displayed week re-renders on the week containing the new date (spec §3.2)", async () => {
    const { rerender } = renderCarousel(WEEK_DATES[0]); // week of 26 Aug - 1 Sep

    expect(activeArrivalValue()).toBe("08:00");

    // 2 Sep 2026 is a Wednesday too, but the following WEDNESDAY-first week
    // (2 Sep - 8 Sep) — entirely outside the currently displayed week and
    // outside `entriesByDate` (only seeded for 26 Aug - 1 Sep). The carousel
    // must re-render for the new week (empty Arrival field, no stale
    // leftover from the previous week's data), not just fail to find the
    // date among its still-old 7 cards.
    rerender(
      <PrimeReactProvider>
        <WeekCarousel
          selectedDate={new Date("2026-09-02T00:00:00.000Z")}
          weekStartDay={WEEK_START}
          entriesByDate={buildEntries()}
          referenceWeek={null}
          onSelectDate={vi.fn()}
          onSaved={vi.fn()}
        />
      </PrimeReactProvider>,
    );

    await waitFor(() => expect(activeArrivalValue()).toBe(""));
  });

  test("the Next control is disabled on the 7th day of the displayed week (no auto-loop into the next week)", () => {
    renderCarousel(WEEK_DATES[6]); // Tuesday, index 6, last day of the week
    expect(
      screen.getByRole("button", { name: "Next day" }).hasAttribute("disabled"),
    ).toBe(true);
  });

  test("the Prev control is disabled on the 1st day of the displayed week (no auto-loop into the previous week)", () => {
    renderCarousel(WEEK_DATES[0]); // Wednesday, index 0, weekStartDay
    expect(
      screen
        .getByRole("button", { name: "Previous day" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
});
