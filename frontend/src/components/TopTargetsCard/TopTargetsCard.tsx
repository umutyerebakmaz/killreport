'use client';

import { Loader } from '@/components/Loader/Loader';
import Card from '@/components/ui/Card';
import RankNumber from '@/components/ui/RankNumber';
import Tooltip from '@/components/Tooltip/Tooltip';
import Link from 'next/link';
import { ReactNode } from 'react';
import type { EveImageKind } from '@/utils/eveImageUrl';
import EveImage from '../ui/EveImage';

export interface TopTarget {
  id: number;
  name: string;
  count: number;
}

/** The three kinds a target can be — derived so the two lists cannot drift. */
type TargetType = Extract<
  EveImageKind,
  'alliance' | 'corporation' | 'character'
>;

export interface TopTargetsCardProps {
  title: string;
  subtitle?: ReactNode;
  targets: TopTarget[];
  loading?: boolean;
  emptyText?: string;
  targetType: TargetType;
  linkPrefix: string; // e.g., "/alliances", "/corporations", "/characters"
}

export default function TopTargetsCard({
  title,
  subtitle,
  targets,
  loading = false,
  emptyText = 'No targets yet',
  targetType,
  linkPrefix,
}: TopTargetsCardProps) {
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
      {targets.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
          <p className="text-sm font-medium text-center">{emptyText}</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/5">
          {targets.map((target, index) => (
            <div key={target.id} className="card-row">
              <div className="flex items-center gap-3">
                {/* Rank */}
                <RankNumber rank={index + 1} />

                {/* Logo/Portrait */}
                <div className="relative shrink-0">
                  <EveImage
                    kind={targetType}
                    id={target.id}
                    name={target.name}
                    size={64}
                  />
                </div>

                {/* Info */}
                <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
                  <Tooltip
                    content={`Show ${targetType} info`}
                    className="w-full! min-w-0"
                  >
                    <Link
                      href={`${linkPrefix}/${target.id}?tab=killmails`}
                      className="block min-w-0 font-medium text-gray-400 truncate hover:text-blue-400"
                      prefetch={false}
                    >
                      {target.name}
                    </Link>
                  </Tooltip>

                  {/* Kill Count */}
                  <span className="text-lg font-semibold text-gray-400 tabular-nums whitespace-nowrap shrink-0">
                    {target.count}
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
