import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { PrimeReactProvider } from "@primereact/core";
import type { WorkScheduleInput } from "@rushhours/domain";
import AppLayout from "./AppLayout";
import { useAuth } from "../auth/AuthProvider";
import { getWorkSchedule, putWorkSchedule, updateProfile } from "../api/users";
import { getReferenceWeek, deleteReferenceWeek } from "../api/reference-week";
import type { AuthUser } from "../api/auth";
import i18n from "../i18n/config";

/**
 * Spec §7.1 (rushhours-full-spec.md lines 284-293) — the sticky app header,
 * mounted via `AppLayout` (`Header` itself needs router + auth context to
 * render at all, so it's exercised through its real mount point rather than
 * in isolation). `useAuth` and `../api/users` are mocked — no real network
 * call happens. `ProfileModal`/`WorkScheduleModal` are the *real* components
 * (not mocked): opening them from the header and asserting their title text
 * is what proves the header's menu is wired to the right modal, not just
 * that it calls some `setState`.
 *
 * The end-to-end "Déconnexion -> POST /auth/logout -> redirected to
 * /login" chain (real `AuthProvider` + real router + stubbed `fetch`) is
 * covered separately in `Header.logout-redirect.test.tsx`, following the
 * same real-App idiom as `App.test.tsx`/`RequireAuth`-adjacent tests. This
 * file's logout test only asserts the unit-level, unambiguous part of that
 * requirement: clicking "Log out" calls the auth logout path.
 *
 * The "header absent on /login and /onboarding" part of "présent sur
 * toutes les vues protégées" is covered in `AppLayout.test.tsx`, which pins
 * where in the route tree `AppLayout` (and therefore `Header`) sits,
 * mirroring `apps/web/src/router.tsx`'s actual nesting.
 *
 * Traceability (spec statement -> test(s)):
 * - "Logo / titre 'RushHours'" -> "renders the title, both nav tabs, the
 *   language selector, and an avatar trigger for an authenticated user"
 * - "Navigation ... 'Saisie' / 'Analyses'" (routed tabs) -> same test (both
 *   tabs render) + "clicking a nav tab navigates to the corresponding
 *   route" (actually exercises navigation, not just the tab's value prop)
 * - "Sélecteur de langue ... liste des langues i18next configurées
 *   (FR/EN minimum)" -> "renders the title..." (selector present with FR/EN
 *   options) + "changing the language selector updates the rendered UI
 *   language via the real i18next instance"
 * - "Bouton avatar ... ouvre un menu" -> "renders the title..." (trigger
 *   present) + the three menu-item tests below (each opens the menu first)
 * - "'Mon profil' -> modal formulaire nom/prénom/email" -> 'clicking "My
 *   profile" in the avatar menu opens ProfileModal'
 * - "'Ma semaine de travail' -> réutilise la modal indépendante du §5.5" ->
 *   'clicking "My work week" in the avatar menu opens WorkScheduleModal'
 * - "'Déconnexion' -> POST /auth/logout" -> 'clicking "Log out" calls the
 *   auth logout path' (unit-level part; see `Header.logout-redirect.test.tsx`
 *   for the redirect-to-/login part of the same requirement)
 */

vi.mock("../auth/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("../api/users", () => ({
  getWorkSchedule: vi.fn(),
  putWorkSchedule: vi.fn(),
  updateProfile: vi.fn(),
}));
// `Header` is mounted here via the real `AppLayout` (see `renderHeader`
// below), which now fetches the reference-week state on mount (spec
// §5.6/§5.7) — mocked so this file's own header-focused assertions don't
// depend on a real network call.
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

const defaultWorkSchedule: WorkScheduleInput = {
  weeklyContractHours: 35,
  weekStartDay: "MONDAY",
  days: [],
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
  vi.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    user: authenticatedUser,
    refresh: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
  });
  vi.mocked(getWorkSchedule).mockResolvedValue(defaultWorkSchedule);
  vi.mocked(getReferenceWeek).mockResolvedValue({ exists: false, days: [] });
});

afterEach(async () => {
  // The language test drives the *real* i18next singleton — reset it so a
  // later test (in this file or, if the module registry is ever shared,
  // another) doesn't inherit a non-default language.
  if (i18n.language !== "en") {
    await i18n.changeLanguage("en");
  }
});

