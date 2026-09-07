'use client';

import { Loader } from '@/components/Loader/Loader';
import Card from '@/components/ui/Card';
import RankNumber from '@/components/ui/RankNumber';
import Link from 'next/link';
import { ReactNode } from 'react';

export interface TopRegion {
  id: number;
  name: string;
  killCount: number;
}

export interface TopRegionsCardProps {
  title: string;
  subtitle?: ReactNode;
  regions: TopRegion[];
  loading?: boolean;
  emptyText?: string;
}

export default function TopRegionsCard({
  title,
  subtitle,
  regions,
  loading = false,
  emptyText = 'No regions yet',
}: TopRegionsCardProps) {
  const header = (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {subtitle && (
        <span className="text-xs text-gray-500 shrink-0">{subtitle}</span>
      )}
    </div>
  );

  if (loading) {
    return (
      <Card header={header}>
        <div className="flex items-center justify-center py-12">
          <Loader size="lg" />
        </div>
      </Card>
    );
  }

  return (
    <Card header={header}>
      {regions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
          <p className="text-sm font-medium text-center">{emptyText}</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/5">
          {regions.map((region, index) => (
            <div key={region.id} className="card-row">
              <div className="flex items-center gap-3">
                <RankNumber rank={index + 1} />

                <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
                  <Link
                    href={`/regions/${region.id}`}
                    className="block min-w-0 font-medium text-orange-400 truncate hover:underline"
                  >
                    {region.name}
                  </Link>
                  <span className="text-lg font-semibold text-gray-400 tabular-nums whitespace-nowrap shrink-0">
                    {region.killCount}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
