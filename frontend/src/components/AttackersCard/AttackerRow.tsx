import { KillmailQuery } from "@/generated/graphql";
import Link from "next/link";
import Tooltip from "../Tooltip/Tooltip";

interface AttackerProps {
  attacker: NonNullable<KillmailQuery["killmail"]>["attackers"][0];
}

export default function AttackerRow({ attacker }: AttackerProps) {
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

        {/* Character Name */}
        <div className="flex-1 space-y-1">
          {attacker.characterId && (
            <Link
              href={`/characters/${attacker.characterId}`}
              className="block font-medium text-white hover:text-blue-400"
            >
              {attacker.character?.name || "Unknown"}
            </Link>
          )}

          <div className="flex items-center gap-4 text-xs text-red-400">
            <span>{attacker.damageDone.toLocaleString()} damage</span>
            {attacker.securityStatus !== null &&
              attacker.securityStatus !== undefined && (
                <span
                  className={
                    attacker.securityStatus >= 0
                      ? "text-green-500"
                      : "text-red-500"
                  }
                >
                  Sec: {attacker.securityStatus.toFixed(1)}
                </span>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
