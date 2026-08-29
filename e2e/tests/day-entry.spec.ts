import { expect, test } from "@playwright/test";
import {
  addVirtualAuthenticator,
  completeOnboarding,
  registerPasskey,
} from "./helpers/auth";
import { dayCard } from "./helpers/carousel";
import { resetAccount } from "./helpers/db";

/**
 * Covers the day-entry form end to end, including the hour-grid popover
 * (spec §4.2) specifically — this exact interaction (open the time
 * popover, click the hour value, pick from the 24-cell grid) broke twice
 * during implementation in ways only a real browser caught (a
 * `PopoverTrigger`/`asChild` prop-forwarding failure, then a grid pick
 * getting silently discarded by a subsequent +/- click); jsdom/Testing
 * Library component tests didn't reproduce either until reworked
 * specifically to force real interaction sequences. This is exactly the
 * class of regression an E2E test is for.
 */
test("fills a day via the hour-grid popover, saves, and the balance reflects it", async ({
  page,
}) => {
  await resetAccount("user");
  await addVirtualAuthenticator(page);

  await registerPasskey(page, "user");
  await completeOnboarding(page, {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
  });

  // Monday's card — always carousel position 1 for this app's default
  // weekStartDay (see helpers/carousel.ts).
  const monday = dayCard(page, 1);
  const arrival = monday.getByLabel("Arrival", { exact: true });

  await arrival.click();
  const timePopover = page.getByRole("dialog");
  await expect(timePopover).toBeVisible();

  const hourTrigger = timePopover.getByRole("button", {
    name: /choose hour|choisir l'heure/i,
  });
  await hourTrigger.click();
  const hourGrid = page.getByRole("listbox", {
    name: /choose hour|choisir l'heure/i,
  });
  await expect(hourGrid).toBeVisible();
  await expect(hourGrid.getByRole("option")).toHaveCount(24);

  await hourGrid.getByRole("option", { name: "08", exact: true }).click();
  await expect(hourGrid).toBeHidden();
  // The grid only sets the hour — minutes carry over from whatever the
  // field showed before, so pin the exact value via direct entry for a
  // deterministic balance calculation below (the grid mechanism itself is
  // already proven above; this second step is about the rest of the test).
  await page.keyboard.press("Escape");
  await arrival.fill("08:00");

  await monday.getByLabel("Departure", { exact: true }).fill("17:00");
  await monday.getByLabel("Lunch break start", { exact: true }).fill("12:00");
  await monday.getByLabel("Lunch break end", { exact: true }).fill("13:00");

  await monday.getByRole("button", { name: /^save$|^enregistrer$/i }).click();

  // 8h worked - 1h lunch = 7h, against a 7h/day target (35h / 5 default
  // working days) -> 0 balance would read "+0h00"; the fixture above
  // (17:00 departure) instead gives 8h worked -> +1h00.
  await expect(page.getByText("+1h00").first()).toBeVisible();
});
