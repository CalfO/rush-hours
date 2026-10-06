import { StrictMode } from "react";
import { expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthProvider";
import * as authApi from "../api/auth";
import type { AuthUser } from "../api/auth";

/**
 * `AuthProvider` boots by calling `GET /auth/me` exactly once per page
 * load. Guarded by a module-level `hasBooted` flag (see the comment in
 * `AuthProvider.tsx`), specifically to survive `React.StrictMode`'s
 * double-invoke of effects in development (the real app renders
 * `<App/>` inside `<StrictMode>` in `src/index.tsx`) — a regression here
 * would silently double-fire the session check. This test therefore
 * mounts under `<StrictMode>`, matching production, rather than a plain
 * mount: that's the scenario the guard exists for.
 *
 * This file gets its own module registry (vitest isolates per test file),
 * so it's the only place this exact "successful boot" scenario is
 * exercised — `AuthProvider`'s `hasBooted` flag is a real module-level
 * singleton and only starts `false` on a file's first `AuthProvider`
 * mount; see `AuthProvider.boot-failure.test.tsx` and `AuthProvider.test.tsx`
 * for why the other boot/refresh/logout scenarios each need their own
 * file or their own non-boot trigger.
 */
vi.mock("../api/auth", async () => {
  const actual =
    await vi.importActual<typeof import("../api/auth")>("../api/auth");
  return { ...actual, getMe: vi.fn() };
});

const sampleUser: AuthUser = {
  id: "u1",
  username: "user",
  role: "USER",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  onboardingCompletedAt: null,
};

function Probe() {
  const { status, user } = useAuth();
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="username">{user?.username ?? ""}</p>
    </div>
  );
}

test("a successful GET /auth/me on boot sets status=authenticated with the fetched user, calling getMe exactly once despite StrictMode's double-invoke", async () => {
  vi.mocked(authApi.getMe).mockResolvedValue(sampleUser);

  render(
    <StrictMode>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </StrictMode>,
  );

  await waitFor(() =>
    expect(screen.getByTestId("status").textContent).toBe("authenticated"),
  );
  expect(screen.getByTestId("username").textContent).toBe("user");
  expect(authApi.getMe).toHaveBeenCalledTimes(1);
});
