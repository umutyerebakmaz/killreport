import { formatPercent } from '@/utils/formatPercent';
import { attackerBadge } from '../KillmailsTable/attackerBadge';
import { KillmailQuery } from '@/generated/graphql';
import { getShipTier } from '@/utils/shipTier';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import EveImage from '../ui/EveImage';
import ShipTierBadge from '../ShipTierBadge/ShipTierBadge';
import Tooltip from '../Tooltip/Tooltip';

interface AttackerProps {
  attacker: NonNullable<KillmailQuery['killmail']>['attackers'][0];
  totalDamage: number;
  isFinalBlow?: boolean;
  isTopDamage?: boolean;
  /**
   * Only `solo` and `npc` are read here, and both are facts about the
   * killmail rather than about this attacker — which is why the badges they
   * drive repeat identically on every row. Asking for the whole killmail
   * said this row depended on far more than it does.
   */
  killmail: Pick<NonNullable<KillmailQuery['killmail']>, 'solo' | 'npc'>;
}

export default function AttackerRow({
  attacker,
  totalDamage,
  isFinalBlow,
  isTopDamage,
  killmail,
}: AttackerProps) {
  const damagePercentage = formatPercent(attacker.damageDone, totalDamage);

  // Use backend-computed fields
  const isSolo = killmail.solo;
  // The table's and the card header's rule (attackerBadge): one marker per
  // killmail. A lone NPC is NPC, not SOLO and NPC side by side; NPCs in a
  // fight are NPC too; players in a fight get none.
  const badge = attackerBadge({ solo: killmail.solo, npc: killmail.npc });
  const killmailMarker =
    badge === 'solo' ? 'SOLO' : badge === 'count' ? null : 'NPC';

  return (
    <div className="p-3 transition-colors duration-100 bg-surface hover:bg-surface-inset">
      <div className="flex">
        {/*
         * One positioning context for the whole portrait slot, whichever of
         * the three images fills it. Each branch used to write its own
         * `relative`, so the security status could only ever be drawn on a
         * character — and there was nowhere to hang the badges.
         */}
        <div className="relative shrink-0">
          {attacker.character?.id ? (
            <EveImage
              kind="character"
              id={attacker.character.id}
              name={attacker.character.name || 'Character'}
              size={64}
            />
          ) : attacker.corporation?.id ? (
            <EveImage
              kind="corporation"
              id={attacker.corporation.id}
              name={attacker.corporation.name || 'Corporation'}
              size={64}
            />
          ) : attacker.shipType?.id ? (
            /* An NPC with neither a character nor a corporation: its ship is
               the only image the killmail query carries — there is no faction
               field on the attacker. */
            <EveImage
              kind="ship"
              id={attacker.shipType.id}
              name={attacker.shipType.name || 'NPC ship'}
              size={64}
            />
          ) : (
            /* Not even a ship: the same placeholder the two slots below use. */
            <div className="flex items-center justify-center shadow-md size-16">
              <QuestionMarkCircleIcon className="text-ink-muted size-8" />
            </div>
          )}

          {/* Security Status - Bottom Left */}
          {attacker.securityStatus !== null &&
            attacker.securityStatus !== undefined && (
              <div className="absolute bottom-0 left-0 px-1.5 py-0.5 text-xs font-medium bg-black/70 backdrop-blur-sm">
                <span
                  className={
                    attacker.securityStatus >= 0
                      ? 'text-dropped'
                      : 'text-destroyed'
                  }
                >
                  {attacker.securityStatus.toFixed(1)}
                </span>
              </div>
            )}
        </div>

        <div className="flex flex-col pr-4 shrink-0">
          <Tooltip content={attacker.shipType?.name || 'Unknown Ship'}>
            <div className="relative">
              {attacker.shipType?.id && getShipTier(attacker.shipType) && (
                <div className="absolute top-0 left-0 z-20">
                  <ShipTierBadge
                    tier={getShipTier(attacker.shipType)}
                    className="size-4"
                  />
                </div>
              )}
              {attacker.shipType?.id ? (
                <EveImage
                  kind="ship"
                  id={attacker.shipType.id}
                  name={attacker.shipType.name || 'Ship'}
                  size={32}
                />
              ) : (
                <div className="flex items-center justify-center shadow-md size-8">
                  <QuestionMarkCircleIcon className="text-ink-muted size-4" />
                </div>
              )}
            </div>
          </Tooltip>
          <Tooltip content={attacker.weaponType?.name || 'Unknown Weapon'}>
            {attacker.weaponType?.id ? (
              <EveImage
                kind="type"
                id={attacker.weaponType.id}
                name={attacker.weaponType.name || 'Weapon'}
                size={32}
                className="bg-white/5"
              />
            ) : attacker.shipType?.id ? (
              <EveImage
                kind="ship"
                id={attacker.shipType.id}
                name={attacker.shipType.name || 'Ship'}
                size={32}
                className="bg-white/5"
              />
            ) : (
              <div className="flex items-center justify-center shadow-md size-8 bg-surface-inset">
                <QuestionMarkCircleIcon className="text-ink-muted size-4" />
              </div>
            )}
          </Tooltip>
        </div>

        <div className="flex justify-between w-full">
          {/* Character Name, Corporation, Alliance */}
          <div className="flex flex-col leading-tight space-y-0.5">
            {attacker.character?.id ? (
              /* No ship name here: the ship is already in the slot beside the
                 portrait, with its name in that slot's tooltip. Printing it
                 again put a second line of orange above every pilot. */
              <Tooltip content="Show Character Info">
                <Link
                  href={`/characters/${attacker.character?.id}`}
                  className="font-medium text-ink-muted hover:text-accent-link"
                  prefetch={false}
                >
                  {attacker.character?.name || 'Unknown'}
                </Link>
              </Tooltip>
            ) : (
              /* An NPC has no pilot to name, so the ship type is the only
                 label this row can carry. */
              attacker.shipType?.name && (
                <div className="text-base text-orange-400">
                  {attacker.shipType.name}
                </div>
              )
            )}

            {/*
             * One organisation line, not two. The row used to print the
             * corporation and the alliance under each other; the alliance is
             * the one that places a pilot, so it wins, and the corporation is
             * what is left to say when there is no alliance.
             */}
            {attacker.alliance?.id ? (
              <Tooltip content="Show Alliance Info">
                <Link
                  href={`/alliances/${attacker.alliance.id}`}
                  className="text-sm text-ink-muted hover:text-accent-link"
                  prefetch={false}
                >
                  {attacker.alliance.name || 'Unknown'}
                </Link>
              </Tooltip>
            ) : attacker.corporation?.id ? (
              <Tooltip content="Show Corporation Info">
                <Link
                  href={`/corporations/${attacker.corporation.id}`}
                  className="text-sm text-ink-muted hover:text-accent-link"
                  prefetch={false}
                >
                  {attacker.corporation.name || 'Unknown'}
                </Link>
              </Tooltip>
            ) : null}
          </div>

          {/* Damage, Damage Percentage. The corporation and alliance logos
              that used to sit under this were saying, in pictures, what the
              organisation line already says in words. */}
          <div className="flex flex-col items-end text-sm gap-y-1">
            {/* A logi or ECM pilot on the killmail did no damage, and a
                column reading "0 / 0.0%" is a line of noise saying nothing.
                The row still shows who they were and what they flew. */}
            {attacker.damageDone > 0 && (
              <>
                <span className="text-destroyed">
                  {attacker.damageDone.toLocaleString()}
                </span>
                <span className="text-ink-muted">{damagePercentage}</span>
              </>
            )}

            {/* Plain text rather than `.tag`: a badge's ground and padding
                made more boxes in a column that already has a figure and a
                percentage. SOLO and NPC are facts about the killmail rather
                than this attacker, but they sit here too, in the same type, so
                every marker on a row is in one place — they used to be tags
                above the pilot's name. Several can be true at once, so they
                sit side by side. */}
            <div className="flex gap-2">
              {killmailMarker && (
                <span
                  className={`text-xs font-light whitespace-nowrap ${
                    killmailMarker === 'SOLO'
                      ? 'text-dropped'
                      : 'text-destroyed'
                  }`}
                >
                  {killmailMarker}
                </span>
              )}
              {isFinalBlow && !isSolo && (
                <span className="text-xs font-light text-destroyed whitespace-nowrap">
                  FINAL BLOW
                </span>
              )}
              {isTopDamage && !isSolo && (
                <span className="text-xs font-light text-orange-400 whitespace-nowrap">
                  TOP DAMAGE
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
