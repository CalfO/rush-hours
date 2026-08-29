import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Children, createContext, isValidElement, useContext } from "react";
import type { ReactElement, ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { PrimeReactProvider } from "@primereact/core";
import type { WorkScheduleInput } from "@rushhours/domain";
import AppLayout from "./AppLayout";
import TimeEntryPage from "../pages/TimeEntryPage";
import { useAuth } from "../auth/AuthProvider";
import { getWorkSchedule } from "../api/users";
import {
  getSummary,
  listMonth,
  upsertTimeEntry,
  type DaySummary,
  type RangeSummary,
  type TimeEntryRecord,
} from "../api/time-entries";
import {
  deleteReferenceWeek,
  getReferenceWeek,
  putReferenceWeek,
} from "../api/reference-week";
import type { AuthUser } from "../api/auth";
import i18n from "../i18n/config";

/**
 * Spec `time-entry-ux-and-reference-week.md` §5.5/§5.6/§5.7 — cross-component
 * propagation of the lifted reference-week state (`AppLayout.tsx`'s own doc
 * comment: "Header and TimeEntryPage are siblings, not parent/child, and
 * both read/mutate this state"). `TimeEntryPage.referenceWeek.test.tsx`
 * already isolates the save-prompt's own trigger logic behind a controlled
 * `<Outlet context>`; this file instead mounts the *real* `AppLayout`
 * (real fetch-once, real `refreshReferenceWeek`) with both `Header` and
 * `TimeEntryPage` as real siblings underneath it, to prove a mutation from
 * either side actually reaches the other — exactly the class of bug a
 * shallow/isolated render test would miss (e.g. accepting the save-prompt
 * updating `TimeEntryPage`'s own local view but leaving `Header`'s menu
 * stale, or vice versa).
 *
 * Traceability:
 * - §5.5 accept path "-> rafraîchit ... visible immédiatement" (implied by
 *   the whole point of lifting the state, `AppLayout.tsx`'s own doc
 *   comment) -> "accepting the save-prompt makes the header's delete menu
 *   item and the carousel's prefill switch appear immediately, in the same
 *   render tree, with no further user navigation needed to see them"
 * - §5.6 "rafraîchir l'état exists (et masquer l'item)" + §5.7's switch
 *   sharing the same `exists` state -> "deleting the reference week from
 *   the header menu makes both the menu item and the carousel's prefill
 *   switch disappear immediately"
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

vi.mock("../auth/AuthProvider", () => ({ useAuth: vi.fn() }));
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
  getReferenceWeek: vi.fn(),
  putReferenceWeek: vi.fn(),
  deleteReferenceWeek: vi.fn(),
}));

const authenticatedUser: AuthUser = {
  id: "u1",
  username: "user",
  role: "USER",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
};

// Same "far in the future" reasoning as
// `TimeEntryPage.referenceWeek.test.tsx`: a fixture month/week that will
// never collide with `TimeEntryPage`'s own initial "today" mount fetch.
const WEEK_START_DAY = "MONDAY" as const;
const MONTH = "2099-05";
const MONDAY = "2099-05-04";
const WEDNESDAY = "2099-05-06";
const FRIDAY = "2099-05-08";

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

function renderApp(initialPath = "/") {
  const routes = [
    {
      element: <AppLayout />,
      children: [{ path: "/", element: <TimeEntryPage /> }],
    },
  ];
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  render(
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

async function openAvatarMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "AL" }));
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

  vi.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    user: authenticatedUser,
    refresh: vi.fn(),
    logout: vi.fn(),
  });
  vi.mocked(getWorkSchedule).mockResolvedValue(WORK_SCHEDULE);
  vi.mocked(upsertTimeEntry).mockImplementation((date, input) =>
    Promise.resolve({
      date: `${date}T00:00:00.000Z`,
      arrivalTime: input.arrivalTime.toISOString(),
      departureTime: input.departureTime.toISOString(),
      lunchBreakStart: input.lunchBreakStart.toISOString(),
      lunchBreakEnd: input.lunchBreakEnd.toISOString(),
    }),
  );
});

describe("AppLayout: reference-week state reaches both siblings (spec §5.5/§5.6/§5.7)", () => {
  test("accepting the save-prompt makes the header's delete menu item and the carousel's prefill switch appear immediately, with no extra navigation needed to observe them", async () => {
    vi.mocked(getReferenceWeek)
      .mockResolvedValueOnce({ exists: false, days: [] }) // AppLayout's initial fetch
      .mockResolvedValueOnce({ exists: true, days: [] }); // refreshReferenceWeek() after accept
    vi.mocked(putReferenceWeek).mockResolvedValue({ exists: true, days: [] });

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

    renderApp();
    const user = userEvent.setup();

    // Before completing the week: neither sibling shows any reference-week
    // affordance yet.
    await openAvatarMenu(user);
    expect(
      screen.queryByRole("menuitem", { name: "Delete reference week" }),
    ).toBeNull();
    await user.keyboard("{Escape}");

    goToDate(FRIDAY);
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Arrival" }).getAttribute("value"),
      ).toBe(""),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Arrival" }), {
      target: { value: "08:30" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Departure" }), {
      target: { value: "17:00" },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: "Lunch break start" }),
      { target: { value: "12:00" } },
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Lunch break end" }), {
      target: { value: "13:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("Save as reference week?");
    await user.click(screen.getByRole("button", { name: "Yes, save" }));

    await waitFor(() => expect(putReferenceWeek).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getReferenceWeek).toHaveBeenCalledTimes(2));

    // Header sibling: the delete menu item is now present, in the same
    // render tree, without any reload.
    await openAvatarMenu(user);
    expect(
      await screen.findByRole("menuitem", { name: "Delete reference week" }),
    ).toBeDefined();
    await user.keyboard("{Escape}");

    // WeekCarousel sibling: navigating to the weekStartDay's own card
    // (Monday) now shows the prefill switch too.
    goToDate(MONDAY);
    expect(
      await screen.findByRole("button", {
        name: "Use the reference week for the whole week",
      }),
    ).toBeDefined();
  });

  test("deleting the reference week from the header menu makes both the menu item and the carousel's prefill switch disappear immediately", async () => {
    vi.mocked(getReferenceWeek)
      .mockResolvedValueOnce({ exists: true, days: [] }) // AppLayout's initial fetch
      .mockResolvedValueOnce({ exists: false, days: [] }); // refreshReferenceWeek() after delete
    vi.mocked(deleteReferenceWeek).mockResolvedValue({ success: true });
    vi.mocked(getSummary).mockResolvedValue(emptySummary());
    vi.mocked(listMonth).mockResolvedValue([]);

    renderApp();
    const user = userEvent.setup();

    goToDate(MONDAY);

    // Both siblings start out showing the reference-week affordance.
    expect(
      await screen.findByRole("button", {
        name: "Use the reference week for the whole week",
      }),
    ).toBeDefined();
    await openAvatarMenu(user);
    expect(
      await screen.findByRole("menuitem", { name: "Delete reference week" }),
    ).toBeDefined();

    await user.click(
      screen.getByRole("menuitem", { name: "Delete reference week" }),
    );
    await user.click(await screen.findByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(deleteReferenceWeek).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getReferenceWeek).toHaveBeenCalledTimes(2));

    // WeekCarousel sibling: the switch disappears without any further
    // navigation.
    await waitFor(() =>
      expect(
        screen.queryByRole("button", {
          name: "Use the reference week for the whole week",
        }),
      ).toBeNull(),
    );

    // Header sibling: the menu item disappears too.
    await openAvatarMenu(user);
    expect(
      screen.queryByRole("menuitem", { name: "Delete reference week" }),
    ).toBeNull();
  });
});
