import type { Page } from "@playwright/test";

/**
 * `WeekCarousel` mounts all 7 `DayCard`s at once (verified against the real
 * PrimeReact Carousel primitive, see prompts/plan-checklist/...) rather
 * than lazily rendering only the active slide — so a plain "the" arrival
 * field query matches 7 elements. Each card's PrimeReact-generated
 * `aria-label` is `"{position} / {total}"` (1-indexed, set by
 * `@primereact/headless/carousel`'s own `getItemProps`, confirmed by
 * reading that package's source), which is a *positional* label, not
 * "whichever card is currently active" — item 1 is always the
 * `weekStartDay` card (Monday, for these seeded accounts) regardless of
 * which day is initially selected.
 */
export function dayCard(page: Page, position: number) {
  return page.getByLabel(new RegExp(`^${position} / `));
}
