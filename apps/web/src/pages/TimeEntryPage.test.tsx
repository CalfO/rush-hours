import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Children, createContext, isValidElement, useContext } from "react";
import type { ReactElement, ReactNode } from "react";
import { PrimeReactProvider } from "@primereact/core";
import { WEEKDAYS } from "@rushhours/domain";
import TimeEntryPage from "./TimeEntryPage";
import {
  getSummary,
  listMonth,
  upsertTimeEntry,
  type RangeSummary,
} from "../api/time-entries";
import { getWorkSchedule } from "../api/users";
import { useAuth } from "../auth/AuthProvider";
import i18n from "../i18n/config";

/*
 * The page tests exercise the real page/form/calendar composition. The
 * DatePicker primitive is reduced to accessible inputs so the behavior under
 * test does not depend on PrimeReact's popup positioning or browser-local
 * calendar controls.
 */
vi.mock("../components/ui/datepicker", () => {
  type PickerValueChange = { value: Date | null };
  type PickerProps = {
    value?: Date | null;
    timeOnly?: boolean;
    onValueChange?: (event: PickerValueChange) => void;
    children?: ReactNode;
  };
  type InputProps = { "aria-label"?: string };

  function DatePickerInput(props: InputProps) {
    void props;
    return null;
  }

  function parseValue(rawValue: string, timeOnly: boolean): Date | null {
    if (timeOnly) {
      const match = /^(\d{2}):(\d{2})$/.exec(rawValue);
      if (!match) return null;
      const [, hours, minutes] = match;
      const result = new Date(1970, 0, 1);
      result.setHours(Number(hours), Number(minutes), 0, 0);
      return result;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) return null;
    const result = new Date(`${rawValue}T00:00:00.000Z`);
    return Number.isNaN(result.getTime()) ? null : result;
  }

  function formatValue(value: Date | null | undefined, timeOnly: boolean) {
    if (!value) return "";
    if (timeOnly) {
      return `${String(value.getHours()).padStart(2, "0")}:${String(
        value.getMinutes(),
      ).padStart(2, "0")}`;
    }
    return value.toISOString().slice(0, 10);
  }

  function DatePicker({
    value,
    timeOnly = false,
    onValueChange,
    children,
  }: PickerProps) {
    const inputChild = Children.toArray(children).find((child) => {
      return isValidElement(child) && child.type === DatePickerInput;
    }) as ReactElement<InputProps> | undefined;

    return (
      <input
        aria-label={inputChild?.props["aria-label"]}
        value={formatValue(value, timeOnly)}
        onChange={(event) =>
          onValueChange?.({
            value: parseValue(event.target.value, timeOnly),
          })
        }
      />
    );
  }

  const Empty = () => null;

  return {
    DatePicker,
    DatePickerCalendar: Empty,
    DatePickerInput,
    DatePickerPanel: Empty,
    DatePickerPopup: Empty,
    DatePickerPortal: Empty,
    DatePickerPositioner: Empty,
    DatePickerTime: Empty,
  };
});

/*
 * The Carousel primitive drives its paging off real DOM layout (scroll
 * width/`IntersectionObserver`), which jsdom doesn't meaningfully provide —
 * and, unmocked, it mounts all 7 `DayCard`s in the DOM at once (it scrolls
 * between slides rather than unmounting them), which would break every
 * `getByRole(..., { name: ... })` query below on "multiple elements found".
 * This reduces it to rendering only the day at the `slide` index, matching
 * what a real page/user actually sees at a time, without depending on
 * PrimeReact's real scroll-snap mechanics.
 */
vi.mock("../components/ui/carousel", () => {
  type CarouselProps = { slide?: number; children?: ReactNode };
  const SlideContext = createContext(0);

  function Carousel({ slide, children }: CarouselProps) {
    return (
      <SlideContext.Provider value={slide ?? 0}>
        <div>{children}</div>
      </SlideContext.Provider>
    );
  }

  function CarouselContent({ children }: { children?: ReactNode }) {
    const activeIndex = useContext(SlideContext);
    const items = Children.toArray(children);
    return <>{items[activeIndex] ?? null}</>;
  }

  function CarouselItem({ children }: { children?: ReactNode }) {
    return <>{children}</>;
  }

  const Inert = () => null;

  return {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselPrev: Inert,
    CarouselNext: Inert,
  };
});

