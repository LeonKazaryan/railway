import { useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import ReactECharts from "echarts-for-react";
import type { ECharts } from "echarts";

interface TwinHealthGaugeProps {
  score: number;
}

export function TwinHealthGauge({ score }: TwinHealthGaugeProps) {
  const { t, i18n } = useTranslation();
  const echartsRef = useRef<ECharts | null>(null);

  const option = useMemo(() => {
    let color = "#22d3a0";
    let label = t("twin.health.good");
    if (score < 60) {
      color = "#f43f5e";
      label = t("twin.health.warning");
    } else if (score < 80) {
      color = "#f59e0b";
      label = t("twin.health.attention");
    }
    return {
      backgroundColor: "transparent",
      series: [
        {
          type: "gauge",
          radius: "88%",
          startAngle: 220,
          endAngle: -40,
          min: 0,
          max: 100,
          splitNumber: 4,
          axisLine: {
            lineStyle: {
              width: 10,
              color: [
                [score / 100, color],
                [1, "rgba(255,255,255,0.06)"],
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
            color: "#e8edf5",
            fontSize: 36,
            fontWeight: 700,
            fontFamily: "JetBrains Mono, monospace",
            offsetCenter: [0, "-8%"],
          },
          title: {
            show: true,
            offsetCenter: [0, "30%"],
            fontSize: 10,
            fontWeight: 700,
            color,
            formatter: label,
          },
          data: [{ value: score, name: label }],
        },
        {
          type: "gauge",
          radius: "75%",
          startAngle: 220,
          endAngle: -40,
          min: 0,
          max: 100,
          axisLine: {
            lineStyle: {
              width: 1,
              color: [[1, "rgba(255,255,255,0.05)"]],
            },
          },
          pointer: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          detail: { show: false },
          data: [{ value: 0 }],
        },
      ],
    };
  }, [score, t, i18n.language]);

  useEffect(() => {
    if (echartsRef.current) {
      echartsRef.current.setOption(option);
    }
  }, [option]);

  return (
    <div className="flex flex-col items-center">
      <div style={{ width: 160, height: 160 }}>
        <ReactECharts
          option={option}
          style={{ width: "100%", height: "100%" }}
          opts={{ renderer: "svg" }}
          onChartReady={(instance) => {
            echartsRef.current = instance;
          }}
        />
      </div>
      <div
        className="text-[9px] font-bold tracking-widest uppercase mt-1"
        style={{ color: "var(--text-muted)" }}
      >
        /100
      </div>
    </div>
  );
}
