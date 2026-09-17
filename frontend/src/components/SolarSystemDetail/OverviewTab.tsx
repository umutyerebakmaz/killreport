'use client';

import SystemActivityChart, {
  ActivityRange,
} from '@/components/SystemActivityChart/SystemActivityChart';
import { useSystemActivityHistoryQuery } from '@/generated/graphql';
import { useState } from 'react';
import StarCard, { StarSummary } from './StarCard';
import SystemTechnicalDetails from './SystemTechnicalDetails';

interface OverviewTabProps {
  systemId: number;
  starId?: number | null;
  securityClass?: string | null;
  securityStatus?: number | null;
  position?: { x: number; y: number; z: number } | null;
  star?: StarSummary | null;
}

export default function OverviewTab({
  systemId,
  starId,
  securityClass,
  securityStatus,
  position,
  star,
}: OverviewTabProps) {
  const [range, setRange] = useState<ActivityRange>('24h');

  const { data, loading, error } = useSystemActivityHistoryQuery({
    variables: {
      filter: { system_id: systemId, hours: range === '24h' ? 24 : 168 },
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <StarCard star={star} starId={starId} />
      </div>

      <div className="lg:col-span-2">
        {error ? (
          // A failing tab query takes down only that tab. Ground here is the
          // tab shell's — bg-white/5 over #101010 is #1c1c1c, not a card
          // surface — where danger measures 4.74:1 and passes. Same ground in
          // the other four SolarSystemDetail tabs.
          <div className="p-6 text-danger border bg-white/5 border-white/10">
            Could not load kill activity: {error.message}
          </div>
        ) : (
          <SystemActivityChart
            snapshots={data?.systemActivityHistory ?? []}
            loading={loading}
            range={range}
            onRangeChange={setRange}
          />
        )}
      </div>

      <div className="lg:col-span-3">
        <SystemTechnicalDetails
          systemId={systemId}
          starId={starId}
          securityClass={securityClass}
          securityStatus={securityStatus}
          position={position}
        />
      </div>
    </div>
  );
}
