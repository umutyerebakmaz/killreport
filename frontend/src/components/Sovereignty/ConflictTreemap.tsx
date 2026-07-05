"use client";

import { formatISK } from "@/utils/formatISK";
import dynamic from "next/dynamic";
import { useMemo } from "react";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

export interface Hotspot {
  regionId: number;
  regionName?: string | null;
  activeCampaigns: number;
  warKills: number;
  iskDestroyed: number;
  intensityScore: number;
}

/**
 * ECharts treemap of conflict hot-zones: each region is a rectangle sized by its
 * intensity score and shaded by war-kill count. Built on the already-installed
 * echarts / echarts-for-react (dynamic, ssr:false) like the growth charts.
 */
export function ConflictTreemap({ hotspots }: { hotspots: Hotspot[] }) {
  const option = useMemo(() => {
    const maxKills = hotspots.reduce((m, h) => Math.max(m, h.warKills), 0);
    return {
      backgroundColor: "transparent",
      tooltip: {
        formatter: (info: { data?: Hotspot & { value?: number } }) => {
          const d = info.data;
          if (!d) return "";
          return [
            `<strong>${d.regionName ?? `#${d.regionId}`}</strong>`,
            `Active campaigns: ${d.activeCampaigns}`,
            `War kills: ${d.warKills}`,
            `ISK destroyed: ${formatISK(d.iskDestroyed)}`,
            `Intensity: ${d.intensityScore}`,
          ].join("<br/>");
        },
      },
      series: [
        {
          type: "treemap",
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          label: {
            show: true,
            formatter: "{b}",
            color: "#fff",
            fontSize: 12,
          },
          itemStyle: { borderColor: "#0a0a0a", borderWidth: 2, gapWidth: 2 },
          data: hotspots.map((h) => ({
            ...h,
            name: h.regionName ?? `#${h.regionId}`,
            value: h.intensityScore,
            itemStyle: {
              // Cyan → red as war-kill count rises.
              color: `rgb(${Math.round(34 + (maxKills ? (h.warKills / maxKills) * 200 : 0))}, ${Math.round(
                211 - (maxKills ? (h.warKills / maxKills) * 150 : 0),
              )}, ${Math.round(238 - (maxKills ? (h.warKills / maxKills) * 180 : 0))})`,
            },
          })),
        },
      ],
    };
  }, [hotspots]);

  if (hotspots.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 border border-white/10">
        No active conflicts to map yet.
      </div>
    );
  }

  return <ReactECharts option={option} style={{ height: 420, width: "100%" }} />;
}
