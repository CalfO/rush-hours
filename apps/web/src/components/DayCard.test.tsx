import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrimeReactProvider } from "@primereact/core";
import { DayCard } from "./DayCard";
import { upsertTimeEntry, type TimeEntryRecord } from "../api/time-entries";
import i18n from "../i18n/config";

/**
 * Spec §4.1/§4.2 (`prompts/spec/time-entry-ux-and-reference-week.md`) — the
 * single day's 4 time fields + Save, now hosted by `DayCard` (narrowed out of
 * `DayForm`, date is a plain prop). Mounted with the *real*
 * `components/ui/datepicker.tsx` (not mocked, unlike `TimeEntryPage.test.tsx`,
 * which reduces the picker to plain inputs specifically to isolate page-level
 * behavior) — this file exists to actually exercise the popover/grid
 * interaction sequence the spec describes, which the page-level mock can't.
 *
 * Traceability:
 * - §4.1 "clic sur un champ heure -> sélecteur heures/minutes +/-, déjà en
 *   place" (non-regression) -> "the existing hour/minute +/- popover still
 *   opens and the +/- steppers change the value"
 * - §4.2 "clic sur la valeur des heures -> grille de toutes les heures ...
 *   sélection en un clic" -> "clicking the hour value opens a 24-option grid;
 *   picking an hour updates the field and closes the grid"
 * - §4.2 "après sélection ... heure choisie est bien appliquée" + the
 *   orchestrator's documented regression (a grid pick silently discarded by
 *   a subsequent +/- click) -> "after picking an hour from the grid, the +/-
 *   stepper still increments/decrements from the picked value, not a stale
 *   one"
 */

vi.mock("../api/time-entries", async () => {
  const actual = await vi.importActual<typeof import("../api/time-entries")>(
    "../api/time-entries",
  );
  return { ...actual, upsertTimeEntry: vi.fn() };
});

const date = new Date("2026-08-24T00:00:00.000Z"); // Monday

const existingEntry: TimeEntryRecord = {
  date: "2026-08-24T00:00:00.000Z",
  arrivalTime: "2026-08-24T08:30:00.000Z",
  departureTime: "2026-08-24T17:30:00.000Z",
  lunchBreakStart: "2026-08-24T12:00:00.000Z",
  lunchBreakEnd: "2026-08-24T13:00:00.000Z",
};

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await new Promise<void>((resolve) => {
      i18n.on("initialized", () => resolve());
    });
  }
  await i18n.changeLanguage("en");
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (
    globalThis as typeof globalThis & {
      ResizeObserver: typeof ResizeObserverStub;
    }
  ).ResizeObserver = ResizeObserverStub;
});

beforeEach(() => {
  vi.clearAllMocks();
});

function renderCard(entry: TimeEntryRecord | undefined = existingEntry) {
  const onSaved = vi.fn();
  render(
    <PrimeReactProvider>
      <DayCard date={date} existingEntry={entry} onSaved={onSaved} />
    </PrimeReactProvider>,
  );
  return { onSaved };
}

/** The always-readOnly `combobox` input for a given time field. */
function getTimeField(label: string): HTMLElement {
  return screen.getByRole("combobox", { name: label });
}

/**
 * The hour/minute +/- stepper buttons rendered inside an open `timeOnly`
 * popover (`role="dialog"`), in DOM order: hour-increment, hour-decrement,
 * minute-increment, minute-decrement (`DatePickerTime` renders the hour
 * `TimePicker` before the minute one, each as Increment/value/Decrement —
 * see `datepicker.tsx`'s `TimePicker`/`DatePickerTime`). None of PrimeReact's
 * chevron buttons expose an accessible name, so they're located structurally
 * (only interactive `<button>`s inside the dialog that render an icon).
 */
function getStepperButtons(dialog: HTMLElement): HTMLButtonElement[] {
  return Array.from(dialog.querySelectorAll("button")).filter((button) =>
    button.querySelector("svg"),
  );
}

