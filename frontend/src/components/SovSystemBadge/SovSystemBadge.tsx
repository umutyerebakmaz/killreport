import { GlobeAltIcon } from '@heroicons/react/24/outline';
import Tooltip from '../Tooltip/Tooltip';

type SovSystemBadgeProps = {
  count: number;
};

export default function SovSystemBadge({ count }: SovSystemBadgeProps) {
  return (
    <Tooltip content="Sovereignty Systems" position="top">
      <div className="flex items-center gap-2">
        <GlobeAltIcon className="w-5 h-5 text-emerald-400" />
        <span className="text-sm font-medium text-emerald-300">{count}</span>
      </div>
    </Tooltip>
  );
}
