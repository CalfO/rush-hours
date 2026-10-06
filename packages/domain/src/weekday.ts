/**
 * These 7 values must stay manually synchronized with `enum Weekday` in
 * `apps/api/prisma/schema.prisma` — this package has no dependency on `@prisma/client`
 * (it must build as plain CommonJS/JSON-serializable domain logic usable from both
 * `apps/api` and, eventually, `apps/web`), so the two lists aren't derived from one
 * another. This is the one place they can drift apart; keep them in the same order.
 */
export const WEEKDAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];
