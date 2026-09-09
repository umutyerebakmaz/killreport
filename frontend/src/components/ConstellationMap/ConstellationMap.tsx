'use client';

import { constellationMapUrl } from '@/utils/constellationMapUrl';
import { useState } from 'react';

export interface ConstellationMapProps {
  constellationId: number;
  constellationName: string;
  /** Edge length in pixels. The image is a vector, so it will be sharp at any size. */
  size: number;
  className?: string;
}

/**
 * A constellation's star map. The background is transparent, so it takes on the
 * color of the surface underneath — a card, a page, or a row hovered with the
 * mouse.
 *
 * If the file is missing, the component removes itself. This can only happen if
 * an SDE update introduces a new constellation and the script is not run;
 * showing nothing is better than showing a broken image icon.
 */
export default function ConstellationMap({
  constellationId,
  constellationName,
  size,
  className,
}: ConstellationMapProps) {
  const [failedId, setFailedId] = useState<number | null>(null);
  if (failedId === constellationId) return null;

  return (
    <img
      src={constellationMapUrl(constellationId)}
      alt={`${constellationName} map`}
      width={size}
      height={size}
      className={className}
      onError={() => setFailedId(constellationId)}
    />
  );
}
