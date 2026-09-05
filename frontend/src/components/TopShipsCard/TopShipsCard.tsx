'use client';

import { Loader } from '@/components/Loader/Loader';
import Card from '@/components/ui/Card';
import RankNumber from '@/components/ui/RankNumber';
import ShipTierBadge from '@/components/ShipTierBadge/ShipTierBadge';
import Tooltip from '@/components/Tooltip/Tooltip';
import { getShipTier } from '@/utils/shipTier';
import { ReactNode } from 'react';

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
  variant?: 'detail' | 'list';
}

export default function TopShipsCard({
  title,
  subtitle,
  ships,
  loading = false,
  emptyText = 'No ships yet',
  variant = 'detail',
}: TopShipsCardProps) {
  const header = (
    <>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {subtitle && (
        <p className="flex items-center justify-between text-xs text-gray-500">
          {subtitle}
        </p>
      )}
    </>
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
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
          <p className="text-sm font-medium text-center">{emptyText}</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/5">
          {ships.map((ship, index) => {
            const shipTier = getShipTier(ship.dogmaAttributes);

            return (
              <div
                key={ship.id}
                className={`p-3 transition-colors duration-100 ${
                  variant === 'list'
                    ? 'bg-neutral-900 hover:bg-neutral-800'
                    : 'bg-neutral-800 hover:bg-neutral-700'
                }`}
              >
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
                    <img
                      src={`https://images.evetech.net/types/${ship.id}/render?size=128`}
                      alt={ship.name}
                      className="shadow-md size-12"
                      loading="lazy"
                      onError={(e) => {
                        // Fallback to icon if render fails (e.g., for some faction ships)
                        const target = e.target as HTMLImageElement;
                        if (target.src.includes('/render?')) {
                          target.src = `https://images.evetech.net/types/${ship.id}/icon?size=128`;
                        }
                      }}
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
                    <span className="text-lg font-semibold text-gray-400 tabular-nums whitespace-nowrap shrink-0">
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
