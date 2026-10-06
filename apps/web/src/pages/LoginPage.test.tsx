import { beforeAll, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { PrimeReactProvider } from "@primereact/core";
import LoginPage from "./LoginPage";
import { useAuth } from "../auth/AuthProvider";
import {
  getLoginOptions,
  getRegistrationOptions,
  verifyLogin,
  verifyRegistration,
} from "../api/auth";
import type { AuthUser } from "../api/auth";
import { ApiError } from "../api/client";
import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import i18n from "../i18n/config";

/**
 * Spec §5.3 (rushhours-full-spec.md lines 225-229): the login screen tries
 * `login/options` first; a 404 (no credential yet) offers the registration
 * ceremony instead; after either ceremony succeeds, the redirect target
 * depends on `onboardingCompletedAt`. `@simplewebauthn/browser` and
 * `../api/auth` are mocked — no real WebAuthn ceremony or network call
 * happens; `useAuth` is mocked to control what `refresh()` (called right
 * after a successful `verify*` call, per `LoginPage.tsx`) resolves to.
 */
vi.mock("@simplewebauthn/browser", () => ({
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
}));
vi.mock("../api/auth", () => ({
  getLoginOptions: vi.fn(),
  verifyLogin: vi.fn(),
  getRegistrationOptions: vi.fn(),
  verifyRegistration: vi.fn(),
}));
vi.mock("../auth/AuthProvider", () => ({ useAuth: vi.fn() }));

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

function renderLoginPage() {
  const routes = [
    { path: "/login", element: <LoginPage /> },
    { path: "/", element: <div>home-page</div> },
    { path: "/onboarding", element: <div>onboarding-page</div> },
  ];
  const router = createMemoryRouter(routes, { initialEntries: ["/login"] });
  render(
    <PrimeReactProvider>
      <RouterProvider router={router} />
    </PrimeReactProvider>,
  );
  return router;
}

async function fillAndSubmit(username: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/username/i), username);
  await user.click(screen.getByRole("button", { name: /continue/i }));
  return user;
}

describe("LoginPage (spec §5.3)", () => {
  beforeAll(async () => {
    if (!i18n.isInitialized) {
      await new Promise<void>((resolve) => {
        i18n.on("initialized", () => resolve());
      });
    }
  });

  test("a username with an existing credential authenticates via startAuthentication and redirects to / when onboarding is complete", async () => {
    const refresh = vi.fn().mockResolvedValue(onboardedUser);
    vi.mocked(useAuth).mockReturnValue({
      status: "unauthenticated",
      user: null,
      refresh,
      logout: vi.fn(),
    });
    vi.mocked(getLoginOptions).mockResolvedValue({
      challenge: "chal",
    });
    vi.mocked(startAuthentication).mockResolvedValue(
      {} as Awaited<ReturnType<typeof startAuthentication>>,
    );
    vi.mocked(verifyLogin).mockResolvedValue({ verified: true });

    renderLoginPage();
    await fillAndSubmit("user");

    expect(await screen.findByText("home-page")).toBeDefined();
    expect(getLoginOptions).toHaveBeenCalledWith("user");
    expect(startAuthentication).toHaveBeenCalled();
    expect(verifyLogin).toHaveBeenCalledWith("user", {});
  });

  test("redirects to /onboarding instead of / when the authenticated user hasn't completed onboarding", async () => {
    const refresh = vi.fn().mockResolvedValue(notYetOnboardedUser);
    vi.mocked(useAuth).mockReturnValue({
      status: "unauthenticated",
      user: null,
      refresh,
      logout: vi.fn(),
    });
    vi.mocked(getLoginOptions).mockResolvedValue(
      {} as Awaited<ReturnType<typeof getLoginOptions>>,
    );
    vi.mocked(startAuthentication).mockResolvedValue(
      {} as Awaited<ReturnType<typeof startAuthentication>>,
    );
    vi.mocked(verifyLogin).mockResolvedValue({ verified: true });

    renderLoginPage();
    await fillAndSubmit("user");

    expect(await screen.findByText("onboarding-page")).toBeDefined();
  });

  test("a username with no enrolled credential (404) offers registration; completing it authenticates the same way", async () => {
    const refresh = vi.fn().mockResolvedValue(onboardedUser);
    vi.mocked(useAuth).mockReturnValue({
      status: "unauthenticated",
      user: null,
      refresh,
      logout: vi.fn(),
    });
    vi.mocked(getLoginOptions).mockRejectedValue(
      new ApiError(404, "No credential"),
    );
    vi.mocked(getRegistrationOptions).mockResolvedValue(
      {} as Awaited<ReturnType<typeof getRegistrationOptions>>,
    );
    vi.mocked(startRegistration).mockResolvedValue(
      {} as Awaited<ReturnType<typeof startRegistration>>,
    );
    vi.mocked(verifyRegistration).mockResolvedValue({ verified: true });

    renderLoginPage();
    const user = await fillAndSubmit("newuser");

    const registerButton = await screen.findByRole("button", {
      name: /create your passkey/i,
    });
    await user.click(registerButton);

    expect(await screen.findByText("home-page")).toBeDefined();
    expect(getRegistrationOptions).toHaveBeenCalledWith("newuser");
    expect(startRegistration).toHaveBeenCalled();
    expect(verifyRegistration).toHaveBeenCalledWith("newuser", {});
  });

  test("a cancelled/rejected WebAuthn ceremony shows a generic error instead of crashing", async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "unauthenticated",
      user: null,
      refresh: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(getLoginOptions).mockResolvedValue(
      {} as Awaited<ReturnType<typeof getLoginOptions>>,
    );
    vi.mocked(startAuthentication).mockRejectedValue(
      new Error(
        "NotAllowedError: The operation either timed out or was not allowed",
      ),
    );

    renderLoginPage();
    await fillAndSubmit("user");

    expect(await screen.findByText(/cancelled or failed/i)).toBeDefined();
    // Still on the login screen, not crashed into React Router's default
    // error boundary and not silently redirected anywhere.
    expect(screen.queryByText("home-page")).toBeNull();
    expect(screen.getByRole("heading", { name: /login/i })).toBeDefined();
  });

  test("a non-404 error from login/options shows a generic error rather than offering registration", async () => {
    vi.mocked(useAuth).mockReturnValue({
      status: "unauthenticated",
      user: null,
      refresh: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(getLoginOptions).mockRejectedValue(
      new ApiError(500, "Internal error"),
    );

    renderLoginPage();
    await fillAndSubmit("user");

    expect(await screen.findByText(/something went wrong/i)).toBeDefined();
    expect(
      screen.queryByRole("button", { name: /create your passkey/i }),
    ).toBeNull();
  });
});
