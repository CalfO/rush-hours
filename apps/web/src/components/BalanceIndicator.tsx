import { formatBalance } from "../lib/format-balance";
import { cn } from "../lib/utils";

interface BalanceIndicatorProps {
  /** `null` = neutral/no data (day not yet saved, or week has no entries). */
  balanceMinutes: number | null;
  label: string;
}

/**
 * Shared presentational gauge for the day/week balance vs. daily/weekly
 * target (spec §7.2). Hand-rolled Tailwind rather than PrimeReact's
 * `ProgressBar`/`Knob`: the balance is a signed gap around zero, not a
 * 0-100% ratio, so a plain div-based bar with a center zero-line and a
 * `success-*`/`error-*`/`surface-*` fill fits the data shape better and
 * needs no new dependency (architect plan).
 */
const BAR_SCALE_MINUTES = 240; // ±4h fills the bar edge-to-edge

export function BalanceIndicator({
  balanceMinutes,
  label,
}: BalanceIndicatorProps) {
  const isNeutral = balanceMinutes === null;
  const isPositive = !isNeutral && balanceMinutes >= 0;

  const fillRatio = isNeutral
    ? 0
    : Math.min(Math.abs(balanceMinutes) / BAR_SCALE_MINUTES, 1) * 50;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-surface-700">{label}</span>
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            isNeutral
              ? "text-surface-400"
              : isPositive
                ? "text-success-700"
                : "text-error-700",
          )}
        >
          {isNeutral ? "—" : formatBalance(balanceMinutes)}
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-100">
        <div className="absolute inset-y-0 left-1/2 w-px bg-surface-300" />
        {!isNeutral && (
          <div
            className={cn(
              "absolute inset-y-0 rounded-full",
              isPositive ? "left-1/2 bg-success-500" : "right-1/2 bg-error-500",
            )}
            style={{ width: `${fillRatio}%` }}
          />
        )}
      </div>
    </div>
  );
}
