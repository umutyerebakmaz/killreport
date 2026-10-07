'use client';

import EveImage from '@/components/ui/EveImage';
import { MapOwnerKind, type MapSovereigntyQuery } from '@/generated/graphql';
import { formatTimeAgo } from '@/utils/date';
import {
  countdownText,
  eventLabel,
  eveTimestamp,
  isLive,
  isStale,
  latestUpdate,
} from '@/utils/map/countdown';
import {
  ownerKindOf,
  SOV_COLORS,
  SOV_UNOWNED_TINT,
} from '@/utils/map/sovColors';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  LinkIcon,
  ViewfinderCircleIcon,
} from '@heroicons/react/24/outline';
import { useMemo, useState } from 'react';
import { useCopyLink } from './useCopyLink';
import SwordsIcon from './SwordsIcon';
import { useNow } from './useNow';
import type { SovCampaign } from './useSovCampaigns';
import { useSovChanges } from './useSovChanges';

type Owner = MapSovereigntyQuery['mapSovereignty']['owners'][number];

type Tab = 'timers' | 'owners' | 'changes';

const TABS: { id: Tab; label: string }[] = [
  { id: 'timers', label: 'Timers' },
  { id: 'owners', label: 'Owners' },
  { id: 'changes', label: 'Changes' },
];

/** The neutral the canvas draws an owner the dictionary does not name. */
const NEUTRAL = `#${SOV_UNOWNED_TINT.toString(16).padStart(6, '0')}`;

/**
 * The crest's drawn size in the list, square. The disc around it is `size-5`
 * — 20 px — which leaves exactly the 1 px rim of owner colour the map's own
 * disc shows. Move one and the other has to move with it.
 */
const CREST_PX = 18;

/** Below `sm` the panel starts folded: on a phone it would cover the map. */
function startsOpen(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(min-width: 640px)').matches
    : true;
}

/**
 * What the map draws for an owner — its crest on a disc of its colour, not a
 * swatch beside a name — so a reader looking from the list to the galaxy is
 * matching the same mark in both places.
 */
function OwnerMark({
  owner,
}: {
  owner: Pick<Owner, 'ownerId' | 'kind' | 'name'>;
}) {
  return (
    <span
      data-testid={`sov-owner-disc-${owner.ownerId}`}
      className="flex size-5 shrink-0 items-center justify-center rounded-full"
      // The dictionary hex, not a class: 101 colours cannot be Tailwind
      // classes, and this is the same value the canvas tints with.
      style={{ backgroundColor: SOV_COLORS[owner.ownerId] ?? NEUTRAL }}
    >
      {/* A faction's crest is served from the CORPORATION path; down the
          alliance path it answers 200 with the default emblem. */}
      <EveImage
        kind={owner.kind === MapOwnerKind.Alliance ? 'alliance' : 'corporation'}
        id={owner.ownerId}
        name={owner.name}
        size={CREST_PX}
      />
    </span>
  );
}

/**
 * One side of a territory change: the owner's mark and name, or "Unclaimed"
 * with no mark. The row carries no kind, so it is read from the id.
 */
function ChangeSide({
  ownerId,
  name,
}: {
  ownerId: number | null | undefined;
  name: string | null | undefined;
}) {
  if (ownerId == null) return <span className="shrink-0">Unclaimed</span>;
  const label = name ?? String(ownerId);
  return (
    <span className="flex min-w-0 items-center gap-x-1">
      <OwnerMark owner={{ ownerId, kind: ownerKindOf(ownerId), name: label }} />
      <span className="truncate">{label}</span>
    </span>
  );
}

/**
 * The sovereignty layer's side panel: what a fleet commander came for — the
 * timers — then who holds what, then what changed hands.
 *
 * It replaces the owner legend, whose list is now the Owners tab: one owner
 * list on the map, not two. The tab is component state, not URL state — a
 * shared link carries the system and the owner, and which tab the sender had
 * open is a preference.
 *
 * Every owner gets a row, with no "N others" tail: the panel is as tall as the
 * map and scrolls, so an owner left out of a list with room for it is just
 * missing. It collapses because a list that tall is also a wall in front of
 * the galaxy, which is the thing being read.
 */
