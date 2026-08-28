import { beforeAll, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { PrimeReactProvider } from "@primereact/core";
import AppLayout from "./AppLayout";
import LoginPage from "../pages/LoginPage";
import OnboardingPage from "../pages/OnboardingPage";
import TimeEntryPage from "../pages/TimeEntryPage";
import AnalyticsPage from "../pages/AnalyticsPage";
import { RequireAuth } from "../auth/RequireAuth";
import { useAuth } from "../auth/AuthProvider";
import type { AuthUser } from "../api/auth";
import i18n from "../i18n/config";

/**
 * Spec §7.1: "Header (sticky, présent sur toutes les vues protégées)" and
 * §7: "Toutes les routes sauf /login sont protégées". This file pins the
 * *placement* half of that requirement — which routes render inside
 * `AppLayout` (and therefore get the sticky `<header>`) and which don't —
 * mirroring `apps/web/src/router.tsx`'s actual nesting (`AppLayout` wraps
 * only `/` and `/analytics`; `/login` sits outside `RequireAuth` entirely,
 * `/onboarding` sits inside `RequireAuth` but outside `AppLayout`).
 *
 * `apps/web/src/router.test.tsx` already pins which *page* renders at each
 * path, but its route table intentionally omits `AppLayout` (it predates
 * this lot) — so it cannot catch a regression where `/login` or
 * `/onboarding` accidentally gained a header, or `/`/`/analytics` lost one.
 * This file closes that gap. If `router.tsx`'s nesting ever changes, this
 * route table (necessarily hand-mirrored, `createBrowserRouter`'s output
 * can't be driven with `initialEntries`) should be updated to match.
 *
 * The `<header>` landmark (`role="banner"`) is used as the presence/absence
 * marker rather than header text content, because `OnboardingPage` renders
 * its own "RushHours" (`app.title`) heading independently of the header.
 *
 * Traceability (spec statement -> test(s)):
 * - "présent sur toutes les vues protégées" (`/` and `/analytics`) ->
 *   "the header renders for / and /analytics"
 * - "toutes les routes sauf /login sont protégées" + header only on
 *   protected *AppLayout* views, not the guard's other protected route
 *   (/onboarding) -> "the header does not render for /onboarding"
 * - implicit: /login is unprotected and also header-less -> "the header
 *   does not render for /login"
 */

vi.mock("../auth/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("../api/users", () => ({
  getWorkSchedule: vi.fn(),
  putWorkSchedule: vi.fn(),
  updateProfile: vi.fn(),
}));

const onboardedUser: AuthUser = {
  id: "u1",
  username: "user",
  role: "USER",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
};

const notYetOnboardedUser: AuthUser = {
  ...onboardedUser,
  onboardingCompletedAt: null,
};

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await new Promise<void>((resolve) => {
      i18n.on("initialized", () => resolve());
    });
  }
});

// Mirrors `apps/web/src/router.tsx` exactly: `/login` outside the guard,
// `/onboarding` inside the guard but outside `AppLayout`, `/` and
// `/analytics` inside both.
const routes = [
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: "/onboarding", element: <OnboardingPage /> },
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <TimeEntryPage /> },
          { path: "/analytics", element: <AnalyticsPage /> },
        ],
      },
    ],
  },
];

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <PrimeReactProvider>
      <RouterProvider router={router} />
    </PrimeReactProvider>,
  );
  return router;
}

describe("AppLayout placement (spec §7.1/§7)", () => {
  test("the header does not render for /login, even without an authenticated session", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "unauthenticated",
      user: null,
      refresh: vi.fn(),
      logout: vi.fn(),
    });

    renderAt("/login");

    expect(screen.getByRole("heading", { name: /login/i })).toBeDefined();
    expect(screen.queryByRole("banner")).toBeNull();
  });

  test("the header does not render for /onboarding, for an authenticated user who hasn't completed onboarding", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      user: notYetOnboardedUser,
      refresh: vi.fn(),
      logout: vi.fn(),
    });

    renderAt("/onboarding");

    // Onboarding step 1's profile form, proving the real page rendered.
    expect(screen.getByLabelText("First name")).toBeDefined();
    expect(screen.queryByRole("banner")).toBeNull();
  });

  test("the header renders for / (Vue Saisie), for an authenticated, onboarded user", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      user: onboardedUser,
      refresh: vi.fn(),
      logout: vi.fn(),
    });

    renderAt("/");

    expect(screen.getByRole("heading", { name: /time entry/i })).toBeDefined();
    expect(screen.getByRole("banner")).toBeDefined();
  });

  test("the header renders for /analytics, for an authenticated, onboarded user", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      user: onboardedUser,
      refresh: vi.fn(),
      logout: vi.fn(),
    });

    renderAt("/analytics");

    expect(screen.getByRole("heading", { name: /analytics/i })).toBeDefined();
    expect(screen.getByRole("banner")).toBeDefined();
  });
});
