import { expect, test } from "@playwright/test";
import {
  addVirtualAuthenticator,
  completeOnboarding,
  registerPasskey,
} from "./helpers/auth";
import { dayCard } from "./helpers/carousel";
import { resetAccount, seedTimeEntry } from "./helpers/db";
import { addDaysUTC, mondayOfWeekUTC, toIsoDate } from "./helpers/dates";

/**
 * Covers spec §5.5 (save-as-reference-week prompt) and §5.6 (deletion from
 * the header menu) end to end, including the cross-sibling propagation
 * between `Header` and `TimeEntryPage` (both driven by state lifted to
 * `AppLayout`) — confirming the menu item appears with no page reload the
 * instant the prompt is accepted, and disappears the instant it's deleted.
 *
 * Deliberately scoped to what's uniquely valuable to verify in a real
 * browser: the popup's trigger timing (only on the save that completes the
 * week) and that no-reload propagation. §5.7's prefill switch (matching
 * by weekday, never overwriting a saved day) is already covered thoroughly
 * and deterministically by apps/web/src/components/WeekCarousel.test.tsx —
 * duplicating it here would mean fragile week-to-week calendar navigation
 * for little added confidence over the existing component tests.
 *
 * Tuesday-Friday are seeded directly in the DB (not via the UI) so this
 * spec stays focused on reference-week behavior rather than re-proving the
 * day-entry form, which day-entry.spec.ts already covers.
 */
test("prompts to save a completed week as reference, then lets it be deleted", async ({
  page,
}) => {
  await resetAccount("user");
  await addVirtualAuthenticator(page);

  await registerPasskey(page, "user");
  await completeOnboarding(page, {
    firstName: "Marie",
    lastName: "Curie",
    email: "marie@example.com",
  });

  const monday = mondayOfWeekUTC(new Date());
  const times = {
    arrival: "08:00",
    departure: "17:00",
    lunchStart: "12:00",
    lunchEnd: "13:00",
  };
  for (const offset of [1, 2, 3, 4] as const) {
    await seedTimeEntry("user", toIsoDate(addDaysUTC(monday, offset)), times);
  }

  await page.reload();

  const mondayCard = dayCard(page, 1);
  await mondayCard.getByLabel("Arrival", { exact: true }).fill(times.arrival);
  await mondayCard
    .getByLabel("Departure", { exact: true })
    .fill(times.departure);
  await mondayCard
    .getByLabel("Lunch break start", { exact: true })
    .fill(times.lunchStart);
  await mondayCard
    .getByLabel("Lunch break end", { exact: true })
    .fill(times.lunchEnd);
  await mondayCard
    .getByRole("button", { name: /^save$|^enregistrer$/i })
    .click();

  const savePrompt = page.getByRole("dialog", {
    name: /save as reference week|enregistrer comme semaine de référence/i,
  });
  await expect(savePrompt).toBeVisible();
  await savePrompt
    .getByRole("button", { name: /yes, save|oui, enregistrer/i })
    .click();
  await expect(savePrompt).toBeHidden();

  const avatarMenuTrigger = page.locator('[data-scope="avatar"]').first();
  await avatarMenuTrigger.click();
  const deleteMenuItem = page.getByRole("menuitem", {
    name: /delete reference week|supprimer la semaine de référence/i,
  });
  await expect(deleteMenuItem).toBeVisible();
  await deleteMenuItem.click();

  const deleteConfirm = page.getByRole("dialog", {
    name: /delete the reference week|supprimer la semaine de référence/i,
  });
  await expect(deleteConfirm).toBeVisible();
  await deleteConfirm
    .getByRole("button", { name: /^confirm$|^confirmer$/i })
    .click();
  await expect(deleteConfirm).toBeHidden();

  await avatarMenuTrigger.click();
  await expect(deleteMenuItem).toBeHidden();
});
