import type { ShipTier } from "@/utils/shipTier";

interface ShipTierBadgeProps {
  tier: ShipTier;
  className?: string;
}

export default function ShipTierBadge({
  tier,
  className = "size-6",
}: ShipTierBadgeProps) {
  if (!tier) return null;

  if (tier === "T2") {
    return <img src="/icons/t2.svg" alt="T2" className={className} />;
  }

  if (tier === "T3") {
    return <img src="/icons/t3.svg" alt="T3" className={className} />;
  }

  if (tier === "faction") {
    return <img src="/icons/faction.svg" alt="Faction" className={className} />;
  }

  if (tier === "officer") {
    return <img src="/icons/officer.svg" alt="Officer" className={className} />;
  }

  return null;
}
