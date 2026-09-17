'use client';

import { useMapSystemDetailsQuery } from '@/generated/graphql';
import { formatTimeAgo } from '@/utils/date';
import { clampOverlay } from '@/utils/map/overlay';
import { formatSecurityStatus, getSecurityColor } from '@/utils/security';
import Link from 'next/link';
import { useEffect } from 'react';

/** How far the panel's top edge clears the system's own disc. */
const POPUP_GAP_PX = 12;

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
      <div className="text-[10px] tracking-wide text-ink-muted uppercase">
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

  // `anchorRadius` is the disc's own size, not a constant: the dots grow with
  // the camera and reach tens of pixels at the interior zooms, where a fixed
  // offset would put the panel back over the system. See clampOverlay for the
  // placement itself.
  const { left, top } = clampOverlay({
    anchorX: screenX,
    anchorY: screenY,
    overlayWidth: POPUP_WIDTH_PX,
    overlayHeight: POPUP_HEIGHT_PX,
    viewportWidth,
    viewportHeight,
    offset: anchorRadius + POPUP_GAP_PX,
  });

  const details = data?.mapSystemDetails;

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

          <div className="mt-0.5 text-xs text-ink-muted">
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
            <div className="mt-1 text-[11px] font-light text-ink-faint">
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
