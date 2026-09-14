'use client';

import { useMapSystemDetailsQuery } from '@/generated/graphql';
import { formatTimeAgo } from '@/utils/date';
import { clampOverlay } from '@/utils/map/overlay';
import { formatSecurityStatus, getSecurityColor } from '@/utils/security';
import Link from 'next/link';
import { useEffect } from 'react';

const POPUP_WIDTH_PX = 280;
const POPUP_HEIGHT_PX = 230;

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
      <div className="text-[10px] tracking-wide text-gray-400 uppercase">
        {label}
      </div>
      <div className="text-base font-semibold text-gray-100">
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
 * starting on the panel pans the map — and that requirement does not survive
 * the move off deck.gl. There the popup was rendered INSIDE deck.gl's React
 * child callback, so its events bubbled through the element holding the
 * controller. Here the panel is a SIBLING of the canvas, and the pan, zoom and
 * click listeners are on the canvas itself (`useMapPointer`): a pointerdown on
 * this panel goes panel -> host -> body and never visits the canvas at all.
 * Handlers calling stopPropagation would have been dead code, so there are
 * none. If the listeners ever move up to the host element, they come back.
 */
export default function SystemPopup({
  systemId,
  screenX,
  screenY,
  viewportWidth,
  viewportHeight,
  onClose,
}: {
  systemId: number;
  screenX: number;
  screenY: number;
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

  // Centred on the system rather than beside it. The click already said where to
  // look, so opening the panel there costs the eye no journey — and unlike the
  // hover tip there is no cursor underneath for it to hide. Near an edge it
  // slides inside instead of flipping, which would move it off its own subject.
  const { left, top } = clampOverlay({
    anchorX: screenX,
    anchorY: screenY,
    overlayWidth: POPUP_WIDTH_PX,
    overlayHeight: POPUP_HEIGHT_PX,
    viewportWidth,
    viewportHeight,
    offset: 0,
    placement: 'centred',
  });

  const details = data?.mapSystemDetails;

  return (
    <div
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
        <div className="text-xs text-gray-400">
          Could not load this system right now.
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-x-3">
            <span className="text-sm font-semibold text-gray-100">
              {details.name}
            </span>
            <span
              className={`text-sm font-medium ${getSecurityColor(details.securityStatus)}`}
            >
              {formatSecurityStatus(details.securityStatus)}
            </span>
          </div>

          <div className="mt-0.5 text-xs text-gray-400">
            {details.constellationName} · {details.regionName}
          </div>

          <div className="grid grid-cols-4 gap-2 mt-3">
            <Box label="Ship" value={details.shipKills ?? null} />
            <Box label="Pod" value={details.podKills ?? null} />
            <Box label="NPC" value={details.npcKills ?? null} />
            <Box label="Jumps" value={details.shipJumps ?? null} />
          </div>

          {/* Directly under the four boxes it describes, and above Gates, which
              is topology rather than an hourly measurement. The position is
              what scopes the line, so the line itself stays short. */}
          {details.snapshotAt && (
            <div className="mt-1 text-[11px] font-light text-gray-500">
              last 1 hour · ESI · {formatTimeAgo(details.snapshotAt)}
            </div>
          )}

          <div className="grid grid-cols-4 mt-3">
            <Box label="Gates" value={details.gateCount} />
          </div>

          <Link
            href={`/solar-systems/${details.systemId}`}
            className="inline-block mt-3 text-xs text-gray-300 hover:text-white"
          >
            Open the system →
          </Link>
        </>
      )}
    </div>
  );
}
