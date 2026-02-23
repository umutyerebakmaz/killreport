import type { ShipTier } from "@/utils/shipTier";
import Image from "next/image";

interface ShipTierBadgeProps {
  tier: ShipTier;
}

export default function ShipTierBadge({ tier }: ShipTierBadgeProps) {
  if (!tier) return null;

  if (tier === "T2") {
    return (
      <Image
        src="/icons/t2.svg"
        alt="T2"
        width={16}
        height={16}
        className="size-6"
      />
    );
  }

  if (tier === "T3") {
    return (
      <Image
        src="/icons/t3.svg"
        alt="T3"
        width={16}
        height={16}
        className="size-6"
      />
    );
  }

  if (tier === "faction") {
    return (
      <Image
        src="/icons/faction.svg"
        alt="Faction"
        width={16}
        height={16}
        className="size-6"
      />
    );
  }

  // officer — text badge
  const config: Record<
    Exclude<ShipTier, "T2" | "T3" | "faction" | null>,
    { label: string; className: string }
  > = {
    officer: {
      label: "O",
      className: "text-orange-300",
    },
  };

  const { label, className } = config[tier];

  return (
    <span
      className={`text-[10px] font-bold leading-none ${className}`}
      title={tier}
    >
      {label}
    </span>
  );
}
