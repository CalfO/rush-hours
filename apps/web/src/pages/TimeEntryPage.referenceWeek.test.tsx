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
import { Children, isValidElement, createContext, useContext } from "react";
import type { ReactElement, ReactNode } from "react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { PrimeReactProvider } from "@primereact/core";
import type { WorkScheduleInput } from "@rushhours/domain";
import TimeEntryPage from "./TimeEntryPage";
import type { AppLayoutContext } from "../components/AppLayout";
import {
  getSummary,
  listMonth,
  upsertTimeEntry,
  type DaySummary,
  type RangeSummary,
  type TimeEntryRecord,
} from "../api/time-entries";
import { getWorkSchedule } from "../api/users";
import { putReferenceWeek } from "../api/reference-week";
import { useAuth } from "../auth/AuthProvider";
import i18n from "../i18n/config";

/**
 * Spec `time-entry-ux-and-reference-week.md` §5.5 — the "Enregistrer comme
 * semaine de référence ?" save-prompt, tested at the page level (the
 * transition-detection logic inside `TimeEntryPage.handleSaved` is a
 * module-private function, not exported, so this is the narrowest level
 * that can actually exercise it). `TimeEntryPage` is rendered standalone
 * behind a tiny `<Outlet context={...}>` bridge rather than the real
 * `AppLayout`, so each test can inject a controlled `referenceWeek`/
 * `refreshReferenceWeek` pair without also depending on `Header`'s own
 * fetch — full sibling (Header + WeekCarousel) propagation through the
 * real `AppLayout` is covered separately in
 * `apps/web/src/components/AppLayout.referenceWeek.test.tsx`.
 *
 * Every test in this file configures the authenticated user with a
 * 3-working-day schedule (Monday/Wednesday/Friday, not the default
 * Monday-Friday 5 or a full 7) specifically to pin spec §5.1's "1 à 7
 * jours, piloté par WorkingDaySchedule" requirement — if the completeness
 * check were ever hardcoded to 5 or 7 days, every test here would fail.
 *
 * Traceability (spec statement -> test(s)):
 * - §5.5 "juste après un enregistrement de jour ... qui fait que tous les
 *   jours travaillés de la semaine ... ont désormais une saisie" -> "the
 *   save-prompt appears on the specific save that completes the week"
 * - §5.5 (implicit: not before) -> "the save-prompt does not appear on a
 *   save that leaves the week partially filled"
 * - §5.5 (implicit: not on further edits to an already-complete week) ->
 *   "the save-prompt does not reappear on a subsequent save to a week
 *   that was already complete"
 * - §5.1 "aucune hypothèse figée sur 5 ou 7 jours" -> exercised throughout
 *   this file via the 3-day (Mon/Wed/Fri) work schedule fixture
 * - §5.5 "Oui -> PUT /users/me/reference-week avec ... heures actuelles
 *   converties en minutes du jour" -> "accepting the prompt calls
 *   putReferenceWeek with the completed week's data, converted to minutes,
 *   and refreshes the shared reference-week state"
 * - §5.5 "Non / fermeture -> ne pas rappeler ce popup ... mémoriser côté
 *   front (localStorage)" -> "declining the prompt marks the week as
 *   answered in localStorage" + "a week already marked as answered in
 *   localStorage does not re-show the prompt even on its completing save"
 * - §5.5's own last sentence ("le popup peut se redéclencher normalement"
 *   after a further edit) implies accepting must NOT itself block a future
 *   re-trigger the way declining does -> "accepting the prompt does not
 *   write the localStorage answered-flag"
 * - month-boundary limitation (documented in `TimeEntryPage.tsx`'s own
 *   `handleSaved` comment, same "assumed limitation, not resolved" pattern
 *   as spec §9) -> "the save-prompt is skipped for a week whose completing
 *   save straddles two calendar months, even though every working day
 *   would otherwise be present"
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

vi.mock("../api/reference-week", () => ({
  putReferenceWeek: vi.fn(),
}));

vi.mock("../auth/AuthProvider", () => ({ useAuth: vi.fn() }));

// Deliberately far in the future (not "this month" off today's real date)
// so these fixtures never collide with `TimeEntryPage`'s own initial
// "today" mount fetch (`toIsoMonth(todayUtc())`), whatever month the test
// happens to run in -- a same-year fixture would eventually start
// colliding with the sandbox's advancing wall-clock date.
const WEEK_START_DAY = "MONDAY" as const;
const MONTH = "2099-05";
const MONDAY = "2099-05-04";
const WEDNESDAY = "2099-05-06";
const FRIDAY = "2099-05-08";
const WEEK_START_ISO = MONDAY;
const USER_ID = "u1";

const WORK_SCHEDULE: WorkScheduleInput = {
  weeklyContractHours: 21,
  weekStartDay: WEEK_START_DAY,
  days: [
    { weekday: "MONDAY", targetMinutes: 420 },
    { weekday: "WEDNESDAY", targetMinutes: 420 },
    { weekday: "FRIDAY", targetMinutes: 420 },
  ],
};

function rawEntry(
  date: string,
  arrivalHM: string,
  departureHM: string,
): TimeEntryRecord {
  return {
    date: `${date}T00:00:00.000Z`,
    arrivalTime: `${date}T${arrivalHM}:00.000Z`,
    departureTime: `${date}T${departureHM}:00.000Z`,
    lunchBreakStart: `${date}T12:00:00.000Z`,
    lunchBreakEnd: `${date}T13:00:00.000Z`,
  };
}

function daySummary(date: string): DaySummary {
  return { date, workedMinutes: 480, targetMinutes: 420, balanceMinutes: 60 };
}

function emptySummary(): RangeSummary {
  return {
    days: [],
    weeks: [],
    total: { workedMinutes: 0, targetMinutes: 0, balanceMinutes: 0 },
  };
}

function summaryOf(days: DaySummary[]): RangeSummary {
  return {
    days,
    weeks: [],
    total: { workedMinutes: 0, targetMinutes: 0, balanceMinutes: 0 },
  };
}

/** Sequenced per-month responses: the Nth call for a given month returns
 * `byMonth[month][N]` (clamped to the last entry once exhausted), letting a
 * test express "before this save" / "after this save" per month without a
 * stateful mutable fixture. Months absent from `byMonth` fall back to
 * `fallback` (e.g. whatever month the real `Date.now()` happens to be in on
 * `TimeEntryPage`'s very first render, before any test navigates away). */
