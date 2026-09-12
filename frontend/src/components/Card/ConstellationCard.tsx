'use client';

import ConstellationMap from '@/components/ConstellationMap/ConstellationMap';
import Tooltip from '@/components/Tooltip/Tooltip';
import { ConstellationsQuery } from '@/generated/graphql';
import Link from 'next/link';

type Constellation = ConstellationsQuery['constellations']['items'][number];

type ConstellationCardProps = {
  constellation: Constellation;
};

/**
 * A constellation, shown as its own star map.
 *
 * The same card as RegionCard one level down — map full-bleed, label over a
 * scrim, the whole surface the link. It carries one count rather than two,
 * because a constellation holds only solar systems.
 *
 * Not to be confused with Cards/ConstellationCard, the row inside a region's
 * constellations tab, which puts the map beside the name and adds the
 * sovereignty holder.
 */
export default function ConstellationCard({
  constellation,
}: ConstellationCardProps) {
  return (
    <Link
      href={`/constellations/${constellation.id}`}
      className="map-card group"
      prefetch={false}
      aria-label={constellation.name}
    >
      <ConstellationMap
        constellationId={constellation.id}
        constellationName={constellation.name}
        className="map-card-map"
      />

      <div className="map-card-scrim" />

      <div className="map-card-label">
        <span className="map-card-name">{constellation.name}</span>

        {/* A bare number says nothing on its own, so the tooltip spells it out.
            The classes go on Tooltip's own wrapper, which is the flex item
            here — shrink-0 on an inner span would never be read. */}
        <Tooltip
          className="map-card-counts"
          content={`${constellation.solarSystemCount} solar systems`}
          position="top"
        >
          {constellation.solarSystemCount}
        </Tooltip>
      </div>
    </Link>
  );
}
