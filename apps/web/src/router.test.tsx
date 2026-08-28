import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, Outlet } from "react-router-dom";
import { describe, expect, test } from "vitest";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";
import TimeEntryPage from "./pages/TimeEntryPage";
import AnalyticsPage from "./pages/AnalyticsPage";

/**
 * Spec §7 (rushhours-full-spec.md lines 273-286): the app exposes exactly
 * 4 routes, and all of them except `/login` are meant to sit behind an
 * auth guard (not implemented yet — this lot only laid the pathless
 * layout groundwork for it, see `src/router.tsx`'s `AppLayout`).
 *
 * This mirrors the route tree declared in `src/router.tsx` rather than
 * rendering the exported `router` singleton directly: that singleton is
 * built with `createBrowserRouter`, which reads `window.location` once at
 * module-evaluation time, so it can't be pointed at a given path per test.
 * `createMemoryRouter` + `initialEntries` gives the same routing behavior
 * (same page components, same nesting under a pathless layout) while
 * letting each route be exercised in isolation. `App.test.tsx` separately
 * covers that the real singleton renders correctly at its default `/`
 * location.
 */
const routes = [
  { path: "/login", element: <LoginPage /> },
  {
    // Mirrors router.tsx's `AppLayout`, which today is only `<Outlet/>`
    // (step 7 swaps this for a real auth guard) — nothing behavior-wise
    // to isolate there yet beyond the nesting itself.
    element: <Outlet />,
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

describe("route table (spec §7)", () => {
  test("/login renders the login page", () => {
    renderAt("/login");
    expect(screen.getByRole("heading", { name: /login/i })).toBeDefined();
  });

  test("/ renders the time entry view (vue Saisie)", () => {
    renderAt("/");
    expect(screen.getByRole("heading", { name: /time entry/i })).toBeDefined();
  });

  test("/analytics renders the analytics view (vue Analyses)", () => {
    renderAt("/analytics");
    expect(screen.getByRole("heading", { name: /analytics/i })).toBeDefined();
  });

  test("/onboarding renders the onboarding page", () => {
    renderAt("/onboarding");
    expect(screen.getByRole("heading", { name: /onboarding/i })).toBeDefined();
  });
});