describe("DayCard (spec §4.1/§4.2)", () => {
  test("renders the 4 time fields pre-filled from the existing entry, with an hh:mm placeholder convention", () => {
    renderCard();

    expect(getTimeField("Arrival").getAttribute("value")).toBe("08:30");
    expect(getTimeField("Departure").getAttribute("value")).toBe("17:30");
    expect(getTimeField("Lunch break start").getAttribute("value")).toBe(
      "12:00",
    );
    expect(getTimeField("Lunch break end").getAttribute("value")).toBe("13:00");
  });

  test("the existing hour/minute +/- popover still opens and the +/- steppers change the value", async () => {
    renderCard();
    const user = userEvent.setup();

    await user.click(getTimeField("Arrival"));

    const dialog = await screen.findByRole("dialog");
    const [hourIncrement] = getStepperButtons(dialog);
    expect(hourIncrement).toBeDefined();

    await user.click(hourIncrement);

    await waitFor(() =>
      expect(getTimeField("Arrival").getAttribute("value")).toBe("09:30"),
    );
  });

  test("clicking the hour value opens a 24-option grid; picking an hour updates the field and closes the grid", async () => {
    renderCard();
    const user = userEvent.setup();

    await user.click(getTimeField("Arrival"));
    await screen.findByRole("dialog");

    // The hour value itself (currently "08") is the grid's own trigger,
    // accessibly named via its aria-label rather than its visible digits.
    const hourTrigger = screen.getByRole("button", { name: "Choose hour" });
    await user.click(hourTrigger);

    const grid = await screen.findByRole("listbox", { name: "Choose hour" });
    expect(grid).toBeDefined();
    expect(screen.getAllByRole("option")).toHaveLength(24);

    await user.click(screen.getByRole("option", { name: "14" }));

    // The grid closes...
    await waitFor(() =>
      expect(screen.queryByRole("listbox", { name: "Choose hour" })).toBeNull(),
    );
    // ...and the picked hour is applied, minutes preserved (08:30 -> 14:30).
    await waitFor(() =>
      expect(getTimeField("Arrival").getAttribute("value")).toBe("14:30"),
    );
  });

  test("after picking an hour from the grid, the +/- stepper still increments from the picked value, not a stale one", async () => {
    renderCard();
    const user = userEvent.setup();

    await user.click(getTimeField("Arrival"));
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: "Choose hour" }));
    await screen.findByRole("listbox", { name: "Choose hour" });
    await user.click(screen.getByRole("option", { name: "14" }));

    await waitFor(() =>
      expect(getTimeField("Arrival").getAttribute("value")).toBe("14:30"),
    );

    // Regression coverage for the bug the orchestrator found by hand: a
    // subsequent +/- click must step from 14 (the picked hour), landing on
    // 15 — not silently discard the grid pick and step from whatever stale
    // internal hour the stepper had before the pick.
    const dialog = await screen.findByRole("dialog");
    const [hourIncrement] = getStepperButtons(dialog);
    expect(hourIncrement).toBeDefined();

    await user.click(hourIncrement);

    await waitFor(() =>
      expect(getTimeField("Arrival").getAttribute("value")).toBe("15:30"),
    );
  });

  test("saving submits the currently displayed values for the day passed via the `date` prop", async () => {
    vi.mocked(upsertTimeEntry).mockResolvedValue(existingEntry);
    const { onSaved } = renderCard();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(upsertTimeEntry).toHaveBeenCalledTimes(1));
    const [isoDate, input] = vi.mocked(upsertTimeEntry).mock.calls[0];
    expect(isoDate).toBe("2026-08-24");
    expect(input.date.toISOString()).toBe("2026-08-24T00:00:00.000Z");
    expect(input.arrivalTime.toISOString()).toBe("2026-08-24T08:30:00.000Z");
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(existingEntry));
  });
});
