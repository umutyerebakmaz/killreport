import AttackerRow from "@/components/AttackersCard/AttackerRow";
import { KillmailQuery } from "@/generated/graphql";
import { UserGroupIcon } from "@heroicons/react/24/outline";

interface AttackersCardProps {
  attackers: NonNullable<KillmailQuery["killmail"]>["attackers"];
}

export default function AttackersCard({ attackers }: AttackersCardProps) {
  // Calculate total damage from all attackers
  const totalDamage = attackers.reduce(
    (sum, attacker) => sum + attacker.damageDone,
    0
  );

  // Find top damage amount to identify top damage attacker
  const topDamageAmount = Math.max(...attackers.map((a) => a.damageDone));

  // Sort attackers: Final Blow first, then by damage descending
  const sortedAttackers = [...attackers].sort((a, b) => {
    if (a.finalBlow && !b.finalBlow) return -1;
    if (!a.finalBlow && b.finalBlow) return 1;
    return b.damageDone - a.damageDone;
  });

  return (
    <div className="p-6 bg-white/5 backdrop-blur-sm inset-ring inset-ring-white/10">
      <h3 className="flex items-center justify-end gap-2 mb-4 text-lg text-gray-400">
        <UserGroupIcon className="w-5 h-5" />
        Attackers ({attackers.length})
      </h3>

      {/* All Attackers */}
      <div className="space-y-3">
        {sortedAttackers.map((attacker, index) => (
          <AttackerRow
            key={index}
            attacker={attacker}
            totalDamage={totalDamage}
            isFinalBlow={attacker.finalBlow}
            isTopDamage={attacker.damageDone === topDamageAmount}
          />
        ))}
      </div>
    </div>
  );
}
