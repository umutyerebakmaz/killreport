'use client';

import { solarSystemMapUrl } from '@/utils/solarSystemMapUrl';
import { useState } from 'react';
import Image from 'next/image';

export interface SolarSystemMapProps {
  systemId: number;
  systemName: string;
  /** Edge length in pixels. The image is a vector, so it will be sharp at any size. */
  size: number;
  className?: string;
}

/**
 * A solar system's orbital diagram: the star at the centre, its planets on a
 * logarithmic radius. The background is transparent, so it takes on the color
 * of the surface underneath — a card, a page, or a row hovered with the mouse.
 *
 * If the file is missing, the component removes itself. That is the normal case
 * for the 401 systems with neither a star nor a planet, and it also covers an
 * SDE update that introduces a new system before the script is run; showing
 * nothing is better than showing a broken image icon.
 */
export default function SolarSystemMap({
  systemId,
  systemName,
  size,
  className,
}: SolarSystemMapProps) {
  const [failedId, setFailedId] = useState<number | null>(null);
  if (failedId === systemId) return null;

  const src = solarSystemMapUrl(systemId);
  const alt = `${systemName} map`;
  const onError = () => setFailedId(systemId);

  /* No `size` means the caller sizes the box — `.map-card-map` is
     `absolute inset-0 size-full`. That is `fill`, which is next/image's name
     for the same arrangement and the only form it has without a pixel box.
     Both branches spell `alt` out: behind a spread, jsx-a11y cannot see it. */
  return size === undefined ? (
    <Image
      src={src}
      alt={alt}
      fill
      className={className}
      onError={onError}
      unoptimized
    />
  ) : (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      onError={onError}
      unoptimized
    />
  );
}
