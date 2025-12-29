import { KillmailQuery } from "@/generated/graphql";
import Link from "next/link";
import Tooltip from "../Tooltip/Tooltip";

interface AttackerProps {
  attacker: NonNullable<KillmailQuery["killmail"]>["attackers"][0];
  totalDamage: number;
}

export default function AttackerRow({ attacker, totalDamage }: AttackerProps) {
  const damagePercentage =
    totalDamage > 0
      ? ((attacker.damageDone / totalDamage) * 100).toFixed(1)
      : "0.0";
  return (
    <div className="p-3 bg-white/5">
      <div className="flex">
        {/* Character Image */}
        {attacker.characterId && (
          <div className="relative shrink-0">
            <img
              src={`https://images.evetech.net/characters/${attacker.characterId}/portrait?size=128`}
              alt={attacker.character?.name || "Character"}
              width={96}
              height={96}
              className="shadow-md"
              loading="lazy"
            />
          </div>
        )}

        <div className="flex flex-col pr-4">
          <Tooltip content={attacker.shipType?.name}>
            <img
              src={`https://images.evetech.net/types/${attacker.shipTypeId}/render?size=64`}
              alt={attacker.shipType?.name || "Ship"}
              width={48}
              height={48}
              className="shadow-md"
              loading="lazy"
            />
          </Tooltip>
          <Tooltip content={attacker.weaponType?.name}>
            <img
              src={`https://images.evetech.net/types/${attacker.weaponTypeId}/icon?size=64`}
              alt={attacker.weaponType?.name || "Weapon"}
              width={48}
              height={48}
              className="shadow-md"
              loading="lazy"
            />
          </Tooltip>
        </div>

        {/* Character Name, Corporation, Alliance */}
        <div className="flex flex-col flex-1 space-y-1">
          {attacker.characterId && (
            <Tooltip content="Show Character Info">
              <Link
                href={`/characters/${attacker.characterId}`}
                className="block font-medium text-gray-400 hover:text-blue-400"
              >
                {attacker.character?.name || "Unknown"}
              </Link>
            </Tooltip>
          )}

          {attacker.corporationId && (
            <Tooltip content="Show Corporation Info">
              <Link
                href={`/corporations/${attacker.corporationId}`}
                className="block font-medium text-gray-400 hover:text-blue-400"
              >
                {attacker.corporation?.name || "Unknown"}
              </Link>
            </Tooltip>
          )}

          {attacker.allianceId && (
            <Tooltip content="Show Alliance Info">
              <Link
                href={`/alliances/${attacker.allianceId}`}
                className="block font-medium text-gray-400 hover:text-blue-400"
              >
                {attacker.alliance?.name || "Unknown"}
              </Link>
            </Tooltip>
          )}
        </div>

        {/* Damage, Damage Percentate, Security */}
        <div className="flex flex-col items-end text-sm gap-y-1">
          <span className="text-red-400">
            {attacker.damageDone.toLocaleString()} DMG
          </span>
          <span className="text-gray-400">{damagePercentage}%</span>
          <span
            className={
              attacker.securityStatus >= 0 ? "text-green-500" : "text-red-500"
            }
          >
            Sec: {attacker.securityStatus.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}
