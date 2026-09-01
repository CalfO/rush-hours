import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { Children, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AnalyticsPage from "./AnalyticsPage";
import { getAnalytics } from "../api/time-entries";
import { getWorkSchedule } from "../api/users";
import i18n from "../i18n/config";

vi.mock("../api/users", () => ({ getWorkSchedule: vi.fn() }));
vi.mock("../api/time-entries", () => ({ getAnalytics: vi.fn() }));

vi.mock("../components/ui/datepicker", () => {
  type PickerProps = {
    value?: Date;
    onValueChange?: (event: { value: Date | null }) => void;
    children?: ReactNode;
  };
  type InputProps = { "aria-label"?: string };

  function DatePickerInput(props: InputProps) {
    void props;
    return null;
  }

  function DatePicker({ value, onValueChange, children }: PickerProps) {
    const input = Children.toArray(children).find(
      (child) => isValidElement(child) && child.type === DatePickerInput,
    ) as ReactElement<InputProps> | undefined;
    return (
      <input
        aria-label={input?.props["aria-label"]}
        type="date"
        value={value?.toISOString().slice(0, 10) ?? ""}
        onChange={(event) =>
          onValueChange?.({
            value: new Date(`${event.target.value}T00:00:00.000Z`),
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
  };
});

const today = new Date();
const todayIso = today.toISOString().slice(0, 10);
const month = todayIso.slice(0, 7);

const summary = {
  days: [
    {
      date: `${month}-01`,
      workedMinutes: 510,
      targetMinutes: 480,
      balanceMinutes: 30,
    },
    {
      date: `${month}-02`,
      workedMinutes: 450,
      targetMinutes: 480,
      balanceMinutes: -30,
    },
  ],
  weeks: [
    {
      start: `${month}-01`,
      end: `${month}-07`,
      workedMinutes: 960,
      targetMinutes: 960,
      balanceMinutes: 0,
    },
  ],
  total: { workedMinutes: 960, targetMinutes: 960, balanceMinutes: 0 },
};

const emptySummary = {
  days: [],
  weeks: [],
  total: { workedMinutes: 0, targetMinutes: 0, balanceMinutes: 0 },
};

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await new Promise<void>((resolve) => {
      i18n.on("initialized", () => resolve());
    });
  }
});

beforeEach(() => {
  vi.clearAllMocks();
  void i18n.changeLanguage("en");
  vi.mocked(getWorkSchedule).mockResolvedValue({
    weeklyContractHours: 35,
    weekStartDay: "MONDAY",
    days: [],
  });
  vi.mocked(getAnalytics).mockResolvedValue(summary);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AnalyticsPage (spec §7.3)", () => {
  test("fetches the default month and renders the three SVG analytics charts", async () => {
    render(<AnalyticsPage />);

    expect(
      await screen.findByRole("img", { name: /hours worked per day/i }),
    ).toBeDefined();
    expect(getWorkSchedule).toHaveBeenCalledTimes(1);
    expect(getAnalytics).toHaveBeenCalledWith(
      `${month}-01`,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(
      screen
        .getByRole("button", { name: "Month" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  test("supports month, week, and custom date-range presets", async () => {
    const user = userEvent.setup();
    render(<AnalyticsPage />);
    await screen.findByRole("img", { name: /hours worked per day/i });

    await user.click(screen.getByRole("button", { name: "Week" }));
    await waitFor(() => {
      expect(getAnalytics).toHaveBeenCalledWith(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      );
    });

    await user.click(screen.getByRole("button", { name: "Custom range" }));
    const from = screen.getByLabelText("From");
    const to = screen.getByLabelText("To");
    fireEvent.change(from, { target: { value: "2026-01-05" } });
    fireEvent.change(to, { target: { value: "2026-01-12" } });
    await waitFor(() =>
      expect(getAnalytics).toHaveBeenLastCalledWith("2026-01-05", "2026-01-12"),
    );
  });

  test("shows a translated empty state and a translated API error", async () => {
    vi.mocked(getAnalytics).mockResolvedValueOnce(emptySummary);
    const { unmount } = render(<AnalyticsPage />);
    expect(
      await screen.findByText("No time entries for the selected period."),
    ).toBeDefined();
    unmount();

    vi.mocked(getAnalytics).mockRejectedValueOnce(new Error("network"));
    render(<AnalyticsPage />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Couldn't load your analytics. Please try again.",
    );
  });

  test("ignores an obsolete response after the selected range changes", async () => {
    let resolveFirst: (value: typeof summary) => void = () => {};
    const first = new Promise<typeof summary>((resolve) => {
      resolveFirst = resolve;
    });
    const latest = {
      ...summary,
      total: { ...summary.total, balanceMinutes: 120 },
      days: summary.days.map((day) => ({ ...day, balanceMinutes: 60 })),
    };
    vi.mocked(getAnalytics).mockImplementationOnce(() => first);
    vi.mocked(getAnalytics).mockResolvedValue(latest);

    const user = userEvent.setup();
    render(<AnalyticsPage />);
    await user.click(screen.getByRole("button", { name: "Custom range" }));
    fireEvent.change(screen.getByLabelText("From"), {
      target: { value: "2026-01-05" },
    });
    fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "2026-01-12" },
    });
    await waitFor(() =>
      expect(getAnalytics).toHaveBeenLastCalledWith("2026-01-05", "2026-01-12"),
    );

    resolveFirst(summary);
    await waitFor(() =>
      expect(document.querySelector("p.text-right")?.textContent).toContain(
        "+2h00",
      ),
    );
  });
});
