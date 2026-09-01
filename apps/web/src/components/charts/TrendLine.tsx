import type { CumulativeBalancePoint } from "../../lib/analytics";

interface TrendLineProps {
  data: CumulativeBalancePoint[];
  ariaLabel: string;
}

const WIDTH = 640;
const HEIGHT = 260;
const LEFT = 24;
const RIGHT = 12;
const TOP = 20;
const BOTTOM = 220;

export function TrendLine({ data, ariaLabel }: TrendLineProps) {
  const values = data.map((point) => point.balanceMinutes);
  const rawMinValue = Math.min(...values, 0);
  const rawMaxValue = Math.max(...values, 0);
  const minValue = rawMinValue === 0 && rawMaxValue === 0 ? -1 : rawMinValue;
  const maxValue = rawMinValue === 0 && rawMaxValue === 0 ? 1 : rawMaxValue;
  const span = Math.max(maxValue - minValue, 1);
  const plotWidth = WIDTH - LEFT - RIGHT;
  const plotHeight = BOTTOM - TOP;
  const xFor = (index: number) =>
    data.length <= 1
      ? LEFT + plotWidth / 2
      : LEFT + (index / (data.length - 1)) * plotWidth;
  const yFor = (value: number) =>
    TOP + ((maxValue - value) / span) * plotHeight;
  const points = data
    .map((point, index) => `${xFor(index)},${yFor(point.balanceMinutes)}`)
    .join(" ");

  return (
    <svg
      className="h-64 w-full overflow-visible"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={ariaLabel}
    >
      <line
        x1={LEFT}
        x2={WIDTH - RIGHT}
        y1={yFor(0)}
        y2={yFor(0)}
        stroke="currentColor"
        strokeDasharray="4 4"
        className="text-surface-400"
      />
      {data.length > 0 && (
        <>
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary-600"
          />
          {data.map((point, index) => (
            <circle
              key={`${point.date}-${index}`}
              cx={xFor(index)}
              cy={yFor(point.balanceMinutes)}
              r="4"
              className="fill-primary-600"
            >
              <title>{`${point.date}: ${point.balanceMinutes} minutes`}</title>
            </circle>
          ))}
        </>
      )}
      {data.length === 0 && (
        <text
          x={WIDTH / 2}
          y={BOTTOM / 2}
          textAnchor="middle"
          className="fill-surface-500 text-sm"
        >
          —
        </text>
      )}
    </svg>
  );
}
