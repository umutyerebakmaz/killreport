'use client';

import { Loader } from '@/components/Loader/Loader';
import Card from '@/components/ui/Card';
import RankNumber from '@/components/ui/RankNumber';
import Tooltip from '@/components/Tooltip/Tooltip';
import Link from 'next/link';
import { ReactNode } from 'react';

export interface TopCorporation {
  id: number;
  name: string;
  ticker?: string | null;
  killCount: number;
}

export interface TopCorporationCardProps {
  title: string;
  subtitle?: ReactNode;
  corporations: TopCorporation[];
  loading?: boolean;
  emptyText?: string;
  variant?: 'detail' | 'list';
}

export default function TopCorporationCard({
  title,
  subtitle,
  corporations,
  loading = false,
  emptyText = 'No corporations',
  variant = 'detail',
}: TopCorporationCardProps) {
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
      {corporations.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
          <p className="text-sm font-medium text-center">{emptyText}</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/5">
          {corporations.map((corporation, index) => {
            return (
              <div
                key={corporation.id}
                className={`p-3 transition-colors duration-100 ${
                  variant === 'list'
                    ? 'bg-neutral-900 hover:bg-neutral-800'
                    : 'bg-neutral-800 hover:bg-neutral-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <RankNumber rank={index + 1} />

                  {/* Logo */}
                  <div className="relative shrink-0">
                    <img
                      src={`https://images.evetech.net/corporations/${corporation.id}/logo?size=64`}
                      alt={corporation.name}
                      width={40}
                      height={40}
                      className="shadow-md bg-black/50 ring-1 ring-black/50"
                      loading="lazy"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
                    <div className="flex flex-col min-w-0 gap-0.5 leading-tight">
                      <Tooltip
                        content="Show corporation info"
                        className="w-full! min-w-0"
                      >
                        <Link
                          href={`/corporations/${corporation.id}?=tab=killmails`}
                          className="block min-w-0 font-medium leading-tight text-gray-400 truncate hover:text-blue-400"
                          prefetch={false}
                        >
                          {corporation.name}
                        </Link>
                      </Tooltip>
                      {corporation.ticker && (
                        <span className="block text-sm leading-tight text-gray-500 truncate">
                          [{corporation.ticker}]
                        </span>
                      )}
                    </div>

                    {/* Kill Count */}
                    <span className="text-lg font-semibold text-gray-400 tabular-nums whitespace-nowrap shrink-0">
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
