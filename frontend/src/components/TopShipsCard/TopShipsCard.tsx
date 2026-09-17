'use client';

import { Loader } from '@/components/Loader/Loader';
import Card from '@/components/ui/Card';
import RankNumber from '@/components/ui/RankNumber';
import ShipTierBadge from '@/components/ShipTierBadge/ShipTierBadge';
import Tooltip from '@/components/Tooltip/Tooltip';
import { getShipTier } from '@/utils/shipTier';
import { ReactNode } from 'react';
import EveImage from '../ui/EveImage';

export interface TopShip {
  id: number;
  name: string;
  killCount: number;
  dogmaAttributes?: Array<{ attribute_id: number; value: number }> | null;
}

export interface TopShipsCardProps {
  title: string;
  subtitle?: ReactNode;
  ships: TopShip[];
  loading?: boolean;
  emptyText?: string;
}

export default function TopShipsCard({
  title,
  subtitle,
  ships,
  loading = false,
  emptyText = 'No ships yet',
}: TopShipsCardProps) {
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
      {ships.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-ink-faint">
          <p className="text-sm font-medium text-center">{emptyText}</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/5">
          {ships.map((ship, index) => {
            const shipTier = getShipTier(ship.dogmaAttributes);

            return (
              <div key={ship.id} className="card-row">
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <RankNumber rank={index + 1} />

                  {/* Ship Image */}
                  <div className="relative shrink-0">
                    {/* Ship tier badge */}
                    {shipTier && (
                      <div className="absolute top-0 left-0 z-20">
                        <ShipTierBadge tier={shipTier} className="size-4" />
                      </div>
                    )}
                    <EveImage
                      kind="ship"
                      id={ship.id}
                      name={ship.name}
                      size={32}
                      className="size-8"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
                    <Tooltip
                      content={`View ship details`}
                      className="w-full! min-w-0"
                    >
                      <span className="block min-w-0 font-medium text-orange-400 truncate">
                        {ship.name}
                      </span>
                    </Tooltip>

                    {/* Kill Count */}
                    <span className="text-base font-medium text-ink-muted tabular-nums whitespace-nowrap shrink-0">
                      {ship.killCount}
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