/**
 * `AppLayout` (Header + `<Outlet/>`) mounted at "/" and "/analytics" behind
 * a memory router, with lightweight stand-in route elements — the same
 * "real header/layout, stand-in pages" idiom `RequireAuth.test.tsx` uses,
 * since the point here is the header's own behavior, not the real page
 * content (that's `router.tsx`'s / `AppLayout.test.tsx`'s job).
 */
function renderHeader(initialPath = "/") {
  const routes = [
    {
      element: <AppLayout />,
      children: [
        { path: "/", element: <div>saisie-route-content</div> },
        { path: "/analytics", element: <div>analytics-route-content</div> },
      ],
    },
  ];
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  render(
    <PrimeReactProvider>
      <RouterProvider router={router} />
    </PrimeReactProvider>,
  );
  return router;
}

async function openAvatarMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "AL" }));
}

describe("Header (spec §7.1)", () => {
  test("renders the title, both nav tabs, the language selector (with flags), and an avatar trigger for an authenticated user", async () => {
    renderHeader();
    const user = userEvent.setup();

    expect(screen.getByText("RushHours")).toBeDefined();
    expect(screen.getByRole("tab", { name: "Time entry" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "Analytics" })).toBeDefined();

    const languageSelect = screen.getByRole("combobox", { name: "Language" });
    expect(languageSelect).toBeDefined();

    await user.click(languageSelect);
    const frOption = screen.getByRole("option", { name: "FR" });
    const enOption = screen.getByRole("option", { name: "EN" });
    expect(frOption).toBeDefined();
    expect(enOption).toBeDefined();
    // The accessible name deliberately excludes the flag (aria-hidden, it's
    // decorative) -- assert it's actually rendered as visible content too.
    expect(within(frOption).getByText("🇫🇷")).toBeDefined();
    expect(within(enOption).getByText("🇬🇧")).toBeDefined();

    // Avatar initials derived from the authenticated user (Ada Lovelace).
    expect(screen.getByRole("button", { name: "AL" })).toBeDefined();
  });

  test("clicking a nav tab navigates to the corresponding route", async () => {
    const router = renderHeader("/");
    const user = userEvent.setup();

    expect(screen.getByText("saisie-route-content")).toBeDefined();
    expect(screen.queryByText("analytics-route-content")).toBeNull();

    await user.click(screen.getByRole("tab", { name: "Analytics" }));

    expect(await screen.findByText("analytics-route-content")).toBeDefined();
    expect(screen.queryByText("saisie-route-content")).toBeNull();
    expect(router.state.location.pathname).toBe("/analytics");

    await user.click(screen.getByRole("tab", { name: "Time entry" }));

    expect(await screen.findByText("saisie-route-content")).toBeDefined();
    expect(router.state.location.pathname).toBe("/");
  });

  test("changing the language selector updates the rendered UI language via the real i18next instance", async () => {
    renderHeader();
    const user = userEvent.setup();

    expect(screen.getByRole("tab", { name: "Time entry" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "Analytics" })).toBeDefined();

    await user.click(screen.getByRole("combobox", { name: "Language" }));
    await user.click(screen.getByRole("option", { name: "FR" }));

    // Driven through the real i18next singleton (not a mock): selecting
    // "FR" flips `i18n.language` to "fr", which every `useTranslation()`
    // consumer (the nav tabs, the language selector's own aria-label)
    // re-renders against — this is the "met à jour la langue" part of the
    // spec observed the way an actual user would see it.
    expect(i18n.language).toBe("fr");
    expect(await screen.findByRole("tab", { name: "Saisie" })).toBeDefined();
    expect(await screen.findByRole("tab", { name: "Analyses" })).toBeDefined();
    expect(screen.getByRole("combobox", { name: "Langue" })).toBeDefined();

    // Switching back to English confirms this is a live, two-way selector
    // reacting to `onValueChange`, not a one-shot effect.
    await user.click(screen.getByRole("combobox", { name: "Langue" }));
    await user.click(screen.getByRole("option", { name: "EN" }));

    expect(i18n.language).toBe("en");
    expect(
      await screen.findByRole("tab", { name: "Time entry" }),
    ).toBeDefined();
  });

  test('clicking "My profile" in the avatar menu opens ProfileModal', async () => {
    renderHeader();
    const user = userEvent.setup();

    await openAvatarMenu(user);
    await user.click(
      await screen.findByRole("menuitem", { name: "My profile" }),
    );

    expect(await screen.findByText("My profile")).toBeDefined();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  test('clicking "My work week" in the avatar menu opens WorkScheduleModal', async () => {
    renderHeader();
    const user = userEvent.setup();

    await openAvatarMenu(user);
    await user.click(
      await screen.findByRole("menuitem", { name: "My work week" }),
    );

    expect(await screen.findByText("My work week")).toBeDefined();
    // The real WorkScheduleModal/Form fetches its data through the mocked
    // `getWorkSchedule` — its arrival is the proof this is the actual §5.5
    // modal, not an unrelated placeholder that merely echoes the title.
    expect(await screen.findByText("Weekly contract hours")).toBeDefined();
    expect(putWorkSchedule).not.toHaveBeenCalled();
  });

  test('clicking "Log out" in the avatar menu calls the auth logout path', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      user: authenticatedUser,
      refresh: vi.fn(),
      logout,
    });
    renderHeader();
    const user = userEvent.setup();

    await openAvatarMenu(user);
    await user.click(await screen.findByRole("menuitem", { name: "Log out" }));

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  });

  /**
   * Spec §5.6 — "Supprimer la semaine de référence" menu item.
   *
   * Traceability:
   * - "Visible uniquement si une semaine de référence existe ... le
   *   masquer plutôt que le désactiver s'il n'y en a pas" -> "the delete
   *   reference week menu item is absent (not merely disabled) when no
   *   reference week exists, and present when one does"
   * - "Au clic -> ConfirmDialog ... -> DELETE ... -> rafraîchir l'état
   *   exists (et masquer l'item)" -> "confirming deletion calls DELETE
   *   /users/me/reference-week, refreshes the shared state, and the menu
   *   item disappears immediately"
   */
  test("the delete reference week menu item is absent (not merely disabled) when no reference week exists", async () => {
    vi.mocked(getReferenceWeek).mockResolvedValue({ exists: false, days: [] });
    renderHeader();
    const user = userEvent.setup();

    await openAvatarMenu(user);
    // Give the fetch-once effect a turn to resolve before asserting
    // absence, so this isn't just "hasn't rendered yet".
    await screen.findByRole("menuitem", { name: "My profile" });
    expect(
      screen.queryByRole("menuitem", { name: "Delete reference week" }),
    ).toBeNull();
    expect(screen.queryByText("Delete reference week")).toBeNull();
  });

  test("the delete reference week menu item is present once a reference week exists", async () => {
    vi.mocked(getReferenceWeek).mockResolvedValue({ exists: true, days: [] });
    renderHeader();
    const user = userEvent.setup();

    await openAvatarMenu(user);
    expect(
      await screen.findByRole("menuitem", { name: "Delete reference week" }),
    ).toBeDefined();
  });

  test("confirming deletion from the menu calls DELETE, refreshes the shared state, and the menu item disappears without a page reload", async () => {
    vi.mocked(getReferenceWeek)
      .mockResolvedValueOnce({ exists: true, days: [] }) // AppLayout's initial fetch
      .mockResolvedValueOnce({ exists: false, days: [] }); // refreshReferenceWeek() after delete
    vi.mocked(deleteReferenceWeek).mockResolvedValue({ success: true });
    renderHeader();
    const user = userEvent.setup();

    await openAvatarMenu(user);
    await user.click(
      await screen.findByRole("menuitem", {
        name: "Delete reference week",
      }),
    );

    // The shared `ConfirmDialog` (spec §5.5/§5.6, same component as the
    // save-prompt) opens with the deletion-specific copy.
    expect(await screen.findByText("Delete the reference week?")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(deleteReferenceWeek).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getReferenceWeek).toHaveBeenCalledTimes(2));

    // The item disappears immediately, in this same render tree (no
    // navigation/reload happened) -- re-opening the still-mounted menu no
    // longer shows it.
    await openAvatarMenu(user);
    await waitFor(() =>
      expect(
        screen.queryByRole("menuitem", { name: "Delete reference week" }),
      ).toBeNull(),
    );
  });
});
