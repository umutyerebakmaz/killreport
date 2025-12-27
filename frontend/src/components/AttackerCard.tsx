import Link from "next/link";

interface Attacker {
  characterId?: number | null;
  corporationId?: number | null;
  allianceId?: number | null;
  shipTypeId?: number | null;
  weaponTypeId?: number | null;
  damageDone: number;
  finalBlow: boolean;
  securityStatus?: number | null;
  character?: {
    id: number;
    name: string;
  } | null;
  corporation?: {
    id: number;
    name: string;
    ticker?: string | null;
  } | null;
  alliance?: {
    id: number;
    name: string;
    ticker?: string | null;
  } | null;
  shipType?: {
    id: number;
    name: string;
  } | null;
  weaponType?: {
    id: number;
    name: string;
  } | null;
}

interface AttackerCardProps {
  attacker: Attacker;
}

export default function AttackerCard({ attacker }: AttackerCardProps) {
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

      <div className="space-y-1">
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
          <div className="text-sm text-gray-500">{attacker.shipType.name}</div>
        )}

        {attacker.weaponType && (
          <div className="text-xs text-gray-600">
            Weapon: {attacker.weaponType.name}
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
  );
}
