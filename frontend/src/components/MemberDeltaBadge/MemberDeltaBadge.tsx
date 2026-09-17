import { ArrowTrendingUpIcon } from '@heroicons/react/24/outline';
import Tooltip from '../Tooltip/Tooltip';

type MemberDeltaBadgeProps = {
  memberDelta: number | null;
  memberGrowthRate: number | null;
};

export default function MemberDeltaBadge({
  memberDelta,
  memberGrowthRate,
}: MemberDeltaBadgeProps) {
  // Delta rengi belirle
  // Every caller renders this inside a .card (bg-surface): EVE's red measures
  // 3.93:1 there, under the 4.5 body-text floor, accepted per the spec.
  const deltaColor =
    memberDelta && memberDelta >= 0 ? 'text-success' : 'text-red-400';
  // Tooltip içeriği
  const tooltipContent =
    memberDelta !== null
      ? `Member Change (7 Days): ${memberDelta >= 0 ? '+' : ''}${memberDelta}${
          memberGrowthRate !== null
            ? ` (${memberGrowthRate >= 0 ? '+' : ''}${memberGrowthRate.toFixed(
                1,
              )}%)`
            : ''
        }`
      : 'No data available';
  return (
    <Tooltip content={tooltipContent} position="top">
      <div className="flex items-center gap-2">
        <ArrowTrendingUpIcon
          className={`w-5 h-5 ${
            memberDelta !== null ? deltaColor : 'text-ink-faint'
          }`}
        />
        <span
          className={`text-sm font-medium ${
            memberDelta !== null ? deltaColor : 'text-ink-faint'
          }`}
        >
          {memberDelta !== null ? (
            <>
              {memberDelta >= 0 ? '+' : ''}
              {memberDelta}
            </>
          ) : (
            'N/A'
          )}
        </span>
      </div>
    </Tooltip>
  );
}
