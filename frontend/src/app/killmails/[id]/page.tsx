'use client';

import AttackersCard from '@/components/AttackersCard';
import FitScreen from '@/components/FitScreen/FitScreen';
import KillmailSummaryCard from '@/components/KillmailSummaryCard/KillmailSummaryCard';
import { Loader } from '@/components/Loader/Loader';
import Tooltip from '@/components/Tooltip/Tooltip';
import SummaryRow from '@/components/ui/SummaryRow';
import { useKillmailQuery } from '@/generated/graphql';
import { formatEveDateTime, formatTimeAgo } from '@/utils/date';
import { formatISK } from '@/utils/formatISK';
import {
  ArrowTopRightOnSquareIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { use, useState } from 'react';
import EveImage from '@/components/ui/EveImage';
import MembershipLink from '@/components/ui/MembershipLink';
import Link from 'next/link';

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
        {/* No padding on the card itself: the portrait runs to its top and
            side edges, and the rows below get the card's usual p-2 on their
            own. overflow-hidden lets the card's edge cut the picture. */}
        <div className="overflow-hidden card 2xl:col-start-2 2xl:row-start-1">
          {/*
           * The account menu's portrait (UserMenu): the picture always as
           * wide as the card and square, with the name and the memberships
           * over its darkened bottom band. Below 2xl the card spans the page,
           * so the height stops at 512px and object-cover crops the picture
           * to a band around the face rather than drawing a huge square. A
           * victim with no character — a structure, an NPC — shows the
           * ship's render in its place.
           */}
          {(victim?.character?.id || victim?.shipType?.id) && (
            <div className="relative w-full overflow-hidden aspect-square max-h-128 bg-surface-inset">
              {victim?.character?.id ? (
                <EveImage
                  kind="character"
                  id={victim.character.id}
                  name={victim.character.name || 'Character'}
                  size={512}
                  className="object-cover size-full"
                />
              ) : (
                victim?.shipType?.id && (
                  <EveImage
                    kind="ship"
                    id={victim.shipType.id}
                    name={victim.shipType.name || 'Structure'}
                    size={512}
                    className="object-contain size-full"
                  />
                )
              )}
              {/* The menu's scrim, at its height, so the text reads over
                  any portrait. */}
              <div className="absolute inset-x-0 bottom-0 h-24 pointer-events-none bg-linear-to-t from-black/95 via-black/70 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3 space-y-1.5">
                {victim?.character?.id && (
                  <Link
                    href={`/characters/${victim.character.id}`}
                    className="block font-medium text-white truncate transition-colors hover:text-accent-link"
                  >
                    {victim.character.name}
                  </Link>
                )}
                {(victim?.corporation?.id || victim?.alliance?.id) && (
                  <div className="flex items-center gap-3">
                    {victim?.corporation?.id && (
                      <MembershipLink
                        kind="corporation"
                        logoSize={32}
                        entity={{
                          id: victim.corporation.id,
                          name: victim.corporation.name || 'Corporation',
                        }}
                      />
                    )}
                    {victim?.alliance?.id && (
                      <MembershipLink
                        kind="alliance"
                        logoSize={32}
                        entity={{
                          id: victim.alliance.id,
                          name: victim.alliance.name || 'Alliance',
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="p-2 space-y-3">
            <SummaryRow label="Ship">
              {/* The killmail table's ship orange (KillmailRow). */}
              <span className="font-medium text-orange-400">
                {victim?.shipType?.name}
              </span>
              {victim?.shipType?.group && (
                <span className="text-ink-faint">
                  {' '}
                  ({victim.shipType.group.name})
                </span>
              )}
            </SummaryRow>

            <SummaryRow label="System">
              {/* The killmail table's target (KillmailRow), with the card's
                  own link hover rather than the table's orange. */}
              {km.solarSystem?.id ? (
                <Link
                  href={`/solar-systems/${km.solarSystem.id}?tab=killmails`}
                  className="transition-colors hover:text-accent-link"
                  prefetch={false}
                >
                  {km.solarSystem.name}
                </Link>
              ) : (
                km.solarSystem?.name
              )}
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
                    {km.solarSystem.securityStatus.toFixed(1)}
                  </span>
                )}
              {km.solarSystem?.constellation?.region && (
                <span className="text-ink-faint">
                  {' '}
                  /{' '}
                  <Link
                    href={`/regions/${km.solarSystem.constellation.region.id}`}
                    className="transition-colors hover:text-accent-link"
                    prefetch={false}
                  >
                    {km.solarSystem.constellation.region.name}
                  </Link>
                </span>
              )}
            </SummaryRow>

            <SummaryRow label="Time">
              {/* How long ago, then the header clock's own label
                  (StatusReadout), so the row itself is just the date. */}
              <Tooltip
                content={
                  <div>
                    <div>{formatTimeAgo(km.killmailTime)}</div>
                    <div className="text-ink-faint">EVE time (UTC)</div>
                  </div>
                }
              >
                {formatEveDateTime(km.killmailTime)}
              </Tooltip>
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
