import { expect, test } from "@playwright/test";
import {
  addVirtualAuthenticator,
  completeOnboarding,
  registerPasskey,
} from "./helpers/auth";
import { resetAccount } from "./helpers/db";

/**
 * Smoke test for the whole auth chain: WebAuthn passkey enrollment (the
 * only account-creation path in this app, spec §5.1) through both
 * onboarding steps to the main app shell. Fast and independent of the
 * heavier day-entry/reference-week specs — a canary that catches an auth
 * regression without waiting on the rest of the suite.
 */
test("registers a passkey, completes onboarding, and reaches the Time Entry view", async ({
  page,
}) => {
  await resetAccount("admin");
  await addVirtualAuthenticator(page);

  await registerPasskey(page, "admin");
  await completeOnboarding(page, {
    firstName: "Grace",
    lastName: "Hopper",
    email: "grace@example.com",
  });

  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", { name: /time entry|saisie/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: /analytics|analyses/i }),
  ).toBeVisible();
});
