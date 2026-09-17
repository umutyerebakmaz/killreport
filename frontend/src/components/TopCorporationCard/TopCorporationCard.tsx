'use client';

import { Loader } from '@/components/Loader/Loader';
import Card from '@/components/ui/Card';
import RankNumber from '@/components/ui/RankNumber';
import Tooltip from '@/components/Tooltip/Tooltip';
import Link from 'next/link';
import { ReactNode } from 'react';
import EveImage from '../ui/EveImage';

export interface TopCorporation {
  id: number;
  name: string;
  killCount: number;
}

export interface TopCorporationCardProps {
  title: string;
  subtitle?: ReactNode;
  corporations: TopCorporation[];
  loading?: boolean;
  emptyText?: string;
}

export default function TopCorporationCard({
  title,
  subtitle,
  corporations,
  loading = false,
  emptyText = 'No corporations',
}: TopCorporationCardProps) {
  const header = (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-lg font-medium text-white">{title}</h3>
      {subtitle && (
        <span className="text-sm text-ink-muted shrink-0">{subtitle}</span>
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
      {corporations.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-ink-faint">
          <p className="text-sm font-medium text-center">{emptyText}</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/5">
          {corporations.map((corporation, index) => {
            return (
              <div key={corporation.id} className="card-row">
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <RankNumber rank={index + 1} />

                  {/* Logo */}
                  <div className="relative shrink-0">
                    <EveImage
                      kind="corporation"
                      id={corporation.id}
                      name={corporation.name}
                      size={32}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
                    <div className="min-w-0 leading-tight">
                      <Tooltip
                        content="Show corporation info"
                        className="w-full! min-w-0"
                      >
                        <Link
                          href={`/corporations/${corporation.id}?=tab=killmails`}
                          className="block min-w-0 font-medium leading-tight text-ink-muted truncate hover:text-blue-400"
                          prefetch={false}
                        >
                          {corporation.name}
                        </Link>
                      </Tooltip>
                    </div>

                    {/* Kill Count */}
                    <span className="text-base font-medium text-ink-muted tabular-nums whitespace-nowrap shrink-0">
                      {corporation.killCount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
