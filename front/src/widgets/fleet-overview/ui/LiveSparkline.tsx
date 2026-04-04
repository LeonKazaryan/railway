import ReactECharts from "echarts-for-react";

const SPARKLINE_DATA = [
  420, 380, 500, 460, 540, 490, 520, 480, 550, 510, 560, 530, 580, 560, 590,
];

export function LiveSparkline() {
  const option = {
    backgroundColor: "transparent",
    grid: { top: 2, bottom: 2, left: 0, right: 0 },
    xAxis: {
      type: "category",
      show: false,
      data: SPARKLINE_DATA.map((_, i) => i),
    },
    yAxis: { type: "value", show: false },
    series: [
      {
        data: SPARKLINE_DATA,
        type: "line",
        smooth: true,
        symbol: "none",
        lineStyle: { color: "#22d3a0", width: 1.5 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(34,211,160,0.25)" },
              { offset: 1, color: "rgba(34,211,160,0.0)" },
            ],
          },
        },
      },
    ],
  };

  return (
    <div style={{ width: "100%", height: 28 }}>
      <ReactECharts
        option={option}
        style={{ width: "100%", height: "100%" }}
        opts={{ renderer: "svg" }}
      />
    </div>
  );
}
