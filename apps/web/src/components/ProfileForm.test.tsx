import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrimeReactProvider } from "@primereact/core";
import type { ProfileInput } from "@rushhours/domain";
import { ProfileForm } from "./ProfileForm";
import { updateProfile } from "../api/users";
import type { AuthUser } from "../api/auth";
import { ApiError } from "../api/client";
import i18n from "../i18n/config";

/**
 * Spec §5.4 step 1 / §6 (`PATCH /users/me`) / §7.1 — the shared profile form
 * (firstName/lastName/email) used by both onboarding step 1 and the "Mon
 * profil" settings modal. `../api/users` is mocked — no real network call
 * happens.
 *
 * Traceability (spec statement -> test(s)):
 * - "Validation Zod" on the profile fields (firstName/lastName required,
 *   email must be valid) -> "rejects an empty firstName/lastName and an
 *   invalid email, without submitting"
 * - "soumission -> PATCH /users/me" (successful path) -> "a valid submit
 *   calls updateProfile with the form values and onSuccess with the saved
 *   user"
 * - submission failure must not silently succeed -> "a failed submit shows
 *   an error message and does not call onSuccess"
 * - Cancel is only offered where there is something to cancel back to
 *   (onboarding step 1 has "nothing to bypass to", the settings modal does)
 *   -> "renders a Cancel button only when onCancel is provided, and invokes
 *       it on click" + covered again at the OnboardingPage level
 *       (OnboardingPage.test.tsx).
 */

vi.mock("../api/users", () => ({
  updateProfile: vi.fn(),
}));

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await new Promise<void>((resolve) => {
      i18n.on("initialized", () => resolve());
    });
  }
});

beforeEach(() => {
  vi.clearAllMocks();
});

const defaultValues: ProfileInput = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
};

function renderForm(props?: { onCancel?: () => void }) {
  const onSuccess = vi.fn();
  const { container } = render(
    <PrimeReactProvider>
      <ProfileForm
        defaultValues={defaultValues}
        submitLabel="Save"
        onSuccess={onSuccess}
        onCancel={props?.onCancel}
      />
    </PrimeReactProvider>,
  );
  return { onSuccess, container };
}

const savedUser: AuthUser = {
  id: "u1",
  username: "user",
  role: "USER",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
};

/** The error paragraph is a sibling of the field within the same wrapper div. */
function fieldErrorText(fieldLabel: string): string | null {
  const input = screen.getByLabelText(fieldLabel);
  const wrapper = input.closest("div");
  const errorEl = wrapper?.querySelector("p.text-error-700");
  return errorEl?.textContent ?? null;
}

describe("ProfileForm (spec §5.4/§6/§7.1)", () => {
  test("rejects an empty firstName/lastName and an invalid email, without submitting", async () => {
    renderForm();
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText("First name"));
    await user.clear(screen.getByLabelText("Last name"));
    await user.clear(screen.getByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), "not-an-email");

    // A real `Save` click, not `fireEvent.submit`: the email field is a
    // native `<input type="email">`, which would otherwise let the browser's
    // own HTML5 constraint validation intercept the submit before Zod ever
    // runs. The form has `noValidate` specifically so this component's own
    // Zod-driven validation (spec: "Validation Zod") — and its translated
    // error message — is what the user actually sees. This click exercises
    // that real path end-to-end; it would fail again if `noValidate` were
    // ever dropped.
    await user.click(screen.getByRole("button", { name: "Save" }));

    await vi.waitFor(() => {
      expect(fieldErrorText("First name")).toBeTruthy();
      expect(fieldErrorText("Last name")).toBeTruthy();
      expect(fieldErrorText("Email")).toBeTruthy();
    });
    expect(updateProfile).not.toHaveBeenCalled();
  });

  test("a valid submit calls updateProfile with the form values and onSuccess with the saved user", async () => {
    vi.mocked(updateProfile).mockResolvedValue(savedUser);
    const { onSuccess } = renderForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await vi.waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
    expect(updateProfile).toHaveBeenCalledWith(defaultValues);
    expect(onSuccess).toHaveBeenCalledWith(savedUser);
  });

  test("a failed submit shows an error message and does not call onSuccess", async () => {
    vi.mocked(updateProfile).mockRejectedValue(
      new ApiError(500, "Internal error"),
    );
    const { onSuccess } = renderForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Couldn't save your profile. Please try again."),
    ).toBeDefined();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  test("renders no Cancel button when onCancel is not provided", () => {
    renderForm();

    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  test("renders a Cancel button when onCancel is provided, and invokes it on click", async () => {
    const onCancel = vi.fn();
    renderForm({ onCancel });
    const user = userEvent.setup();

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(updateProfile).not.toHaveBeenCalled();
  });
});
