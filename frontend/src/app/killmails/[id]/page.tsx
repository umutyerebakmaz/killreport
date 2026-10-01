'use client';

import AttackersCard from '@/components/AttackersCard';
import FitScreen from '@/components/FitScreen/FitScreen';
import KillmailSummaryCard from '@/components/KillmailSummaryCard/KillmailSummaryCard';
import { Loader } from '@/components/Loader/Loader';
import Tooltip from '@/components/Tooltip/Tooltip';
import SummaryRow from '@/components/ui/SummaryRow';
import { useKillmailQuery } from '@/generated/graphql';
import { formatISK } from '@/utils/formatISK';
import {
  ArrowTopRightOnSquareIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { use, useState } from 'react';
import EveImage from '@/components/ui/EveImage';

export default function KillmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [copied, setCopied] = useState(false);
  const { data, loading, error } = useKillmailQuery({
    variables: { id },
  });

  const handleShare = async () => {
    try {
      const shareUrl = `${window.location.origin}/killmails/${id}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('failed to copy to clipboard:', err);
    }
  };

  if (loading) {
    return <Loader fullHeight size="lg" text="Loading killmail detail..." />;
  }

  if (error || !data?.killmail) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-danger">
          Error: {error?.message || 'Killmail not found'}
        </div>
      </div>
    );
  }

  const km = data.killmail;
  const victim = km.victim;
  const attackers = km.attackers || []; // final blow, top damage and +8 more: 10 in total on first load.
  const fitting = km.fitting;

  // Check if victim is a structure
  const isStructure = victim?.shipType?.group?.category?.name === 'Structure';

  // Use the values computed by the backend
  const totalValue = km.totalValue || 0;
  const destroyedValue = km.destroyedValue || 0;
  const droppedValue = km.droppedValue || 0;

  return (
    <>
      {/*
       * One grid at 2xl: fit | victim | attackers, split 2fr / 1fr / 1fr. The
       * fit card is a size container and the fit screen zooms to fill it (see
       * .fit-screen-container in globals.css), so the extra width goes to the
       * fit rather than the side cards. The second row is 1fr so a long
       * attackers list, which spans both rows, grows only that row and never
       * pushes the summary card down. Below 2xl the three do not fit side by
       * side, so the cards stack in the same order: fit, victim, summary,
       * attackers.
       */}
      <div className="flex flex-col gap-6 2xl:grid 2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] 2xl:grid-rows-[auto_1fr]">
        {/* Fit screen — first. The extra bottom padding a structure fit
                needs belongs to this card alone; it used to be applied to the
                summary too, because the two shared one card. */}
        <div
          className={
            isStructure
              ? '@container px-2 pt-2 pb-32 card 2xl:col-start-1 2xl:row-start-1'
              : '@container p-2 card 2xl:col-start-1 2xl:row-start-1'
          }
        >
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-2 pb-6">
              <a
                href={`https://zkillboard.com/kill/${km.id}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="button button-secondary button-sm"
              >
                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                zKillboard
              </a>
              <a
                href={`https://esi.evetech.net/killmails/${km.id}/${km.killmailHash}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="button button-secondary button-sm"
              >
                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                ESI Verified
              </a>
              <button
                onClick={handleShare}
                className="button button-secondary button-sm"
              >
                {copied ? (
                  <>
                    <CheckIcon className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                    Share
                  </>
                )}
              </button>
            </div>
          </div>
          <FitScreen shipType={victim?.shipType} fitting={fitting} />
        </div>

        {/* Victim summary — second, beside the fit */}
        <div className="p-2 card 2xl:col-start-2 2xl:row-start-1">
          <div className="space-y-3">
            {/* Character, Corp, Alliance Images */}
            {(victim?.character?.id ||
              victim?.corporation?.id ||
              victim?.alliance?.id) && (
              <div className="flex items-start overflow-hidden">
                {/* Character Portrait or Ship Render */}
                {victim?.character?.id ? (
                  <Tooltip content="Show Victim Info" position="top">
                    <a href={`/characters/${victim.character?.id}`}>
                      <EveImage
                        kind="character"
                        id={victim.character.id}
                        name={victim.character.name || 'Character'}
                        size={96}
                        className="shadow-md shrink-0"
                      />
                    </a>
                  </Tooltip>
                ) : victim?.shipType?.id ? (
                  <Tooltip
                    content={victim.shipType.name || 'Structure'}
                    position="top"
                  >
                    <div
                      className="flex items-center justify-center bg-surface-inset shrink-0"
                      style={{ width: 96, height: 96 }}
                    >
                      <EveImage
                        kind="ship"
                        id={victim.shipType.id}
                        name={victim.shipType.name || 'Structure'}
                        size={96}
                        className="shadow-md shrink-0"
                      />
                    </div>
                  </Tooltip>
                ) : null}

                <div className="flex flex-col shrink-0">
                  {/* Corporation Portrait */}
                  {victim?.corporation?.id && (
                    <a href={`/corporations/${victim.corporation?.id}`}>
                      <EveImage
                        kind="corporation"
                        id={victim.corporation.id}
                        name={victim.corporation.name || 'Corporation'}
                        size={48}
                        className="shadow-sm"
                      />
                    </a>
                  )}
                  {/* Alliance Portrait */}
                  {victim?.alliance?.id && (
                    <a href={`/alliances/${victim.alliance?.id}`}>
                      <EveImage
                        kind="alliance"
                        id={victim.alliance.id}
                        name={victim.alliance.name || 'Alliance'}
                        size={48}
                        className="shadow-sm"
                      />
                    </a>
                  )}
                </div>

                <div className="flex flex-col items-start justify-start flex-1 min-w-0 pl-4 overflow-hidden">
                  {victim?.character?.id && (
                    <a
                      href={`/characters/${victim.character?.id}`}
                      title={victim.character?.name || 'Character'}
                      className="block w-full text-ink-muted truncate transition-colors hover:text-accent-link"
                    >
                      {victim.character?.name}
                    </a>
                  )}

                  {victim?.corporation?.id && (
                    <Tooltip content="Show corporation info">
                      <a
                        href={`/corporations/${victim.corporation?.id}`}
                        title={victim.corporation?.name || 'Corporation'}
                        className="block w-full text-ink-muted truncate transition-colors hover:text-accent-link"
                      >
                        {victim.corporation?.name}
                      </a>
                    </Tooltip>
                  )}

                  {victim?.alliance?.id && (
                    <Tooltip content="Show alliance info">
                      <a
                        href={`/alliances/${victim.alliance?.id}`}
                        title={victim.alliance?.name || 'Alliance'}
                        className="block w-full text-ink-muted truncate transition-colors hover:text-accent-link"
                      >
                        {victim.alliance?.name}
                      </a>
                    </Tooltip>
                  )}
                </div>
              </div>
            )}

            <SummaryRow label="Ship">
              {victim?.shipType?.name}
              {victim?.shipType?.group && (
                <span className="text-ink-faint">
                  {' '}
                  ({victim.shipType.group.name})
                </span>
              )}
            </SummaryRow>

            <SummaryRow label="System">
              {km.solarSystem?.name}
              {/* EVE's own security colour code, not one of the meaning
                      tokens — green/yellow/red here mean high/low/null sec. */}
              {km.solarSystem?.securityStatus !== undefined &&
                km.solarSystem.securityStatus !== null && (
                  <span
                    className={
                      km.solarSystem.securityStatus >= 0.5
                        ? 'text-green-400'
                        : km.solarSystem.securityStatus > 0
                          ? 'text-yellow-400'
                          : 'text-red-400'
                    }
                  >
                    {' '}
                    ({km.solarSystem.securityStatus.toFixed(1)})
                  </span>
                )}
              {km.solarSystem?.constellation?.region && (
                <span className="text-ink-faint">
                  {' '}
                  / {km.solarSystem.constellation.region.name}
                </span>
              )}
            </SummaryRow>

            <SummaryRow label="Time">
              {new Date(km.killmailTime).toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </SummaryRow>

            <SummaryRow label="Damage">
              <span className="text-destroyed tabular-nums">
                {victim?.damageTaken?.toLocaleString()}
              </span>
            </SummaryRow>

            <div className="space-y-2">
              <SummaryRow label="Destroyed">
                <span className="text-destroyed tabular-nums">
                  {formatISK(destroyedValue)}
                </span>
              </SummaryRow>
              <SummaryRow label="Dropped">
                <span className="text-dropped tabular-nums">
                  {formatISK(droppedValue)}
                </span>
              </SummaryRow>
              <SummaryRow label="Total">
                <span className="font-bold text-isk tabular-nums">
                  {formatISK(totalValue)}
                </span>
              </SummaryRow>
              {km.isWarRelated && (
                <div className="pt-2">
                  <span className="tag text-orange-400 bg-orange-400/10">
                    WAR KILL — sovereignty campaign
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Killmail Summary Card — under the fit and the victim */}
        <div className="2xl:col-span-2 2xl:col-start-1 2xl:row-start-2">
          <KillmailSummaryCard
            victim={victim}
            fitting={fitting}
            isStructure={isStructure}
            destroyedValue={destroyedValue}
            droppedValue={droppedValue}
            totalValue={totalValue}
          />
        </div>

        {/* Attackers — the right column, down both rows */}
        <div className="2xl:col-start-3 2xl:row-span-2 2xl:row-start-1">
          <AttackersCard attackers={attackers} killmail={km} />
        </div>
      </div>
    </>
  );
}
