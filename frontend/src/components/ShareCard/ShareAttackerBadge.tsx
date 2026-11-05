import { attackerBadge } from '@/components/KillmailsTable/attackerBadge';
import { SHARE } from '@/lib/shareCard/palette';
import { CpuChipIcon, UserIcon, UsersIcon } from '@heroicons/react/16/solid';

const ICONS = {
  solo: UserIcon,
  count: UsersIcon,
  npc: CpuChipIcon,
  'npc-count': CpuChipIcon,
} as const;

/** The footer's attackers badge: IconBadge at card scale, one grey. */
export default function ShareAttackerBadge({
  solo,
  npc,
  attackerCount,
}: {
  solo: boolean;
  npc: boolean;
  attackerCount: number;
}) {
  const kind = attackerBadge({ solo, npc });
  const Icon = ICONS[kind];
  const label =
    kind === 'solo' ? 'SOLO' : kind === 'npc' ? 'NPC' : String(attackerCount);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        border: `2px solid ${SHARE.faint}`,
        fontSize: 28,
        fontWeight: 500,
        lineHeight: '40px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 10,
          paddingRight: 10,
          background: SHARE.faint,
        }}
      >
        <Icon width={24} height={24} fill={SHARE.ground} />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 14,
          paddingRight: 14,
          color: SHARE.faint,
        }}
      >
        {label}
      </div>
    </div>
  );
}
