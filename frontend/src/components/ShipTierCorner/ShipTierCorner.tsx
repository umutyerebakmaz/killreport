import type { ShipTier } from '@/utils/shipTier';

interface ShipTierCornerProps {
  tier: ShipTier;
  /** Extra classes on the wrapper, e.g. to show the corner only on hover. */
  className?: string;
}

/**
 * The three tiers with a colour of their own. A Tech I hull keeps the brown
 * the corner has always had. No ship sits in the officer meta group.
 */
const FROM: Partial<Record<Exclude<ShipTier, null>, string>> = {
  faction: 'from-tier-faction',
  T2: 'from-tier-t2',
  T3: 'from-tier-t3',
};

const DEFAULT_FROM = 'from-amber-800';

/**
 * Two 1px lines along the top and left edges of a ship render, each fading
 * out from the top-left corner. The parent must be `relative`.
 */
export default function ShipTierCorner({
  tier,
  className = '',
}: ShipTierCornerProps) {
  const from = (tier && FROM[tier]) || DEFAULT_FROM;

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-10 ${className}`}
      aria-hidden
    >
      <div
        className={`absolute top-0 left-0 w-px h-full bg-linear-to-b to-transparent ${from}`}
      />
      <div
        className={`absolute top-0 left-0 w-full h-px bg-linear-to-r to-transparent ${from}`}
      />
    </div>
  );
}
