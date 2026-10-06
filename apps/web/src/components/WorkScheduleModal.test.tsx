import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { PrimeReactProvider } from "@primereact/core";
import type { WorkScheduleInput } from "@rushhours/domain";
import WorkScheduleModal from "./WorkScheduleModal";
import { getWorkSchedule, putWorkSchedule } from "../api/users";
import { ApiError } from "../api/client";
import i18n from "../i18n/config";

/**
 * Spec §5.5 (rushhours-full-spec.md lines 238-252) — "Ma semaine de travail"
 * modal, tested at component level (not wired into a trigger yet, per the
 * lot's scope). `getWorkSchedule`/`putWorkSchedule` are mocked; no network
 * call happens.
 *
 * Traceability (spec statement -> test(s)):
 * - "raccourcis ToggleButtonGroup 35 / 37 / 40"
 *     -> "35/37/40 quick-pick buttons set the numeric field"
 * - "ordre d'affichage à partir de weekStartDay courant si déjà défini,
 *    sinon ordre Lundi->Dimanche" + "réagit si l'utilisateur change le
 *    Select en cours d'édition" (live)
 *     -> "week-start-day Select reorders the day rows live, Monday-first
 *         by default"
 * - "indicateur en temps réel de l'écart" + "vert si Δ=0, rouge sinon"
 *     -> "Δ indicator turns red and Save disables when a checked day's
 *         hours are edited off-total, and recovers when fixed"
 * - "Le bouton Enregistrer est désactivé tant que Δ ≠ 0"
 *     -> covered throughout; explicitly in the above and in the
 *        all-days-unchecked test
 * - regression: a checked day whose hours were cleared to `null` (still
 *   `checked: true`, per InputNumber's clear-then-blur interaction) must
 *   keep Save disabled even if another checked day's hours are increased
 *   enough to make the naive Δ sum read 0 — `workScheduleSchema`
 *   (`packages/domain`) requires every submitted day's `targetMinutes` to
 *   be a positive integer, so a checked-but-empty day is never a valid
 *   submission regardless of what Δ says. Previously this silently passed
 *   Save-enabled with a green "matches" message and a click that did
 *   nothing (resolver-level rejection routed to `errors.root`, which
 *   wasn't rendered).
 *     -> "Save stays disabled and shows the incomplete-day message when a
 *         checked day's hours are cleared to null, even if Δ reads 0"
 * - "Décocher un jour retire sa ligne de saisie et redistribue implicitement
 *    rien" (no auto-redistribution)
 *     -> "unchecking a day removes its hours row without redistributing
 *         the remaining days' hours"
 * - "aucun jour coché" must keep Save disabled (implied by "au moins 1 jour
 *    coché" validation, §5.5 last paragraph)
 *     -> "Save stays disabled once every day is unchecked"
 * - "Valeur par défaut proposée à l'ouverture initiale (aucune config
 *    existante): répartition égale... Lundi-Vendredi cochés par défaut"
 *     -> "defaults to Monday-Friday checked with hours split evenly"
 *        + "remainder minute(s) from an uneven split are pushed onto the
 *        last default day so Δ=0 immediately"
 * - existing (non-empty) config is loaded and converted minutes->hours
 *     -> "loads an existing configuration and converts minutes to hours"
 * - "Soumission -> PUT /users/me/work-schedule" with correctly shaped
 *   payload (checked days only, minutes, weekStartDay)
 *     -> "successful save calls putWorkSchedule with the correctly-shaped
 *         payload and closes the modal"
 * - save failure shows an error and does not close the modal
 *     -> "a failed save shows an error message and keeps the modal open"
 * - load failure shows an error state instead of a broken/empty form
 *     -> "a failed load shows an error message instead of the form"
 * - `dismissible={false}` (used by onboarding step 2, spec §5.4, to pin the
 *   modal open with "no cancel escape route") disables Escape/backdrop/X
 *   dismissal -> "dismissible=false hides the close (X) button and Escape
 *   does not close the modal"
 * - `cancellable={false}` (same mandatory-step use case) hides the modal's
 *   own internal Cancel button -> "cancellable=false hides the internal
 *   Cancel button without affecting the dismissible (X) button"
 */

