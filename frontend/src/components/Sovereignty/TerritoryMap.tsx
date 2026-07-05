"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

export interface MapPoint {
  systemId: number;
  systemName?: string | null;
  x: number;
  y: number;
  allianceId?: number | null;
  allianceName?: string | null;
  allianceTicker?: string | null;
  regionName?: string | null;
}

// Distinct, dark-background-friendly qualitative palette for the top alliances.
const PALETTE = [
  "#22d3ee", "#f97316", "#a855f7", "#22c55e", "#eab308",
  "#ef4444", "#3b82f6", "#ec4899", "#14b8a6", "#f59e0b",
  "#8b5cf6", "#84cc16", "#06b6d4", "#fb7185", "#10b981",
];
const OTHER_COLOR = "#6b7280"; // alliances beyond the top N
const UNCLAIMED_COLOR = "#374151"; // owned but no alliance (corp/faction)
const TOP_N = 15;

/**
 * 2D territory scatter: sov-held systems plotted at their galactic (x,z) in
 * light-years and colored by controlling alliance. Top-N alliances get distinct
 * colors; the rest bucket into "Other"; alliance-less owned systems render as a
 * dim background layer. One ECharts series per legend entry so the legend
 * toggles alliances. Built on the already-installed echarts-for-react.
 */
export function TerritoryMap({ points }: { points: MapPoint[] }) {
  const option = useMemo(() => {
    // A handful of anomalous systems sit thousands of light-years from known
    // space and would otherwise squash the whole galaxy into a corner. Clamp the
    // axes to the robust 1st–99th percentile of the data (+margin) so the main
    // cluster fills the view; the rare outliers just fall off-canvas.
    const bounds = (vals: number[]) => {
      const s = [...vals].sort((a, b) => a - b);
      const at = (q: number) => s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))];
      const lo = at(0.01);
      const hi = at(0.99);
      const margin = (hi - lo) * 0.05 || 1;
      return { min: lo - margin, max: hi + margin };
    };
    const xB = bounds(points.map((p) => p.x));
    const yB = bounds(points.map((p) => p.y));

    // Rank alliances by number of systems held.
    const counts = new Map<number, { name: string; count: number }>();
    for (const p of points) {
      if (p.allianceId == null) continue;
      const cur = counts.get(p.allianceId) ?? { name: p.allianceName ?? `#${p.allianceId}`, count: 0 };
      cur.count += 1;
      counts.set(p.allianceId, cur);
    }
    const top = [...counts.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, TOP_N);
    const colorByAlliance = new Map<number, string>();
    top.forEach(([id], i) => colorByAlliance.set(id, PALETTE[i % PALETTE.length]));

    // Bucket points into series: one per top alliance, plus Other and Unclaimed.
    const buckets = new Map<string, { color: string; data: (number | string)[][] }>();
    const bucketFor = (p: MapPoint): { key: string; color: string } => {
      if (p.allianceId == null) return { key: "Unclaimed", color: UNCLAIMED_COLOR };
      const c = colorByAlliance.get(p.allianceId);
      if (c) return { key: counts.get(p.allianceId)!.name, color: c };
      return { key: "Other", color: OTHER_COLOR };
    };
    for (const p of points) {
      const { key, color } = bucketFor(p);
      const b = buckets.get(key) ?? { color, data: [] };
      b.data.push([p.x, p.y, p.systemName ?? String(p.systemId), p.regionName ?? "", p.allianceName ?? "—"]);
      buckets.set(key, b);
    }

    // Order series so Unclaimed/Other draw first (underneath the colored alliances).
    const orderedKeys = [...buckets.keys()].sort((a, b) => {
      const rank = (k: string) => (k === "Unclaimed" ? 0 : k === "Other" ? 1 : 2);
      return rank(a) - rank(b);
    });

    const series = orderedKeys.map((key) => {
      const b = buckets.get(key)!;
      return {
        name: key,
        type: "scatter",
        large: true,
        largeThreshold: 500,
        symbolSize: key === "Unclaimed" ? 2.5 : 4,
        itemStyle: { color: b.color, opacity: key === "Unclaimed" ? 0.5 : 0.9 },
        data: b.data,
      };
    });

    return {
      backgroundColor: "transparent",
      legend: {
        type: "scroll",
        top: 0,
        textStyle: { color: "#d1d5db" },
        pageTextStyle: { color: "#d1d5db" },
        // Keep the big background layers off by default focus but still visible.
        data: orderedKeys,
      },
      tooltip: {
        trigger: "item",
        formatter: (p: { data: (number | string)[]; seriesName: string }) => {
          const [, , name, region, alliance] = p.data;
          return `<strong>${name}</strong><br/>Region: ${region || "—"}<br/>Alliance: ${alliance || "—"}`;
        },
      },
      grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: false },
      xAxis: { show: false, type: "value", min: xB.min, max: xB.max },
      yAxis: { show: false, type: "value", min: yB.min, max: yB.max },
      dataZoom: [
        { type: "inside", xAxisIndex: 0, filterMode: "none" },
        { type: "inside", yAxisIndex: 0, filterMode: "none" },
      ],
      series,
    };
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-500 border h-96 border-white/10">
        No sov-held systems to map.
      </div>
    );
  }

  return <ReactECharts option={option} style={{ height: 620, width: "100%" }} notMerge />;
}
