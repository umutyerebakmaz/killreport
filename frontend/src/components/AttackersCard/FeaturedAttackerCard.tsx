import { KillmailQuery } from "@/generated/graphql";
import Link from "next/link";
import Tooltip from "../Tooltip/Tooltip";

interface FeaturedAttackerCardProps {
  attacker: NonNullable<KillmailQuery["killmail"]>["attackers"][0];
  label: string;
  labelColor: string;
  totalDamage: number;
}

export default function FeaturedAttackerCard({
  attacker,
  label,
  totalDamage,
}: FeaturedAttackerCardProps) {
  const damagePercentage =
    totalDamage > 0
      ? ((attacker.damageDone / totalDamage) * 100).toFixed(1)
      : "0.0";
  return (
    <div className="p-4 inset-ring inset-ring-white/10">
      {/* Label */}
      <div className="px-3 py-1 text-sm font-medium text-center">{label}</div>

      {/* Character Portrait */}
      {attacker.characterId && (
        <div className="relative mb-3">
          <Tooltip content={`Character: ${attacker.character?.name}`}>
            <img
              src={`https://images.evetech.net/characters/${attacker.characterId}/portrait?size=256`}
              alt={attacker.character?.name || "Character"}
              width={256}
              height={256}
              className="w-full shadow-lg"
              loading="lazy"
            />
          </Tooltip>
          {/* Logos Container - Bottom Right */}
          <div className="absolute bottom-0 right-0 flex">
            {/* Corporation Logo */}
            {attacker.corporationId && (
              <Tooltip content={`Corporation: ${attacker.corporation?.name}`}>
                <img
                  src={`https://images.evetech.net/corporations/${attacker.corporationId}/logo?size=64`}
                  alt={attacker.corporation?.name || "Corporation"}
                  width={32}
                  height={32}
                  className="shadow-md bg-black/50 ring-2 ring-black/50"
                  loading="lazy"
                />
              </Tooltip>
            )}

            {/* Alliance Logo */}
            {attacker.allianceId && (
              <Tooltip content={`Alliance: ${attacker.alliance?.name}`}>
                <img
                  src={`https://images.evetech.net/alliances/${attacker.allianceId}/logo?size=64`}
                  alt={attacker.alliance?.name || "Alliance"}
                  width={32}
                  height={32}
                  className="shadow-md bg-black/50 ring-2 ring-black/50"
                  loading="lazy"
                />
              </Tooltip>
            )}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="pt-1 pb-4">
        <Link
          href={`/characters/${attacker.characterId}`}
          className="block font-medium text-gray-400 hover:text-blue-400"
        >
          {attacker?.character?.name}
        </Link>
      </div>

      {/* Ship Type Image */}
      {attacker.shipTypeId && (
        <div className="flex gap-2">
          <Tooltip content={attacker.shipType?.name}>
            <img
              src={`https://images.evetech.net/types/${attacker.shipTypeId}/render?size=64`}
              alt={attacker.shipType?.name || "Ship"}
              width={48}
              height={48}
              className="shadow-lg"
              loading="lazy"
            />
          </Tooltip>
        </div>
      )}

      {/* Weapon Type Image */}
      {attacker.weaponTypeId && (
        <div className="flex gap-2">
          <Tooltip content={attacker.weaponType?.name}>
            <img
              src={`https://images.evetech.net/types/${attacker.weaponTypeId}/icon?size=64`}
              alt={attacker.weaponType?.name || "Weapon"}
              width={48}
              height={48}
              className="shadow-lg"
              loading="lazy"
            />
          </Tooltip>
        </div>
      )}

      <div className="pt-4 mt-2 text-right border-t border-white/10">
        <div className="font-semibold text-red-400 text-md">
          {attacker.damageDone.toLocaleString()} DMG
        </div>
        <div className="text-sm text-gray-400">{damagePercentage}%</div>
      </div>
    </div>
  );
}
