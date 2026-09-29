import { CpuChipIcon, UserIcon, UsersIcon } from '@heroicons/react/16/solid';
import { attackerBadge } from '../KillmailsTable/attackerBadge';
import IconBadge from './IconBadge';

/**
 * Who killed it, as one badge: the killmail table's attackers cell at `sm`,
 * the killmail screen's attackers card heading at `md`.
 */
export default function AttackerBadge({
  solo,
  npc,
  attackerCount,
  size,
}: {
  solo: boolean;
  npc: boolean;
  attackerCount: number;
  size?: 'sm' | 'md';
}) {
  const badge = attackerBadge({ solo, npc });
  if (badge === 'solo')
    return (
      <IconBadge icon={UserIcon} size={size}>
        SOLO
      </IconBadge>
    );
  if (badge === 'npc')
    return (
      <IconBadge icon={CpuChipIcon} size={size}>
        NPC
      </IconBadge>
    );
  return (
    <IconBadge
      icon={badge === 'npc-count' ? CpuChipIcon : UsersIcon}
      size={size}
    >
      {attackerCount}
      <span className="sr-only">
        {badge === 'npc-count' ? ' NPC attackers' : ' attackers'}
      </span>
    </IconBadge>
  );
}
