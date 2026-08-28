import { expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthProvider";
import * as authApi from "../api/auth";
import { ApiError } from "../api/client";

/**
 * Spec §7's guard rule ("redirection vers /login si GET /auth/me renvoie
 * 401") starts here: an anonymous visitor's session check fails, and that
 * must resolve to a plain `"unauthenticated"` state — not an uncaught
 * rejection that would crash the app before `RequireAuth` ever gets a
 * chance to redirect. See its own file (fresh module registry, see the
 * comment in `AuthProvider.boot-success.test.tsx` for why boot scenarios
 * each need isolation from `hasBooted`).
 */
vi.mock("../api/auth", async () => {
  const actual =
    await vi.importActual<typeof import("../api/auth")>("../api/auth");
  return { ...actual, getMe: vi.fn() };
});

function Probe() {
  const { status, user } = useAuth();
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="username">{user?.username ?? ""}</p>
    </div>
  );
}

test("a failed GET /auth/me (401) on boot resolves to status=unauthenticated without throwing", async () => {
  vi.mocked(authApi.getMe).mockRejectedValue(new ApiError(401, "Unauthorized"));

  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

  await waitFor(() =>
    expect(screen.getByTestId("status").textContent).toBe("unauthenticated"),
  );
  expect(screen.getByTestId("username").textContent).toBe("");
});
