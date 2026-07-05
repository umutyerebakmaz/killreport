"use client";

import Loader from "@/components/Loader";
import { TerritoryMap } from "@/components/Sovereignty/TerritoryMap";
import { useSovereigntyMapQuery } from "@/generated/graphql";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";

function MapContent() {
  const { data, loading, error } = useSovereigntyMapQuery();
  const [region, setRegion] = useState("all");

  const points = useMemo(() => data?.sovereigntyMapPoints ?? [], [data]);
  const regions = useMemo(
    () =>
      [...new Set(points.map((p) => p.regionName).filter((r): r is string => !!r))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [points],
  );
  const filtered = useMemo(
    () => (region === "all" ? points : points.filter((p) => p.regionName === region)),
    [points, region],
  );

  if (loading) return <Loader fullHeight size="lg" text="Loading territory map..." />;
  if (error) return <div className="p-8 text-red-400">Error: {error.message}</div>;

  return (
    <div className="max-w-6xl px-4 py-8 mx-auto">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-semibold text-white">Territory Map</h1>
        <Link href="/sovereignty" prefetch={false} className="text-sm text-cyan-400 hover:text-cyan-300">
          ← Sovereignty Overview
        </Link>
      </div>
      <h2 className="mt-2 text-xl text-white">
        Null-sec sovereignty by controlling alliance ({filtered.length.toLocaleString()} systems)
      </h2>

      <div className="flex items-center gap-3 mt-4">
        <label className="text-sm text-gray-400">Region</label>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="px-3 py-1.5 text-sm text-white border bg-neutral-900 border-white/10"
        >
          <option value="all">All regions</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <section className="mt-4 border border-white/10 bg-neutral-950">
        <TerritoryMap points={filtered} />
      </section>
      <p className="mt-2 text-xs text-gray-500">
        Each point is a sov-held system at its galactic position (light-years). Colored by the top
        controlling alliances; scroll to zoom, drag to pan, click a legend entry to isolate.
      </p>
    </div>
  );
}

export default function SovereigntyMapPage() {
  return (
    <Suspense fallback={<Loader fullHeight size="lg" text="Loading territory map..." />}>
      <MapContent />
    </Suspense>
  );
}
