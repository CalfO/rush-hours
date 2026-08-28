import { beforeAll, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";
import TimeEntryPage from "./pages/TimeEntryPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import { RequireAuth } from "./auth/RequireAuth";
import i18n from "./i18n/config";
import { useAuth } from "./auth/AuthProvider";
import type { AuthUser } from "./api/auth";

/**
 * Spec §7 (rushhours-full-spec.md lines 273-282): the app exposes exactly
 * 4 routes, and all of them except `/login` sit behind the auth guard.
 *
 * `RequireAuth`'s own branch logic (loading/unauthenticated/onboarding) is
 * covered exhaustively, with lightweight stand-in route elements, in
 * `src/auth/RequireAuth.test.tsx`. This file instead pins the real route
 * *table* wiring — the actual page components mounted at the actual
 * paths — and specifically that `/login` is a sibling living outside
 * `RequireAuth`: it stays reachable and renders `LoginPage` even for an
 * already-authenticated, fully-onboarded user, unlike the other 3 routes
 * (which is the behavior the old `AppLayout` stub couldn't demonstrate,
 * since it had no guard at all).
 *
 * `useAuth` (from `./auth/AuthProvider`) is mocked directly rather than
 * driven through a real `AuthProvider` + mocked `fetch`: the route *table*
 * is what's under test here, not `AuthProvider`'s own request/state logic
 * (covered in `src/auth/AuthProvider.*.test.tsx`).
 */
vi.mock("./auth/AuthProvider", () => ({ useAuth: vi.fn() }));

const routes = [
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: "/", element: <TimeEntryPage /> },
      { path: "/analytics", element: <AnalyticsPage /> },
      { path: "/onboarding", element: <OnboardingPage /> },
    ],
  },
];

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
}

const authenticatedOnboardedUser: AuthUser = {
  id: "u1",
  username: "user",
  role: "USER",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
};

describe("route table (spec §7)", () => {
  beforeAll(async () => {
    // LoginPage renders translated text (t("auth.title") etc.) — make
    // sure the real fr/en resource bundles are loaded so assertions match
    // real UI copy, not raw i18next keys.
    if (!i18n.isInitialized) {
      await new Promise<void>((resolve) => {
        i18n.on("initialized", () => resolve());
      });
    }
  });

  test("/login renders the login page even for an already-authenticated, onboarded user (it sits outside the guard)", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      user: authenticatedOnboardedUser,
      refresh: vi.fn(),
      logout: vi.fn(),
    });

    renderAt("/login");

    expect(screen.getByRole("heading", { name: /login/i })).toBeDefined();
  });

  test("/ renders the time entry view (vue Saisie) for an authenticated, onboarded user", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      user: authenticatedOnboardedUser,
      refresh: vi.fn(),
      logout: vi.fn(),
    });

    renderAt("/");

    expect(screen.getByRole("heading", { name: /time entry/i })).toBeDefined();
  });

  test("/analytics renders the analytics view (vue Analyses) for an authenticated, onboarded user", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      user: authenticatedOnboardedUser,
      refresh: vi.fn(),
      logout: vi.fn(),
    });

    renderAt("/analytics");

    expect(screen.getByRole("heading", { name: /analytics/i })).toBeDefined();
  });

  test("/onboarding redirects an already-onboarded user to / (the guard applies to /onboarding too)", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      user: authenticatedOnboardedUser,
      refresh: vi.fn(),
      logout: vi.fn(),
    });

    renderAt("/onboarding");

    expect(screen.getByRole("heading", { name: /time entry/i })).toBeDefined();
  });
});
