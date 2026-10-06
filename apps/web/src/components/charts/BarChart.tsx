import type { ChartPoint } from "../../lib/analytics";

interface BarChartProps {
  data: ChartPoint[];
  ariaLabel: string;
  valueLabel: string;
}

const CHART_WIDTH = 640;
const CHART_HEIGHT = 260;
const PLOT_TOP = 20;
const PLOT_BOTTOM = 220;
const PLOT_LEFT = 24;
const PLOT_RIGHT = 12;

export function BarChart({ data, ariaLabel, valueLabel }: BarChartProps) {
  const maxValue = Math.max(...data.map((point) => point.value), 0);
  const plotWidth = CHART_WIDTH - PLOT_LEFT - PLOT_RIGHT;
  const plotHeight = PLOT_BOTTOM - PLOT_TOP;
  const slotWidth = data.length > 0 ? plotWidth / data.length : plotWidth;
  const barWidth = Math.max(4, slotWidth * 0.68);

  return (
    <svg
      className="h-64 w-full overflow-visible"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-label={ariaLabel}
    >
      <line
        x1={PLOT_LEFT}
        x2={CHART_WIDTH - PLOT_RIGHT}
        y1={PLOT_BOTTOM}
        y2={PLOT_BOTTOM}
        stroke="currentColor"
        className="text-surface-300"
      />
      {data.map((point, index) => {
        const height = maxValue > 0 ? (point.value / maxValue) * plotHeight : 0;
        const x = PLOT_LEFT + index * slotWidth + (slotWidth - barWidth) / 2;
        const y = PLOT_BOTTOM - height;
        return (
          <g key={`${point.label}-${index}`}>
            <title>{`${point.label}: ${point.value.toFixed(2)} ${valueLabel}`}</title>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={height}
              rx="3"
              className="fill-primary-500"
            />
            <text
              x={x + barWidth / 2}
              y={PLOT_BOTTOM + 18}
              textAnchor="middle"
              className="fill-surface-500 text-[11px]"
            >
              {point.label}
            </text>
          </g>
        );
      })}
      {data.length === 0 && (
        <text
          x={CHART_WIDTH / 2}
          y={PLOT_BOTTOM / 2}
          textAnchor="middle"
          className="fill-surface-500 text-sm"
        >
          —
        </text>
      )}
      <desc>
        {data
          .map(
            (point) =>
              `${point.label}: ${point.value.toFixed(2)} ${valueLabel}`,
          )
          .join(", ")}
      </desc>
    </svg>
  );
}
