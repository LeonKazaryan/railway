import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import ReactECharts from "echarts-for-react";
import { useThemeStore } from "@/features/theme/model/store";

interface FleetHealthGaugeProps {
  score: number;
}

export function FleetHealthGauge({ score }: FleetHealthGaugeProps) {
  const { t, i18n } = useTranslation();
  const theme = useThemeStore((s) => s.theme);

  const option = useMemo(
    () => {
      const detailColor = theme === "light" ? "#0f172a" : "#e8edf5";
      const trackRest =
        theme === "light" ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.06)";
      const titleColor = theme === "light" ? "#059669" : "#22d3a0";
      return {
        backgroundColor: "transparent",
        series: [
          {
            type: "gauge",
            radius: "90%",
            startAngle: 220,
            endAngle: -40,
            min: 0,
            max: 100,
            splitNumber: 5,
            axisLine: {
              lineStyle: {
                width: 8,
                color: [
                  [score / 100, "#22d3a0"],
                  [1, trackRest],
                ],
              },
            },
            pointer: { show: false },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false },
            detail: {
              valueAnimation: true,
              formatter: "{value}",
              color: detailColor,
              fontSize: 22,
              fontWeight: 700,
              fontFamily: "JetBrains Mono, monospace",
              offsetCenter: [0, "-5%"],
            },
            title: {
              show: true,
              offsetCenter: [0, "28%"],
              fontSize: 9,
              fontWeight: 600,
              color: titleColor,
              formatter: t("fleetOverview.gaugeGood"),
            },
            data: [{ value: score, name: "" }],
          },
        ],
      };
    },
    [score, t, i18n.language, theme],
  );

  return (
    <div style={{ width: 80, height: 80 }}>
      <ReactECharts
        option={option}
        style={{ width: "100%", height: "100%" }}
        opts={{ renderer: "svg" }}
      />
    </div>
  );
}
