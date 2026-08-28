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
import TimeEntryPage from "./TimeEntryPage";
import {
  getSummary,
  listMonth,
  upsertTimeEntry,
  type RangeSummary,
} from "../api/time-entries";
import { getWorkSchedule } from "../api/users";
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

  vi.mocked(getWorkSchedule).mockResolvedValue({
    weeklyContractHours: 35,
    weekStartDay: "MONDAY",
    days: [],
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
    render(<TimeEntryPage />);

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
    render(<TimeEntryPage />);

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
    render(<TimeEntryPage />);

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
});
