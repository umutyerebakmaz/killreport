import { SHARE } from '@/lib/shareCard/palette';

/** Heights as 0-1 shares of the taller bar; null when there is nothing to draw. */
export function killLossBarHeights(
  kills: number,
  losses: number,
): { kills: number; losses: number } | null {
  const max = Math.max(kills, losses);
  if (max <= 0) return null;
  return { kills: kills / max, losses: losses / max };
}

/**
 * Two bottom-aligned bars, 40px in from the right panel's edge. `top` and
 * `height` give the box they stand in; the taller bar fills it.
 */
export default function KillLossBars({
  kills,
  losses,
  top,
  height,
}: {
  kills: number;
  losses: number;
  top: number;
  height: number;
}) {
  const heights = killLossBarHeights(kills, losses);
  if (!heights) return null;
  return (
    <div
      style={{
        position: 'absolute',
        display: 'flex',
        alignItems: 'flex-end',
        top,
        height,
        right: 40,
      }}
    >
      <div
        style={{
          width: 30,
          height: Math.round(height * heights.kills),
          background: SHARE.dropped,
        }}
      />
      <div
        style={{
          width: 30,
          marginLeft: 10,
          height: Math.round(height * heights.losses),
          background: SHARE.red,
        }}
      />
    </div>
  );
}
