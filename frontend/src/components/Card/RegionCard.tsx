'use client';

import RegionMap from '@/components/RegionMap/RegionMap';
import Tooltip from '@/components/Tooltip/Tooltip';
import Card from '@/components/ui/Card';
import { RegionsQuery } from '@/generated/graphql';
import { MapIcon, MapPinIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

// useRegionsQuery'nin döndüğü Region type'ını extract et
type Region = RegionsQuery['regions']['items'][number];

type RegionCardProps = {
  region: Region;
};

export default function RegionCard({ region }: RegionCardProps) {
  return (
    <Card>
      <div className="px-4 py-5 sm:p-6">
        <div className="flex flex-col items-center gap-4">
          {/* Region star map */}
          <div className="flex items-center justify-center w-32 h-32">
            <RegionMap
              regionId={region.id}
              regionName={region.name}
              size={128}
            />
          </div>

          {/* Region Name */}
          <Link
            href={`/regions/${region.id}`}
            className="region-name"
            prefetch={false}
          >
            {region.name}
          </Link>

          {/* Metrics */}
          <div className="card-metrics">
            {/* Constellation count */}
            <Tooltip content="Constellations in this region" position="top">
              <div className="flex items-center gap-2">
                <MapIcon className="w-5 h-5 text-purple-400" />
                <span className="font-medium text-purple-300">
                  {region.constellationCount}
                </span>
              </div>
            </Tooltip>

            {/* Solar system count */}
            <Tooltip content="Solar systems in this region" position="top">
              <div className="flex items-center gap-2">
                <MapPinIcon className="w-5 h-5 text-orange-400" />
                <span className="font-medium text-orange-300">
                  {region.solarSystemCount}
                </span>
              </div>
            </Tooltip>
          </div>
        </div>
      </div>
    </Card>
  );
}
