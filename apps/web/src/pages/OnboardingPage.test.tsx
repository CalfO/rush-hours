import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { PrimeReactProvider } from "@primereact/core";
import OnboardingPage from "./OnboardingPage";
import { useAuth } from "../auth/AuthProvider";
import { getWorkSchedule, putWorkSchedule, updateProfile } from "../api/users";
import type { AuthUser } from "../api/auth";
import type { WorkScheduleInput } from "@rushhours/domain";
import i18n from "../i18n/config";

/**
 * Spec §5.4 — mandatory two-step onboarding wizard (`RequireAuth`'s routing
 * to `/onboarding` itself is out of scope, see `RequireAuth.test.tsx`).
 * `useAuth`/`../api/users` are mocked — no real network call happens.
 *
 * Traceability (spec statement -> test(s)):
 * - "Parcours en deux étapes... les deux étapes doivent être présentées
 *   l'une après l'autre sans possibilité de sauter la seconde" (step 2 only
 *   reachable after step 1) -> "renders step 1 (profile) first, with no way
 *   to skip to step 2" + "completing step 1 advances to step 2 (work
 *   schedule), not before"
 * - step 1 = profile form, "nothing to bypass to" (no Cancel option) ->
 *   "renders step 1 (profile) first, with no way to skip to step 2"
 * - step 2 = the §5.5 work-schedule modal, pinned open/non-dismissible/
 *   non-cancellable in this mandatory context -> "step 2 is the
 *   work-schedule form with no Cancel button and no dismiss (X) button"
 *   (the underlying `dismissible`/`cancellable` prop-gating itself is
 *   pinned at the component level in WorkScheduleModal.test.tsx)
 * - "Une fois cette étape [2] enregistrée... onboardingCompletedAt = now()
 *   côté API" + front must reflect that and navigate away -> "completing
 *   step 2 refreshes the auth session and navigates to /"
 */

vi.mock("../auth/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("../api/users", () => ({
  updateProfile: vi.fn(),
  getWorkSchedule: vi.fn(),
  putWorkSchedule: vi.fn(),
}));

const preOnboardingUser: AuthUser = {
  id: "u1",
  username: "newuser",
  role: "USER",
  firstName: null,
  lastName: null,
  email: null,
  onboardingCompletedAt: null,
};

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await new Promise<void>((resolve) => {
      i18n.on("initialized", () => resolve());
    });
  }
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

function renderOnboardingPage(refresh = vi.fn().mockResolvedValue(null)) {
  vi.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    user: preOnboardingUser,
    refresh,
    logout: vi.fn(),
  });

  const routes = [
    { path: "/onboarding", element: <OnboardingPage /> },
    { path: "/", element: <div>home-page</div> },
  ];
  const router = createMemoryRouter(routes, {
    initialEntries: ["/onboarding"],
  });
  render(
    <PrimeReactProvider>
      <RouterProvider router={router} />
    </PrimeReactProvider>,
  );
  return { router, refresh };
}

async function completeStepOne(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("First name"), "Ada");
  await user.type(screen.getByLabelText("Last name"), "Lovelace");
  await user.type(screen.getByLabelText("Email"), "ada@example.com");
  await user.click(screen.getByRole("button", { name: "Continue" }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OnboardingPage (spec §5.4)", () => {
  test("renders step 1 (profile) first, with no way to skip to step 2", () => {
    renderOnboardingPage();

    expect(screen.getByText("Step 1 of 2")).toBeDefined();
    expect(screen.getByLabelText("First name")).toBeDefined();
    expect(screen.getByLabelText("Last name")).toBeDefined();
    expect(screen.getByLabelText("Email")).toBeDefined();
    // Step 1 has nothing to cancel back to.
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    // Step 2's content isn't reachable/rendered yet.
    expect(screen.queryByText("My work week")).toBeNull();
  });

  test("completing step 1 advances to step 2 (work schedule), not before", async () => {
    vi.mocked(updateProfile).mockResolvedValue({
      ...preOnboardingUser,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
    });
    vi.mocked(getWorkSchedule).mockResolvedValue({
      weeklyContractHours: 35,
      weekStartDay: "MONDAY",
      days: [],
    });
    renderOnboardingPage();
    const user = userEvent.setup();

    // Step 2 must not exist before step 1 succeeds.
    expect(screen.queryByText("My work week")).toBeNull();

    await completeStepOne(user);

    expect(await screen.findByText("Step 2 of 2")).toBeDefined();
    expect(await screen.findByText("My work week")).toBeDefined();
    expect(screen.queryByLabelText("First name")).toBeNull();
  });

  test("step 2 is the work-schedule form with no Cancel button and no dismiss (X) button", async () => {
    vi.mocked(updateProfile).mockResolvedValue(preOnboardingUser);
    vi.mocked(getWorkSchedule).mockResolvedValue({
      weeklyContractHours: 35,
      weekStartDay: "MONDAY",
      days: [],
    });
    renderOnboardingPage();
    const user = userEvent.setup();

    await completeStepOne(user);
    await screen.findByText("My work week");

    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    // The mandatory step's own Save button is present and eventually
    // enabled (spec §5.5 default distribution has Δ=0 immediately).
    expect(await screen.findByRole("button", { name: "Save" })).toBeDefined();
  });

  test("completing step 2 refreshes the auth session and navigates to /", async () => {
    vi.mocked(updateProfile).mockResolvedValue(preOnboardingUser);
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
    const onboardedUser: AuthUser = {
      ...preOnboardingUser,
      onboardingCompletedAt: "2026-08-28T00:00:00.000Z",
    };
    const refresh = vi.fn().mockResolvedValue(onboardedUser);

    renderOnboardingPage(refresh);
    const user = userEvent.setup();

    await completeStepOne(user);
    const saveButton = await screen.findByRole("button", { name: "Save" });
    await user.click(saveButton);

    await vi.waitFor(() => expect(putWorkSchedule).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("home-page")).toBeDefined();
  });
});
