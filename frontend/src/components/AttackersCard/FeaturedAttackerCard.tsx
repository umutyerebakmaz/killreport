import { KillmailQuery } from '@/generated/graphql';
import Link from 'next/link';
import Tooltip from '../Tooltip/Tooltip';
import EveImage from '../ui/EveImage';

interface FeaturedAttackerCardProps {
  attacker: NonNullable<KillmailQuery['killmail']>['attackers'][0];
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
      : '0.0';
  return (
    <div className="p-4 card">
      {/* Label */}
      <div className="px-3 py-1 text-sm font-medium text-center">{label}</div>

      {/* Character Portrait */}
      {attacker.character?.id && (
        <div className="relative mb-3">
          <Tooltip content={`Character: ${attacker.character?.name}`}>
            <EveImage
              kind="character"
              id={attacker.character.id}
              name={attacker.character.name || 'Character'}
              size={256}
              className="w-full"
            />
          </Tooltip>
          {/* Logos Container - Bottom Right */}
          <div className="absolute bottom-0 right-0 flex">
            {/* Corporation Logo */}
            {attacker.corporation?.id && (
              <Tooltip content={`Corporation: ${attacker.corporation?.name}`}>
                <EveImage
                  kind="corporation"
                  id={attacker.corporation.id}
                  name={attacker.corporation.name || 'Corporation'}
                  size={32}
                />
              </Tooltip>
            )}

            {/* Alliance Logo */}
            {attacker.alliance?.id && (
              <Tooltip content={`Alliance: ${attacker.alliance?.name}`}>
                <EveImage
                  kind="alliance"
                  id={attacker.alliance.id}
                  name={attacker.alliance.name || 'Alliance'}
                  size={32}
                />
              </Tooltip>
            )}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="pt-1 pb-4">
        <Link
          href={`/characters/${attacker.character?.id}`}
          className="block font-medium text-gray-400 hover:text-cyan-400"
          prefetch={false}
        >
          {attacker?.character?.name}
        </Link>
      </div>

      {/* Ship Type Image */}
      {attacker.shipType?.id && (
        <div className="flex gap-2">
          <Tooltip content={attacker.shipType?.name}>
            <EveImage
              kind="ship"
              id={attacker.shipType.id}
              name={attacker.shipType.name || 'Ship'}
              size={48}
            />
          </Tooltip>
        </div>
      )}

      {/* Weapon Type Image */}
      {attacker.weaponType?.id && (
        <div className="flex gap-2">
          <Tooltip content={attacker.weaponType?.name}>
            <img
              src={`https://images.evetech.net/types/${attacker.weaponType?.id}/icon?size=128`}
              alt={attacker.weaponType?.name || 'Weapon'}
              width={48}
              height={48}
              loading="lazy"
            />
          </Tooltip>
        </div>
      )}

      <div className="pt-4 mt-2 text-right border-t border-white/10">
        <div className="font-semibold text-destroyed">
          {attacker.damageDone.toLocaleString()}
        </div>
        <div className="text-sm text-gray-400">{damagePercentage}%</div>
      </div>
    </div>
  );
}