vi.mock("../api/users", () => ({
  getWorkSchedule: vi.fn(),
  putWorkSchedule: vi.fn(),
}));

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await new Promise<void>((resolve) => {
      i18n.on("initialized", () => resolve());
    });
  }
  // jsdom has no ResizeObserver; the PrimeReact Select positioner needs one
  // to open its popup.
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

function renderModal(props?: { dismissible?: boolean; cancellable?: boolean }) {
  const onOpenChange = vi.fn();
  const onSaved = vi.fn();
  render(
    <PrimeReactProvider>
      <WorkScheduleModal
        open
        onOpenChange={onOpenChange}
        onSaved={onSaved}
        dismissible={props?.dismissible}
        cancellable={props?.cancellable}
      />
    </PrimeReactProvider>,
  );
  return { onOpenChange, onSaved };
}

async function findForm() {
  await screen.findByText("Weekly contract hours");
}

/** Always the first spinbutton in DOM order — rendered before any day row. */
function getWeeklyHoursInput(): HTMLInputElement {
  return screen.getAllByRole("spinbutton")[0] as HTMLInputElement;
}

function getDayCheckbox(weekdayLabel: string): HTMLInputElement {
  return screen.getByRole("checkbox", {
    name: weekdayLabel,
  });
}

function getDayRow(weekdayLabel: string): HTMLElement {
  const checkbox = getDayCheckbox(weekdayLabel);
  const row = checkbox.closest("div.flex.items-center.gap-3.py-1");
  if (!row) {
    throw new Error(`Could not find row container for "${weekdayLabel}"`);
  }
  return row as HTMLElement;
}

function getDayHoursInput(weekdayLabel: string): HTMLInputElement {
  return within(getDayRow(weekdayLabel)).getByRole("spinbutton");
}

function getDeltaParagraph(): HTMLElement {
  return screen.getByText(
    /minute\(s\) off the weekly total|matches the weekly total/,
  );
}

function getSaveButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: "Save" });
}

// This repo doesn't have `@testing-library/jest-dom` wired up (see
// LoginPage.test.tsx/AuthProvider.test.tsx, which assert via plain DOM
// properties rather than jest-dom matchers) — match that convention.
function hasClass(element: HTMLElement, className: string): boolean {
  return element.className.split(/\s+/).includes(className);
}

/**
 * The InputNumber Primitive re-formats its value, so a plain
 * `userEvent.clear()` doesn't reliably empty it — select-all + backspace
 * does. `tab()` afterwards blurs the field (its `onBlur` is wired to RHF).
 */
async function setSpinValue(
  user: UserEvent,
  input: HTMLInputElement,
  value: string,
) {
  await user.click(input);
  await user.keyboard("{Control>}a{/Control}{Backspace}");
  if (value) {
    await user.type(input, value);
  }
  await user.tab();
}

const WEEKDAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

