'use client';

import { regionMapUrl } from '@/utils/regionMapUrl';
import { useState } from 'react';

export interface RegionMapProps {
  regionId: number;
  regionName: string;
  /**
   * Edge length in pixels. The image is a vector, so it will be sharp at any
   * size. Omit it to let `className` do the sizing — a full-bleed map has no
   * fixed edge length, it takes the size of whatever box it fills.
   */
  size?: number;
  className?: string;
}

/**
 * A region's star map. The background is transparent, so it takes on the color
 * of the surface underneath — a card, a page, or a row hovered with the mouse.
 *
 * If the file is missing, the component removes itself. This can only happen if
 * an SDE update introduces a new region and the script is not run; showing
 * nothing is better than showing a broken image icon.
 */
export default function RegionMap({
  regionId,
  regionName,
  size,
  className,
}: RegionMapProps) {
  const [failedId, setFailedId] = useState<number | null>(null);
  if (failedId === regionId) return null;

  return (
    <img
      src={regionMapUrl(regionId)}
      alt={`${regionName} map`}
      width={size}
      height={size}
      className={className}
      onError={() => setFailedId(regionId)}
    />
  );
}