export default function SovPanel({
  owners,
  campaigns,
  isolatedOwner,
  onIsolate,
  onFrameOwner,
  onFocusSystem,
  shareUrlFor,
}: {
  owners: readonly Owner[];
  campaigns: readonly SovCampaign[];
  isolatedOwner: number | null;
  onIsolate: (ownerId: number | null) => void;
  onFrameOwner: (ownerId: number) => void;
  onFocusSystem: (systemId: number) => void;
  shareUrlFor: (systemId: number) => string;
}) {
  const [open, setOpen] = useState(startsOpen);
  const [tab, setTab] = useState<Tab>('timers');
  // Latched: once the Changes tab has been opened its data stays, rather than
  // being skipped again — and refetched — on every return to it.
  const [changesWanted, setChangesWanted] = useState(false);

  const now = useNow(1_000, open && tab === 'timers' && campaigns.length > 0);
  const { copied, copy } = useCopyLink();
  const { changes, loading: changesLoading } = useSovChanges(changesWanted);

  const byHoldings = useMemo(
    () => [...owners].sort((a, b) => b.systemCount - a.systemCount),
    [owners],
  );
  const latest = latestUpdate(campaigns);

  const selectTab = (next: Tab) => {
    setTab(next);
    if (next === 'changes') setChangesWanted(true);
  };

  return (
    // Fixed in both directions while it is open, and auto only when there is
    // nothing under the header to size. The width is fixed because the rows
    // `truncate`: left to the content, the longest alliance name sets it and
    // nothing ever truncates. The height is fixed so the panel is the same
    // shape whoever holds sovereignty, and `max-h-full` still hands it back on
    // a viewport too short for it.
    <div
      className={`float flex w-72 max-w-full flex-col text-xs ${
        open ? 'h-240 max-h-full min-h-0' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        // No `aria-pressed`: this opens a panel, it is not a segment of a
        // group, and buttons.css reserves the selected fill for that.
        className="button button-ghost button-sm button-block shrink-0 gap-x-2"
      >
        {open ? (
          <ChevronDownIcon className="size-4" />
        ) : (
          <ChevronRightIcon className="size-4" />
        )}
        <span className="flex-1 text-left">Sovereignty</span>
        <span className="tabular-nums">
          {campaigns.length} {campaigns.length === 1 ? 'timer' : 'timers'}
        </span>
      </button>

      {open && (
        <>
          <div role="tablist" className="flex shrink-0 gap-1 px-3 pb-2">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => selectTab(id)}
                className="button button-secondary button-sm"
              >
                {label}
              </button>
            ))}
          </div>

          <div
            role="tabpanel"
            // `min-h-0` is what makes the scroll work: a flex child's default
            // min-height is its content, so without it the panel grows past
            // the column instead of overflowing inside it.
            className="flex min-h-0 flex-1 flex-col gap-y-1 overflow-y-auto px-3 pb-2"
          >
            {tab === 'timers' && (
              <>
                {isStale(latest, now) && latest && (
                  <p className="text-[11px] text-ink-faint">
                    Data as of {eveTimestamp(latest)}
                  </p>
                )}
                {campaigns.length === 0 ? (
                  <p className="text-ink-muted">No active campaigns</p>
                ) : (
                  campaigns.map((campaign) => {
                    const name =
                      campaign.solarSystemName ??
                      String(campaign.solarSystemId);
                    return (
                      <div
                        key={campaign.campaignId}
                        className="flex items-center gap-x-1"
                      >
                        <button
                          type="button"
                          onClick={() => onFocusSystem(campaign.solarSystemId)}
                          className="button button-ghost button-sm min-w-0 flex-1 flex-col items-stretch gap-y-0.5"
                        >
                          <span className="flex items-baseline justify-between gap-x-2">
                            <span className="truncate font-medium">{name}</span>
                            <span
                              className={`shrink-0 tabular-nums ${
                                isLive(campaign, now)
                                  ? 'text-danger'
                                  : 'text-accent'
                              }`}
                            >
                              {countdownText(campaign, now)}
                            </span>
                          </span>
                          <span className="truncate text-left text-ink-muted">
                            {campaign.regionName ?? '—'} ·{' '}
                            {campaign.defenderTicker ??
                              campaign.defenderName ??
                              '—'}{' '}
                            · {eventLabel(campaign.eventType)}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Copy link to ${name}`}
                          onClick={() =>
                            copy(
                              `timer:${campaign.campaignId}`,
                              shareUrlFor(campaign.solarSystemId),
                            )
                          }
                          className="button button-ghost button-sm shrink-0"
                        >
                          {copied === `timer:${campaign.campaignId}` ? (
                            'Copied'
                          ) : (
                            <LinkIcon className="size-4" />
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
              </>
            )}

            {tab === 'owners' &&
              (owners.length === 0 ? (
                <p className="text-ink-muted">Loading sovereignty...</p>
              ) : (
                byHoldings.map((owner) => {
                  const pressed = isolatedOwner === owner.ownerId;
                  return (
                    <div
                      key={owner.ownerId}
                      className="flex items-center gap-x-1"
                    >
                      <button
                        type="button"
                        aria-pressed={pressed}
                        onClick={() =>
                          onIsolate(pressed ? null : owner.ownerId)
                        }
                        className="button button-ghost button-sm min-w-0 flex-1 justify-start gap-x-2"
                      >
                        <OwnerMark owner={owner} />
                        <span className="flex-1 truncate text-left">
                          {owner.name}
                        </span>
                        <span className="tabular-nums text-ink-muted">
                          {owner.systemCount}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Show ${owner.name} on the map`}
                        onClick={() => onFrameOwner(owner.ownerId)}
                        className="button button-ghost button-sm shrink-0"
                      >
                        <ViewfinderCircleIcon className="size-4" />
                      </button>
                    </div>
                  );
                })
              ))}

            {tab === 'changes' &&
              (changes.length === 0 ? (
                <p className="text-ink-muted">
                  {changesLoading ? 'Loading changes...' : 'No recent changes'}
                </p>
              ) : (
                changes.map((change) => (
                  <button
                    key={change.id}
                    type="button"
                    onClick={() => onFocusSystem(change.solarSystemId)}
                    className="button button-ghost button-sm flex-col items-stretch gap-y-0.5"
                  >
                    <span className="flex items-baseline justify-between gap-x-2">
                      <span className="truncate font-medium">
                        {change.solarSystemName ?? change.solarSystemId}
                      </span>
                      <span className="shrink-0 text-ink-faint">
                        {formatTimeAgo(change.detectedAt, true)}
                      </span>
                    </span>
                    <span className="flex min-w-0 items-center gap-x-1.5 text-ink-muted">
                      <ChangeSide
                        ownerId={change.previousOwnerId}
                        name={change.previousOwnerName}
                      />
                      <SwordsIcon className="size-3.5 shrink-0 text-ink-faint" />
                      <span className="sr-only">to</span>
                      <ChangeSide
                        ownerId={change.newOwnerId}
                        name={change.newOwnerName}
                      />
                    </span>
                  </button>
                ))
              ))}
          </div>
        </>
      )}
    </div>
  );
}
