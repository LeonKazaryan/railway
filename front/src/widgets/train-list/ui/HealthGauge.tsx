import { useTranslation } from "react-i18next";

interface Props {
  score: number;
  size?: number;
}

export function HealthGauge({ score, size = 96 }: Props) {
  const { t } = useTranslation();

  const radius = 38;
  const stroke = 6;
  const cx = 50;
  const cy = 54;
  const startAngle = -210;
  const endAngle = 30;
  const totalDeg = endAngle - startAngle;
  const fillDeg = (score / 100) * totalDeg;

  const color =
    score >= 90 ? "var(--success)" : score >= 70 ? "var(--warning)" : "var(--danger)";

  const label =
    score >= 90
      ? t("twin.health.good")
      : score >= 70
        ? t("twin.health.attention")
        : t("twin.health.warning");

  function polarToXY(angle: number): [number, number] {
    const rad = (angle * Math.PI) / 180;
    return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
  }

  function arc(startDeg: number, endDeg: number): string {
    const [sx, sy] = polarToXY(startDeg);
    const [ex, ey] = polarToXY(endDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${sx} ${sy} A ${radius} ${radius} 0 ${large} 1 ${ex} ${ey}`;
  }

  return (
    <div className="flex flex-col items-center" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 100 80"
        width={size}
        height={(size * 80) / 100}
        style={{ overflow: "visible" }}
      >
        <path
          d={arc(startAngle, endAngle)}
          fill="none"
          stroke="var(--gauge-track-rest)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {score > 0 && (
          <path
            d={arc(startAngle, startAngle + fillDeg)}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        )}
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="18"
          fontWeight="bold"
          fill={color}
        >
          {score}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="7"
          fontWeight="600"
          fill="var(--text-muted)"
          letterSpacing="0.05em"
        >
          {label}
        </text>
      </svg>
    </div>
  );
}
