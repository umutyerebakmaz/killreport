'use client';

import { Loader } from '@/components/Loader/Loader';
import Card from '@/components/ui/Card';
import RankNumber from '@/components/ui/RankNumber';
import Tooltip from '@/components/Tooltip/Tooltip';
import { getSecurityStatusBorderColor } from '@/utils/securityStatus';
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
      <h3 className="card-title">{title}</h3>
      {subtitle && (
        <span className="text-xs text-ink-muted shrink-0">{subtitle}</span>
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
            const secBorder = getSecurityStatusBorderColor(
              character.securityStatus,
            );
            return (
              // Every row takes a stripe, an unresolved security status
              // included, so the 4px never changes the indent from one row to
              // the next. The stripe is the only place the status appears in
              // this list now — the figure that sat after the name was read as
              // noise. A band is four points wide, so the exact value is on
              // the character's own page.
              <div
                key={character.id}
                className={`card-row border-l-4 ${secBorder}`}
              >
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
                    <div className="min-w-0 leading-tight">
                      <Tooltip
                        content="Show character info"
                        className="min-w-0"
                      >
                        <Link
                          href={`/characters/${character.id}?tab=killmails`}
                          className="block min-w-0 font-medium leading-tight text-ink-muted truncate hover:text-accent-link"
                          prefetch={false}
                        >
                          {character.name}
                        </Link>
                      </Tooltip>
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