function sequencedMonthly<T>(
  byMonth: Record<string, T[]>,
  fallback: T,
): (month: string) => Promise<T> {
  const counters: Record<string, number> = {};
  return (month: string) => {
    const idx = counters[month] ?? 0;
    counters[month] = idx + 1;
    const seq = byMonth[month];
    if (!seq) return Promise.resolve(fallback);
    return Promise.resolve(seq[Math.min(idx, seq.length - 1)]);
  };
}

function monthCallCount(
  mockFn: { mock: { calls: unknown[][] } },
  month: string,
): number {
  return mockFn.mock.calls.filter(([m]) => m === month).length;
}

function renderPage(context: AppLayoutContext) {
  function ContextBridge() {
    return <Outlet context={context} />;
  }
  const routes = [
    {
      element: <ContextBridge />,
      children: [{ path: "/", element: <TimeEntryPage /> }],
    },
  ];
  const router = createMemoryRouter(routes, { initialEntries: ["/"] });
  return render(
    <PrimeReactProvider>
      <RouterProvider router={router} />
    </PrimeReactProvider>,
  );
}

function goToDate(iso: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Date" }), {
    target: { value: iso },
  });
}

function fillAndSaveDay(times: {
  arrival: string;
  departure: string;
  lunchStart: string;
  lunchEnd: string;
}) {
  fireEvent.change(screen.getByRole("textbox", { name: "Arrival" }), {
    target: { value: times.arrival },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Departure" }), {
    target: { value: times.departure },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Lunch break start" }), {
    target: { value: times.lunchStart },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Lunch break end" }), {
    target: { value: times.lunchEnd },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
}

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
  localStorage.clear();

  vi.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    user: {
      id: USER_ID,
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

  vi.mocked(getWorkSchedule).mockResolvedValue(WORK_SCHEDULE);

  // Echoes back exactly what was submitted, like the real `PUT
  // /time-entries/:date` endpoint would -- lets every test drive a save
  // through the visible form instead of hand-crafting the resolved record.
  vi.mocked(upsertTimeEntry).mockImplementation((date, input) =>
    Promise.resolve({
      date: `${date}T00:00:00.000Z`,
      arrivalTime: input.arrivalTime.toISOString(),
      departureTime: input.departureTime.toISOString(),
      lunchBreakStart: input.lunchBreakStart.toISOString(),
      lunchBreakEnd: input.lunchBreakEnd.toISOString(),
    }),
  );

  vi.mocked(putReferenceWeek).mockResolvedValue({ exists: true, days: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("TimeEntryPage save-prompt (spec §5.5, 3-working-day schedule per §5.1)", () => {
  test("does not appear on a save that leaves the week partially filled", async () => {
    const beforeEntries = [rawEntry(MONDAY, "08:00", "17:00")];
    const afterEntries = [
      rawEntry(MONDAY, "08:00", "17:00"),
      rawEntry(WEDNESDAY, "08:15", "17:00"),
    ];
    vi.mocked(getSummary).mockImplementation(
      sequencedMonthly(
        {
          [MONTH]: [
            summaryOf([daySummary(MONDAY)]),
            summaryOf([daySummary(MONDAY), daySummary(WEDNESDAY)]),
          ],
        },
        emptySummary(),
      ),
    );
    vi.mocked(listMonth).mockImplementation(
      sequencedMonthly({ [MONTH]: [beforeEntries, afterEntries] }, []),
    );

    renderPage({
      referenceWeek: { exists: false, days: [] },
      refreshReferenceWeek: vi.fn(),
    });

    await screen.findByRole("textbox", { name: "Date" });
    goToDate(WEDNESDAY);
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Arrival" }).getAttribute("value"),
      ).toBe(""),
    );

    fillAndSaveDay({
      arrival: "08:15",
      departure: "17:00",
      lunchStart: "12:00",
      lunchEnd: "13:00",
    });

    await waitFor(() =>
      expect(monthCallCount(vi.mocked(listMonth), MONTH)).toBe(2),
    );
    expect(screen.queryByText("Save as reference week?")).toBeNull();
  });

  test("appears on the specific save that completes the week", async () => {
    const beforeEntries = [
      rawEntry(MONDAY, "08:00", "17:00"),
      rawEntry(WEDNESDAY, "08:15", "17:00"),
    ];
    const afterEntries = [
      rawEntry(MONDAY, "08:00", "17:00"),
      rawEntry(WEDNESDAY, "08:15", "17:00"),
      rawEntry(FRIDAY, "08:30", "17:00"),
    ];
    vi.mocked(getSummary).mockImplementation(
      sequencedMonthly(
        {
          [MONTH]: [
            summaryOf([daySummary(MONDAY), daySummary(WEDNESDAY)]),
            summaryOf([
              daySummary(MONDAY),
              daySummary(WEDNESDAY),
              daySummary(FRIDAY),
            ]),
          ],
        },
        emptySummary(),
      ),
    );
    vi.mocked(listMonth).mockImplementation(
      sequencedMonthly({ [MONTH]: [beforeEntries, afterEntries] }, []),
    );

    renderPage({
      referenceWeek: { exists: false, days: [] },
      refreshReferenceWeek: vi.fn(),
    });

    await screen.findByRole("textbox", { name: "Date" });
    goToDate(FRIDAY);
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Arrival" }).getAttribute("value"),
      ).toBe(""),
    );

    fillAndSaveDay({
      arrival: "08:30",
      departure: "17:00",
      lunchStart: "12:00",
      lunchEnd: "13:00",
    });

    expect(await screen.findByText("Save as reference week?")).toBeDefined();
    // No existing reference week yet -> the non-replacing description.
    expect(
      screen.getByText(
        "You've just completed this week. Do you want to save it as your reference week to prefill future entries?",
      ),
    ).toBeDefined();
  });

  test("does not reappear on a subsequent save to a week that was already complete", async () => {
    const allThreeSummary = summaryOf([
      daySummary(MONDAY),
      daySummary(WEDNESDAY),
      daySummary(FRIDAY),
    ]);
    const allThreeEntries = [
      rawEntry(MONDAY, "08:00", "17:00"),
      rawEntry(WEDNESDAY, "08:15", "17:00"),
      rawEntry(FRIDAY, "08:30", "17:00"),
    ];
    vi.mocked(getSummary).mockImplementation(
      sequencedMonthly(
        { [MONTH]: [allThreeSummary, allThreeSummary] },
        emptySummary(),
      ),
    );
    vi.mocked(listMonth).mockImplementation(
      sequencedMonthly({ [MONTH]: [allThreeEntries, allThreeEntries] }, []),
    );

    renderPage({
      referenceWeek: { exists: false, days: [] },
      refreshReferenceWeek: vi.fn(),
    });

    await screen.findByRole("textbox", { name: "Date" });
    goToDate(MONDAY);
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Arrival" }).getAttribute("value"),
      ).toBe("08:00"),
    );

    // Re-save Monday (an edit to an already-complete week) with the exact
    // same values.
    fillAndSaveDay({
      arrival: "08:00",
      departure: "17:00",
      lunchStart: "12:00",
      lunchEnd: "13:00",
    });

    await waitFor(() =>
      expect(monthCallCount(vi.mocked(listMonth), MONTH)).toBe(2),
    );
    expect(screen.queryByText("Save as reference week?")).toBeNull();
  });

  test("declining the prompt marks the week as answered in localStorage, and a pre-answered week's completing save does not re-show it", async () => {
    const beforeEntries = [
      rawEntry(MONDAY, "08:00", "17:00"),
      rawEntry(WEDNESDAY, "08:15", "17:00"),
    ];
    const afterEntries = [
      rawEntry(MONDAY, "08:00", "17:00"),
      rawEntry(WEDNESDAY, "08:15", "17:00"),
      rawEntry(FRIDAY, "08:30", "17:00"),
    ];
    vi.mocked(getSummary).mockImplementation(
      sequencedMonthly(
        {
          [MONTH]: [
            summaryOf([daySummary(MONDAY), daySummary(WEDNESDAY)]),
            summaryOf([
              daySummary(MONDAY),
              daySummary(WEDNESDAY),
              daySummary(FRIDAY),
            ]),
          ],
        },
        emptySummary(),
      ),
    );
    vi.mocked(listMonth).mockImplementation(
      sequencedMonthly({ [MONTH]: [beforeEntries, afterEntries] }, []),
    );

    renderPage({
      referenceWeek: { exists: false, days: [] },
      refreshReferenceWeek: vi.fn(),
    });

    await screen.findByRole("textbox", { name: "Date" });
    goToDate(FRIDAY);
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Arrival" }).getAttribute("value"),
      ).toBe(""),
    );
    fillAndSaveDay({
      arrival: "08:30",
      departure: "17:00",
      lunchStart: "12:00",
      lunchEnd: "13:00",
    });

    await screen.findByText("Save as reference week?");
    fireEvent.click(screen.getByRole("button", { name: "No thanks" }));

    await waitFor(() =>
      expect(
        localStorage.getItem(
          `referenceWeekPrompt:${USER_ID}:${WEEK_START_ISO}`,
        ),
      ).toBe("1"),
    );
    expect(putReferenceWeek).not.toHaveBeenCalled();
  });

  test("a week already marked as answered in localStorage does not show the prompt even on its completing save", async () => {
    localStorage.setItem(
      `referenceWeekPrompt:${USER_ID}:${WEEK_START_ISO}`,
      "1",
    );

    const beforeEntries = [
      rawEntry(MONDAY, "08:00", "17:00"),
      rawEntry(WEDNESDAY, "08:15", "17:00"),
    ];
    const afterEntries = [
      rawEntry(MONDAY, "08:00", "17:00"),
      rawEntry(WEDNESDAY, "08:15", "17:00"),
      rawEntry(FRIDAY, "08:30", "17:00"),
    ];
    vi.mocked(getSummary).mockImplementation(
      sequencedMonthly(
        {
          [MONTH]: [
            summaryOf([daySummary(MONDAY), daySummary(WEDNESDAY)]),
            summaryOf([
              daySummary(MONDAY),
              daySummary(WEDNESDAY),
              daySummary(FRIDAY),
            ]),
          ],
        },
        emptySummary(),
      ),
    );
    vi.mocked(listMonth).mockImplementation(
      sequencedMonthly({ [MONTH]: [beforeEntries, afterEntries] }, []),
    );

    renderPage({
      referenceWeek: { exists: false, days: [] },
      refreshReferenceWeek: vi.fn(),
    });

    await screen.findByRole("textbox", { name: "Date" });
    goToDate(FRIDAY);
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Arrival" }).getAttribute("value"),
      ).toBe(""),
    );
    fillAndSaveDay({
      arrival: "08:30",
      departure: "17:00",
      lunchStart: "12:00",
      lunchEnd: "13:00",
    });

    await waitFor(() =>
      expect(monthCallCount(vi.mocked(listMonth), MONTH)).toBe(2),
    );
    expect(screen.queryByText("Save as reference week?")).toBeNull();
  });

  test("accepting the prompt calls putReferenceWeek with the completed week converted to minutes, refreshes the shared state, and does not write the localStorage answered-flag", async () => {
    const beforeEntries = [
      rawEntry(MONDAY, "08:00", "17:00"),
      rawEntry(WEDNESDAY, "08:15", "17:00"),
    ];
    const afterEntries = [
      rawEntry(MONDAY, "08:00", "17:00"),
      rawEntry(WEDNESDAY, "08:15", "17:00"),
      rawEntry(FRIDAY, "08:30", "17:00"),
    ];
    vi.mocked(getSummary).mockImplementation(
      sequencedMonthly(
        {
          [MONTH]: [
            summaryOf([daySummary(MONDAY), daySummary(WEDNESDAY)]),
            summaryOf([
              daySummary(MONDAY),
              daySummary(WEDNESDAY),
              daySummary(FRIDAY),
            ]),
          ],
        },
        emptySummary(),
      ),
    );
    vi.mocked(listMonth).mockImplementation(
      sequencedMonthly({ [MONTH]: [beforeEntries, afterEntries] }, []),
    );
    const refreshReferenceWeek = vi.fn();

    renderPage({
      referenceWeek: { exists: false, days: [] },
      refreshReferenceWeek,
    });

    await screen.findByRole("textbox", { name: "Date" });
    goToDate(FRIDAY);
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Arrival" }).getAttribute("value"),
      ).toBe(""),
    );
    fillAndSaveDay({
      arrival: "08:30",
      departure: "17:00",
      lunchStart: "12:00",
      lunchEnd: "13:00",
    });

    await screen.findByText("Save as reference week?");
    fireEvent.click(screen.getByRole("button", { name: "Yes, save" }));

    await waitFor(() => expect(putReferenceWeek).toHaveBeenCalledTimes(1));
    expect(putReferenceWeek).toHaveBeenCalledWith([
      {
        weekday: "MONDAY",
        arrivalMinutes: 8 * 60,
        departureMinutes: 17 * 60,
        lunchBreakStartMinutes: 12 * 60,
        lunchBreakEndMinutes: 13 * 60,
      },
      {
        weekday: "WEDNESDAY",
        arrivalMinutes: 8 * 60 + 15,
        departureMinutes: 17 * 60,
        lunchBreakStartMinutes: 12 * 60,
        lunchBreakEndMinutes: 13 * 60,
      },
      {
        weekday: "FRIDAY",
        arrivalMinutes: 8 * 60 + 30,
        departureMinutes: 17 * 60,
        lunchBreakStartMinutes: 12 * 60,
        lunchBreakEndMinutes: 13 * 60,
      },
    ]);
    await waitFor(() => expect(refreshReferenceWeek).toHaveBeenCalledTimes(1));
    expect(
      localStorage.getItem(`referenceWeekPrompt:${USER_ID}:${WEEK_START_ISO}`),
    ).toBeNull();
  });

  test("adapts the prompt's description when a reference week already exists (will be replaced)", async () => {
    const beforeEntries = [
      rawEntry(MONDAY, "08:00", "17:00"),
      rawEntry(WEDNESDAY, "08:15", "17:00"),
    ];
    const afterEntries = [
      rawEntry(MONDAY, "08:00", "17:00"),
      rawEntry(WEDNESDAY, "08:15", "17:00"),
      rawEntry(FRIDAY, "08:30", "17:00"),
    ];
    vi.mocked(getSummary).mockImplementation(
      sequencedMonthly(
        {
          [MONTH]: [
            summaryOf([daySummary(MONDAY), daySummary(WEDNESDAY)]),
            summaryOf([
              daySummary(MONDAY),
              daySummary(WEDNESDAY),
              daySummary(FRIDAY),
            ]),
          ],
        },
        emptySummary(),
      ),
    );
    vi.mocked(listMonth).mockImplementation(
      sequencedMonthly({ [MONTH]: [beforeEntries, afterEntries] }, []),
    );

    renderPage({
      referenceWeek: { exists: true, days: [] },
      refreshReferenceWeek: vi.fn(),
    });

    await screen.findByRole("textbox", { name: "Date" });
    goToDate(FRIDAY);
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Arrival" }).getAttribute("value"),
      ).toBe(""),
    );
    fillAndSaveDay({
      arrival: "08:30",
      departure: "17:00",
      lunchStart: "12:00",
      lunchEnd: "13:00",
    });

    expect(
      await screen.findByText(
        "You've just completed this week. Saving it as your reference week will replace the one you already have. Continue?",
      ),
    ).toBeDefined();
  });

  test("is skipped for a week whose completing save straddles two calendar months, even though every working day would otherwise be present", async () => {
    // WEEK_START_DAY MONDAY: the week of 2099-03-30 (Mon) - 2099-04-05 (Sun)
    // straddles March/April. Wednesday 1 Apr and Friday 3 Apr fall in April
    // (this page's `currentMonth` once navigated there); Monday 30 Mar
    // falls in March and is only ever visible to this page via the
    // *neighbor*-month summary fetch (`neighborDaysByDate`), never via the
    // raw entries needed to build a `PUT /users/me/reference-week` payload.
    // Deliberately far in the future (not "this month"/"next month" off
    // today's real date) so this fixture never collides with
    // `TimeEntryPage`'s own initial "today" mount fetch, whatever month the
    // test happens to run in.
    const straddleMonday = "2099-03-30";
    const straddleWednesday = "2099-04-01";
    const straddleFriday = "2099-04-03";
    const marchMonth = "2099-03";
    const aprilMonth = "2099-04";

    const beforeEntries = [rawEntry(straddleWednesday, "08:15", "17:00")];
    const afterEntries = [
      rawEntry(straddleWednesday, "08:15", "17:00"),
      rawEntry(straddleFriday, "08:30", "17:00"),
    ];
    vi.mocked(getSummary).mockImplementation(
      sequencedMonthly(
        {
          [aprilMonth]: [
            summaryOf([daySummary(straddleWednesday)]),
            summaryOf([
              daySummary(straddleWednesday),
              daySummary(straddleFriday),
            ]),
          ],
          // Monday's own summary is only ever fetched as a *neighbor* month
          // (triggered because the displayed week spans two months) -- it
          // reports Monday as present, which would make the week look
          // complete if the month-boundary skip weren't in place.
          [marchMonth]: [summaryOf([daySummary(straddleMonday)])],
        },
        emptySummary(),
      ),
    );
    vi.mocked(listMonth).mockImplementation(
      sequencedMonthly({ [aprilMonth]: [beforeEntries, afterEntries] }, []),
    );

    renderPage({
      referenceWeek: { exists: false, days: [] },
      refreshReferenceWeek: vi.fn(),
    });

    await screen.findByRole("textbox", { name: "Date" });
    goToDate(straddleWednesday);
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Arrival" }).getAttribute("value"),
      ).toBe("08:15"),
    );
    // Confirms the neighbor (August) summary fetch actually happened, so
    // the assertion below is a genuine proof of the skip, not an accident
    // of Monday's data never having been available in the first place.
    await waitFor(() =>
      expect(
        monthCallCount(vi.mocked(getSummary), marchMonth),
      ).toBeGreaterThanOrEqual(1),
    );

    goToDate(straddleFriday);
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Arrival" }).getAttribute("value"),
      ).toBe(""),
    );
    fillAndSaveDay({
      arrival: "08:30",
      departure: "17:00",
      lunchStart: "12:00",
      lunchEnd: "13:00",
    });

    await waitFor(() =>
      expect(monthCallCount(vi.mocked(listMonth), aprilMonth)).toBe(2),
    );
    expect(screen.queryByText("Save as reference week?")).toBeNull();
    expect(putReferenceWeek).not.toHaveBeenCalled();
  });
});
