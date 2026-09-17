import type { ShipTier } from '@/utils/shipTier';
import Image from 'next/image';

interface ShipTierBadgeProps {
  tier: ShipTier;
  className?: string;
}

/** The four tiers that have an icon, and what it is called. */
const ICONS: Record<Exclude<ShipTier, null>, { src: string; alt: string }> = {
  T2: { src: '/icons/t2.svg', alt: 'T2' },
  T3: { src: '/icons/t3.svg', alt: 'T3' },
  faction: { src: '/icons/faction.svg', alt: 'Faction' },
  officer: { src: '/icons/officer.svg', alt: 'Officer' },
};

/**
 * An intrinsic hint only: the class the caller passes sets the drawn size, and
 * it sets both dimensions, so next/image has nothing to warn about. All four
 * icons are square.
 */
const INTRINSIC = 24;

export default function ShipTierBadge({
  tier,
  className = 'size-6',
}: ShipTierBadgeProps) {
  if (!tier) return null;

  const icon = ICONS[tier];

  return (
    <Image
      src={icon.src}
      alt={icon.alt}
      width={INTRINSIC}
      height={INTRINSIC}
      className={className}
      unoptimized
    />
  );
}
