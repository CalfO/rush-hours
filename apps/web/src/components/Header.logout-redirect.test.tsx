import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import type { AuthUser } from "../api/auth";
import i18n from "../i18n/config";

/**
 * Spec §7.1 — "'Déconnexion' -> POST /auth/logout", combined with §7's
 * "toutes les routes sauf /login sont protégées (redirection vers /login
 * si GET /auth/me renvoie 401)": after logout, the app must actually land
 * back on /login, not just have called the endpoint. This exercises the
 * real `App` (real `AuthProvider`, real `router`, real `RequireAuth`) with
 * only `fetch` stubbed — the same idiom `App.test.tsx` uses for the
 * equivalent "real request/redirect chain" assertion, so the
 * unauthenticated-redirect behavior triggered by `AuthProvider.logout()`
 * setting `status: "unauthenticated"` is proven end-to-end rather than
 * mocked away.
 *
 * `Header.test.tsx` covers the unit-level, unambiguous part of the same
 * requirement (clicking "Log out" calls `useAuth().logout()`) with
 * `useAuth` mocked; this file is the complementary full-chain check.
 */
const authenticatedOnboardedUser: AuthUser = {
  id: "u1",
  username: "user",
  role: "USER",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await new Promise<void>((resolve) => {
      i18n.on("initialized", () => resolve());
    });
  }
});

beforeEach(() => {
  fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url.includes("/auth/logout")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });
    }
    if (url.includes("/auth/me")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(authenticatedOnboardedUser),
      });
    }
    return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("clicking Log out calls POST /auth/logout and redirects to /login", async () => {
  render(<App />);

  await screen.findByRole("heading", { name: /time entry/i });
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: "AL" }));
  await user.click(await screen.findByRole("menuitem", { name: "Log out" }));

  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/logout"),
      expect.objectContaining({ method: "POST" }),
    ),
  );
  expect(await screen.findByRole("heading", { name: /login/i })).toBeDefined();
});
