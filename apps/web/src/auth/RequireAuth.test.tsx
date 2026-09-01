import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { RequireAuth } from "./RequireAuth";
import { useAuth } from "./AuthProvider";
import type { AuthUser } from "../api/auth";

/**
 * Spec §5.4 ("non contournable") + §7 (lines 273-282, in particular:
 * "/onboarding — ... garde de route si onboardingCompletedAt absent" and
 * "Toutes les routes sauf /login sont protégées"). Each branch of
 * `RequireAuth`'s logic is exercised directly against a mocked `useAuth`
 * (from `./AuthProvider`), with lightweight stand-in route elements
 * instead of the real pages — the real page table is separately pinned in
 * `src/router.test.tsx`; this file's job is purely the guard's decision
 * logic for every (status, onboarding, current path) combination described
 * by the spec.
 */
vi.mock("./AuthProvider", () => ({ useAuth: vi.fn() }));

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

const routes = [
  { path: "/login", element: <div>login-page</div> },
  {
    element: <RequireAuth />,
    children: [
      { path: "/", element: <div>time-entry-page</div> },
      { path: "/onboarding", element: <div>onboarding-page</div> },
    ],
  },
];

function renderGuardAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe("RequireAuth", () => {
  test('status "loading" renders nothing (not the outlet, no redirect)', () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "loading",
      user: null,
      refresh: vi.fn(),
      logout: vi.fn(),
    });

    const router = renderGuardAt("/");

    expect(screen.queryByText("time-entry-page")).toBeNull();
    expect(screen.queryByText("login-page")).toBeNull();
    expect(screen.queryByText("onboarding-page")).toBeNull();
    expect(router.state.location.pathname).toBe("/");
  });

  test('status "unauthenticated" redirects to /login', async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "unauthenticated",
      user: null,
      refresh: vi.fn(),
      logout: vi.fn(),
    });

    renderGuardAt("/");

    expect(await screen.findByText("login-page")).toBeDefined();
  });

  test("authenticated + onboarding incomplete + on a route other than /onboarding redirects to /onboarding", async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      user: notYetOnboardedUser,
      refresh: vi.fn(),
      logout: vi.fn(),
    });

    renderGuardAt("/");

    expect(await screen.findByText("onboarding-page")).toBeDefined();
  });

  test("authenticated + onboarding incomplete + already on /onboarding renders the outlet (no redirect loop)", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      user: notYetOnboardedUser,
      refresh: vi.fn(),
      logout: vi.fn(),
    });

    const router = renderGuardAt("/onboarding");

    expect(screen.getByText("onboarding-page")).toBeDefined();
    expect(router.state.location.pathname).toBe("/onboarding");
  });

  test("authenticated + onboarding complete + on /onboarding redirects to /", async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      user: onboardedUser,
      refresh: vi.fn(),
      logout: vi.fn(),
    });

    renderGuardAt("/onboarding");

    expect(await screen.findByText("time-entry-page")).toBeDefined();
  });

  test("authenticated + onboarding complete + elsewhere renders the outlet", () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      user: onboardedUser,
      refresh: vi.fn(),
      logout: vi.fn(),
    });

    const router = renderGuardAt("/");

    expect(screen.getByText("time-entry-page")).toBeDefined();
    expect(router.state.location.pathname).toBe("/");
  });
});