vi.mock("../api/users", () => ({
  getWorkSchedule: vi.fn(),
  putWorkSchedule: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("../api/time-entries", () => ({
  getAnalytics: vi.fn(),
  getSummary: vi.fn(),
  listMonth: vi.fn(),
  upsertTimeEntry: vi.fn(),
}));

// Rendered standalone here (no `<Outlet>`/`AuthProvider` ancestor, unlike
// the real app via `AppLayout`) — `useOutletContext()` already degrades
// gracefully to "no reference week" on its own (see `TimeEntryPage.tsx`'s
// own doc comment on that fallback), but `useAuth()` throws outside an
// `AuthProvider`, so it's mocked here purely to let the page render at all;
// none of this file's tests exercise the §5.5 reference-week save-prompt.
vi.mock("../auth/AuthProvider", () => ({ useAuth: vi.fn() }));

const today = new Date();
const selectedIso = today.toISOString().slice(0, 10);
const currentMonth = selectedIso.slice(0, 7);
const yesterday = new Date(`${selectedIso}T00:00:00.000Z`);
yesterday.setUTCDate(yesterday.getUTCDate() - 1);
const yesterdayIso = yesterday.toISOString().slice(0, 10);
const nextMonthDate = new Date(`${currentMonth}-01T00:00:00.000Z`);
nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth() + 1);
const nextMonth = nextMonthDate.toISOString().slice(0, 7);

const monthSummaries: Record<string, RangeSummary> = {
  [currentMonth]: {
    days: [
      {
        date: `${currentMonth}-01`,
        workedMinutes: 570,
        targetMinutes: 480,
        balanceMinutes: 90,
      },
      {
        date: `${currentMonth}-02`,
        workedMinutes: 405,
        targetMinutes: 480,
        balanceMinutes: -75,
      },
      {
        date: yesterdayIso,
        workedMinutes: 450,
        targetMinutes: 480,
        balanceMinutes: -30,
      },
      {
        date: selectedIso,
        workedMinutes: 540,
        targetMinutes: 480,
        balanceMinutes: 60,
      },
    ],
    weeks: [],
    total: {
      workedMinutes: 1965,
      targetMinutes: 1920,
      balanceMinutes: 45,
    },
  },
  [nextMonth]: {
    days: [
      {
        date: `${nextMonth}-01`,
        workedMinutes: 465,
        targetMinutes: 480,
        balanceMinutes: -15,
      },
    ],
    weeks: [],
    total: {
      workedMinutes: 465,
      targetMinutes: 480,
      balanceMinutes: -15,
    },
  },
};

const emptySummary = (): RangeSummary => ({
  days: [],
  weeks: [],
  total: {
    workedMinutes: 0,
    targetMinutes: 0,
    balanceMinutes: 0,
  },
});

const savedEntry = {
  date: `${selectedIso}T00:00:00.000Z`,
  arrivalTime: `${selectedIso}T08:30:00.000Z`,
  departureTime: `${selectedIso}T17:30:00.000Z`,
  lunchBreakStart: `${selectedIso}T12:00:00.000Z`,
  lunchBreakEnd: `${selectedIso}T13:00:00.000Z`,
};

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await new Promise<void>((resolve) => {
      i18n.on("initialized", () => resolve());
    });
  }
});

beforeEach(async () => {
  await i18n.changeLanguage("en");
  vi.clearAllMocks();

  vi.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    user: {
      id: "u1",
      username: "user",
      role: "USER",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
    },
    refresh: vi.fn(),
    logout: vi.fn(),
  });

  // All 7 days configured as working days -- these tests exercise the day-
  // entry form itself, not the working-days filtering behavior (covered by
  // `WeekCarousel.test.tsx`), so every day of the week must still get a
  // card here.
  vi.mocked(getWorkSchedule).mockResolvedValue({
    weeklyContractHours: 35,
    weekStartDay: "MONDAY",
    days: WEEKDAYS.map((weekday) => ({ weekday, targetMinutes: 300 })),
  });
  vi.mocked(getSummary).mockImplementation((month) =>
    Promise.resolve(monthSummaries[month] ?? emptySummary()),
  );
  vi.mocked(listMonth).mockImplementation((month) =>
    Promise.resolve(month === currentMonth ? [savedEntry] : []),
  );
  vi.mocked(upsertTimeEntry).mockResolvedValue(savedEntry);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function findCalendarButton(text: string): HTMLButtonElement {
  const button = screen
    .getAllByRole("button")
    .find((candidate) => candidate.textContent?.replace(/\s/g, "") === text);
  if (!button) throw new Error(`Calendar button ${text} was not found`);
  return button as HTMLButtonElement;
}

