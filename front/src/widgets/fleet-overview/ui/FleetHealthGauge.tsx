import ReactECharts from 'echarts-for-react'

interface FleetHealthGaugeProps {
  score: number
}

export function FleetHealthGauge({ score }: FleetHealthGaugeProps) {
  const option = {
    backgroundColor: 'transparent',
    series: [
      {
        type: 'gauge',
        radius: '90%',
        startAngle: 220,
        endAngle: -40,
        min: 0,
        max: 100,
        splitNumber: 5,
        axisLine: {
          lineStyle: {
            width: 8,
            color: [
              [score / 100, '#22d3a0'],
              [1, 'rgba(255,255,255,0.06)'],
            ],
          },
        },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: {
          valueAnimation: true,
          formatter: '{value}',
          color: '#e8edf5',
          fontSize: 22,
          fontWeight: 700,
          fontFamily: 'JetBrains Mono, monospace',
          offsetCenter: [0, '-5%'],
        },
        title: {
          show: true,
          offsetCenter: [0, '28%'],
          fontSize: 9,
          fontWeight: 600,
          color: '#22d3a0',
          formatter: 'Good',
        },
        data: [{ value: score, name: '' }],
      },
    ],
  }

  return (
    <div style={{ width: 80, height: 80 }}>
      <ReactECharts
        option={option}
        style={{ width: '100%', height: '100%' }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  )
}
