import { StarIcon } from "@heroicons/react/24/outline";
import Tooltip from "../Tooltip/Tooltip";

type TotalCorporationBadgeProps = {
  count: number;
};

export default function TotalCorporationBadge({
  count,
}: TotalCorporationBadgeProps) {
  return (
    <Tooltip content="Total Corporations" position="top">
      <div className="flex items-center gap-2">
        <StarIcon className="w-5 h-5 text-yellow-500" />
        <span className="text-sm font-medium text-yellow-500">{count}</span>
      </div>
    </Tooltip>
  );
}
