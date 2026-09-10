import Tooltip from '@/components/Tooltip/Tooltip';
import Image from 'next/image';
import Link from 'next/link';

export interface SovereigntyHolder {
  ownerType: string;
  ownerId: number;
  ownerName?: string | null;
  allianceTicker?: string | null;
  systemCount: number;
}

export interface SovereigntyLogoProps {
  holder?: SovereigntyHolder | null;
  /** Rendered edge length in pixels. The source is requested at twice this. */
  size: number;
  /**
   * How many systems the region or constellation has in total. Given, the
   * tooltip says what share of them the holder holds — sovereignty is per
   * system, so a holder can own only part of what it is shown against.
   */
  totalSystems?: number;
  className?: string;
}

/**
 * The sovereignty holder of a region or a constellation, as its logo alone.
 * The name is in the tooltip; an alliance's logo also links to its page.
 *
 * Renders nothing when nothing is held — wormhole space and unclaimed nullsec,
 * 44 of the 114 regions and 400 of the 1184 constellations.
 */
export default function SovereigntyLogo({
  holder,
  size,
  totalSystems,
  className,
}: SovereigntyLogoProps) {
  if (!holder) return null;

  // Both kinds of logo come off the id itself. A faction goes through the
  // CORPORATION path: /factions/ returns 400, and /alliances/ answers a faction
  // id with the same blank placeholder for every one of them, but
  // /corporations/{factionId} serves the faction's own emblem — checked against
  // all 27 factions in the database, 27 distinct images, no placeholder.
  const logo =
    holder.ownerType === 'ALLIANCE'
      ? `https://images.evetech.net/alliances/${holder.ownerId}/logo?size=${size * 2}`
      : `https://images.evetech.net/corporations/${holder.ownerId}/logo?size=${size * 2}`;

  const label = [
    holder.ownerName ?? String(holder.ownerId),
    holder.allianceTicker ? `[${holder.allianceTicker}]` : null,
    totalSystems !== undefined && holder.systemCount < totalSystems
      ? `— ${holder.systemCount} of ${totalSystems} systems`
      : null,
  ]
    .filter(Boolean)
    .join(' ');

  const image = (
    <Image
      src={logo}
      alt={holder.ownerName ?? 'Sovereignty holder'}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      unoptimized
    />
  );

  return (
    <Tooltip content={label} position="top" className={className}>
      {holder.ownerType === 'ALLIANCE' ? (
        <Link
          href={`/alliances/${holder.ownerId}`}
          prefetch={false}
          className="block transition-opacity hover:opacity-80"
        >
          {image}
        </Link>
      ) : (
        image
      )}
    </Tooltip>
  );
}
