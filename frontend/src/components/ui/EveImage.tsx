'use client';

import { eveImageUrl, type EveImageKind } from '@/utils/eveImageUrl';
import Image from 'next/image';
import { useState } from 'react';

/**
 * A `fill` image has no pixel box to derive a fetch size from, so it asks for
 * the largest size this app draws — the same 512 the fit screen's hull has
 * always requested.
 */
const FILL_SIZE = 512;

type Sizing = { size: number; fill?: never } | { fill: true; size?: never };

export type EveImageProps = {
  kind: EveImageKind;
  id: number;
  /** The entity's name; it is the alt text. */
  name: string;
  className?: string;
  /** Only the killmail page's victim hull sets this. */
  priority?: boolean;
  /** `type` only: 2 is a blueprint copy. */
  singleton?: number;
  /** `type` only: the caller's `isBlueprint(itemType)`. */
  blueprint?: boolean;
} & Sizing;

/**
 * Every image this app loads from the EVE image server.
 *
 * `unoptimized`, because the server already serves the exact size asked for:
 * routing it through `/_next/image` would spend CPU re-encoding what is
 * already right. What next/image is here for is the explicit width and height
 * — 56 of the 59 `<img>` elements this replaced had none, so every one of them
 * shifted its row as it loaded — and lazy loading.
 */
export default function EveImage({
  kind,
  id,
  name,
  className,
  priority,
  singleton,
  blueprint,
  size,
  fill,
}: EveImageProps) {
  /*
   * Which id the render 404'd for, not a bare boolean: a row that re-renders
   * with a different ship must ask for its render again rather than inherit
   * the previous one's fallback. RegionMap holds a failed map's id the same
   * way.
   */
  const [iconFor, setIconFor] = useState<number | null>(null);

  const src = eveImageUrl({
    kind,
    id,
    size: fill ? FILL_SIZE : size,
    singleton,
    blueprint,
    icon: kind === 'ship' && iconFor === id,
  });

  /* Only a ship has somewhere to fall back to: a hull with no render still
     has an icon. Nothing else does, so nothing else listens. */
  const onError =
    kind === 'ship' && iconFor !== id ? () => setIconFor(id) : undefined;

  if (fill) {
    return (
      <Image
        src={src}
        alt={name}
        fill
        className={className}
        priority={priority}
        onError={onError}
        unoptimized
      />
    );
  }

  return (
    <Image
      src={src}
      alt={name}
      width={size}
      height={size}
      className={className}
      priority={priority}
      onError={onError}
      unoptimized
    />
  );
}
