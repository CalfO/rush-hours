import { BarChart } from "./BarChart";
import { formatAnalyticsDate, recentWeeks } from "../../lib/analytics";
import type { WeekSummary } from "../../api/time-entries";

interface WeeklyTotalsChartProps {
  weeks: WeekSummary[];
  locale: string;
  ariaLabel: string;
  valueLabel: string;
}

export function WeeklyTotalsChart({
  weeks,
  locale,
  ariaLabel,
  valueLabel,
}: WeeklyTotalsChartProps) {
  const data = recentWeeks(weeks).map((week) => ({
    label: formatAnalyticsDate(week.start, locale),
    value: week.workedMinutes / 60,
  }));

  return <BarChart data={data} ariaLabel={ariaLabel} valueLabel={valueLabel} />;
}