describe("TimeEntryPage (spec §7.2)", () => {
  test("renders the day form and saves date and four time fields", async () => {
    const user = userEvent.setup();
    render(
      <PrimeReactProvider>
        <TimeEntryPage />
      </PrimeReactProvider>,
    );

    expect(await screen.findByRole("button", { name: "Save" })).toBeDefined();

    const arrival = screen.getByRole("textbox", { name: "Arrival" });
    const departure = screen.getByRole("textbox", { name: "Departure" });
    const lunchStart = screen.getByRole("textbox", {
      name: "Lunch break start",
    });
    const lunchEnd = screen.getByRole("textbox", { name: "Lunch break end" });
    expect(arrival.getAttribute("value")).toBe("08:30");
    expect(departure.getAttribute("value")).toBe("17:30");
    expect(lunchStart.getAttribute("value")).toBe("12:00");
    expect(lunchEnd.getAttribute("value")).toBe("13:00");
    fireEvent.change(arrival, { target: { value: "08:30" } });
    fireEvent.change(departure, { target: { value: "17:30" } });
    fireEvent.change(lunchStart, { target: { value: "10:00" } });
    fireEvent.change(lunchEnd, { target: { value: "15:00" } });
    expect(lunchStart.getAttribute("value")).toBe("12:00");
    expect(lunchEnd.getAttribute("value")).toBe("14:00");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(upsertTimeEntry).toHaveBeenCalledTimes(1));
    const [date, input] = vi.mocked(upsertTimeEntry).mock.calls[0];
    expect(date).toBe(selectedIso);
    expect(input.date.toISOString()).toBe(`${selectedIso}T00:00:00.000Z`);
    expect(input.arrivalTime.toISOString()).toBe(
      `${selectedIso}T08:30:00.000Z`,
    );
    expect(input.departureTime.toISOString()).toBe(
      `${selectedIso}T17:30:00.000Z`,
    );
    expect(input.lunchBreakStart.toISOString()).toBe(
      `${selectedIso}T12:00:00.000Z`,
    );
    expect(input.lunchBreakEnd.toISOString()).toBe(
      `${selectedIso}T14:00:00.000Z`,
    );
    await waitFor(() => expect(getSummary).toHaveBeenCalledTimes(2));
    expect(listMonth).toHaveBeenCalledTimes(2);
  });

  test("shows day/week balances and color-codes the aligned monthly calendar", async () => {
    render(
      <PrimeReactProvider>
        <TimeEntryPage />
      </PrimeReactProvider>,
    );

    const calendarMonth = await screen.findByText(currentMonth);
    expect(calendarMonth).toBeDefined();
    expect(screen.getByText("Day balance")).toBeDefined();
    expect(screen.getByText("Week balance")).toBeDefined();
    expect(screen.getByText(/Month total:/)).toBeDefined();
    expect(screen.getAllByText("+1h00").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("+0h30").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/\+0h45/)).toBeDefined();

    expect(screen.getByText("Monday")).toBeDefined();
    expect(screen.getByText("Sunday")).toBeDefined();
    expect(findCalendarButton("1+1h30").className).toContain("bg-success-100");
    expect(findCalendarButton("2-1h15").className).toContain("bg-error-100");
    expect(findCalendarButton("3").className).toContain("bg-surface-50");
  });

  test("changes the selected day and loads the previous/next month", async () => {
    const user = userEvent.setup();
    render(
      <PrimeReactProvider>
        <TimeEntryPage />
      </PrimeReactProvider>,
    );

    await screen.findByText(currentMonth);
    await user.click(findCalendarButton("2-1h15"));

    expect(
      screen.getByRole("textbox", { name: "Date" }).getAttribute("value"),
    ).toBe(`${currentMonth}-02`);
    expect(screen.getAllByText("-1h15").length).toBeGreaterThanOrEqual(2);

    fireEvent.change(screen.getByRole("textbox", { name: "Date" }), {
      target: { value: `${currentMonth}-03` },
    });
    expect(
      screen.getByRole("textbox", { name: "Date" }).getAttribute("value"),
    ).toBe(`${currentMonth}-03`);

    await user.click(screen.getByRole("button", { name: "Next month" }));

    expect(await screen.findByText(nextMonth)).toBeDefined();
    expect(getSummary).toHaveBeenCalledWith(nextMonth);
    expect(listMonth).toHaveBeenCalledWith(nextMonth);

    await user.click(screen.getByRole("button", { name: "Previous month" }));
    expect(await screen.findByText(currentMonth)).toBeDefined();
    expect(getSummary).toHaveBeenCalledWith(currentMonth);
  });

  test("the page-level date-picker jumps directly to a day outside the currently displayed week, re-rendering the carousel on the week containing it (spec §3.2)", async () => {
    render(
      <PrimeReactProvider>
        <TimeEntryPage />
      </PrimeReactProvider>,
    );

    // Sanity check the starting point: today's card is pre-filled from
    // `savedEntry` (the mocked existing entry for `selectedIso`).
    expect(
      (await screen.findByRole("textbox", { name: "Arrival" })).getAttribute(
        "value",
      ),
    ).toBe("08:30");

    // Jump straight to a day in the *next month* (necessarily a different
    // displayed week too) via the page-level date-picker — not the monthly
    // calendar, not the carousel itself.
    fireEvent.change(screen.getByRole("textbox", { name: "Date" }), {
      target: { value: `${nextMonth}-01` },
    });

    expect(
      screen.getByRole("textbox", { name: "Date" }).getAttribute("value"),
    ).toBe(`${nextMonth}-01`);

    // The carousel re-renders for the week containing the newly picked
    // date: `listMonth` has no entry for `${nextMonth}-01` (mocked to
    // return `[]` for any month other than `currentMonth`), so its card's
    // Arrival field comes back empty rather than still showing "08:30"
    // (which would mean the carousel silently kept showing the old day/week
    // instead of following the date-picker across the month/week boundary).
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Arrival" }).getAttribute("value"),
      ).toBe(""),
    );
    expect(getSummary).toHaveBeenCalledWith(nextMonth);
    expect(listMonth).toHaveBeenCalledWith(nextMonth);
  });
});
