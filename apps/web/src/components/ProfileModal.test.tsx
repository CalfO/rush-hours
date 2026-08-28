import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrimeReactProvider } from "@primereact/core";
import ProfileModal from "./ProfileModal";
import { useAuth } from "../auth/AuthProvider";
import { updateProfile } from "../api/users";
import type { AuthUser } from "../api/auth";
import i18n from "../i18n/config";

/**
 * Spec §7.1 — "Mon profil" settings modal: pre-fills from the authenticated
 * user, Save persists via `PATCH /users/me` and closes, Cancel/dismiss
 * discards without saving. `useAuth`/`../api/users` are mocked — no real
 * network call or `AuthProvider` boot sequence happens.
 *
 * Traceability (spec statement -> test(s)):
 * - "pré-remplie... nom/prénom/email" from the current profile -> "pre-fills
 *   the form fields from the authenticated user"
 * - "Save persists via PATCH /users/me" -> "Save calls updateProfile with
 *   the edited values, closes the modal, and reports the saved user"
 * - "Cancel/dismiss discards without saving" -> "Cancel closes the modal
 *   without calling updateProfile"
 */

vi.mock("../auth/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("../api/users", () => ({ updateProfile: vi.fn() }));

const authenticatedUser: AuthUser = {
  id: "u1",
  username: "user",
  role: "USER",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
};

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await new Promise<void>((resolve) => {
      i18n.on("initialized", () => resolve());
    });
  }
  // jsdom has no ResizeObserver; the underlying Dialog primitive's
  // positioner needs one (same stub as WorkScheduleModal.test.tsx).
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (
    globalThis as typeof globalThis & {
      ResizeObserver: typeof ResizeObserverStub;
    }
  ).ResizeObserver = ResizeObserverStub;
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    user: authenticatedUser,
    refresh: vi.fn(),
    logout: vi.fn(),
  });
});

function renderModal() {
  const onOpenChange = vi.fn();
  const onSaved = vi.fn();
  render(
    <PrimeReactProvider>
      <ProfileModal open onOpenChange={onOpenChange} onSaved={onSaved} />
    </PrimeReactProvider>,
  );
  return { onOpenChange, onSaved };
}

describe("ProfileModal (spec §7.1)", () => {
  test("pre-fills the form fields from the authenticated user", async () => {
    renderModal();

    expect(await screen.findByDisplayValue("Ada")).toBeDefined();
    expect(screen.getByDisplayValue("Lovelace")).toBeDefined();
    expect(screen.getByDisplayValue("ada@example.com")).toBeDefined();
  });

  test("Save calls updateProfile with the edited values, closes the modal, and reports the saved user", async () => {
    const savedUser: AuthUser = { ...authenticatedUser, firstName: "Grace" };
    vi.mocked(updateProfile).mockResolvedValue(savedUser);
    const { onOpenChange, onSaved } = renderModal();
    const user = userEvent.setup();

    const firstNameInput = await screen.findByDisplayValue("Ada");
    await user.clear(firstNameInput);
    await user.type(firstNameInput, "Grace");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await vi.waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
    expect(updateProfile).toHaveBeenCalledWith({
      firstName: "Grace",
      lastName: "Lovelace",
      email: "ada@example.com",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSaved).toHaveBeenCalledWith(savedUser);
  });

  test("Cancel closes the modal without calling updateProfile", async () => {
    const { onOpenChange, onSaved } = renderModal();
    const user = userEvent.setup();

    await screen.findByDisplayValue("Ada");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSaved).not.toHaveBeenCalled();
    expect(updateProfile).not.toHaveBeenCalled();
  });
});
