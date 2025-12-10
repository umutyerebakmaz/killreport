import { UsersIcon } from "@heroicons/react/24/outline";
import Tooltip from "../Tooltip/Tooltip";

type TotalMemberBadgeProps = {
  count: number;
};

export default function TotalMemberBadge({ count }: TotalMemberBadgeProps) {
  return (
    <Tooltip content="Total Members" position="top">
      <div className="flex items-center gap-2">
        <UsersIcon className="w-5 h-5 text-blue-400" />
        <span className="text-sm font-medium text-blue-300">{count}</span>
      </div>
    </Tooltip>
  );
}
