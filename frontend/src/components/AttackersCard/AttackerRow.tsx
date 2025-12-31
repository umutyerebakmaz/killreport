import { KillmailQuery } from "@/generated/graphql";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import Tooltip from "../Tooltip/Tooltip";

interface AttackerProps {
  attacker: NonNullable<KillmailQuery["killmail"]>["attackers"][0];
  totalDamage: number;
  isFinalBlow?: boolean;
  isTopDamage?: boolean;
}

export default function AttackerRow({
  attacker,
  totalDamage,
  isFinalBlow,
  isTopDamage,
}: AttackerProps) {
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
            {/* Logos Container - Bottom Right */}
            <div className="absolute bottom-0 right-0 flex">
              {/* Corporation Logo */}
              {attacker.corporationId && (
                <Tooltip
                  content={`Corporation: ${
                    attacker.corporation?.name || "Unknown"
                  }`}
                >
                  <img
                    src={`https://images.evetech.net/corporations/${attacker.corporationId}/logo?size=64`}
                    alt={attacker.corporation?.name || "Corporation"}
                    width={24}
                    height={24}
                    className="shadow-md bg-black/50 ring-1 ring-black/50"
                    loading="lazy"
                  />
                </Tooltip>
              )}

              {/* Alliance Logo */}
              {attacker.allianceId && (
                <Tooltip
                  content={`Alliance: ${attacker.alliance?.name || "Unknown"}`}
                >
                  <img
                    src={`https://images.evetech.net/alliances/${attacker.allianceId}/logo?size=64`}
                    alt={attacker.alliance?.name || "Alliance"}
                    width={24}
                    height={24}
                    className="shadow-md bg-black/50 ring-1 ring-black/50"
                    loading="lazy"
                  />
                </Tooltip>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col pr-4">
          <Tooltip content={attacker.shipType?.name || "Unknown Ship"}>
            {attacker.shipTypeId ? (
              <img
                src={`https://images.evetech.net/types/${attacker.shipTypeId}/render?size=64`}
                alt={attacker.shipType?.name || "Ship"}
                width={48}
                height={48}
                className="shadow-md"
                loading="lazy"
              />
            ) : (
              <div className="flex items-center justify-center w-12 h-12 bg-gray-800 shadow-md">
                <QuestionMarkCircleIcon className="w-8 h-8 text-gray-500" />
              </div>
            )}
          </Tooltip>
          <Tooltip content={attacker.weaponType?.name || "Unknown Weapon"}>
            {attacker.weaponTypeId ? (
              <img
                src={`https://images.evetech.net/types/${attacker.weaponTypeId}/icon?size=64`}
                alt={attacker.weaponType?.name || "Weapon"}
                width={48}
                height={48}
                className="shadow-md"
                loading="lazy"
              />
            ) : (
              <div className="flex items-center justify-center w-12 h-12 bg-gray-800 shadow-md">
                <QuestionMarkCircleIcon className="w-8 h-8 text-gray-500" />
              </div>
            )}
          </Tooltip>
        </div>

        {/* Character Name, Corporation, Alliance */}
        <div className="flex flex-col flex-1 space-y-1">
          {/* Badges for Final Blow and Top Damage */}
          <div className="flex gap-2 mb-1">
            {isFinalBlow && (
              <span className="px-2 py-0.5 text-xs font-medium text-red-400 rounded bg-red-400/10">
                FINAL BLOW
              </span>
            )}
            {isTopDamage && (
              <span className="px-2 py-0.5 text-xs font-medium text-orange-400 rounded bg-orange-400/10">
                TOP DAMAGE
              </span>
            )}
          </div>

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
                className="block text-sm text-gray-400 hover:text-blue-400"
              >
                {attacker.corporation?.name || "Unknown"}
              </Link>
            </Tooltip>
          )}

          {attacker.allianceId && (
            <Tooltip content="Show Alliance Info">
              <Link
                href={`/alliances/${attacker.allianceId}`}
                className="block text-sm text-gray-400 hover:text-blue-400"
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
