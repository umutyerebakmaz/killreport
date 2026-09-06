'use client';

import Loader from '@/components/Loader';
import { TerritoryMap } from '@/components/Sovereignty/TerritoryMap';
import { useSovereigntyMapQuery } from '@/generated/graphql';
import Select from '@/components/ui/Select';
import Link from 'next/link';
import { Suspense, useMemo, useState } from 'react';

function MapContent() {
  const { data, loading, error } = useSovereigntyMapQuery();
  const [region, setRegion] = useState('all');

  const points = useMemo(() => data?.sovereigntyMapPoints ?? [], [data]);
  const regions = useMemo(
    () =>
      [
        ...new Set(
          points.map((p) => p.regionName).filter((r): r is string => !!r),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [points],
  );
  const filtered = useMemo(
    () =>
      region === 'all' ? points : points.filter((p) => p.regionName === region),
    [points, region],
  );

  if (loading)
    return <Loader fullHeight size="lg" text="Loading territory map..." />;
  if (error)
    return <div className="p-8 text-red-400">Error: {error.message}</div>;

  return (
    <>
      <h1 className="sr-only">Territory Map</h1>
      <div className="flex flex-wrap items-baseline justify-end gap-2">
        <Link
          href="/sovereignty"
          prefetch={false}
          className="button button-secondary button-sm"
        >
          Sovereignty Overview
        </Link>
      </div>
      <div className="flex items-center gap-3 mt-4">
        <label htmlFor="region" className="text-sm text-gray-400">
          Region
        </label>
        <Select
          value={region}
          onChange={setRegion}
          options={[
            { value: 'all', label: 'All regions' },
            ...regions.map((r) => ({ value: r, label: r })),
          ]}
          aria-label="Region"
        />
      </div>

      <section className="mt-4 border border-white/10 bg-surface">
        <TerritoryMap points={filtered} />
      </section>
      <p className="mt-2 text-xs text-gray-500">
        Each point is a sov-held system at its galactic position (light-years).
        Colored by the top controlling alliances; scroll to zoom, drag to pan,
        click a legend entry to isolate.
      </p>
    </>
  );
}

export default function SovereigntyMapPage() {
  return (
    <Suspense
      fallback={<Loader fullHeight size="lg" text="Loading territory map..." />}
    >
      <MapContent />
    </Suspense>
  );
}
