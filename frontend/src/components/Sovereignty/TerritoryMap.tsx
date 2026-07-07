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
    if (points.length === 0) return {};

    // Square data window with EQUAL span on both axes so the galaxy keeps its
    // shape (paired with the near-square grid below, x and y stay at the same
    // px/ly scale). On large sets, clip far-flung anomalous systems via the
    // 1st–99th percentile; on small sets (a filtered region) use the true extent
    // so no frontier system falls off-canvas.
    const extent = (vals: number[]) => {
      const s = [...vals].sort((a, b) => a - b);
      const n = s.length;
      if (n <= 20) return { lo: s[0], hi: s[n - 1] };
      const at = (q: number) => s[Math.round(q * (n - 1))];
      return { lo: at(0.01), hi: at(0.99) };
    };
    const xr = extent(points.map((p) => p.x));
    const yr = extent(points.map((p) => p.y));
    const cx = (xr.lo + xr.hi) / 2;
    const cy = (yr.lo + yr.hi) / 2;
    const half = (Math.max(xr.hi - xr.lo, yr.hi - yr.lo) / 2) * 1.05 || 1;
    const xB = { min: cx - half, max: cx + half };
    const yB = { min: cy - half, max: cy + half };

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

    // Bucket points into series keyed by a STABLE key (alliance id, not display
    // name — so two alliances that share a name never merge), plus Other and
    // Unclaimed.
    const buckets = new Map<string, { name: string; color: string; data: (number | string)[][] }>();
    const bucketFor = (p: MapPoint): { key: string; name: string; color: string } => {
      if (p.allianceId == null) return { key: "unclaimed", name: "Unclaimed", color: UNCLAIMED_COLOR };
      const color = colorByAlliance.get(p.allianceId);
      if (color) return { key: `a:${p.allianceId}`, name: counts.get(p.allianceId)!.name, color };
      return { key: "other", name: "Other", color: OTHER_COLOR };
    };
    for (const p of points) {
      const { key, name, color } = bucketFor(p);
      const b = buckets.get(key) ?? { name, color, data: [] };
      b.data.push([p.x, p.y, p.systemName ?? String(p.systemId), p.regionName ?? "", p.allianceName ?? "—"]);
      buckets.set(key, b);
    }

    // Draw Unclaimed/Other underneath the colored alliance layers.
    const rank = (k: string) => (k === "unclaimed" ? 0 : k === "other" ? 1 : 2);
    const orderedKeys = [...buckets.keys()].sort((a, b) => rank(a) - rank(b));

    const series = orderedKeys.map((key) => {
      const b = buckets.get(key)!;
      return {
        name: b.name,
        type: "scatter",
        large: true,
        largeThreshold: 500,
        symbolSize: key === "unclaimed" ? 2.5 : 4,
        itemStyle: { color: b.color, opacity: key === "unclaimed" ? 0.5 : 0.9 },
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
        data: series.map((s) => s.name),
      },
      tooltip: {
        trigger: "item",
        formatter: (p: { data: (number | string)[]; seriesName: string }) => {
          const [, , name, region, alliance] = p.data;
          return `<strong>${name}</strong><br/>Region: ${region || "—"}<br/>Alliance: ${alliance || "—"}`;
        },
      },
      // Near-square plot area so the equal-span window keeps x/y at one scale.
      grid: { left: "24%", right: "24%", top: 36, bottom: 8, containLabel: false },
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
