'use client';

import { Loader } from '@/components/Loader/Loader';
import Card from '@/components/ui/Card';
import RankNumber from '@/components/ui/RankNumber';
import { ReactNode } from 'react';

export interface TopFaction {
  id: number;
  name: string;
  killCount: number;
}

export interface TopFactionsCardProps {
  title: string;
  subtitle?: ReactNode;
  factions: TopFaction[];
  loading?: boolean;
  emptyText?: string;
}

export default function TopFactionsCard({
  title,
  subtitle,
  factions,
  loading = false,
  emptyText = 'No factions yet',
}: TopFactionsCardProps) {
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
      {factions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
          <p className="text-sm font-medium text-center">{emptyText}</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/5">
          {factions.map((faction, index) => (
            <div key={faction.id} className="card-row">
              <div className="flex items-center gap-3">
                <RankNumber rank={index + 1} />

                {/*
                  CCP's image server has no /factions/ path — it returns 400,
                  and /alliances/ answers a faction id with the same blank
                  placeholder for every one of them. /corporations/ does accept
                  a faction id and serves the faction's own emblem: all 27
                  factions in the database come back as 27 distinct images.
                  Going through the faction's owning NPC corporation instead
                  drew that corporation's crest — Amarr Empire showed the
                  Imperial Navy logo.
                */}
                <div className="relative shrink-0">
                  <img
                    src={`https://images.evetech.net/corporations/${faction.id}/logo?size=128`}
                    alt={faction.name}
                    width={64}
                    height={64}
                    loading="lazy"
                  />
                </div>

                <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
                  <span className="block min-w-0 font-medium text-orange-400 truncate">
                    {faction.name}
                  </span>
                  <span className="text-lg font-semibold text-gray-400 tabular-nums whitespace-nowrap shrink-0">
                    {faction.killCount}
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
