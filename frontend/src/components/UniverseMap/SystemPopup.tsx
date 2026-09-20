'use client';

import EveImage from '@/components/ui/EveImage';
import {
  MapOwnerKind,
  useMapSystemDetailsQuery,
  type MapSystemDetailsQuery,
} from '@/generated/graphql';
import { formatTimeAgo } from '@/utils/date';
import { clampOverlay, popupHeightPx } from '@/utils/map/overlay';
import { SOV_COLORS, SOV_UNOWNED_TINT } from '@/utils/map/sovColors';
import { formatSecurityStatus, getSecurityColor } from '@/utils/security';
import { ArrowRightEndOnRectangleIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useEffect } from 'react';

/** How far the panel's top edge clears the system's own disc. */
const POPUP_GAP_PX = 12;

const POPUP_WIDTH_PX = 280;

/** The neutral the canvas draws an owner the colour dictionary does not name. */
const NEUTRAL = `#${SOV_UNOWNED_TINT.toString(16).padStart(6, '0')}`;

/**
 * The crest's drawn size, square, on a 26 px disc.
 *
 * Bigger than the legend's 18 on 20, and deliberately: the legend is a list of
 * up to 98 rows where the crest is a lookup key, and this is the one owner the
 * reader is actually asking about. What the two share is the 1 px rim of owner
 * colour around the artwork — that ratio is the mark, not the size.
 */
const CREST_PX = 24;
const CREST_DISC_PX = CREST_PX + 2;

type Details = NonNullable<MapSystemDetailsQuery['mapSystemDetails']>;
type Owner = NonNullable<Details['owner']>;
type Stargate = Details['stargates'][number];

/**
 * The owner's crest on a disc of its colour — the same mark the map draws past
 * `SOV_LOGO_ZOOM` and the same one the legend lists, so the popup identifies
 * the system's holder with the mark the reader has already learned rather than
 * with a second vocabulary.
 */
