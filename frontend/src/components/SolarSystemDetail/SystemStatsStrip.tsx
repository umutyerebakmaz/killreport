'use client';

import { useSolarSystemStatsQuery } from '@/generated/graphql';
import { formatISK } from '@/utils/formatISK';

interface SystemStatsStripProps {
  systemId: number;
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 border bg-white/5 border-white/10">
      <div className="text-xs tracking-wide text-gray-400 uppercase">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-gray-100">{value}</div>
    </div>
  );
}

function SkeletonBox() {
  return (
    <div className="p-4 border bg-white/5 border-white/10">
      <div className="w-24 h-3 bg-white/10 animate-pulse" />
      <div className="w-16 h-6 mt-2 bg-white/10 animate-pulse" />
    </div>
  );
}

export default function SystemStatsStrip({ systemId }: SystemStatsStripProps) {
  const { data, loading } = useSolarSystemStatsQuery({
    variables: { systemId },
  });

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 mt-6 lg:grid-cols-4">
        <SkeletonBox />
        <SkeletonBox />
        <SkeletonBox />
        <SkeletonBox />
      </div>
    );
  }

  const stats = data?.solarSystemStats;
  const busiest = stats?.busiestHourUtc;

  // A system with no killmails shows zeroes, not an empty state.
  return (
    <div className="grid grid-cols-2 gap-4 mt-6 lg:grid-cols-4">
      <Box
        label="Total Kills"
        value={(stats?.totalKills ?? 0).toLocaleString()}
      />
      <Box label="ISK Destroyed" value={formatISK(stats?.totalIskDestroyed)} />
      <Box
        label="Kills (24h)"
        value={(stats?.kills24h ?? 0).toLocaleString()}
      />
      <Box
        label="Busiest Hour"
        value={
          busiest === null || busiest === undefined
            ? '—'
            : `${String(busiest).padStart(2, '0')}:00 UTC`
        }
      />
    </div>
  );
}