describe("WorkScheduleModal (spec §5.5)", () => {
  test("defaults to Monday-Friday checked with hours split evenly, Δ matched, Save enabled", async () => {
    vi.mocked(getWorkSchedule).mockResolvedValue({
      weeklyContractHours: 35,
      weekStartDay: "MONDAY",
      days: [],
    });

    renderModal();
    await findForm();

    for (const label of [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
    ]) {
      expect(getDayCheckbox(label).checked).toBe(true);
      expect(getDayHoursInput(label).getAttribute("aria-valuenow")).toBe("7");
    }
    for (const label of ["Saturday", "Sunday"]) {
      expect(getDayCheckbox(label).checked).toBe(false);
    }

    expect(getDeltaParagraph().textContent).toBe(
      "The distribution matches the weekly total.",
    );
    expect(hasClass(getDeltaParagraph(), "text-success-700")).toBe(true);
    expect(getSaveButton().disabled).toBe(false);
  });

  test("remainder minute(s) from an uneven split are pushed onto the last default day so Δ=0 immediately", async () => {
    // 35.05h * 60 = 2103 minutes; 2103 / 5 days doesn't divide evenly
    // (floor 420 * 5 = 2100, remainder 3) — the remainder must land on
    // Friday (the last of the default Monday-Friday days), not be lost or
    // left for the user to fix.
    vi.mocked(getWorkSchedule).mockResolvedValue({
      weeklyContractHours: 35.05,
      weekStartDay: "MONDAY",
      days: [],
    });

    renderModal();
    await findForm();

    for (const label of ["Monday", "Tuesday", "Wednesday", "Thursday"]) {
      expect(getDayHoursInput(label).getAttribute("aria-valuenow")).toBe("7");
    }
    expect(getDayHoursInput("Friday").getAttribute("aria-valuenow")).toBe(
      "7.05",
    );

    expect(hasClass(getDeltaParagraph(), "text-success-700")).toBe(true);
    expect(getSaveButton().disabled).toBe(false);
  });

  test("loads an existing configuration and converts minutes to hours", async () => {
    vi.mocked(getWorkSchedule).mockResolvedValue({
      weeklyContractHours: 40,
      weekStartDay: "TUESDAY",
      days: [
        { weekday: "TUESDAY", targetMinutes: 480 },
        { weekday: "WEDNESDAY", targetMinutes: 480 },
        { weekday: "THURSDAY", targetMinutes: 480 },
        { weekday: "FRIDAY", targetMinutes: 480 },
        { weekday: "SATURDAY", targetMinutes: 480 },
      ],
    });

    renderModal();
    await findForm();

    expect(getWeeklyHoursInput().getAttribute("aria-valuenow")).toBe("40");
    for (const label of [
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ]) {
      expect(getDayCheckbox(label).checked).toBe(true);
      expect(getDayHoursInput(label).getAttribute("aria-valuenow")).toBe("8");
    }
    for (const label of ["Monday", "Sunday"]) {
      expect(getDayCheckbox(label).checked).toBe(false);
    }

    expect(hasClass(getDeltaParagraph(), "text-success-700")).toBe(true);
    expect(getSaveButton().disabled).toBe(false);
  });

  test("Δ indicator turns red and Save disables when a checked day's hours are edited off-total, and recovers when fixed", async () => {
    vi.mocked(getWorkSchedule).mockResolvedValue({
      weeklyContractHours: 35,
      weekStartDay: "MONDAY",
      days: [],
    });
    renderModal();
    await findForm();
    const user = userEvent.setup();

    await setSpinValue(user, getDayHoursInput("Monday"), "10");

    expect(getDeltaParagraph().textContent).toBe(
      "-180 minute(s) off the weekly total.",
    );
    expect(hasClass(getDeltaParagraph(), "text-error-700")).toBe(true);
    expect(getSaveButton().disabled).toBe(true);

    // Compensate on another day so the sum returns to weeklyContractHours*60.
    await setSpinValue(user, getDayHoursInput("Tuesday"), "4");

    expect(getDeltaParagraph().textContent).toBe(
      "The distribution matches the weekly total.",
    );
    expect(hasClass(getDeltaParagraph(), "text-success-700")).toBe(true);
    expect(getSaveButton().disabled).toBe(false);
  });

  test("Save stays disabled and shows the incomplete-day message when a checked day's hours are cleared to null, even if Δ reads 0", async () => {
    vi.mocked(getWorkSchedule).mockResolvedValue({
      weeklyContractHours: 35,
      weekStartDay: "MONDAY",
      days: [],
    });
    renderModal();
    await findForm();
    const user = userEvent.setup();

    // Clear Monday's hours (still checked, `hours` becomes `null`) — the
    // documented click -> select-all -> backspace -> blur interaction is
    // exactly what `setSpinValue` with an empty value does.
    await setSpinValue(user, getDayHoursInput("Monday"), "");
    expect(getDayCheckbox("Monday").checked).toBe(true);

    // Compensate on Friday by the amount Monday no longer contributes
    // (7h -> 0h, i.e. 420 minutes) so the naive Δ sum reads back to 0:
    // Mon(0) + Tue(7) + Wed(7) + Thu(7) + Fri(14) = 35h = target.
    await setSpinValue(user, getDayHoursInput("Friday"), "14");

    // The crux of the bug: Δ alone looks satisfied, but Save must stay
    // disabled because Monday is checked with no hours entered.
    expect(
      screen.getByText("Enter a number of hours for every checked day."),
    ).toBeDefined();
    expect(
      hasClass(
        screen.getByText("Enter a number of hours for every checked day."),
        "text-error-700",
      ),
    ).toBe(true);
    expect(
      screen.queryByText("The distribution matches the weekly total."),
    ).toBeNull();
    expect(getSaveButton().disabled).toBe(true);

    // Recovery path: filling the cleared field back in (and undoing the
    // Friday compensation) restores Δ=0 with no incomplete day, re-enabling
    // Save and reverting the message.
    await setSpinValue(user, getDayHoursInput("Monday"), "7");
    await setSpinValue(user, getDayHoursInput("Friday"), "7");

    expect(getDeltaParagraph().textContent).toBe(
      "The distribution matches the weekly total.",
    );
    expect(hasClass(getDeltaParagraph(), "text-success-700")).toBe(true);
    expect(getSaveButton().disabled).toBe(false);
  });

  test("unchecking a day removes its hours row without redistributing the remaining days' hours", async () => {
    vi.mocked(getWorkSchedule).mockResolvedValue({
      weeklyContractHours: 35,
      weekStartDay: "MONDAY",
      days: [],
    });
    renderModal();
    await findForm();
    const user = userEvent.setup();

    expect(screen.getAllByRole("spinbutton")).toHaveLength(6); // weekly + 5 days

    await user.click(getDayCheckbox("Monday"));

    expect(getDayCheckbox("Monday").checked).toBe(false);
    expect(within(getDayRow("Monday")).queryByRole("spinbutton")).toBeNull();
    // Remaining checked days keep their own hours untouched (still 7 each).
    for (const label of ["Tuesday", "Wednesday", "Thursday", "Friday"]) {
      expect(getDayHoursInput(label).getAttribute("aria-valuenow")).toBe("7");
    }
    expect(screen.getAllByRole("spinbutton")).toHaveLength(5); // weekly + 4 days

    expect(getDeltaParagraph().textContent).toBe(
      "420 minute(s) off the weekly total.",
    );
    expect(hasClass(getDeltaParagraph(), "text-error-700")).toBe(true);
    expect(getSaveButton().disabled).toBe(true);
  });

  test("Save stays disabled once every day is unchecked", async () => {
    vi.mocked(getWorkSchedule).mockResolvedValue({
      weeklyContractHours: 35,
      weekStartDay: "MONDAY",
      days: [],
    });
    renderModal();
    await findForm();
    const user = userEvent.setup();

    for (const label of [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
    ]) {
      await user.click(getDayCheckbox(label));
    }

    for (const label of WEEKDAY_LABELS) {
      expect(getDayCheckbox(label).checked).toBe(false);
    }
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(1); // weekly only
    expect(getSaveButton().disabled).toBe(true);
  });

  test("35/37/40 quick-pick buttons set the weekly hours field", async () => {
    vi.mocked(getWorkSchedule).mockResolvedValue({
      weeklyContractHours: 35,
      weekStartDay: "MONDAY",
      days: [],
    });
    renderModal();
    await findForm();
    const user = userEvent.setup();

    expect(getWeeklyHoursInput().getAttribute("aria-valuenow")).toBe("35");

    await user.click(screen.getByRole("button", { name: "37" }));
    expect(getWeeklyHoursInput().getAttribute("aria-valuenow")).toBe("37");

    await user.click(screen.getByRole("button", { name: "40" }));
    expect(getWeeklyHoursInput().getAttribute("aria-valuenow")).toBe("40");
  });

  test("week-start-day Select reorders the day rows live, Monday-first by default", async () => {
    vi.mocked(getWorkSchedule).mockResolvedValue({
      weeklyContractHours: 35,
      weekStartDay: "MONDAY",
      days: [],
    });
    renderModal();
    await findForm();

    expect(
      screen
        .getAllByRole("checkbox")
        .map((cb) => cb.closest("label")!.textContent),
    ).toEqual(WEEKDAY_LABELS);

    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Wednesday" }));

    expect(screen.getByRole("combobox").textContent).toBe("Wednesday");
    expect(
      screen
        .getAllByRole("checkbox")
        .map((cb) => cb.closest("label")!.textContent),
    ).toEqual([
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
      "Monday",
      "Tuesday",
    ]);
  });

  test("successful save calls putWorkSchedule with the correctly-shaped payload and closes the modal", async () => {
    vi.mocked(getWorkSchedule).mockResolvedValue({
      weeklyContractHours: 35,
      weekStartDay: "MONDAY",
      days: [],
    });
    const savedSchedule: WorkScheduleInput = {
      weeklyContractHours: 35,
      weekStartDay: "MONDAY",
      days: [
        { weekday: "MONDAY", targetMinutes: 420 },
        { weekday: "TUESDAY", targetMinutes: 420 },
        { weekday: "WEDNESDAY", targetMinutes: 420 },
        { weekday: "THURSDAY", targetMinutes: 420 },
        { weekday: "FRIDAY", targetMinutes: 420 },
      ],
    };
    vi.mocked(putWorkSchedule).mockResolvedValue(savedSchedule);

    const { onOpenChange, onSaved } = renderModal();
    await findForm();
    const user = userEvent.setup();

    await user.click(getSaveButton());

    await waitFor(() => expect(putWorkSchedule).toHaveBeenCalledTimes(1));
    expect(putWorkSchedule).toHaveBeenCalledWith(savedSchedule);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSaved).toHaveBeenCalledWith(savedSchedule);
  });

  test("a failed save shows an error message and keeps the modal open", async () => {
    vi.mocked(getWorkSchedule).mockResolvedValue({
      weeklyContractHours: 35,
      weekStartDay: "MONDAY",
      days: [],
    });
    vi.mocked(putWorkSchedule).mockRejectedValue(
      new ApiError(500, "Internal error"),
    );

    const { onOpenChange, onSaved } = renderModal();
    await findForm();
    const user = userEvent.setup();

    await user.click(getSaveButton());

    expect(
      await screen.findByText(
        "Couldn't save your work week. Please try again.",
      ),
    ).toBeDefined();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  test("a failed load shows an error message instead of the form", async () => {
    vi.mocked(getWorkSchedule).mockRejectedValue(new ApiError(500, "boom"));

    renderModal();

    expect(
      await screen.findByText(
        "Couldn't load your work week. Please try again.",
      ),
    ).toBeDefined();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  test("dismissible=false hides the close (X) button and Escape does not close the modal", async () => {
    vi.mocked(getWorkSchedule).mockResolvedValue({
      weeklyContractHours: 35,
      weekStartDay: "MONDAY",
      days: [],
    });
    const { onOpenChange } = renderModal({ dismissible: false });
    await findForm();
    const user = userEvent.setup();

    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();

    await user.keyboard("{Escape}");

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  test("cancellable=false hides the internal Cancel button without affecting the dismissible (X) button", async () => {
    vi.mocked(getWorkSchedule).mockResolvedValue({
      weeklyContractHours: 35,
      weekStartDay: "MONDAY",
      days: [],
    });
    renderModal({ cancellable: false });
    await findForm();

    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    // `dismissible` (default true) is a separate prop — the X stays.
    expect(screen.getByRole("button", { name: "Close" })).toBeDefined();
  });
});