function OwnerCrest({ owner }: { owner: Owner }) {
  return (
    <span
      data-testid={`popup-owner-disc-${owner.ownerId}`}
      className="flex items-center justify-center rounded-full shrink-0"
      // The dictionary hex, not a class: 101 colours cannot be Tailwind
      // classes, and this is the same value the canvas tints with. The size
      // joins it inline so the disc and the crest cannot drift apart.
      style={{
        backgroundColor: SOV_COLORS[owner.ownerId] ?? NEUTRAL,
        width: CREST_DISC_PX,
        height: CREST_DISC_PX,
      }}
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
 * One way out of the system, as a chip.
 *
 * The DESTINATION's name, not the gate's: every row in `stargates` is called
 * `Stargate (Perimeter)`, so under a heading that already says Stargates the
 * word carries nothing and the parenthesis is the whole message.
 *
 * The link is `/map?focus=` rather than the system page, because the reader is
 * on the map and the thing they asked for is one jump away on it. `useMapCamera`
 * has carried `focus` in the URL since phase 1, so this needs no new plumbing.
 *
 * `button-outline`: bordered, but with no ground of its own. Secondary was
 * here first and had to go — its `bg-surface` (#2b2b2c) landed within a
 * rounding step of the stat boxes' `bg-white/5` over the panel (≈#2c2c2c), so
 * the one thing in the panel that can be clicked looked exactly like the four
 * things that cannot, and the hover was carrying the whole affordance alone.
 */
function StargateChip({ gate }: { gate: Stargate }) {
  return (
    <Link
      href={`/map?focus=${gate.destinationSystemId}`}
      // `justify-start` overrides `.button`'s centring, and `min-w-0` is what
      // lets the name truncate: a grid item's min-width is `auto`, so without
      // it "Nourvukaiken" widens its own cell and the two columns stop
      // matching — which is the whole point of the grid.
      className="button button-outline button-sm justify-start min-w-0"
    >
      <ArrowRightEndOnRectangleIcon className="size-3.5 shrink-0" />
      <span className="truncate">{gate.destinationName}</span>
      {/* The destination's own security status, coloured the way the panel's
          own is — so a reader can see which of the ways out is the dangerous
          one without leaving the popup. `ml-auto` pins it to the right edge of
          every chip, so the numbers form a column the eye can run down instead
          of landing wherever each name happens to end.

          It keeps its colour on hover, where `button-outline` takes the label
          to white: the colour IS the value here, not decoration. */}
      <span
        className={`ml-auto shrink-0 font-normal ${getSecurityColor(gate.destinationSecurityStatus)}`}
      >
        {formatSecurityStatus(gate.destinationSecurityStatus)}
      </span>
    </Link>
  );
}

/**
 * One hourly number.
 *
 * The page's own stat box is `SolarSystemDetail/SystemStatsStrip`'s `Box`; this
 * is that box at popup scale — p-2 rather than p-4, and a base value rather
 * than text-2xl.
 *
 * A null value is an em dash, not a zero, the way that file's Busiest Hour box
 * already does it: ESI not reporting a system is not the same as reporting no
 * activity, and `system_activity.ship_jumps` was left nullable so the
 * difference survives to here.
 */
function Box({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="p-2 border bg-white/5 border-white/10">
      <div className="text-[10px] tracking-wide text-ink-muted uppercase">
        {label}
      </div>
      <div className="text-base font-medium text-gray-100">
        {value === null ? '—' : value.toLocaleString('en-US')}
      </div>
    </div>
  );
}

function SkeletonBox() {
  return (
    <div className="p-2 border bg-white/5 border-white/10">
      <div className="w-12 h-2 bg-white/10 animate-pulse" />
      <div className="w-8 h-4 mt-1 bg-white/10 animate-pulse" />
    </div>
  );
}

/**
 * The selected system, anchored to its dot.
 *
 * An ordinary React component over the canvas rather than anything drawn into
 * it — which is what the phase 1-2 design already called for, and the one part
 * of its Popup paragraph that survived the move off deck.gl.
 *
 * Two things it must do: stay inside the viewport, and close on Escape.
 *
 * The phase 1-2 design named a third — stop its own pointer events, or a drag
 * starting on the panel pans the map — and it is back. It lapsed while the
 * pan, zoom and click listeners were on the canvas, a SIBLING of this panel
 * that its events never visited; the DOM label overlay moved them up to the
 * host, and this panel is a child of that host.
 *
 * `data-map-overlay` rather than a stopPropagation handler, because there is
 * nowhere to put one that works. React delegates to the root container, an
 * ANCESTOR of the host, so an `onPointerDown` here runs only after the host's
 * own listener already has. A native listener on this div would be early
 * enough, but stopping the event there also stops it reaching that root —
 * which is where React reads the click the link below needs. So the press and
 * the wheel are declined by `useMapPointer` instead, and every click is left
 * alone.
 */
export default function SystemPopup({
  systemId,
  screenX,
  screenY,
  anchorRadius,
  viewportWidth,
  viewportHeight,
  onClose,
}: {
  systemId: number;
  screenX: number;
  screenY: number;
  /** The system's drawn radius in pixels, which the panel opens clear of. */
  anchorRadius: number;
  viewportWidth: number;
  viewportHeight: number;
  onClose: () => void;
}) {
  const { data, loading, error } = useMapSystemDetailsQuery({
    variables: { systemId },
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const details = data?.mapSystemDetails;

  // `anchorRadius` is the disc's own size, not a constant: the dots grow with
  // the camera and reach tens of pixels at the interior zooms, where a fixed
  // offset would put the panel back over the system. See clampOverlay for the
  // placement itself.
  //
  // The height is computed rather than measured, because the flip at the
  // bottom edge is decided before the browser has laid the panel out — and the
  // panel stopped being a fixed height when the gate count became a gate list.
  const { left, top } = clampOverlay({
    anchorX: screenX,
    anchorY: screenY,
    overlayWidth: POPUP_WIDTH_PX,
    overlayHeight: popupHeightPx({
      stargateCount: details?.stargates.length ?? 0,
      hasOwner: Boolean(details?.owner),
    }),
    viewportWidth,
    viewportHeight,
    offset: anchorRadius + POPUP_GAP_PX,
  });

  return (
    <div
      data-map-overlay
      className="absolute z-20 p-3 float"
      style={{ left, top, width: POPUP_WIDTH_PX }}
    >
      {loading && !details ? (
        <div className="grid grid-cols-4 gap-2">
          <SkeletonBox />
          <SkeletonBox />
          <SkeletonBox />
          <SkeletonBox />
        </div>
      ) : error || !details ? (
        <div className="text-xs text-ink-muted">
          Could not load this system right now.
        </div>
      ) : (
        <>
          {/* One line for the whole address: the system, then the two
              containers it sits in, reading outwards. One size and one grey
              across all three — the system name was near-white and a size
              above its own containers, which made the loudest thing on the
              panel the one word the reader had just clicked on. Weight is the
              only mark it keeps.

              `min-w-0` with `truncate` is what keeps a long region from pushing
              the security status off the panel — the address gives way, the
              number does not. */}
          <div className="flex items-baseline justify-between gap-x-3">
            <span className="min-w-0 text-xs truncate text-ink-muted">
              <span className="font-medium">{details.name}</span>
              {' · '}
              {details.constellationName} · {details.regionName}
            </span>
            {/* The line's one size, so nothing on it is ragged. What sets the
                security status apart is its colour, which is the whole point
                of the value. */}
            <span
              // Named, because the value is not unique on the panel: a highsec
              // system's neighbours read the same number, and Jita and Maurasi
              // are both 0.9.
              data-testid="popup-security"
              className={`text-xs font-medium shrink-0 ${getSecurityColor(details.securityStatus)}`}
            >
              {formatSecurityStatus(details.securityStatus)}
            </span>
          </div>

          {/* Under the address, because who holds a system changes and where it
              is does not. The name is beside the crest rather than left to it:
              the mark says "these systems are one holding" without saying
              whose. items-center, since a disc has no baseline to sit on. */}
          {details.owner && (
            <div className="flex items-center mt-1 gap-x-2">
              <OwnerCrest owner={details.owner} />
              <span className="text-xs truncate text-ink-muted">
                {details.owner.name}
              </span>
            </div>
          )}

          <div className="grid grid-cols-4 gap-2 mt-3">
            <Box label="Ship" value={details.shipKills ?? null} />
            <Box label="Pod" value={details.podKills ?? null} />
            <Box label="NPC" value={details.npcKills ?? null} />
            <Box label="Jumps" value={details.shipJumps ?? null} />
          </div>

          {/* Directly under the four boxes it describes, and above Stargates,
              which is topology rather than an hourly measurement. The position
              is what scopes the line, so the line itself stays short. */}
          {details.snapshotAt && (
            <div className="mt-1 text-[11px] font-light text-ink-faint">
              last 1 hour · ESI · {formatTimeAgo(details.snapshotAt)}
            </div>
          )}

          {/* Nothing at all when there is none: a heading over an empty space
              reads as a failed load rather than as a wormhole, and the count
              is not carried separately — the list's length is the count. */}
          {details.stargates.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] tracking-wide text-ink-muted uppercase">
                Stargates
              </div>
              {/* A two-column grid rather than a wrapping row: wrapping sized
                  every chip to its own name, so "T5ZI-S" and "New Caldari" sat
                  side by side at different widths and the count per row moved
                  with the system. Two equal columns, then down — which is also
                  what makes `STARGATE_CHIPS_PER_ROW` exact rather than an
                  estimate. An odd last chip keeps its column's width and
                  leaves the other half empty. */}
              <div className="grid grid-cols-2 gap-1 mt-1">
                {details.stargates.map((gate) => (
                  <StargateChip key={gate.stargateId} gate={gate} />
                ))}
              </div>
            </div>
          )}

          {/* The one thing the panel is FOR, so the vocabulary's primary, and
              full width because there is nothing to sit beside it. */}
          <Link
            href={`/solar-systems/${details.systemId}`}
            className="mt-3 button button-primary button-sm button-block"
          >
            Open the system
          </Link>
        </>
      )}
    </div>
  );
}
