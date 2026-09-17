'use client';

import { Loader } from '@/components/Loader/Loader';
import Card from '@/components/ui/Card';
import RankNumber from '@/components/ui/RankNumber';
import Tooltip from '@/components/Tooltip/Tooltip';
import { getSecurityStatusColor } from '@/utils/securityStatus';
import Link from 'next/link';
import { ReactNode } from 'react';
import EveImage from '../ui/EveImage';

export interface TopCharacter {
  id: number;
  name: string;
  killCount: number;
  securityStatus?: number | null;
}

export interface TopCharacterCardProps {
  title: string;
  subtitle?: ReactNode;
  characters: TopCharacter[];
  loading?: boolean;
  emptyText?: string;
}

export default function TopCharacterCard({
  title,
  subtitle,
  characters,
  loading = false,
  emptyText = 'No characters',
}: TopCharacterCardProps) {
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
      {characters.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-ink-faint">
          <p className="text-sm font-medium text-center">{emptyText}</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-white/5">
          {characters.map((character, index) => {
            const secColor = getSecurityStatusColor(character.securityStatus);
            return (
              <div key={character.id} className="card-row">
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <RankNumber rank={index + 1} />

                  {/* Portrait */}
                  <EveImage
                    kind="character"
                    id={character.id}
                    name={character.name}
                    size={32}
                    className="shrink-0"
                  />

                  {/* Info */}
                  <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
                    <div className="flex items-baseline min-w-0 gap-2 leading-tight">
                      <Tooltip
                        content="Show character info"
                        className="min-w-0"
                      >
                        <Link
                          href={`/characters/${character.id}?tab=killmails`}
                          className="block min-w-0 font-medium leading-tight text-ink-muted truncate hover:text-blue-400"
                          prefetch={false}
                        >
                          {character.name}
                        </Link>
                      </Tooltip>
                      {/* The security figure used to sit on the portrait. At
                          32px it covered half of it, so it reads as a value
                          after the name instead. */}
                      {character.securityStatus != null && (
                        <span
                          className={`text-base leading-tight tabular-nums shrink-0 ${secColor}`}
                        >
                          {character.securityStatus.toFixed(1)}
                        </span>
                      )}
                    </div>

                    {/* Kill Count */}
                    <span className="text-base font-medium text-ink-muted tabular-nums whitespace-nowrap shrink-0">
                      {character.killCount}
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
