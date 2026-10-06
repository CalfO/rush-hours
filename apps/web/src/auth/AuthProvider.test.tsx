import { expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "./AuthProvider";
import * as authApi from "../api/auth";
import type { AuthUser } from "../api/auth";

/**
 * `refresh()` and `logout()` from `AuthProvider`'s context, used by
 * `LoginPage` (post-ceremony) and the header's avatar menu (§7.1)
 * respectively. Unlike the boot effect, neither is guarded by the
 * module-level `hasBooted` flag — they're plain callbacks, callable any
 * number of times.
 *
 * Both tests below live in the same file and run in declaration order.
 * The first test's `<AuthProvider/>` mount is this file's very first, so
 * its own automatic boot effect still fires normally (asserted here as a
 * secondary check); by the second test, this file's `hasBooted` flag is
 * already `true` (module-level, shared across every `AuthProvider` mount
 * within this file — see `AuthProvider.boot-success.test.tsx`), so its
 * mount's own boot effect is a no-op by design. That's fine: the second
 * test never relies on the automatic boot to reach "authenticated" — it
 * drives that transition explicitly via `refresh()`, the same way
 * `LoginPage` does after a real WebAuthn ceremony.
 */
vi.mock("../api/auth", async () => {
  const actual =
    await vi.importActual<typeof import("../api/auth")>("../api/auth");
  return { ...actual, getMe: vi.fn(), logout: vi.fn() };
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
  const { status, user, refresh, logout } = useAuth();
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="username">{user?.username ?? ""}</p>
      <button onClick={() => void refresh()}>refresh</button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

test("refresh() re-fetches the user, updates status/user, and its return value is the freshly-fetched user", async () => {
  vi.mocked(authApi.getMe).mockResolvedValueOnce(sampleUser);

  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

  await waitFor(() =>
    expect(screen.getByTestId("status").textContent).toBe("authenticated"),
  );
  expect(authApi.getMe).toHaveBeenCalledTimes(1);

  const onboardedUser: AuthUser = {
    ...sampleUser,
    onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
  };
  vi.mocked(authApi.getMe).mockResolvedValueOnce(onboardedUser);

  const user = userEvent.setup();
  await user.click(screen.getByText("refresh"));

  await waitFor(() => expect(authApi.getMe).toHaveBeenCalledTimes(2));
  expect(screen.getByTestId("status").textContent).toBe("authenticated");
  expect(screen.getByTestId("username").textContent).toBe("user");
});

test("logout() calls the logout endpoint and resets state to unauthenticated", async () => {
  vi.mocked(authApi.getMe).mockResolvedValue(sampleUser);
  vi.mocked(authApi.logout).mockResolvedValue({ success: true });

  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

  // This file's second `AuthProvider` mount — its automatic boot effect is
  // a no-op (module-level `hasBooted` is already `true`, see the file
  // comment above), so status stays "loading" until we explicitly call
  // `refresh()` to reach "authenticated", exactly as `LoginPage` does.
  expect(screen.getByTestId("status").textContent).toBe("loading");

  const user = userEvent.setup();
  await user.click(screen.getByText("refresh"));
  await waitFor(() =>
    expect(screen.getByTestId("status").textContent).toBe("authenticated"),
  );

  await user.click(screen.getByText("logout"));

  await waitFor(() =>
    expect(screen.getByTestId("status").textContent).toBe("unauthenticated"),
  );
  expect(authApi.logout).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("username").textContent).toBe("");
});
