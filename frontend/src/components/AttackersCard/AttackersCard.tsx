import AttackerRow from "@/components/AttackersCard/AttackerRow";
import FeaturedAttackerCard from "@/components/AttackersCard/FeaturedAttackerCard";
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

  // Find Final Blow attacker
  const finalBlowAttacker = attackers.find((a) => a.finalBlow);

  // Find Top Damage attacker (highest damage done)
  const topDamageAttacker = attackers.reduce((prev, current) =>
    prev.damageDone > current.damageDone ? prev : current
  );

  // Get remaining attackers (exclude final blow and top damage)
  const remainingAttackers = attackers.filter(
    (a) =>
      (!finalBlowAttacker || a !== finalBlowAttacker) &&
      (!topDamageAttacker || a !== topDamageAttacker)
  );

  return (
    <div className="p-6 bg-white/5 backdrop-blur-sm inset-ring inset-ring-white/10">
      <h3 className="flex items-center gap-2 mb-4 text-lg font-semibold text-pink-400">
        <UserGroupIcon className="w-5 h-5" />
        Attackers ({attackers.length})
      </h3>

      {/* Featured Attackers: Final Blow & Top Damage */}
      {(finalBlowAttacker || topDamageAttacker) && (
        <div className="grid grid-cols-2 gap-3 pb-4 mb-4 border-b border-white/10">
          {finalBlowAttacker && (
            <FeaturedAttackerCard
              attacker={finalBlowAttacker}
              label="FINAL BLOW"
              labelColor="#C82D2DFF"
              totalDamage={totalDamage}
            />
          )}
          {topDamageAttacker && (
            <FeaturedAttackerCard
              attacker={topDamageAttacker}
              label="TOP DAMAGE"
              labelColor="#D81C1CFF"
              totalDamage={totalDamage}
            />
          )}
        </div>
      )}

      {/* Remaining Attackers */}
      {remainingAttackers.length > 0 && (
        <div className="space-y-3">
          {remainingAttackers.map((attacker, index) => (
            <AttackerRow
              key={index}
              attacker={attacker}
              totalDamage={totalDamage}
            />
          ))}
        </div>
      )}
    </div>
  );
}
