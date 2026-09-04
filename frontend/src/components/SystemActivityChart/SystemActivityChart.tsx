'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';

// ECharts cannot render on the server; AllianceGrowthChart loads it the same way.
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

export type ActivityRange = '24h' | '7d';

interface Snapshot {
  timestamp: string;
  ship_kills: number;
  pod_kills: number;
  npc_kills: number;
}

interface SystemActivityChartProps {
  snapshots: Snapshot[];
  loading?: boolean;
  range: ActivityRange;
  onRangeChange: (range: ActivityRange) => void;
}

function formatHour(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });
}

export default function SystemActivityChart({
  snapshots,
  loading = false,
  range,
  onRangeChange,
}: SystemActivityChartProps) {
  const option = useMemo(() => {
    const sorted = [...snapshots].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: {
        data: ['Ship kills', 'Pod kills', 'NPC kills'],
        textStyle: { color: '#9ca3af' },
      },
      grid: { left: 48, right: 16, top: 48, bottom: 40 },
      xAxis: {
        type: 'category',
        data: sorted.map((s) => formatHour(s.timestamp)),
        axisLabel: { color: '#9ca3af' },
      },
      yAxis: { type: 'value', axisLabel: { color: '#9ca3af' } },
      series: [
        {
          name: 'Ship kills',
          type: 'line',
          smooth: true,
          data: sorted.map((s) => s.ship_kills),
        },
        {
          name: 'Pod kills',
          type: 'line',
          smooth: true,
          data: sorted.map((s) => s.pod_kills),
        },
        {
          name: 'NPC kills',
          type: 'line',
          smooth: true,
          data: sorted.map((s) => s.npc_kills),
        },
      ],
    };
  }, [snapshots]);

  return (
    <div className="p-6 border bg-white/5 border-white/10">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide text-gray-300 uppercase">
          Kill activity
        </h3>
        <div className="flex gap-2">
          {(['24h', '7d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={`px-3 py-1 text-xs font-semibold border transition-colors ${
                range === r
                  ? 'border-cyan-500 text-cyan-500'
                  : 'border-white/10 text-gray-400 hover:text-gray-200'
              }`}
            >
              {r === '24h' ? '24 Hours' : '7 Days'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-[320px] mt-4 bg-white/5 animate-pulse" />
      ) : snapshots.length === 0 ? (
        // An axis with no series reads as broken, so say nothing was recorded.
        <div className="h-[320px] mt-4 flex items-center justify-center text-gray-500">
          No kill activity recorded in this window
        </div>
      ) : (
        <ReactECharts option={option} style={{ height: 320, marginTop: 16 }} />
      )}
    </div>
  );
}
