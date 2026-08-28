import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";
import type { AuthUser } from "./api/auth";

/**
 * Spec §7 (lines 273-282): "/" is the Vue Saisie, and (last line) "Toutes
 * les routes sauf /login sont protégées (redirection vers /login si
 * `GET /auth/me` renvoie 401)". Post Front-Auth-lot, reaching TimeEntryPage
 * at "/" requires a real, successful session check with a completed
 * onboarding — this replaces the pre-auth version of this test, which
 * rendered <App/> with no session concept at all and asserted the heading
 * appeared immediately.
 *
 * The other branches of that same spec line are covered elsewhere, closer
 * to where they're actually decided, rather than duplicated here:
 * - a failed `GET /auth/me` resolving to `status: "unauthenticated"`
 *   without throwing: `src/auth/AuthProvider.boot-failure.test.tsx`.
 * - `"unauthenticated"` driving a redirect to `/login`, and the
 *   onboarding-incomplete branch driving a redirect to `/onboarding`:
 *   `src/auth/RequireAuth.test.tsx`.
 * Together with this test (the successful, fully-onboarded happy path
 * through the real `AuthProvider` + real `router` + real `RequireAuth`),
 * that's the full real request/redirect chain described by §7.
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

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(authenticatedOnboardedUser),
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("an authenticated user with a completed onboarding sees the time entry page at /", async () => {
  render(<App />);

  const heading = await screen.findByRole("heading", { name: /time entry/i });
  expect(heading).toBeDefined();
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("/auth/me"),
    expect.anything(),
  );
});
