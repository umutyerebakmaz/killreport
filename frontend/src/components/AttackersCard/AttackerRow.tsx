import { KillmailQuery } from "@/generated/graphql";
import Link from "next/link";

interface AttackerProps {
  attacker: NonNullable<KillmailQuery["killmail"]>["attackers"][0];
}

export default function AttackerRow({ attacker }: AttackerProps) {
  return (
    <div
      className={`p-3 rounded-lg ${
        attacker.finalBlow
          ? "bg-green-400/10 inset-ring inset-ring-green-400/20"
          : "bg-white/5"
      }`}
    >
      {attacker.finalBlow && (
        <div className="mb-2">
          <span className="px-2 py-1 text-xs font-medium text-green-400 rounded bg-green-400/20">
            FINAL BLOW
          </span>
        </div>
      )}

      <div className="flex gap-3">
        {/* Character Image */}
        {attacker.characterId && (
          <div className="relative shrink-0">
            <img
              src={`https://images.evetech.net/characters/${attacker.characterId}/portrait?size=64`}
              alt={attacker.character?.name || "Character"}
              width={64}
              height={64}
              className="rounded shadow-md"
              loading="lazy"
            />

            {/* Logos Container - Bottom Right */}
            <div className="absolute bottom-0 right-0 flex gap-0.5">
              {/* Corporation Logo */}
              {attacker.corporationId && (
                <img
                  src={`https://images.evetech.net/corporations/${attacker.corporationId}/logo?size=32`}
                  alt={attacker.corporation?.name || "Corporation"}
                  width={20}
                  height={20}
                  className="rounded shadow-md bg-black/50 ring-1 ring-black/50"
                  loading="lazy"
                />
              )}

              {/* Alliance Logo */}
              {attacker.allianceId && (
                <img
                  src={`https://images.evetech.net/alliances/${attacker.allianceId}/logo?size=32`}
                  alt={attacker.alliance?.name || "Alliance"}
                  width={20}
                  height={20}
                  className="rounded shadow-md bg-black/50 ring-1 ring-black/50"
                  loading="lazy"
                />
              )}
            </div>
          </div>
        )}

        {/* Ship Type Image */}
        {attacker.shipTypeId && (
          <div className="shrink-0">
            <img
              src={`https://images.evetech.net/types/${attacker.shipTypeId}/render?size=64`}
              alt={attacker.shipType?.name || "Ship"}
              width={64}
              height={64}
              className="rounded shadow-md"
              loading="lazy"
            />
          </div>
        )}

        <div className="flex-1 space-y-1">
          {attacker.character && (
            <Link
              href={`/characters/${attacker.characterId}`}
              className="block font-medium text-white hover:text-blue-400"
            >
              {attacker.character.name}
            </Link>
          )}

          {attacker.corporation && (
            <Link
              href={`/corporations/${attacker.corporationId}`}
              className="block text-sm text-gray-400 hover:text-blue-400"
            >
              {attacker.corporation.name}
            </Link>
          )}

          {attacker.alliance && (
            <Link
              href={`/alliances/${attacker.allianceId}`}
              className="block text-xs text-gray-500 hover:text-blue-400"
            >
              {attacker.alliance.name}
              {attacker.alliance.ticker && (
                <span className="ml-1">&lt;{attacker.alliance.ticker}&gt;</span>
              )}
            </Link>
          )}

          {attacker.shipType && (
            <div className="text-sm font-medium text-gray-400">
              {attacker.shipType.name}
            </div>
          )}

          {attacker.weaponType && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <img
                src={`https://images.evetech.net/types/${attacker.weaponTypeId}/icon?size=32`}
                alt={attacker.weaponType.name}
                width={16}
                height={16}
                className="inline"
                loading="lazy"
              />
              {attacker.weaponType.name}
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-gray-500">
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
