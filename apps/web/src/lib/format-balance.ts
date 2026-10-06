/**
 * Pure display formatter for a signed minutes balance, e.g. `+1h30` / `-0h45`.
 * Not dual-usage (front+back), so it stays in `apps/web/src/lib/` rather than
 * `packages/domain` (CLAUDE.md's dual-usage-only rule for that package).
 * Written generically since it will be reused by `MonthCalendar`'s cell
 * labels and eventually the Analytics view.
 */
export function formatBalance(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const absMinutes = Math.round(Math.abs(minutes));
  const hours = Math.floor(absMinutes / 60);
  const remainderMinutes = absMinutes % 60;
  return `${sign}${hours}h${String(remainderMinutes).padStart(2, "0")}`;
}
