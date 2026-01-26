import { KillmailQuery } from "@/generated/graphql";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import Tooltip from "../Tooltip/Tooltip";

interface AttackerProps {
  attacker: NonNullable<KillmailQuery["killmail"]>["attackers"][0];
  totalDamage: number;
  isFinalBlow?: boolean;
  isTopDamage?: boolean;
  killmail: NonNullable<KillmailQuery["killmail"]>;
}

export default function AttackerRow({
  attacker,
  totalDamage,
  isFinalBlow,
  isTopDamage,
  killmail,
}: AttackerProps) {
  const damagePercentage =
    totalDamage > 0
      ? ((attacker.damageDone / totalDamage) * 100).toFixed(1)
      : "0.0";

  // Use backend-computed fields
  const isSolo = killmail.isSoloKill;
  const isNpcAttackers = killmail.hasNpcAttackers;

  // Check if attacker is NPC (no character but has corporation)
  const isNPC = !attacker.character?.id && attacker.corporation?.id;
  // NPC corporations have IDs < 2000000
  const isNPCCorporation =
    attacker.corporation?.id && attacker.corporation.id < 2000000;

  return (
    <div className="p-3 bg-white/5">
      <div className="flex">
        {/* Character/Corporation Image */}
        {attacker.character?.id ? (
          <div className="relative shrink-0">
            <img
              src={`https://images.evetech.net/characters/${attacker.character?.id}/portrait?size=128`}
              alt={attacker.character?.name || "Character"}
              width={96}
              height={96}
              className="shadow-md"
              loading="lazy"
            />
            {/* Security Status - Bottom Left */}
            {attacker.securityStatus !== null &&
              attacker.securityStatus !== undefined && (
                <div className="absolute bottom-0 left-0 px-1.5 py-0.5 text-xs font-semibold bg-black/70 backdrop-blur-sm">
                  <span
                    className={
                      attacker.securityStatus >= 0
                        ? "text-green-500"
                        : "text-red-500"
                    }
                  >
                    {attacker.securityStatus.toFixed(1)}
                  </span>
                </div>
              )}
            {/* Logos Container - Bottom Right */}
            <div className="absolute bottom-0 right-0 flex">
              {/* Corporation Logo */}
              {attacker.corporation?.id && (
                <Tooltip
                  content={`Corporation: ${
                    attacker.corporation?.name || "Unknown"
                  }`}
                >
                  <img
                    src={`https://images.evetech.net/corporations/${attacker.corporation?.id}/logo?size=64`}
                    alt={attacker.corporation?.name || "Corporation"}
                    width={24}
                    height={24}
                    className="shadow-md bg-black/50 ring-1 ring-black/50"
                    loading="lazy"
                  />
                </Tooltip>
              )}

              {/* Alliance Logo */}
              {attacker.alliance?.id && (
                <Tooltip
                  content={`Alliance: ${attacker.alliance?.name || "Unknown"}`}
                >
                  <img
                    src={`https://images.evetech.net/alliances/${attacker.alliance?.id}/logo?size=64`}
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
        ) : isNPC && isNPCCorporation ? (
          <div className="relative shrink-0">
            <img
              src={`https://images.evetech.net/corporations/${attacker.corporation?.id}/logo?size=128`}
              alt={attacker.corporation?.name || "NPC Corporation"}
              width={96}
              height={96}
              className="shadow-md"
              loading="lazy"
            />
          </div>
        ) : null}

        <div className="flex flex-col pr-4 shrink-0">
          <Tooltip content={attacker.shipType?.name || "Unknown Ship"}>
            {attacker.shipType?.id ? (
              <img
                src={`https://images.evetech.net/types/${attacker.shipType?.id}/render?size=64`}
                alt={attacker.shipType?.name || "Ship"}
                width={48}
                height={48}
                className="shadow-md"
                loading="lazy"
              />
            ) : (
              <div className="flex items-center justify-center shadow-md size-12">
                <QuestionMarkCircleIcon className="w-8 h-8 text-gray-400" />
              </div>
            )}
          </Tooltip>
          <Tooltip content={attacker.weaponType?.name || "Unknown Weapon"}>
            {attacker.weaponType?.id ? (
              <img
                src={`https://images.evetech.net/types/${attacker.weaponType?.id}/icon?size=64`}
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

        <div className="flex justify-between w-full">
          {/* Character Name, Corporation, Alliance */}
          <div className="flex flex-col">
            {/* Badges for Final Blow, Top Damage, Solo, and NPC */}
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
              {isSolo && (
                <span className="px-2 py-0.5 text-xs font-medium text-purple-400 rounded bg-purple-400/10">
                  SOLO KILL
                </span>
              )}
              {isNpcAttackers && (
                <span className="px-2 py-0.5 text-xs font-medium text-red-400 rounded bg-red-400/10">
                  NPC
                </span>
              )}
            </div>

            {attacker.character?.id ? (
              <>
                <Tooltip content="Show Character Info">
                  <Link
                    href={`/characters/${attacker.character?.id}`}
                    className="font-medium text-gray-400 hover:text-blue-400"
                    prefetch={false}
                  >
                    {attacker.character?.name || "Unknown"}
                  </Link>
                </Tooltip>
                {attacker.corporation?.id && (
                  <Tooltip content="Show Corporation Info">
                    <Link
                      href={`/corporations/${attacker.corporation?.id}`}
                      className="text-sm text-gray-400 hover:text-blue-400"
                      prefetch={false}
                    >
                      {attacker.corporation?.name || "Unknown"}
                    </Link>
                  </Tooltip>
                )}
              </>
            ) : (
              <>
                {/* NPC attacker: Show ship type name and corporation */}
                {attacker.shipType?.name && (
                  <div className="font-medium text-gray-400">
                    {attacker.shipType.name}
                  </div>
                )}
                {attacker.corporation?.id && (
                  <Tooltip content="Show Corporation Info">
                    <Link
                      href={`/corporations/${attacker.corporation.id}`}
                      className="text-sm text-gray-400 hover:text-blue-400"
                      prefetch={false}
                    >
                      {attacker.corporation?.name || "Unknown"}
                    </Link>
                  </Tooltip>
                )}
              </>
            )}

            {attacker.alliance?.id && (
              <Tooltip content="Show Alliance Info">
                <Link
                  href={`/alliances/${attacker.alliance?.id}`}
                  className="text-sm text-gray-400 hover:text-blue-400"
                  prefetch={false}
                >
                  {attacker.alliance?.name || "Unknown"}
                </Link>
              </Tooltip>
            )}
          </div>

          {/* Damage, Damage Percentage */}
          <div className="flex flex-col items-end justify-center text-sm gap-y-1">
            <span className="text-red-400">
              {attacker.damageDone.toLocaleString()} DMG
            </span>
            <span className="text-gray-400">{damagePercentage}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
