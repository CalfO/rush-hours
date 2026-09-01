import type { CDPSession, Page } from "@playwright/test";

/**
 * This app authenticates exclusively via WebAuthn passkeys (no password,
 * spec §5) — a real browser has no authenticator, so every test drives one
 * of Chromium's own virtual authenticators over CDP
 * (https://chromedevtools.github.io/devtools-protocol/tot/WebAuthn/).
 * `automaticPresenceSimulation: true` answers the "touch your authenticator"
 * prompt automatically, so the ceremony completes without any human step.
 */
export async function addVirtualAuthenticator(page: Page): Promise<CDPSession> {
  const client = await page.context().newCDPSession(page);
  await client.send("WebAuthn.enable");
  await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return client;
}

const USERNAME_LABEL = /nom d'utilisateur|username/i;
const CONTINUE_BUTTON = /continuer|continue/i;
const REGISTER_BUTTON = /créer votre passkey|create your passkey/i;

/**
 * Enrolls a first passkey for a seeded account with none yet (the app's
 * only account-creation path, per spec §5.1) and lands on `/onboarding`.
 * Call `addVirtualAuthenticator(page)` first.
 */
export async function registerPasskey(
  page: Page,
  username: string,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(USERNAME_LABEL).fill(username);
  await page.getByRole("button", { name: CONTINUE_BUTTON }).click();
  await page
    .getByRole("button", { name: REGISTER_BUTTON })
    .click({ timeout: 10_000 });
  await page.waitForURL("**/onboarding");
}

/**
 * Logs in with an already-enrolled passkey (same virtual authenticator
 * instance that registered it — a real authenticator's private key never
 * leaves its own browser context, so this only works within the same
 * `page`/`browserContext` that called `registerPasskey`).
 */
export async function loginWithPasskey(
  page: Page,
  username: string,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(USERNAME_LABEL).fill(username);
  await page.getByRole("button", { name: CONTINUE_BUTTON }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 10_000 });
}

export interface Profile {
  firstName: string;
  lastName: string;
  email: string;
}

/**
 * Completes both onboarding steps (spec §5.4) from `/onboarding`: profile
 * form, then the work-schedule form left at its default (Mon-Fri, 35h) —
 * callers that need a specific schedule adjust the form before saving, this
 * helper only carries the two steps that are always the same.
 */
export async function completeOnboarding(
  page: Page,
  profile: Profile,
): Promise<void> {
  await page.getByLabel(/first name|prénom/i).fill(profile.firstName);
  await page
    .getByLabel(/last name(?! d'utilisateur)|^nom$/i)
    .fill(profile.lastName);
  await page.getByLabel(/^email$/i).fill(profile.email);
  await page.getByRole("button", { name: /continue|continuer/i }).click();
  await page.getByRole("button", { name: /^save$|^enregistrer$/i }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 10_000 });
}
