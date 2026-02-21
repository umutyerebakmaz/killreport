"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface Snapshot {
  date: string;
  memberCount: number;
  corporationCount: number;
}

interface AllianceGrowthChartProps {
  snapshots: Snapshot[];
  loading?: boolean;
}

type RangeType = "90d" | "30d" | "7d" | "monthly";

const RANGE_LABELS: Record<RangeType, string> = {
  "90d": "90 Days",
  "30d": "1 Month",
  "7d": "1 Week",
  monthly: "Monthly",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

export default function AllianceGrowthChart({
  snapshots,
  loading = false,
}: AllianceGrowthChartProps) {
  const [range, setRange] = useState<RangeType>("90d");

  const chartData = useMemo(() => {
    if (!snapshots || snapshots.length === 0)
      return { dates: [], members: [], corps: [] };

    const sorted = [...snapshots].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    if (range === "monthly") {
      // Her ay için son snapshot değerini al
      const monthMap = new Map<string, Snapshot>();
      for (const snap of sorted) {
        const d = new Date(snap.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthMap.set(key, snap); // Son değer üzerine yazar
      }

      const entries = Array.from(monthMap.entries()).sort(([a], [b]) =>
        a.localeCompare(b),
      );

      const dates = entries.map(([key]) => {
        const [year, month] = key.split("-");
        const d = new Date(parseInt(year), parseInt(month) - 1, 1);
        return d.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });
      });
      const members = entries.map(([, snap]) => snap.memberCount);
      const corps = entries.map(([, snap]) => snap.corporationCount);

      return { dates, members, corps };
    }

    const daysMap: Record<RangeType, number> = {
      "90d": 90,
      "30d": 30,
      "7d": 7,
      monthly: 90,
    };

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysMap[range]);
    const filtered = sorted.filter((s) => new Date(s.date) >= cutoff);

    return {
      dates: filtered.map((s) => formatDate(s.date)),
      members: filtered.map((s) => s.memberCount),
      corps: filtered.map((s) => s.corporationCount),
    };
  }, [snapshots, range]);

  const option = useMemo(
    () => ({
      backgroundColor: "transparent",
      grid: {
        top: 40,
        right: 60,
        bottom: 40,
        left: 60,
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#1e293b",
        borderColor: "#334155",
        textStyle: { color: "#e2e8f0" },
        axisPointer: { type: "cross", lineStyle: { color: "#475569" } },
      },
      legend: {
        show: false,
      },
      xAxis: {
        type: "category",
        data: chartData.dates,
        axisLine: { lineStyle: { color: "#334155" } },
        axisLabel: {
          color: "#64748b",
          fontSize: 11,
          rotate: chartData.dates.length > 20 ? 30 : 0,
        },
        splitLine: { show: false },
      },
      yAxis: [
        {
          type: "value",
          name: "Members",
          nameTextStyle: { color: "#64748b", fontSize: 11 },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: "#64748b",
            fontSize: 11,
            formatter: (v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`,
          },
          splitLine: { lineStyle: { color: "#1e293b" } },
        },
        {
          type: "value",
          name: "Corps",
          nameTextStyle: { color: "#64748b", fontSize: 11 },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: "#64748b", fontSize: 11 },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: "Members",
          type: "line",
          yAxisIndex: 0,
          data: chartData.members,
          smooth: true,
          symbol: "circle",
          symbolSize: chartData.dates.length > 30 ? 4 : 6,
          lineStyle: { color: "#06b6d4", width: 2 },
          itemStyle: { color: "#06b6d4" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(6,182,212,0.25)" },
                { offset: 1, color: "rgba(6,182,212,0.02)" },
              ],
            },
          },
        },
        {
          name: "Corporations",
          type: "line",
          yAxisIndex: 1,
          data: chartData.corps,
          smooth: true,
          symbol: "circle",
          symbolSize: chartData.dates.length > 30 ? 4 : 6,
          lineStyle: { color: "#f59e0b", width: 2 },
          itemStyle: { color: "#f59e0b" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(245,158,11,0.20)" },
                { offset: 1, color: "rgba(245,158,11,0.02)" },
              ],
            },
          },
        },
      ],
    }),
    [chartData],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-500">
        Loading growth data...
      </div>
    );
  }

  if (!snapshots || snapshots.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-500">
        No snapshot data available.
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-white">Growth Chart</h3>
        <div className="flex gap-1">
          {(Object.keys(RANGE_LABELS) as RangeType[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                range === r
                  ? "bg-cyan-600/80 text-white"
                  : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200"
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>
      {/* Custom legend */}
      <div className="flex items-center justify-end gap-4 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-6 h-0.5 bg-cyan-400" />
          <span className="text-xs text-slate-400">Members</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-6 h-0.5 bg-amber-400" />
          <span className="text-xs text-slate-400">Corporations</span>
        </div>
      </div>
      <ReactECharts
        option={option}
        style={{ height: 320 }}
        opts={{ renderer: "canvas" }}
        notMerge
      />
    </div>
  );
}
