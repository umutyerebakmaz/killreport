import AttackerRow from "@/components/AttackersCard/AttackerRow";
import { KillmailQuery } from "@/generated/graphql";

interface AttackersCardProps {
  attackers: NonNullable<KillmailQuery["killmail"]>["attackers"];
  killmail: NonNullable<KillmailQuery["killmail"]>;
}

export default function AttackersCard({
  attackers,
  killmail,
}: AttackersCardProps) {
  // Calculate total damage from all attackers
  const totalDamage = attackers.reduce(
    (sum, attacker) => sum + attacker.damageDone,
    0,
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
      <div className="flex justify-end">
        <span className="px-2 py-0.5 text-xs font-medium text-gray-400  bg-white/5">
          {killmail.attackerCount} ATTACKERS
        </span>
      </div>

      {/* All Attackers */}
      <div className="space-y-3">
        {sortedAttackers.map((attacker, index) => (
          <AttackerRow
            key={index}
            attacker={attacker}
            totalDamage={totalDamage}
            isFinalBlow={attacker.finalBlow}
            isTopDamage={attacker.damageDone === topDamageAmount}
            killmail={killmail}
          />
        ))}
      </div>
    </div>
  );
}
