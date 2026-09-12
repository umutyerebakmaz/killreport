'use client';

import RegionMap from '@/components/RegionMap/RegionMap';
import Tooltip from '@/components/Tooltip/Tooltip';
import { RegionsQuery } from '@/generated/graphql';
import Link from 'next/link';

// useRegionsQuery'nin döndüğü Region type'ını extract et
type Region = RegionsQuery['regions']['items'][number];

type RegionCardProps = {
  region: Region;
};

/**
 * A region, shown as its own star map.
 *
 * The map is the card rather than a thumbnail inside it, so the link is the
 * card too — the name alone used to be the only target. Same shape as
 * KillmailCard, which is the other card built out of a single full-bleed image.
 */
export default function RegionCard({ region }: RegionCardProps) {
  return (
    <Link
      href={`/regions/${region.id}`}
      className="map-card group"
      prefetch={false}
      aria-label={region.name}
    >
      <RegionMap
        regionId={region.id}
        regionName={region.name}
        className="map-card-map"
      />

      <div className="map-card-scrim" />

      <div className="map-card-label">
        <span className="map-card-name">{region.name}</span>

        {/* 7/12 says nothing on its own, so the tooltip spells it out.
            The classes go on Tooltip's own wrapper, which is the flex item
            here — shrink-0 on an inner span would never be read. */}
        <Tooltip
          className="map-card-counts"
          content={`${region.constellationCount} constellations · ${region.solarSystemCount} solar systems`}
          position="top"
        >
          {region.constellationCount}/{region.solarSystemCount}
        </Tooltip>
      </div>
    </Link>
  );
}
