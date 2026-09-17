'use client';

import { Loader } from '@/components/Loader/Loader';
import Card from '@/components/ui/Card';
import RankNumber from '@/components/ui/RankNumber';
import Tooltip from '@/components/Tooltip/Tooltip';
import Link from 'next/link';
import { ReactNode } from 'react';
import EveImage from '../ui/EveImage';

export interface TopAlliance {
  id: number;
  name: string;
  ticker?: string | null;
  killCount: number;
}

export interface TopAllianceCardProps {
  title: string;
  subtitle?: ReactNode;
  alliances: TopAlliance[];
  loading?: boolean;
  emptyText?: string;
}

export default function TopAllianceCard({
  title,
  subtitle,
  alliances,
  loading = false,
  emptyText = 'No alliances',
}: TopAllianceCardProps) {
  const header = (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-lg font-medium text-white">{title}</h3>
      {subtitle && (
        <span className="text-xs text-ink-faint shrink-0">{subtitle}</span>
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
      {alliances.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-ink-faint">
          <p className="text-sm font-medium text-center">{emptyText}</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/5">
          {alliances.map((alliance, index) => {
            return (
              <div key={alliance.id} className="card-row">
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <RankNumber rank={index + 1} />

                  {/* Logo */}
                  <div className="relative shrink-0">
                    <EveImage
                      kind="alliance"
                      id={alliance.id}
                      name={alliance.name}
                      size={64}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
                    <div className="flex flex-col min-w-0 gap-0.5 leading-tight">
                      <Tooltip
                        content="Show alliance info"
                        className="w-full! min-w-0"
                      >
                        <Link
                          href={`/alliances/${alliance.id}?tab=killmails`}
                          className="block min-w-0 font-medium leading-tight text-ink-muted truncate hover:text-blue-400"
                          prefetch={false}
                        >
                          {alliance.name}
                        </Link>
                      </Tooltip>
                      {alliance.ticker && (
                        <span className="block text-sm leading-tight text-ink-faint truncate">
                          &lt;{alliance.ticker}&gt;
                        </span>
                      )}
                    </div>

                    {/* Kill Count */}
                    <span className="text-lg font-medium text-ink-muted tabular-nums whitespace-nowrap shrink-0">
                      {alliance.killCount.toLocaleString()}
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
